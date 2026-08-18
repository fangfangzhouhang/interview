from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
import json

from ...models import Candidate, Volunteer, Interviewer, InterviewGroup, CandidateInGroup

@login_required
def queue_view(request):
    """排队管理页面视图"""
    return render(request, 'candidate/queue.html')


@login_required
def get_queue_info(request):
    """获取面试者排队信息"""
    try:
        user = request.user
        candidate = Candidate.objects.get(user=user)

        # 获取所有志愿
        volunteers = candidate.volunteers.all().order_by('priority')

        queue_data = []
        for vol in volunteers:
            # 获取该部门的排队信息
            dept_queue = get_department_queue(vol.department)

            # 找到该面试者在该部门队列中的位置
            position = None
            for idx, q in enumerate(dept_queue, start=1):
                if q['candidate_id'] == candidate.id and q['volunteer_id'] == vol.id:
                    position = idx
                    break

            # 计算预计等待时间（仅当有历史数据时）
            estimated_wait = None
            if position is not None and position > 0:
                estimated_wait = calculate_estimated_wait_time(vol.department, position)

            # 状态显示：ACCEPTED/REJECTED 都显示为 COMPLETED
            status_display = vol.get_status_display()
            if vol.status in ['ACCEPTED', 'REJECTED']:
                status_display = '已完成'

            queue_data.append({
                'volunteer_id': vol.id,
                'department': vol.department,
                'department_display': vol.get_department_display(),
                'priority': vol.priority,
                'status': vol.status,
                'status_display': status_display,
                'position': position,
                'total_in_queue': len(dept_queue),
                'estimated_wait_minutes': estimated_wait,
                'is_in_queue': vol.is_in_queue(),
                'queue_start_time': vol.queue_start_time.isoformat() if vol.queue_start_time else None,
                'queue_duration': vol.get_queue_duration() if vol.is_in_queue() else 0,
            })

        # 计算所有排队志愿中最短的等待时间（只统计有估算值的）
        min_wait = None
        queuing_items = [d for d in queue_data if d['is_in_queue'] and d['estimated_wait_minutes'] is not None]
        if queuing_items:
            min_wait = min(d['estimated_wait_minutes'] for d in queuing_items)

        return JsonResponse({
            'success': True,
            'data': queue_data,
            'min_wait_minutes': min_wait,
            'candidate_status': candidate.status,
            'candidate_status_display': candidate.get_status_display(),
        })

    except Candidate.DoesNotExist:
        return JsonResponse({'success': False, 'message': '用户信息不存在'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


def get_department_queue(department):
    """获取某个部门的排队队列（按排队时间排序）"""
    from django.db.models import Q

    # 获取该部门所有正在排队的志愿，按排队开始时间排序
    queuing_volunteers = Volunteer.objects.filter(
        department=department,
        status=Volunteer.Status.WAITING,
        queue_start_time__isnull=False
    ).select_related('candidate').order_by('queue_start_time')

    queue = []
    for vol in queuing_volunteers:
        queue.append({
            'volunteer_id': vol.id,
            'candidate_id': vol.candidate.id,
            'candidate_name': vol.candidate.name,
            'student_number': vol.candidate.student_number,
            'queue_start_time': vol.queue_start_time,
            'priority': vol.priority,
        })

    return queue


def calculate_estimated_wait_time(department, position):
    """计算预计等待时间（分钟），使用进一法
    调取面试场次已完成的该部门InterviewGroup的持续时间都加起来除以该部门已经完成的人数
    乘以该面试者前面排队的人数，进一法计算得等待时间
    """
    from django.db.models import Q, Sum, Count
    from datetime import timedelta
    import math

    try:
        # 获取该部门所有已完成的InterviewGroup
        completed_groups = InterviewGroup.objects.filter(
            departments=department,
            status=InterviewGroup.Status.ENDED,
            start_time__isnull=False,
            end_time__isnull=False
        )

        # 如果没有任何已完成的数据，返回 None（不估算）
        if not completed_groups.exists():
            return None

        total_duration_seconds = 0
        total_candidates = 0

        for group in completed_groups:
            # 计算该组的面试持续时间（秒）
            duration = group.end_time - group.start_time
            total_duration_seconds += duration.total_seconds()

            # 获取该组的候选人数量
            candidate_count = CandidateInGroup.objects.filter(group=group).count()
            total_candidates += candidate_count

        # 如果总候选人数为0，返回 None
        if total_candidates == 0:
            return None

        # 计算平均每个候选人的面试时间（秒）
        avg_seconds_per_candidate = total_duration_seconds / total_candidates

        # 预计等待时间 = 平均时间 × 前面排队人数（position - 1）
        wait_seconds = avg_seconds_per_candidate * (position - 1)

        # 进一法取整（分钟）
        wait_minutes = math.ceil(wait_seconds / 60)

        # 至少1分钟
        return max(wait_minutes, 1)

    except Exception as e:
        print(f"计算预计等待时间失败: {e}")
        return None