# dashboard_views.py - 修改部门筛选逻辑

from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import json

from ..permission import (
    subadmin_required,
    department_permission_required,
    admin_required,
)
from ...models import Candidate, Volunteer, InterviewerScore, Interviewer, InterviewGroup, CandidateInGroup


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def subadmin_console_view(request, department=None):
    """部门管理员仪表板视图"""
    # 获取当前用户的部门
    user_department = None
    if hasattr(request.user, 'interviewer') and request.user.interviewer:
        user_department = request.user.interviewer.department

    # 获取部门显示名称
    dept_display = dict(Interviewer.Department.choices).get(department, '')

    return render(request, 'subaddmin/subaddmin_console.html', {
        'user_department': user_department,
        'user_department_display': dept_display,
        'is_subadmin': True,
    })


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_candidates(request, department=None):
    """获取面试者列表（部门管理员）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        # 获取筛选参数
        search = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '')
        # 部门固定为当前用户的部门，不允许修改
        filter_department = department

        if department == 'ALL':
            return JsonResponse({'success': False, 'message': '主管理员无访问权限'})

        if not filter_department:
            return JsonResponse({'success': False, 'message': '未指定部门'})

        # 获取所有面试者，筛选有该部门志愿的
        candidates = Candidate.objects.filter(
            volunteers__department=filter_department
        ).distinct().prefetch_related(
            'volunteers',
            'scores__interviewer',
            'candidateingroup_set__group'
        )

        # 搜索筛选
        if search:
            candidates = candidates.filter(
                Q(name__icontains=search) |
                Q(student_number__icontains=search) |
                Q(telephone__icontains=search)
            )

        # 状态筛选（面试者状态）
        if status_filter:
            candidates = candidates.filter(status=status_filter)

        # 构建数据
        candidate_list = []
        for candidate in candidates:
            # 获取该部门的志愿信息
            dept_volunteers = candidate.volunteers.filter(department=filter_department)
            volunteer_info = []
            for vol in dept_volunteers:
                volunteer_info.append({
                    'id': vol.id,
                    'department': vol.department,
                    'department_display': vol.get_department_display(),
                    'status': vol.status,
                    'status_display': vol.get_status_display(),
                    'priority': vol.priority,
                    'status_color': get_volunteer_status_color(vol.status),
                })

            # 获取所有志愿（显示用）
            all_volunteers = candidate.volunteers.all().order_by('priority')
            all_volunteer_info = []
            for vol in all_volunteers:
                all_volunteer_info.append({
                    'id': vol.id,
                    'department': vol.department,
                    'department_display': vol.get_department_display(),
                    'status': vol.status,
                    'status_display': vol.get_status_display(),
                    'priority': vol.priority,
                    'status_color': get_volunteer_status_color(vol.status),
                })

            # 计算平均分
            scores = candidate.scores.exclude(score=0)
            avg_score = 0
            if scores:
                total = sum(float(s.score) for s in scores)
                avg_score = round(total / len(scores), 2)

            # 获取面试状态
            status_display = candidate.get_status_display() if candidate.status else '未完善'

            # 获取该部门志愿的状态（用于操作按钮判断）
            dept_vol_status = None
            dept_vol_id = None
            if dept_volunteers.exists():
                dept_vol = dept_volunteers.order_by('priority').first()
                dept_vol_status = dept_vol.status
                dept_vol_id = dept_vol.id

            candidate_list.append({
                'id': candidate.id,
                'name': candidate.name,
                'student_number': candidate.student_number,
                'gender': candidate.get_gender_display(),
                'school': candidate.get_school_display(),
                'school_code': candidate.school,
                'telephone': candidate.telephone,
                'email': candidate.email,
                'qq_id': candidate.qq_id,
                'wx_id': candidate.wx_id,
                'political_status': candidate.political_status,
                'homeroom': candidate.homeroom,
                'character': candidate.character,
                'introduction': candidate.introduction,
                'experience': candidate.experience,
                'honor': candidate.honor,
                'racetrack': candidate.get_racetrack_display(),
                'adjustable': candidate.get_adjustable_display(),
                'status': candidate.status,
                'status_display': status_display,
                'avg_score': avg_score,
                'volunteers': all_volunteer_info,
                'dept_volunteer': volunteer_info[0] if volunteer_info else None,
                'dept_volunteer_status': dept_vol_status,
                'dept_volunteer_id': dept_vol_id,
                'created_at': candidate.created_at.isoformat() if candidate.created_at else None,
                'avatar_url': candidate.avatar.url if candidate.avatar else None,
                'avatar_thumbnail_url': candidate.avatar_thumbnail.url if candidate.avatar_thumbnail else None,
            })

        # 排序逻辑：按分数降序
        def get_sort_key(item):
            score = item.get('avg_score', 0)
            return -score

        candidate_list.sort(key=get_sort_key)

        # 分页
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))

        total = len(candidate_list)
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

        start = (page - 1) * page_size
        end = start + page_size
        page_data = candidate_list[start:end]

        return JsonResponse({
            'success': True,
            'data': page_data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


def get_volunteer_status_color(status):
    """获取志愿状态对应的颜色"""
    color_map = {
        'ACCEPTED': 'green',
        'REJECTED': 'red',
        'FILLED': 'blue',
        'WAITING': 'blue',
        'INQUEUE': 'blue',
        'INTERVIEWING': 'blue',
        'COMPLETED': 'blue',
    }
    return color_map.get(status, 'blue')


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_volunteer_accept(request, department=None):
    """批量接受志愿"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)
        candidate_ids = data.get('candidate_ids', [])
        # 使用当前用户的部门，不允许修改
        filter_department = department

        if not filter_department:
            return JsonResponse({'success': False, 'message': '未指定部门'})

        if not candidate_ids:
            return JsonResponse({'success': False, 'message': '请选择至少一位面试者'})

        results = []
        success_count = 0
        fail_count = 0

        for candidate_id in candidate_ids:
            try:
                candidate = Candidate.objects.get(id=candidate_id)
                # 获取该部门下该候选人的志愿
                dept_volunteers = candidate.volunteers.filter(department=filter_department)

                if not dept_volunteers.exists():
                    results.append({
                        'candidate_id': candidate_id,
                        'name': candidate.name,
                        'success': False,
                        'message': '该面试者没有本部门志愿'
                    })
                    fail_count += 1
                    continue

                # 取优先级最高的该部门志愿
                volunteer = dept_volunteers.order_by('priority').first()

                # 检查是否可以接受：只有已完成或拒绝可以改为接受
                if volunteer.status not in [Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED]:
                    results.append({
                        'candidate_id': candidate_id,
                        'name': candidate.name,
                        'success': False,
                        'message': f'当前志愿状态为 {volunteer.get_status_display()}，无法接受'
                    })
                    fail_count += 1
                    continue

                # 执行接受
                volunteer.status = Volunteer.Status.ACCEPTED
                volunteer.save()

                # 更新候选人状态
                candidate.status = Candidate.Status.COMPLETED
                candidate.save()

                results.append({
                    'candidate_id': candidate_id,
                    'name': candidate.name,
                    'success': True,
                    'message': '接受成功'
                })
                success_count += 1

            except Candidate.DoesNotExist:
                results.append({
                    'candidate_id': candidate_id,
                    'success': False,
                    'message': '面试者不存在'
                })
                fail_count += 1
            except Exception as e:
                results.append({
                    'candidate_id': candidate_id,
                    'success': False,
                    'message': str(e)
                })
                fail_count += 1

        return JsonResponse({
            'success': True,
            'data': {
                'results': results,
                'success_count': success_count,
                'fail_count': fail_count,
                'total': len(candidate_ids)
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_volunteer_reject(request, department=None):
    """批量拒绝志愿"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)
        candidate_ids = data.get('candidate_ids', [])
        # 使用当前用户的部门，不允许修改
        filter_department = department

        if not filter_department:
            return JsonResponse({'success': False, 'message': '未指定部门'})

        if not candidate_ids:
            return JsonResponse({'success': False, 'message': '请选择至少一位面试者'})

        results = []
        success_count = 0
        fail_count = 0

        for candidate_id in candidate_ids:
            try:
                candidate = Candidate.objects.get(id=candidate_id)
                # 获取该部门下该候选人的志愿
                dept_volunteers = candidate.volunteers.filter(department=filter_department)

                if not dept_volunteers.exists():
                    results.append({
                        'candidate_id': candidate_id,
                        'name': candidate.name,
                        'success': False,
                        'message': '该面试者没有本部门志愿'
                    })
                    fail_count += 1
                    continue

                # 取优先级最高的该部门志愿
                volunteer = dept_volunteers.order_by('priority').first()

                # 检查是否可以拒绝：只有已完成或接受可以改为拒绝
                if volunteer.status not in [Volunteer.Status.COMPLETED, Volunteer.Status.ACCEPTED]:
                    results.append({
                        'candidate_id': candidate_id,
                        'name': candidate.name,
                        'success': False,
                        'message': f'当前志愿状态为 {volunteer.get_status_display()}，无法拒绝'
                    })
                    fail_count += 1
                    continue

                # 执行拒绝
                volunteer.status = Volunteer.Status.REJECTED
                volunteer.save()

                results.append({
                    'candidate_id': candidate_id,
                    'name': candidate.name,
                    'success': True,
                    'message': '拒绝成功'
                })
                success_count += 1

            except Candidate.DoesNotExist:
                results.append({
                    'candidate_id': candidate_id,
                    'success': False,
                    'message': '面试者不存在'
                })
                fail_count += 1
            except Exception as e:
                results.append({
                    'candidate_id': candidate_id,
                    'success': False,
                    'message': str(e)
                })
                fail_count += 1

        return JsonResponse({
            'success': True,
            'data': {
                'results': results,
                'success_count': success_count,
                'fail_count': fail_count,
                'total': len(candidate_ids)
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_volunteer_single_action(request, candidate_id, department=None):
    """单个志愿操作（接受/拒绝）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)
        action = data.get('action')
        # 使用当前用户的部门，不允许修改
        filter_department = department

        if not filter_department:
            return JsonResponse({'success': False, 'message': '未指定部门'})

        if action not in ['accept', 'reject']:
            return JsonResponse({'success': False, 'message': '无效的操作'})

        try:
            candidate = Candidate.objects.get(id=candidate_id)
        except Candidate.DoesNotExist:
            return JsonResponse({'success': False, 'message': '面试者不存在'})

        # 获取该部门下该候选人的志愿
        dept_volunteers = candidate.volunteers.filter(department=filter_department)

        if not dept_volunteers.exists():
            return JsonResponse({'success': False, 'message': '该面试者没有本部门志愿'})

        volunteer = dept_volunteers.order_by('priority').first()

        if action == 'accept':
            if volunteer.status not in [Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED]:
                return JsonResponse({
                    'success': False,
                    'message': f'当前志愿状态为 {volunteer.get_status_display()}，无法接受'
                })
            volunteer.status = Volunteer.Status.ACCEPTED
            candidate.status = Candidate.Status.COMPLETED
        else:  # reject
            if volunteer.status not in [Volunteer.Status.COMPLETED, Volunteer.Status.ACCEPTED]:
                return JsonResponse({
                    'success': False,
                    'message': f'当前志愿状态为 {volunteer.get_status_display()}，无法拒绝'
                })
            volunteer.status = Volunteer.Status.REJECTED

        volunteer.save()
        candidate.save()

        return JsonResponse({
            'success': True,
            'message': '操作成功',
            'data': {
                'volunteer_status': volunteer.status,
                'volunteer_status_display': volunteer.get_status_display(),
                'candidate_status': candidate.status,
                'candidate_status_display': candidate.get_status_display(),
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


def get_client_ip(request):
    """获取客户端IP地址"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip