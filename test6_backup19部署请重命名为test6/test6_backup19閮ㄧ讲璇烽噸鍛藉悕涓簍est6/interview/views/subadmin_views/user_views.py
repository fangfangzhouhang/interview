# interview/views/admin_views/user_views.py - subadmin 部分

import json
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from ...models import User, Candidate, Interviewer, UserProfile, Volunteer

from ..permission import (
    subadmin_required,
    department_permission_required,
)

# 权限等级常量
ROLE_SUPER_ADMIN = 'super_admin'
ROLE_ADMIN = 'admin'
ROLE_SUBADMIN = 'subadmin'
ROLE_INTERVIEWER = 'interviewer'
ROLE_CANDIDATE = 'candidate'
ROLE_GUEST = 'guest'

# 权限等级显示映射
ROLE_DISPLAY = {
    ROLE_SUPER_ADMIN: '超级管理员',
    ROLE_ADMIN: '主管理员',
    ROLE_SUBADMIN: '部门管理员',
    ROLE_INTERVIEWER: '面试官',
    ROLE_CANDIDATE: '面试者',
    ROLE_GUEST: '访客',
}

# 权限等级颜色映射
ROLE_COLOR = {
    ROLE_SUPER_ADMIN: 'role-superadmin',
    ROLE_ADMIN: 'role-admin',
    ROLE_SUBADMIN: 'role-subadmin',
    ROLE_INTERVIEWER: 'role-interviewer',
    ROLE_CANDIDATE: 'role-candidate',
    ROLE_GUEST: 'role-guest',
}

# 部门管理员可设置的角色
SUBADMIN_ALLOWED_ROLES = [
    ROLE_SUBADMIN,
    ROLE_INTERVIEWER,
    ROLE_CANDIDATE,
    ROLE_GUEST,
]

# 部门选项
DEPARTMENT_CHOICES = [
    {'value': 'BGS', 'label': '办公'},
    {'value': 'XCB', 'label': '信传'},
    {'value': 'QYB', 'label': '权益'},
    {'value': 'XSB', 'label': '学实'},
    {'value': 'WYB', 'label': '文艺'},
    {'value': 'TYB', 'label': '体育'},
]

# 面试状态选项
CANDIDATE_STATUS_CHOICES = [
    {'value': 'INCOMPLETE', 'label': '未完善'},
    {'value': 'REGISTERED', 'label': '已报名'},
    {'value': 'INUQEUE', 'label': '队列中'},
    {'value': 'WAITING', 'label': '候场中'},
    {'value': 'INTERVIEWING', 'label': '面试中'},
    {'value': 'COMPLETED', 'label': '已完成'},
]

# 志愿状态选项
VOLUNTEER_STATUS_CHOICES = [
    {'value': 'FILLED', 'label': '已填报'},
    {'value': 'WAITING', 'label': '排队中'},
    {'value': 'INTERVIEWING', 'label': '面试中'},
    {'value': 'COMPLETED', 'label': '已完成'},
    {'value': 'REJECTED', 'label': '已淘汰'},
    {'value': 'ACCEPTED', 'label': '已录取'},
]


def _get_user_department(user):
    """获取用户的部门"""
    if hasattr(user, 'interviewer') and user.interviewer:
        return user.interviewer.department
    return None


def _get_user_role(user):
    """获取用户角色"""
    if user.is_superuser:
        return ROLE_SUPER_ADMIN
    if hasattr(user, 'profile') and user.profile:
        return user.profile.role or ROLE_GUEST
    return ROLE_GUEST


@subadmin_required(return_json=True)
def subadmin_users_view(request):
    """部门管理员用户管理视图"""
    return render(request, 'subaddmin/subaddmin_users.html')


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_users(request, department=None):
    """获取用户列表 - 自动过滤只显示本部门用户"""
    if request.method == 'GET':
        current_user = request.user

        users = User.objects.all().select_related('profile', 'candidate', 'interviewer')
        users = users.prefetch_related('candidate__volunteers')

        # 只显示本部门的用户
        if department:
            if department != 'ALL':
                # 面试者：通过志愿部门筛选
                candidate_users = User.objects.filter(
                    candidate__volunteers__department=department
                ).distinct()
                # 面试官：通过面试官部门筛选
                interviewer_users = User.objects.filter(
                    interviewer__department=department
                )
                users = users.filter(Q(id__in=candidate_users) | Q(id__in=interviewer_users))
        else:
            users = users.none()

        # 搜索
        search = request.GET.get('search', '')
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(candidate__name__icontains=search) |
                Q(candidate__student_number__icontains=search) |
                Q(candidate__telephone__icontains=search) |
                Q(interviewer__name__icontains=search)
            )

        # 角色筛选
        role = request.GET.get('role', '')
        if role:
            users = users.filter(profile__role=role)

        all_data = []
        for user in users:
            user_role = _get_user_role(user)

            display_name = user.username
            department_display = '-'
            candidate_info = None
            interviewer_info = None
            status_display = '/'
            status_value = None

            if hasattr(user, 'candidate') and user.candidate:
                candidate = user.candidate
                display_name = candidate.name
                department_display = '/'

                # 获取面试状态
                status_value = candidate.status
                status_display = candidate.get_status_display() if candidate.status else '/'

                # 获取志愿信息 - 按优先级排序
                volunteers = candidate.volunteers.all().order_by('priority')

                # 初始化志愿字典，确保1、2、3都存在
                volunteer_info = {
                    'volunteer_1': None,
                    'volunteer_2': None,
                    'volunteer_3': None,
                }

                for vol in volunteers:
                    key = f'volunteer_{vol.priority}'
                    volunteer_info[key] = {
                        'id': vol.id,
                        'department': vol.department,
                        'department_display': vol.get_department_display(),
                        'status': vol.status,
                        'status_display': vol.get_status_display(),
                        'queue_start_time': vol.queue_start_time.isoformat() if vol.queue_start_time else None,
                        'is_in_queue': vol.is_in_queue(),
                        'queue_duration': vol.get_queue_duration() if vol.is_in_queue() else 0,
                    }

                candidate_info = {
                    'id': candidate.id,
                    'name': candidate.name,
                    'gender': candidate.get_gender_display(),
                    'gender_code': candidate.gender,
                    'political_status': candidate.political_status,
                    'school': candidate.get_school_display(),
                    'school_code': candidate.school,
                    'homeroom': candidate.homeroom,
                    'telephone': candidate.telephone,
                    'student_number': candidate.student_number,
                    'status': status_value,
                    'status_display': status_display,
                    'volunteer_1': volunteer_info.get('volunteer_1'),
                    'volunteer_2': volunteer_info.get('volunteer_2'),
                    'volunteer_3': volunteer_info.get('volunteer_3'),
                }
            elif hasattr(user, 'interviewer') and user.interviewer:
                interviewer = user.interviewer
                display_name = interviewer.name
                department_display = interviewer.get_department_display() or '-'
                status_display = '/'
                interviewer_info = {
                    'id': interviewer.id,
                    'name': interviewer.name,
                    'gender': interviewer.get_gender_display(),
                    'gender_code': interviewer.gender,
                    'student_number': interviewer.student_number,
                    'department': interviewer.get_department_display(),
                    'department_code': interviewer.department,
                    'homeroom': interviewer.homeroom,
                    'political_status': interviewer.political_status,
                    'telephone': interviewer.telephone,
                }
            role_display = ROLE_DISPLAY.get(user_role, user_role or '未知')
            role_color = ROLE_COLOR.get(user_role, 'role-guest')

            # 判断状态显示
            if user_role in [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SUBADMIN, ROLE_INTERVIEWER, ROLE_GUEST]:
                display_status = '/'
            else:
                display_status = status_display

            data_item = {
                'id': user.id,
                'username': user.username,
                'display_name': display_name,
                'department': department_display,
                'role': user_role,
                'role_display': role_display,
                'role_color': role_color,
                'is_active': user.is_active,
                'status': display_status,
                'status_value': status_value,
                'date_joined': user.date_joined.strftime('%Y-%m-%d %H:%M'),
                'last_login': user.last_login.strftime('%Y-%m-%d %H:%M') if user.last_login else '从未登录',
                'candidate': candidate_info,
                'interviewer': interviewer_info,
            }
            all_data.append(data_item)

        # 排序
        sort_field = request.GET.get('sort', 'id')
        sort_order = request.GET.get('order', 'asc')
        reverse = sort_order == 'desc'

        if sort_field == 'display_name':
            all_data = sorted(all_data, key=lambda x: x.get('display_name', ''), reverse=reverse)
        elif sort_field == 'department':
            all_data = sorted(all_data, key=lambda x: x.get('department', ''), reverse=reverse)
        else:
            all_data = sorted(all_data, key=lambda x: x.get(sort_field, ''), reverse=reverse)

        # 分页
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))

        total = len(all_data)
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

        start = (page - 1) * page_size
        end = start + page_size
        page_data = all_data[start:end]

        return JsonResponse({
            'success': True,
            'data': page_data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        })

    return JsonResponse({'success': False, 'message': '不支持的操作'})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_user_detail(request, user_id, department=None):
    """获取/更新用户详情（仅权限）"""
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户不存在'})

    # 验证该用户是否属于当前部门
    user_belongs_to_department = False
    if department == 'ALL':
        user_belongs_to_department = True
    elif department:
        if hasattr(target_user, 'interviewer') and target_user.interviewer:
            if target_user.interviewer.department == department:
                user_belongs_to_department = True
        elif hasattr(target_user, 'candidate') and target_user.candidate:
            # 检查候选人的志愿中是否有该部门
            if target_user.candidate.volunteers.filter(department=department).exists():
                user_belongs_to_department = True
    else:
        pass

    if not user_belongs_to_department:
        return JsonResponse({'success': False, 'message': '无权操作此用户'})

    profile, created = UserProfile.objects.get_or_create(user=target_user)

    if target_user.is_superuser and profile.role != ROLE_SUPER_ADMIN:
        profile.role = ROLE_SUPER_ADMIN
        profile.save()

    if request.method == 'GET':
        display_name = target_user.username
        candidate_info = None
        interviewer_info = None
        status_display = '/'
        status_value = None

        if hasattr(target_user, 'candidate') and target_user.candidate:
            candidate = target_user.candidate
            display_name = candidate.name
            status_value = candidate.status
            status_display = candidate.get_status_display() if candidate.status else '/'

            # 获取志愿信息 - 按优先级排序
            volunteers = candidate.volunteers.all().order_by('priority')

            # 初始化志愿字典，确保1、2、3都存在
            volunteer_info = {
                'volunteer_1': None,
                'volunteer_2': None,
                'volunteer_3': None,
            }

            for vol in volunteers:
                key = f'volunteer_{vol.priority}'
                volunteer_info[key] = {
                    'id': vol.id,
                    'department': vol.department,
                    'department_display': vol.get_department_display(),
                    'status': vol.status,
                    'status_display': vol.get_status_display(),
                    'queue_start_time': vol.queue_start_time.isoformat() if vol.queue_start_time else None,
                    'is_in_queue': vol.is_in_queue(),
                    'queue_duration': vol.get_queue_duration() if vol.is_in_queue() else 0,
                }

            candidate_info = {
                'id': candidate.id,
                'name': candidate.name,
                'gender': candidate.get_gender_display(),
                'gender_code': candidate.gender,
                'political_status': candidate.political_status,
                'school': candidate.get_school_display(),
                'school_code': candidate.school,
                'homeroom': candidate.homeroom,
                'telephone': candidate.telephone,
                'student_number': candidate.student_number,
                'status': status_value,
                'status_display': status_display,
                'volunteer_1': volunteer_info.get('volunteer_1'),
                'volunteer_2': volunteer_info.get('volunteer_2'),
                'volunteer_3': volunteer_info.get('volunteer_3'),
            }
        elif hasattr(target_user, 'interviewer') and target_user.interviewer:
            interviewer = target_user.interviewer
            display_name = interviewer.name
            interviewer_info = {
                'id': interviewer.id,
                'name': interviewer.name,
                'gender': interviewer.get_gender_display(),
                'gender_code': interviewer.gender,
                'student_number': interviewer.student_number,
                'department': interviewer.get_department_display(),
                'department_code': interviewer.department,
                'homeroom': interviewer.homeroom,
                'political_status': interviewer.political_status,
                'telephone': interviewer.telephone,
            }

        user_role = _get_user_role(target_user)

        data = {
            'id': target_user.id,
            'username': target_user.username,
            'display_name': display_name,
            'role': user_role,
            'role_display': ROLE_DISPLAY.get(user_role, user_role or '未知'),
            'is_active': target_user.is_active,
            'status': status_display,
            'status_value': status_value,
            'candidate': candidate_info,
            'interviewer': interviewer_info,
        }
        return JsonResponse({'success': True, 'data': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            # 获取当前用户的角色
            current_user_role = ROLE_GUEST
            if hasattr(request.user, 'profile') and request.user.profile:
                current_user_role = request.user.profile.role
            if request.user.is_superuser:
                current_user_role = ROLE_SUPER_ADMIN

            # 部门管理员权限检查
            if current_user_role != ROLE_SUBADMIN:
                return JsonResponse({'success': False, 'message': '没有权限修改用户权限'})

            role = data.get('role')
            if role is None:
                return JsonResponse({'success': False, 'message': '请指定权限等级'})

            # 1. 不能修改自己的权限
            if user_id == request.user.id:
                return JsonResponse({'success': False, 'message': '不能修改自己的权限等级'})

            # 2. 检查目标用户当前角色
            target_user_role = profile.role or ROLE_GUEST
            if target_user.is_superuser:
                target_user_role = ROLE_SUPER_ADMIN

            # 3. 部门管理员不能修改超级管理员和主管理员
            if target_user_role in [ROLE_SUPER_ADMIN, ROLE_ADMIN]:
                return JsonResponse(
                    {'success': False, 'message': f'不能修改{ROLE_DISPLAY.get(target_user_role, "管理员")}的权限'})

            # 4. 部门管理员不能修改其他部门管理员（同级）
            if target_user_role == ROLE_SUBADMIN:
                return JsonResponse({'success': False, 'message': '不能修改其他部门管理员的权限'})

            # 5. 验证新角色是否有效
            valid_roles = [ROLE_SUBADMIN, ROLE_INTERVIEWER, ROLE_CANDIDATE, ROLE_GUEST]
            if role not in valid_roles:
                return JsonResponse({'success': False, 'message': '无效的权限等级'})

            # 6. 不能将用户设置为部门管理员（部门管理员不能新增同级）
            if role == ROLE_SUBADMIN:
                return JsonResponse({'success': False, 'message': '不能将用户设置为部门管理员'})

            # 执行更新
            profile.role = role
            profile.save()

            # 如果设置为超级管理员，更新 is_superuser
            if role == ROLE_SUPER_ADMIN:
                target_user.is_superuser = True
                target_user.is_staff = True
                target_user.save()

            return JsonResponse({'success': True, 'message': '更新成功'})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'success': False, 'message': str(e)})

    return JsonResponse({'success': False, 'message': '请求方法错误'})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_user_options(request, department=None):
    """获取用户管理所需的选项数据"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        # 部门管理员只能看到部分角色选项
        subadmin_roles = [
            {'value': ROLE_SUBADMIN, 'label': '部门管理员'},
            {'value': ROLE_INTERVIEWER, 'label': '面试官'},
            {'value': ROLE_CANDIDATE, 'label': '面试者'},
            {'value': ROLE_GUEST, 'label': '访客'},
        ]

        return JsonResponse({
            'success': True,
            'roles': subadmin_roles,
            'departments': [dept for dept in DEPARTMENT_CHOICES if dept['value']==department] if department != 'ALL' else DEPARTMENT_CHOICES,
            'candidate_statuses': CANDIDATE_STATUS_CHOICES,
            'volunteer_statuses': VOLUNTEER_STATUS_CHOICES,
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取选项失败：{str(e)}'
        })

@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_volunteer_action(request, volunteer_id, department=None):
    """部门管理员处理志愿操作：开始排队、取消排队、重新排队"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        volunteer = Volunteer.objects.get(id=volunteer_id)
    except Volunteer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '志愿不存在'})

    # 获取当前用户的部门
    current_user = request.user

    # 验证该志愿是否属于当前部门
    if not department or volunteer.department != department and department != 'ALL':
        return JsonResponse({'success': False, 'message': '无权操作此志愿'})

    try:
        data = json.loads(request.body)
        action = data.get('action')

        if not action:
            return JsonResponse({'success': False, 'message': '缺少操作类型'})

        if action == 'start_queue':
            '''
            # 检查该候选人是否已有其他志愿在排队
            other_queuing = Volunteer.objects.filter(
                candidate=volunteer.candidate,
                status='WAITING'
            ).exclude(id=volunteer.id)

            if other_queuing.exists():
                return JsonResponse({
                    'success': False,
                    'message': '该面试者已有其他志愿在排队中，不能同时排队多个志愿'
                })
            '''

            volunteer.start_queue()

            # 更新候选人的面试状态
            candidate = volunteer.candidate
            has_queuing = Volunteer.objects.filter(
                candidate=candidate,
                status='INQUEUE'
            ).exists()
            if not has_queuing:
                candidate.status = 'WAITING'
            else:
                candidate.status = 'INQUEUE'
            candidate.save()

            return JsonResponse({
                'success': True,
                'message': '开始排队成功',
                'data': {
                    'id': volunteer.id,
                    'status': volunteer.status,
                    'status_display': volunteer.get_status_display(),
                    'queue_start_time': volunteer.queue_start_time.isoformat() if volunteer.queue_start_time else None,
                    'is_in_queue': volunteer.is_in_queue(),
                    'candidate_status': candidate.get_status_display(),
                }
            })

        elif action == 'cancel_queue':
            volunteer.cancel_queue()

            # 更新候选人的面试状态
            candidate = volunteer.candidate
            has_waiting = Volunteer.objects.filter(
                candidate=candidate,
                status='WAITING'
            ).exists()
            has_queuing = Volunteer.objects.filter(
                candidate=candidate,
                status='INQUEUE'
            ).exists()
            if not has_queuing:
                if not has_waiting:
                    candidate.status = 'REGISTERED'
                else:
                    candidate.status = 'WAITING'
            else:
                candidate.status = 'INQUEUE'
            candidate.save()

            return JsonResponse({
                'success': True,
                'message': '取消排队成功',
                'data': {
                    'id': volunteer.id,
                    'status': volunteer.status,
                    'status_display': volunteer.get_status_display(),
                    'queue_start_time': None,
                    'is_in_queue': False,
                    'candidate_status': candidate.get_status_display(),
                }
            })

        elif action == 'requeue':
            '''
            # 检查该候选人是否已有其他志愿在排队
            other_queuing = Volunteer.objects.filter(
                candidate=volunteer.candidate,
                status='WAITING'
            ).exclude(id=volunteer.id)

            if other_queuing.exists():
                return JsonResponse({
                    'success': False,
                    'message': '该面试者已有其他志愿在排队中，不能同时排队多个志愿'
                })
            '''

            volunteer.requeue()

            return JsonResponse({
                'success': True,
                'message': '重新排队成功',
                'data': {
                    'id': volunteer.id,
                    'status': volunteer.status,
                    'status_display': volunteer.get_status_display(),
                    'queue_start_time': volunteer.queue_start_time.isoformat() if volunteer.queue_start_time else None,
                    'is_in_queue': volunteer.is_in_queue(),
                    'candidate_status': volunteer.candidate.get_status_display(),
                }
            })

        else:
            return JsonResponse({'success': False, 'message': f'无效的操作: {action}'})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '请求数据格式错误'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'操作失败: {str(e)}'})