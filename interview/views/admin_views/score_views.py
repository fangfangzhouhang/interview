from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from ...models import InterviewGroup, Interviewer, Candidate, InterviewerScore, CandidateInGroup, SCORE_DIMENSIONS

from ..permission import (
    admin_required,
)


@admin_required()
def admin_scores_view(request):
    """管理员评价信息管理视图"""
    return render(request, 'addmin/addmin_scores.html')


@csrf_exempt
@admin_required(return_json=True)
def api_admin_scores(request):
    """获取评价信息列表（逐条展示）"""
    if request.method == 'GET':
        # 获取所有评分记录，每条记录是一条独立的评分数据
        scores = InterviewerScore.objects.all().select_related(
            'candidate',
            'interview_group',
            'interviewer'
        ).order_by('-id')

        search = request.GET.get('search', '')
        if search:
            scores = scores.filter(
                Q(candidate__name__icontains=search) |
                Q(candidate__student_number__icontains=search) |
                Q(interviewer__name__icontains=search) |
                Q(interview_group__group_id__icontains=search)
            )

        department = request.GET.get('department', '')
        if department:
            scores = scores.filter(interview_group__departments=department)

        all_data = []
        for score in scores:
            candidate = score.candidate
            group = score.interview_group
            interviewer = score.interviewer

            # 获取该面试者在场次中的序号（如果有）
            candidate_order = None
            if group:
                try:
                    from ...models import CandidateInGroup
                    cig = CandidateInGroup.objects.get(group=group, candidate=candidate)
                    candidate_order = cig.order
                except:
                    candidate_order = None

            all_data.append({
                'id': score.id,
                'department': group.get_departments_display() if group else '未关联',
                'department_code': group.departments if group else '',
                'interviewer_id': interviewer.id,
                'interviewer_name': interviewer.name,
                'interviewer_department': interviewer.get_department_display(),
                'candidate_id': candidate.id,
                'candidate_name': candidate.name,
                'candidate_student_number': candidate.student_number,
                'candidate_order': candidate_order,
                'score': float(score.score),
                'group_id': group.id if group else None,
                'group_name': group.group_id or '未设置' if group else '未关联',
                'group_status': group.get_status_display() if group else '未知',
                'group_status_code': group.status if group else '',
                'group_interview_date': group.interview_date.strftime('%Y-%m-%d %H:%M') if group else '',
            })

        sort_field = request.GET.get('sort', 'id')
        sort_order = request.GET.get('order', 'asc')
        reverse = sort_order == 'desc'

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

    return JsonResponse({'success': False, 'message': '请求方法错误'})


@csrf_exempt
@admin_required(return_json=True)
def api_admin_scores_options(request):
    """获取评价管理所需的选项数据（部门、状态）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        departments = [
            {'value': 'BGS', 'label': '办公'},
            {'value': 'XCB', 'label': '信传'},
            {'value': 'QYB', 'label': '权益'},
            {'value': 'XSB', 'label': '学实'},
            {'value': 'WYB', 'label': '文艺'},
            {'value': 'TYB', 'label': '体育'},
        ]

        statuses = [
            {'value': 'PENDING', 'label': '待开始'},
            {'value': 'ONGOING', 'label': '进行中'},
            {'value': 'PAUSE', 'label': '暂停中'},
            {'value': 'ENDED', 'label': '已结束'},
            {'value': 'CANCELLED', 'label': '已取消'},
        ]

        return JsonResponse({
            'success': True,
            'departments': departments,
            'statuses': statuses,
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取选项失败：{str(e)}'
        })


@admin_required(return_json=True)
def api_admin_group_scores(request, group_id):
    """获取场次下所有面试者的评价信息（用于查看详情）"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    if request.method == 'GET':
        # 获取场次关联的所有面试者（通过 CandidateInGroup）
        candidates_in_group = CandidateInGroup.objects.filter(
            group=group
        ).select_related('candidate').order_by('order')

        data = []
        for cig in candidates_in_group:
            candidate = cig.candidate
            # 获取该候选人在此场次的所有评分
            scores = InterviewerScore.objects.filter(
                candidate=candidate,
                interview_group=group
            ).select_related('interviewer')

            score_list = []
            for score in scores:
                dim_scores = score.dimension_scores or {}
                dim_details = []
                for dim in SCORE_DIMENSIONS:
                    s = float(dim_scores.get(dim['code'], 0))
                    pct = (s / dim['max_score'] * 100) if dim['max_score'] > 0 else 0
                    dim_details.append({
                        'code': dim['code'],
                        'name': dim['name'],
                        'max_score': dim['max_score'],
                        'score': s,
                        'percentage': round(pct, 1)
                    })
                score_list.append({
                    'id': score.id,
                    'interviewer_id': score.interviewer.id,
                    'interviewer_name': score.interviewer.name,
                    'score': float(score.score),
                    'self_intro': score.self_intro or '',
                    'comment': score.comment or '',
                    'dimension_scores': dim_scores,
                    'dimension_details': dim_details,
                })

            if score_list:
                avg_score = sum(s['score'] for s in score_list) / len(score_list)
            else:
                avg_score = 0

            data.append({
                'candidate_in_group_id': cig.id,
                'candidate_id': candidate.id,
                'candidate_name': candidate.name,
                'student_number': candidate.student_number,
                'order': cig.order,
                'avg_score': round(avg_score, 2),
                'scores': score_list,
            })

        return JsonResponse({
            'success': True,
            'data': data
        })

    return JsonResponse({'success': False, 'message': '请求方法错误'})
