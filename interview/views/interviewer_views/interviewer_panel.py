from django.shortcuts import render
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q

from ...models import Interviewer, InterviewGroup

from ..permission import (
    interviewer_required,
)

@interviewer_required()
def interviewer_panel_view(request):
    return render(request, 'interviewer/interviewer_panel.html')


@interviewer_required(return_json=True)
def api_interviewer_groups(request):
    """获取当前面试官关联的场次（支持分页、搜索、排序）"""
    try:
        interviewer = Interviewer.objects.get(user=request.user)

        # 获取该面试官关联的所有场次
        groups = InterviewGroup.objects.filter(interviewers=interviewer).prefetch_related('candidates__candidate')

        # 搜索功能
        search_keyword = request.GET.get('search', '').strip()
        if search_keyword:
            groups = groups.filter(
                Q(group_id__icontains=search_keyword) |
                Q(departments__icontains=search_keyword) |
                Q(candidates__candidate__name__icontains=search_keyword)
            ).distinct()

        # 排序：状态优先级 + ID降序
        status_order = {
            'PENDING': 2,
            'PAUSE': 1,
            'ONGOING': 3,
            'ENDED': 4,
            'CANCELLED': 5,
        }
        # 先按状态排序，再按ID降序（后创建的排在前面）
        groups = sorted(
            groups,
            key=lambda g: (status_order.get(g.status, 99), -g.id)
        )

        # 分页
        page = request.GET.get('page', 1)
        paginator = Paginator(groups, 10)
        try:
            page_obj = paginator.page(page)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        # 构建数据
        data = []
        start_index = (page_obj.number - 1) * paginator.per_page
        for idx, group in enumerate(page_obj.object_list, start=start_index + 1):
            candidates = group.candidates.all()
            candidate_names = [c.candidate.name for c in candidates]

            data.append({
                'index': idx,
                'group_id': group.id,
                'group_name': group.group_id or f"第{group.id}组",
                'candidates': '；'.join(candidate_names) if candidate_names else '暂无',
                'candidate_count': len(candidate_names),
                'status': group.get_status_display(),
                'status_code': group.status,
                'interview_date': group.interview_date.strftime('%Y-%m-%d %H:%M'),
                'department': group.get_departments_display(),
            })

        return JsonResponse({
            'success': True,
            'data': data,
            'pagination': {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'page_size': paginator.per_page,
                'start': start_index + 1,
                'end': min(start_index + paginator.per_page, paginator.count)
            }
        })
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '您还不是面试官'})
