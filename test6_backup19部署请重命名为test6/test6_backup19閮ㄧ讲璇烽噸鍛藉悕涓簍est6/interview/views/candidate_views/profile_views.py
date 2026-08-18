from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
import json

from ...models import Candidate, Volunteer, Interviewer

DEPARTMENT_CHOICES = [
    {'value': 'BGS', 'label': '办公'},
    {'value': 'XCB', 'label': '信传'},
    {'value': 'QYB', 'label': '权益'},
    {'value': 'XSB', 'label': '学实'},
    {'value': 'WYB', 'label': '文艺'},
    {'value': 'TYB', 'label': '体育'},
]

TRACETRACK_CHOICES = [
    {'value': 'POL', 'label': '破浪赛道'},
    {'value': 'ZHU', 'label': '逐浪赛道'},
]

ADJUSTABLE_CHOICES = [
    {'value': 'Y', 'label': '是'},
    {'value': 'N', 'label': '否'},
]


@login_required
def profile_view(request):
    """个人中心页面视图"""
    return render(request, 'candidate/profile.html')


# profile_views.py - 修复后的 update_profile

@login_required
@csrf_exempt
@transaction.atomic
def update_profile(request):
    """更新个人资料（包含志愿信息）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        user = request.user
        candidate = Candidate.objects.get(user=user)

        # 检查是否为multipart/form-data（包含文件上传）
        content_type = request.content_type or ''
        is_multipart = 'multipart/form-data' in content_type

        if is_multipart:
            # 处理文件上传 - 从 request.POST 和 request.FILES 获取数据
            data = {}
            for key, value in request.POST.items():
                data[key] = value

            # 处理头像上传
            if 'avatar' in request.FILES:
                avatar_file = request.FILES['avatar']
                # 验证文件类型
                import imghdr
                file_type = imghdr.what(avatar_file)
                if file_type not in ['jpeg', 'png', 'jpg']:
                    return JsonResponse({'success': False, 'message': '仅支持 jpeg/jpg/png 格式的图片'})
                # 验证文件大小（限制3MB）
                if avatar_file.size > 3 * 1024 * 1024:
                    return JsonResponse({'success': False, 'message': '图片大小不能超过3MB'})

                # 删除旧头像（如果有）
                if candidate.avatar:
                    candidate.avatar.delete(save=False)

                # 保存新头像
                candidate.avatar = avatar_file

                # 生成文件名：用户名+学号
                ext = avatar_file.name.split('.')[-1]
                new_filename = f"{user.username}_{candidate.student_number}.{ext}"
                candidate.avatar.name = f"avatar/{new_filename}"
                candidate.save()  # 先保存头像字段
            elif request.POST.get('remove_avatar') == 'true':
                # 如果前端传了 remove_avatar 参数，删除头像
                if candidate.avatar:
                    candidate.avatar.delete(save=False)
                    candidate.avatar = None
                    candidate.save()
        else:
            # JSON 格式请求
            data = json.loads(request.body)

        # 更新基本信息（从 data 中获取）
        candidate.name = data.get('name', candidate.name)
        candidate.gender = data.get('gender', candidate.gender)
        candidate.political_status = data.get('political_status', candidate.political_status)
        candidate.school = data.get('school', candidate.school)
        candidate.homeroom = data.get('homeroom', candidate.homeroom)
        candidate.telephone = data.get('telephone', candidate.telephone)
        candidate.qq_id = data.get('qq_id', candidate.qq_id)
        candidate.wx_id = data.get('wx_id', candidate.wx_id)
        candidate.email = data.get('email', candidate.email)
        candidate.character = data.get('character', candidate.character)
        candidate.introduction = data.get('introduction', candidate.introduction)
        candidate.experience = data.get('experience', candidate.experience)
        candidate.honor = data.get('honor', candidate.honor)
        candidate.racetrack = data.get('racetrack', candidate.racetrack)
        candidate.adjustable = data.get('adjustable', candidate.adjustable)

        if candidate.status == Candidate.Status.INCOMPLETE:
            candidate.status = Candidate.Status.REGISTERED
        # 检查状态：只有未完善或已报名状态才能修改
        if candidate.status not in [Candidate.Status.INCOMPLETE, Candidate.Status.REGISTERED]:
            return JsonResponse({
                'success': False,
                'message': f'当前状态为 {candidate.get_status_display()}，无法修改个人信息。志愿信息已更新。'
            })
        elif candidate.status == Candidate.Status.REGISTERED:
            for vol in candidate.volunteers.all():
                if vol.status not in [Volunteer.Status.FILLED, None]:
                    return JsonResponse({
                        'success': False,
                        'message': f'面试流程中，无法修改个人信息。志愿信息已更新。'
                    })

        # 保存基本信息
        candidate.save()

        # ========== 处理志愿更新 ==========
        # 从 data 中获取 volunteers 数据（可能是 JSON 字符串）
        volunteers_data = data.get('volunteers', [])
        if isinstance(volunteers_data, str):
            try:
                volunteers_data = json.loads(volunteers_data)
            except json.JSONDecodeError:
                volunteers_data = []

        racetrack = data.get('racetrack', candidate.racetrack)

        if volunteers_data and isinstance(volunteers_data, list):
            # 验证志愿数据 - 至少有一个志愿
            if racetrack == Candidate.RaceTrack.POL:
                valid_departments = ['BGS', 'QYB', 'XSB']  # 办公、权益、学实
            elif racetrack == Candidate.RaceTrack.ZHU:
                valid_departments = ['XCB', 'WYB', 'TYB']  # 信传、文艺、体育
            else:
                valid_departments = ['BGS', 'QYB', 'XSB', 'XCB', 'WYB', 'TYB']

            # 过滤掉空部门，检查是否有至少一个有效志愿
            valid_volunteers = [v for v in volunteers_data if v.get('department')]

            # 至少需要有一个志愿
            if len(valid_volunteers) == 0:
                return JsonResponse({'success': False, 'message': '请至少填报一个志愿'})

            # 检查当前表单中是否有重复部门（排除空值）
            depts = [v.get('department') for v in volunteers_data if v.get('department')]
            if len(depts) != len(set(depts)):
                return JsonResponse({'success': False, 'message': '志愿部门不能重复'})

            # 获取当前所有志愿
            existing_volunteers = {v.id: v for v in candidate.volunteers.all()}
            updated_ids = set()

            for vol_data in volunteers_data:
                vol_id = vol_data.get('id')
                priority = vol_data.get('priority', 1)
                department = vol_data.get('department')

                # 如果部门为空，跳过（不创建/更新）
                if not department:
                    continue

                # 验证部门是否有效
                if department not in valid_departments:
                    return JsonResponse({
                        'success': False,
                        'message': f'无效的部门: {department}；或当前赛道不允许选择 "{department}" 部门，请调整赛道或志愿'
                    })

                if vol_id and vol_id in existing_volunteers:
                    # 更新已有志愿
                    volunteer = existing_volunteers[vol_id]
                    # 如果志愿正在排队或已面试，不能修改部门
                    if volunteer.is_in_queue() or (volunteer.status and volunteer.status not in ['FILLED', 'WAITING']):
                        # 如果部门发生了变化，报错
                        if department != volunteer.department:
                            return JsonResponse({
                                'success': False,
                                'message': f'志愿 "{volunteer.get_department_display()}" 正在排队或已面试，不能修改'
                            })
                    else:
                        # 可以修改
                        volunteer.department = department
                        volunteer.priority = priority
                        # 如果状态是 WAITING 但不在排队中，重置为 FILLED
                        if volunteer.status == 'WAITING' and not volunteer.is_in_queue():
                            volunteer.status = Volunteer.Status.FILLED
                        volunteer.save()
                    updated_ids.add(vol_id)
                else:
                    # 创建新志愿（先检查是否已存在该部门的志愿）
                    existing = candidate.volunteers.filter(department=department).first()
                    if existing:
                        # 如果已存在，更新优先级
                        existing.priority = priority
                        # 如果状态是 WAITING 但不在排队中，重置为 FILLED
                        if existing.status == 'WAITING' and not existing.is_in_queue():
                            existing.status = Volunteer.Status.FILLED
                        existing.save()
                        updated_ids.add(existing.id)
                    else:
                        volunteer = Volunteer.objects.create(
                            candidate=candidate,
                            department=department,
                            priority=priority,
                            status=Volunteer.Status.FILLED  # 默认已填报状态
                        )
                        updated_ids.add(volunteer.id)

            # 删除被移除的志愿（只能删除未在排队且状态为FILLED的）
            for vol_id, volunteer in existing_volunteers.items():
                if vol_id not in updated_ids:
                    if volunteer.is_in_queue():
                        return JsonResponse({
                            'success': False,
                            'message': f'志愿 "{volunteer.get_department_display()}" 正在排队中，不能删除'
                        })
                    if volunteer.status != Volunteer.Status.FILLED:
                        return JsonResponse({
                            'success': False,
                            'message': f'志愿 "{volunteer.get_department_display()}" 已面试，不能删除'
                        })
                    volunteer.delete()

            # 重新整理优先级（确保从1开始连续）
            all_vols = candidate.volunteers.all().order_by('priority')
            for idx, vol in enumerate(all_vols, start=1):
                if vol.priority != idx:
                    vol.priority = idx
                    vol.save()

        return JsonResponse({
            'success': True,
            'message': '个人信息更新成功'
        })

    except Candidate.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户信息不存在'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'更新失败：{str(e)}'})


@login_required
def get_profile(request):
    """获取个人资料（包含志愿信息）"""
    try:
        user = request.user
        candidate = Candidate.objects.get(user=user)

        # 获取志愿信息
        volunteers = candidate.volunteers.all().order_by('priority')
        volunteer_list = []
        for vol in volunteers:
            volunteer_list.append({
                'id': vol.id,
                'department': vol.department,
                'department_display': vol.get_department_display(),
                'priority': vol.priority,
                'status': vol.status if vol.status not in ['ACCEPTED', 'REJECTED'] else 'COMPLETED',
                'status_display': vol.get_status_display() if vol.status not in ['ACCEPTED', 'REJECTED'] else '已完成',
                'queue_start_time': vol.queue_start_time.isoformat() if vol.queue_start_time else None,
                'is_in_queue': vol.is_in_queue(),
                'queue_duration': vol.get_queue_duration() if vol.is_in_queue() else 0,
            })

        # 补全缺失的志愿（最多3个）
        existing_priorities = [v['priority'] for v in volunteer_list]
        for i in range(1, 4):
            if i not in existing_priorities:
                volunteer_list.append({
                    'id': None,
                    'department': None,
                    'department_display': None,
                    'priority': i,
                    'status': None,
                    'status_display': None,
                    'queue_start_time': None,
                    'is_in_queue': False,
                    'queue_duration': 0,
                })

        # 按优先级排序
        volunteer_list.sort(key=lambda x: x['priority'])

        avatar_url = None
        avatar_thumbnail_url = None
        if candidate.avatar and hasattr(candidate.avatar, 'url'):
            avatar_url = candidate.avatar.url
            if candidate.avatar_thumbnail and hasattr(candidate.avatar_thumbnail, 'url'):
                avatar_thumbnail_url = candidate.avatar_thumbnail.url
            else:
                avatar_thumbnail_url = avatar_url

        data = {
            'username': user.username,
            'name': candidate.name,
            'gender': candidate.gender,
            'gender_display': candidate.get_gender_display(),
            'political_status': candidate.political_status,
            'school': candidate.school,
            'school_display': candidate.get_school_display(),
            'homeroom': candidate.homeroom,
            'telephone': candidate.telephone,
            'student_number': candidate.student_number,
            'qq_id': candidate.qq_id,
            'wx_id': candidate.wx_id,
            'email': candidate.email,
            'character': candidate.character,
            'introduction': candidate.introduction,
            'experience': candidate.experience,
            'honor': candidate.honor,
            'status': candidate.status,
            'status_display': candidate.get_status_display(),
            'volunteers': volunteer_list,
            'department_choices': DEPARTMENT_CHOICES,
            'racetrack_choices': TRACETRACK_CHOICES,
            'adjustable_choices': ADJUSTABLE_CHOICES,
            'racetrack': candidate.racetrack,
            'racetrack_display': candidate.get_racetrack_display(),
            'adjustable': candidate.adjustable,
            'adjustable_display': candidate.get_adjustable_display(),
            'avatar_url': avatar_url,
            'avatar_thumbnail_url': avatar_thumbnail_url,
        }

        return JsonResponse({'success': True, 'data': data})

    except Candidate.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户信息不存在'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'获取信息失败：{str(e)}'})


@login_required
@csrf_exempt
def volunteer_action(request):
    """志愿操作：开始排队、取消排队、重新排队"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)
        volunteer_id = data.get('volunteer_id')
        action = data.get('action')

        if not volunteer_id:
            return JsonResponse({'success': False, 'message': '缺少志愿ID'})

        volunteer = Volunteer.objects.get(id=volunteer_id)

        # 验证该志愿属于当前用户
        if volunteer.candidate.user != request.user:
            return JsonResponse({'success': False, 'message': '无权操作此志愿'})

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
                    'message': '您已有其他志愿在排队中，不能同时排队多个志愿'
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
                    'candidate_status': candidate.status,
                    'candidate_status_display': candidate.get_status_display(),
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
                    'candidate_status': candidate.status,
                    'candidate_status_display': candidate.get_status_display(),
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
                    'message': '您已有其他志愿在排队中，不能同时排队多个志愿'
                })
            '''

            volunteer.requeue()

            candidate = volunteer.candidate
            candidate.status = 'WAITING'
            candidate.save()

            return JsonResponse({
                'success': True,
                'message': '重新排队成功',
                'data': {
                    'id': volunteer.id,
                    'status': volunteer.status,
                    'status_display': volunteer.get_status_display(),
                    'queue_start_time': volunteer.queue_start_time.isoformat() if volunteer.queue_start_time else None,
                    'is_in_queue': volunteer.is_in_queue(),
                    'candidate_status': candidate.status,
                    'candidate_status_display': candidate.get_status_display(),
                }
            })

        else:
            return JsonResponse({'success': False, 'message': '无效的操作'})

    except Volunteer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '志愿不存在'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})