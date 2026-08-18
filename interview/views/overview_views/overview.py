import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Q

from ...models import (
    InterviewGroup, Interviewer, Candidate,
    InterviewerGroup, CandidateInGroup, Volunteer,
)
from ..permission import subadmin_required


@subadmin_required()
def overview_dashboard(request):
    """排队总览视图"""
    return render(request, 'overview/overview.html')


@csrf_exempt
@subadmin_required(return_json=True)
def api_overview_data(request):
    """获取总览数据（仅查询，不执行自动分组）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = build_overview_data()
        return JsonResponse({
            'success': True,
            'data': data,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
def api_auto_group(request):
    """仅执行自动分组，不返回卡片数据"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        result = perform_auto_grouping()
        return JsonResponse({
            'success': True,
            'message': result['message'],
            'created_groups': result.get('created_groups', 0),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
def api_manual_refresh(request):
    """
    手动刷新 - 执行自动分组 + 返回最新数据
    用于轮询和手动点击刷新按钮
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        # 1. 执行自动分组
        group_result = perform_auto_grouping()

        # 2. 获取最新数据
        data = build_overview_data()

        # 3. 附加自动分组结果
        data['auto_group_result'] = group_result

        return JsonResponse({
            'success': True,
            'data': data,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


# ==================== 数据构建函数 ====================

def build_overview_data():
    """构建总览数据"""
    departments = [
        {'code': 'BGS', 'name': '办公'},
        {'code': 'XCB', 'name': '信传'},
        {'code': 'QYB', 'name': '权益'},
        {'code': 'XSB', 'name': '学实'},
        {'code': 'WYB', 'name': '文艺'},
        {'code': 'TYB', 'name': '体育'},
    ]

    cards = []
    for dept in departments:
        card_data = build_department_card(dept['code'], dept['name'])
        cards.append(card_data)

    queue_stats = get_queue_stats()

    return {
        'cards': cards,
        'queue_stats': queue_stats,
        'last_updated': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
    }


def build_department_card(dept_code, dept_name):
    """构建单个部门卡片数据"""
    active_statuses = [
        InterviewGroup.Status.PENDING,
        InterviewGroup.Status.ONGOING,
        InterviewGroup.Status.PAUSE,
    ]

    groups = InterviewGroup.objects.filter(
        departments=dept_code,
        status__in=active_statuses
    ).prefetch_related('candidates__candidate').order_by('interview_date')

    status_order = {
        'PENDING': 0,
        'PAUSE': 1,
        'ONGOING': 2,
    }

    groups_list = []
    for group in groups:
        candidate_names = []
        for cig in group.candidates.all().order_by('order'):
            if cig.candidate:
                candidate_names.append(cig.candidate.name)

        groups_list.append({
            'id': group.id,
            'group_id': group.group_id or f'第{group.id}场',
            'status': group.status,
            'status_display': group.get_status_display(),
            'status_order': status_order.get(group.status, 3),
            'candidate_names': candidate_names,
            'candidate_count': len(candidate_names),
            'interview_date': group.interview_date.strftime('%Y-%m-%d %H:%M'),
            'start_time': group.start_time.strftime('%Y-%m-%d %H:%M') if group.start_time else None,
        })

    groups_list.sort(key=lambda x: (x['status_order'], x['interview_date']))

    return {
        'department_code': dept_code,
        'department_name': dept_name,
        'groups': groups_list,
        'total_groups': len(groups_list),
        'total_candidates': sum(g['candidate_count'] for g in groups_list),
    }


def get_queue_stats():
    """获取各部门队列统计"""
    departments = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB']
    stats = []

    for dept in departments:
        waiting_count = Volunteer.objects.filter(
            department=dept,
            status=Volunteer.Status.WAITING
        ).count()

        inqueue_count = Volunteer.objects.filter(
            department=dept,
            status=Volunteer.Status.INQUEUE
        ).count()

        completed_count = Volunteer.objects.filter(
            department=dept,
            status=Volunteer.Status.COMPLETED
        ).count()

        stats.append({
            'department_code': dept,
            'department_name': dict(Interviewer.Department.choices).get(dept, dept),
            'waiting_count': waiting_count,
            'inqueue_count': inqueue_count,
            'completed_count': completed_count,
            'total': waiting_count + inqueue_count + completed_count,
        })

    return stats


# ==================== 自动分组函数 ====================

def perform_auto_grouping():
    """执行自动分组逻辑"""
    created_groups = 0
    created_group_ids = []

    # 获取所有启用中的面试官组
    active_groups = InterviewerGroup.objects.filter(
        status=InterviewerGroup.Status.ONUSE
    ).select_related('chief').prefetch_related('members')

    if not active_groups.exists():
        return {
            'success': False,
            'message': '没有启用中的面试官组',
            'created_groups': 0,
        }

    # 获取所有待开始的场次中已分配的面试官ID
    pending_groups = InterviewGroup.objects.filter(
        status=InterviewGroup.Status.PENDING
    )
    busy_interviewer_ids = set()
    for group in pending_groups:
        for interviewer in group.interviewers.all():
            busy_interviewer_ids.add(interviewer.id)

    # 找出空闲的面试官组
    free_groups = []
    for group in active_groups:
        group_member_ids = set(group.members.values_list('id', flat=True))
        if group_member_ids and not (group_member_ids & busy_interviewer_ids):
            free_groups.append({
                'group': group,
                'member_ids': group_member_ids,
                'chief_id': group.chief.id if group.chief else None,
                'department': group.department,
            })

    if not free_groups:
        return {
            'success': False,
            'message': '没有空闲的面试官组',
            'created_groups': 0,
        }

    # 统计各部门排队人数，按均衡模式排序
    departments = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB']
    dept_waiting_counts = {}
    for dept in departments:
        count = Volunteer.objects.filter(
            department=dept,
            status=Volunteer.Status.WAITING
        ).count()
        dept_waiting_counts[dept] = count

    # 按排队人数降序排列，人数相同按部门顺序
    dept_order = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB']
    sorted_depts = sorted(
        departments,
        key=lambda d: (-dept_waiting_counts.get(d, 0), dept_order.index(d))
    )

    # 为每个空闲组分配面试者
    for free_group_info in free_groups:
        group = free_group_info['group']
        dept_code = group.department

        # 检查该部门是否有排队中的面试者
        waiting_candidates = get_waiting_candidates(dept_code, limit=4)

        if not waiting_candidates:
            continue

        # 创建新的面试场次
        now = timezone.now()
        dept_display = dict(Interviewer.Department.choices).get(dept_code, dept_code)
        group_name = f"{dept_display}_{now.strftime('%m%d%H%M%S')}_{group.id}"

        interview_group = InterviewGroup.objects.create(
            group_id=group_name,
            departments=dept_code,
            status=InterviewGroup.Status.PENDING,
            interview_date=now,
            basic_question1='',
            basic_question2='',
            rush_question='',
        )

        # 添加面试官
        interviewer_ids = list(free_group_info['member_ids'])
        if interviewer_ids:
            interview_group.interviewers.set(interviewer_ids)

        # 添加面试者（最多4位）
        valid_statuses = [
            InterviewGroup.Status.PENDING,
            InterviewGroup.Status.ONGOING,
            InterviewGroup.Status.PAUSE
        ]

        added_count = 0
        for candidate in waiting_candidates[:4]:
            # 检查是否已被分配到其他有效场次
            existing = CandidateInGroup.objects.filter(
                candidate=candidate,
                group__status__in=valid_statuses
            ).exists()

            if existing:
                continue

            CandidateInGroup.objects.create(
                group=interview_group,
                candidate=candidate,
                order=added_count + 1
            )

            # 更新面试者状态
            candidate.status = Candidate.Status.INQUEUE
            candidate.save()

            # 更新志愿状态
            Volunteer.objects.filter(
                candidate=candidate,
                department=dept_code,
                status=Volunteer.Status.WAITING
            ).update(status=Volunteer.Status.INQUEUE)

            added_count += 1

        if added_count > 0:
            created_groups += 1
            created_group_ids.append(interview_group.id)
        else:
            interview_group.delete()

    if created_groups > 0:
        return {
            'success': True,
            'message': f'成功创建 {created_groups} 个面试场次',
            'created_groups': created_groups,
            'data': {'group_ids': created_group_ids},
        }
    else:
        return {
            'success': True,
            'message': '没有符合条件的面试者需要分配',
            'created_groups': 0,
        }


def get_waiting_candidates(department, limit=4):
    """获取指定部门排队中的面试者，按排队时间先后排序"""
    candidates = Candidate.objects.filter(
        volunteers__department=department,
        volunteers__status=Volunteer.Status.WAITING
    ).distinct().order_by('volunteers__queue_start_time')

    # 过滤掉已分配到有效场次的面试者
    valid_statuses = [
        InterviewGroup.Status.PENDING,
        InterviewGroup.Status.ONGOING,
        InterviewGroup.Status.PAUSE
    ]
    assigned_ids = CandidateInGroup.objects.filter(
        group__status__in=valid_statuses
    ).values_list('candidate_id', flat=True)

    candidates = candidates.exclude(id__in=assigned_ids)

    return list(candidates[:limit])
