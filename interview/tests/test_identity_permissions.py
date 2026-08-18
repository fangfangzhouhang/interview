from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from types import SimpleNamespace

from interview.models import Candidate, Interviewer, InterviewGroup, UserProfile
from interview.permissions.permissions import PermissionChecker
from interview.permissions.roles import Role, RoleManager
from interview.wss_api.workflow_services import InterviewService


TEST_PASSWORD = 'StrongPass123!'


class IdentityFlowTests(TestCase):
    def registration_payload(self, role, username, student_number):
        payload = {
            'role': role,
            'username': username,
            'password': TEST_PASSWORD,
            'confirm_password': TEST_PASSWORD,
            'name': username,
            'gender': 'M',
            'political_status': '群众',
            'telephone': '13800000000',
            'student_number': student_number,
            'homeroom': '测试班级',
        }
        if role == 'candidate':
            payload['school'] = 'XX'
        else:
            payload['department'] = 'BGS'
        return payload

    def test_candidate_registration_and_login_use_profile_role(self):
        response = self.client.post(
            reverse('register'),
            self.registration_payload('candidate', 'candidate_test', '26000001'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])

        user = User.objects.get(username='candidate_test')
        self.assertEqual(user.profile.role, Role.CANDIDATE.value)
        self.assertTrue(Candidate.objects.filter(user=user).exists())

        response = self.client.post(reverse('login'), {
            'username': 'candidate_test',
            'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], Role.CANDIDATE.value)
        self.assertEqual(response.json()['redirect_url'], reverse('profile'))

    def test_interviewer_registration_and_login_use_profile_role(self):
        response = self.client.post(
            reverse('register'),
            self.registration_payload('interviewer', 'interviewer_test', '26000002'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])

        user = User.objects.get(username='interviewer_test')
        self.assertEqual(user.profile.role, Role.INTERVIEWER.value)
        self.assertTrue(Interviewer.objects.filter(user=user).exists())

        response = self.client.post(reverse('login'), {
            'username': 'interviewer_test',
            'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], Role.INTERVIEWER.value)
        self.assertEqual(response.json()['redirect_url'], reverse('interviewer_panel'))

    def test_business_record_does_not_override_profile_role(self):
        user = User.objects.create_user('legacy_guest', password=TEST_PASSWORD)
        UserProfile.objects.create(user=user, role=Role.GUEST.value)
        Interviewer.objects.create(
            user=user,
            name='Legacy Guest',
            gender='M',
            political_status='群众',
            department='BGS',
            homeroom='测试班级',
            telephone='13800000001',
            student_number='26000003',
        )

        self.assertEqual(RoleManager.get_user_role(user), Role.GUEST)

        response = self.client.post(reverse('login'), {
            'username': 'legacy_guest',
            'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 403)

    def test_management_login_redirects_use_profile_role(self):
        expected_redirects = {
            Role.SUBADMIN: reverse('subadmin_console'),
            Role.ADMIN: reverse('admin_console'),
            Role.SUPER_ADMIN: reverse('admin_console'),
        }

        for index, (role, redirect_url) in enumerate(expected_redirects.items(), start=1):
            username = f'{role.value}_test'
            user = User.objects.create_user(username, password=TEST_PASSWORD)
            UserProfile.objects.create(user=user, role=role.value)

            response = self.client.post(reverse('login'), {
                'username': username,
                'password': TEST_PASSWORD,
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['role'], role.value)
            self.assertEqual(response.json()['redirect_url'], redirect_url)
            self.client.logout()

    def test_invalid_role_details_do_not_leave_partial_accounts(self):
        interviewer_payload = self.registration_payload(
            'interviewer',
            'invalid_interviewer',
            '26000008',
        )
        interviewer_payload['department'] = 'UNK'
        response = self.client.post(reverse('register'), interviewer_payload)
        self.assertFalse(response.json()['success'])
        self.assertFalse(User.objects.filter(username='invalid_interviewer').exists())

        candidate_payload = self.registration_payload(
            'candidate',
            'invalid_candidate',
            '26000009',
        )
        candidate_payload['school'] = 'UN'
        response = self.client.post(reverse('register'), candidate_payload)
        self.assertFalse(response.json()['success'])
        self.assertFalse(User.objects.filter(username='invalid_candidate').exists())


class PermissionBoundaryTests(TestCase):
    def create_user(self, username, role):
        user = User.objects.create_user(username, password=TEST_PASSWORD)
        UserProfile.objects.create(user=user, role=role.value)
        return user

    def test_anonymous_html_redirects_to_login(self):
        response = self.client.get(reverse('interviewer_panel'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)

    def test_anonymous_api_returns_json_403(self):
        response = self.client.get(reverse('api-interviewer-groups'))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json()['code'], 403)

    def test_wrong_role_html_returns_html_403(self):
        candidate = self.create_user('candidate_boundary', Role.CANDIDATE)
        self.client.force_login(candidate)

        response = self.client.get(reverse('interviewer_panel'))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response['Content-Type'].startswith('text/html'))

    def test_wrong_role_api_returns_json_403(self):
        candidate = self.create_user('candidate_api_boundary', Role.CANDIDATE)
        self.client.force_login(candidate)

        response = self.client.get(reverse('api-interviewer-groups'))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response.json()['code'], 403)

    def test_business_record_cannot_bypass_workflow_identity_gate(self):
        candidate = self.create_user('candidate_with_interviewer_record', Role.CANDIDATE)
        interviewer_record = Interviewer.objects.create(
            user=candidate,
            name='Candidate With Interviewer Record',
            gender='M',
            political_status='群众',
            department='BGS',
            homeroom='测试班级',
            telephone='13800000006',
            student_number='26000010',
        )
        group = InterviewGroup.objects.create(
            departments='BGS',
            group_id='identity-gate-test',
        )
        group.interviewers.add(interviewer_record)

        self.assertFalse(InterviewService.check_user_permission(candidate, group.id))
        detail, error = InterviewService.get_group_detail(candidate, group.id)
        self.assertIsNone(detail)
        self.assertEqual(error, '您没有面试工作流权限')

    def test_candidate_pages_require_candidate_role(self):
        candidate = self.create_user('candidate_page', Role.CANDIDATE)
        self.client.force_login(candidate)
        self.assertEqual(self.client.get(reverse('profile')).status_code, 200)
        self.client.logout()

        interviewer = self.create_user('interviewer_candidate_page', Role.INTERVIEWER)
        self.client.force_login(interviewer)
        self.assertEqual(self.client.get(reverse('profile')).status_code, 403)

    def test_management_pages_use_profile_role(self):
        admin = self.create_user('admin_page', Role.ADMIN)
        self.client.force_login(admin)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 200)
        self.client.logout()

        subadmin = self.create_user('subadmin_page', Role.SUBADMIN)
        self.client.force_login(subadmin)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 403)

    def test_subadmin_candidate_scope_requires_matching_department(self):
        subadmin = self.create_user('subadmin_scope', Role.SUBADMIN)
        Interviewer.objects.create(
            user=subadmin,
            name='Subadmin Scope',
            gender='M',
            political_status='群众',
            department='BGS',
            homeroom='测试班级',
            telephone='13800000002',
            student_number='26000004',
        )

        same_department = SimpleNamespace(group=SimpleNamespace(departments='BGS'))
        other_department = SimpleNamespace(group=SimpleNamespace(departments='XCB'))

        self.assertTrue(
            PermissionChecker.check_candidate_in_group_permission(
                subadmin,
                same_department,
            )
        )
        self.assertFalse(
            PermissionChecker.check_candidate_in_group_permission(
                subadmin,
                other_department,
            )
        )

    def test_core_page_status_matrix(self):
        self.assertEqual(self.client.get(reverse('login')).status_code, 200)
        self.assertEqual(self.client.get(reverse('register')).status_code, 200)

        candidate = self.create_user('candidate_matrix', Role.CANDIDATE)
        Candidate.objects.create(
            user=candidate,
            name='Candidate Matrix',
            gender='M',
            political_status='群众',
            school='XX',
            homeroom='测试班级',
            telephone='13800000003',
            student_number='26000005',
        )
        self.client.force_login(candidate)
        self.assertEqual(self.client.get(reverse('profile')).status_code, 200)
        self.assertEqual(self.client.get(reverse('queue')).status_code, 200)
        self.assertEqual(self.client.get(reverse('api-profile')).status_code, 200)
        self.assertEqual(self.client.get(reverse('interviewer_panel')).status_code, 403)
        self.assertEqual(self.client.get(reverse('subadmin_console')).status_code, 403)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 403)
        self.client.logout()

        interviewer = self.create_user('interviewer_matrix', Role.INTERVIEWER)
        Interviewer.objects.create(
            user=interviewer,
            name='Interviewer Matrix',
            gender='M',
            political_status='群众',
            department='BGS',
            homeroom='测试班级',
            telephone='13800000004',
            student_number='26000006',
        )
        self.client.force_login(interviewer)
        self.assertEqual(self.client.get(reverse('interviewer_panel')).status_code, 200)
        self.assertEqual(self.client.get(reverse('interviewer_profile')).status_code, 200)
        self.assertEqual(self.client.get(reverse('interviewer_panel_groups')).status_code, 200)
        interviewer_api = self.client.get(reverse('api-interviewer-groups'))
        self.assertEqual(interviewer_api.status_code, 200)
        self.assertTrue(interviewer_api.json()['success'])
        self.assertEqual(self.client.get(reverse('profile')).status_code, 403)
        self.assertEqual(self.client.get(reverse('subadmin_console')).status_code, 403)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 403)
        self.client.logout()

        subadmin = self.create_user('subadmin_matrix', Role.SUBADMIN)
        Interviewer.objects.create(
            user=subadmin,
            name='Subadmin Matrix',
            gender='M',
            political_status='群众',
            department='BGS',
            homeroom='测试班级',
            telephone='13800000005',
            student_number='26000007',
        )
        self.client.force_login(subadmin)
        for url_name in ('subadmin_console', 'subadmin_users', 'subadmin_scores'):
            self.assertEqual(self.client.get(reverse(url_name)).status_code, 200)
        self.assertEqual(self.client.get(reverse('profile')).status_code, 403)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 403)
        self.client.logout()

        admin = self.create_user('admin_matrix', Role.ADMIN)
        self.client.force_login(admin)
        for url_name in ('admin_console', 'admin_users', 'admin_scores'):
            self.assertEqual(self.client.get(reverse(url_name)).status_code, 200)
        self.assertEqual(self.client.get(reverse('subadmin_console')).status_code, 200)
        self.client.logout()

        super_admin = self.create_user('super_admin_matrix', Role.SUPER_ADMIN)
        self.client.force_login(super_admin)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 200)
        self.client.logout()

        guest = self.create_user('guest_matrix', Role.GUEST)
        self.client.force_login(guest)
        self.assertEqual(self.client.get(reverse('profile')).status_code, 403)
        self.assertEqual(self.client.get(reverse('interviewer_panel')).status_code, 403)
        self.assertEqual(self.client.get(reverse('subadmin_console')).status_code, 403)
        self.assertEqual(self.client.get(reverse('admin_console')).status_code, 403)
