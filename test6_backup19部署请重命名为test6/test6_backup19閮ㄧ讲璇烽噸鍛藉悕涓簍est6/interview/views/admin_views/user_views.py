import json
from django.shortcuts import render
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from ...models import User, Candidate, Interviewer, UserProfile, Volunteer

from ..permission import (
    admin_required,
)

@admin_required(return_json=True)
def admin_users_view(request):
    """管理员用户管理视图"""
    is_superuser = request.user.is_superuser
    is_admin = False
    if hasattr(request.user, 'profile') and request.user.profile:
        is_admin = request.user.profile.role == ROLE_ADMIN

    return render(request, 'addmin/addmin_users.html', {
        'is_superuser': is_superuser,
        'is_admin': is_admin,
    })

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

# 权限等级选项（用于下拉列表）
ROLE_CHOICES = [
    {'value': ROLE_SUPER_ADMIN, 'label': '超级管理员'},
    {'value': ROLE_ADMIN, 'label': '主管理员'},
    {'value': ROLE_SUBADMIN, 'label': '部门管理员'},
    {'value': ROLE_INTERVIEWER, 'label': '面试官'},
    {'value': ROLE_CANDIDATE, 'label': '面试者'},
    {'value': ROLE_GUEST, 'label': '访客'},
]

# 部门选项
DEPARTMENT_CHOICES = [
    {'value': 'BGS', 'label': '办公'},
    {'value': 'XCB', 'label': '信传'},
    {'value': 'QYB', 'label': '权益'},
    {'value': 'XSB', 'label': '学实'},
    {'value': 'WYB', 'label': '文艺'},
    {'value': 'TYB', 'label': '体育'},
    {'value': 'UNK', 'label': '未知'},
]

# 面试状态选项
CANDIDATE_STATUS_CHOICES = [
    {'value': 'INCOMPLETE', 'label': '未完善'},
    {'value': 'REGISTERED', 'label': '已报名'},
    {'value': 'WAITING', 'label': '候场中'},
    {'value': 'INQUEUE', 'label': '队列中'},
    {'value': 'INTERVIEWING', 'label': '面试中'},
    {'value': 'COMPLETED', 'label': '已完成'},
]

# 志愿状态选项
VOLUNTEER_STATUS_CHOICES = [
    {'value': 'FILLED', 'label': '已填报'},
    {'value': 'WAITING', 'label': '排队中'},
    {'value': 'INQUEUE', 'label': '队列中'},
    {'value': 'INTERVIEWING', 'label': '面试中'},
    {'value': 'COMPLETED', 'label': '已完成'},
    {'value': 'REJECTED', 'label': '已淘汰'},
    {'value': 'ACCEPTED', 'label': '已录取'},
]



@csrf_exempt
@admin_required(return_json=True)
def api_admin_users(request):
    """获取用户列表"""
    if request.method == 'GET':
        users = User.objects.all().select_related('profile', 'candidate', 'interviewer')

        # 预加载志愿信息
        users = users.prefetch_related('candidate__volunteers')

        search = request.GET.get('search', '')
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(candidate__name__icontains=search) |
                Q(candidate__student_number__icontains=search) |
                Q(candidate__telephone__icontains=search) |
                Q(interviewer__name__icontains=search)
            )

        role = request.GET.get('role', '')
        if role:
            users = users.filter(profile__role=role)

        department = request.GET.get('department', '')
        if department:
            # 面试者：通过志愿部门筛选（或的关系，填报了该部门即算）
            candidate_users = User.objects.filter(
                candidate__volunteers__department=department
            ).distinct()
            # 面试官：通过面试官部门筛选
            interviewer_users = User.objects.filter(
                interviewer__department=department
            )
            users = users.filter(Q(id__in=candidate_users) | Q(id__in=interviewer_users))

        all_data = []
        for user in users:
            user_role = ROLE_GUEST
            if hasattr(user, 'profile') and user.profile:
                user_role = user.profile.role or ROLE_GUEST
            elif user.is_superuser:
                user_role = ROLE_SUPER_ADMIN

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
                    'qq_id': candidate.qq_id,
                    'wx_id': candidate.wx_id,
                    'email': candidate.email,
                    'status': status_value,
                    'status_display': status_display,
                    'volunteer_1': volunteer_info.get('volunteer_1'),
                    'volunteer_2': volunteer_info.get('volunteer_2'),
                    'volunteer_3': volunteer_info.get('volunteer_3'),
                }
            elif hasattr(user, 'interviewer') and user.interviewer:
                interviewer = user.interviewer
                display_name = interviewer.name
                department_display = interviewer.get_department_display()
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

        sort_field = request.GET.get('sort', 'id')
        sort_order = request.GET.get('order', 'asc')
        reverse = sort_order == 'desc'

        if sort_field == 'display_name':
            all_data = sorted(all_data, key=lambda x: x.get('display_name', ''), reverse=reverse)
        elif sort_field == 'department':
            all_data = sorted(all_data, key=lambda x: x.get('department', ''), reverse=reverse)
        else:
            all_data = sorted(all_data, key=lambda x: x.get(sort_field, ''), reverse=reverse)

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
@admin_required(return_json=True)
def api_admin_user_detail(request, user_id):
    """获取/更新用户详情"""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户不存在'})

    profile, created = UserProfile.objects.get_or_create(user=user)

    if user.is_superuser and profile.role != ROLE_SUPER_ADMIN:
        profile.role = ROLE_SUPER_ADMIN
        profile.save()

    if request.method == 'GET':
        display_name = user.username
        candidate_info = None
        interviewer_info = None
        status_display = '/'
        status_value = None

        if hasattr(user, 'candidate') and user.candidate:
            candidate = user.candidate
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
                'qq_id': candidate.qq_id,
                'wx_id': candidate.wx_id,
                'email': candidate.email,
                'status': status_value,
                'status_display': status_display,
                'volunteer_1': volunteer_info.get('volunteer_1'),
                'volunteer_2': volunteer_info.get('volunteer_2'),
                'volunteer_3': volunteer_info.get('volunteer_3'),
            }
        elif hasattr(user, 'interviewer') and user.interviewer:
            interviewer = user.interviewer
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

        user_role = profile.role or ROLE_GUEST
        if user.is_superuser:
            user_role = ROLE_SUPER_ADMIN

        data = {
            'id': user.id,
            'username': user.username,
            'display_name': display_name,
            'role': user_role,
            'role_display': ROLE_DISPLAY.get(user_role, user_role or '未知'),
            'is_active': user.is_active,
            'status': status_display,
            'status_value': status_value,
            'candidate': candidate_info,
            'interviewer': interviewer_info,
        }
        return JsonResponse({'success': True, 'data': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            current_user_role = ROLE_GUEST
            if hasattr(request.user, 'profile') and request.user.profile:
                current_user_role = request.user.profile.role
            if request.user.is_superuser:
                current_user_role = ROLE_SUPER_ADMIN

            if current_user_role not in [ROLE_SUPER_ADMIN, ROLE_ADMIN]:
                return JsonResponse({'success': False, 'message': '没有权限修改用户权限'})

            # 修改权限
            role = data.get('role')
            if role is not None:
                if user_id == request.user.id:
                    return JsonResponse({'success': False, 'message': '不能修改自己的权限等级'})

                valid_roles = [r['value'] for r in ROLE_CHOICES]
                if role not in valid_roles:
                    return JsonResponse({'success': False, 'message': '无效的权限等级'})

                target_user_role = profile.role or ROLE_GUEST
                if target_user_role in [ROLE_SUPER_ADMIN, ROLE_ADMIN] and current_user_role != ROLE_SUPER_ADMIN:
                    return JsonResponse({'success': False, 'message': '只有超级管理员可以修改管理员权限'})

                if user.is_superuser and request.user.id != user_id:
                    return JsonResponse({'success': False, 'message': '不能修改其他超级管理员的权限'})

                profile.role = role
                profile.save()

                if role == ROLE_SUPER_ADMIN:
                    user.is_superuser = True
                    user.is_staff = True
                elif role == ROLE_ADMIN:
                    user.is_staff = True
                else:
                    user.is_staff = False
                user.save()

            # 修改激活状态
            is_active = data.get('is_active')
            if is_active is not None:
                if current_user_role != ROLE_SUPER_ADMIN:
                    return JsonResponse({'success': False, 'message': '只有超级管理员可以修改激活状态'})

                if user_id == request.user.id:
                    return JsonResponse({'success': False, 'message': '不能停用自己'})
                user.is_active = is_active
                user.save()

            return JsonResponse({'success': True, 'message': '更新成功'})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'success': False, 'message': str(e)})

    return JsonResponse({'success': False, 'message': '请求方法错误'})


@csrf_exempt
@admin_required(return_json=True)
def api_admin_user_reset_password(request, user_id):
    """重置用户密码"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户不存在'})

    user_role = ROLE_GUEST
    if hasattr(user, 'profile') and user.profile:
        user_role = user.profile.role or ROLE_GUEST
    if user.is_superuser:
        user_role = ROLE_SUPER_ADMIN

    if user_role == ROLE_SUPER_ADMIN and not request.user.is_superuser:
        return JsonResponse({'success': False, 'message': '没有权限重置超级管理员密码'})

    try:
        data = json.loads(request.body)
        new_password = data.get('new_password', '').strip()
        if not new_password or len(new_password) < 6:
            return JsonResponse({'success': False, 'message': '密码长度至少6位'})

        user.set_password(new_password)
        user.save()
        return JsonResponse({'success': True, 'message': '密码重置成功'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@admin_required(return_json=True)
def api_admin_user_options(request):
    """获取用户管理所需的选项数据"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        return JsonResponse({
            'success': True,
            'roles': ROLE_CHOICES,
            'departments': DEPARTMENT_CHOICES,
            'candidate_statuses': CANDIDATE_STATUS_CHOICES,
            'volunteer_statuses': VOLUNTEER_STATUS_CHOICES,
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取选项失败：{str(e)}'
        })


@csrf_exempt
@admin_required(return_json=True)
def api_admin_volunteer_action(request, volunteer_id):
    """处理志愿操作：开始排队、取消排队、重新排队"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        volunteer = Volunteer.objects.get(id=volunteer_id)
    except Volunteer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '志愿不存在'})

    try:
        # 从请求体中获取 action
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