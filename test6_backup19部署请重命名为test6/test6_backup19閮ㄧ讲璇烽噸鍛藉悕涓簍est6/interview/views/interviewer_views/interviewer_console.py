from django.shortcuts import render
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
import json

from ...models import Interviewer, InterviewerGroup

from ..permission import (
    interviewer_required,
)

@interviewer_required(return_json=True)
def interviewer_console_view(request):
    """面试官组管理页面 - 只显示自己是主面试官的组"""
    return render(request, 'interviewer/interviewer_console.html')


@interviewer_required(return_json=True)
def api_interviewer_console(request):
    """获取当前面试官作为主面试官的组列表（支持分页、搜索、筛选）"""
    try:
        interviewer = Interviewer.objects.get(user=request.user)
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '您还不是面试官'})

    # 获取该面试官作为主面试官的所有组
    groups = InterviewerGroup.objects.filter(
        chief=interviewer
    ).prefetch_related('members')

    # 搜索功能
    search_keyword = request.GET.get('search', '').strip()
    if search_keyword:
        groups = groups.filter(
            Q(name__icontains=search_keyword) |
            Q(department__icontains=search_keyword) |
            Q(members__name__icontains=search_keyword)
        ).distinct()

    # 状态筛选（默认启用中）
    status_filter = request.GET.get('status', 'ONUSE')
    if status_filter:
        groups = groups.filter(status=status_filter)

    # 排序：启用中 > 工作中 > 已销毁，同状态下ID降序（后创建的排在前面）
    status_order = {
        'ONUSE': 1,
        'WORKING': 2,
        'ENDED': 3,
    }
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
        member_list = group.members.all()
        member_names = [m.name for m in member_list]

        data.append({
            'index': idx,
            'id': group.id,
            'name': group.name or f"{group.get_department_display()}组",
            'department': group.get_department_display(),
            'department_code': group.department,
            'status': group.get_status_display(),
            'status_code': group.status,
            'chief': group.chief.name if group.chief else '未设置',
            'chief_id': group.chief.id if group.chief else None,
            'members': '；'.join(member_names) if len(member_names) > 0 else '无',
            'member_count': len(member_list),
            'created_at': group.created_at.strftime('%Y-%m-%d %H:%M') if group.created_at else '-',
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


@interviewer_required(return_json=True)
def api_interviewer_console_detail(request, group_id):
    """获取组详情（用于移交弹窗）"""
    try:
        interviewer = Interviewer.objects.get(user=request.user)
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '您还不是面试官'})

    try:
        group = InterviewerGroup.objects.get(id=group_id)
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})

    # 验证当前用户是否是该组的主面试官
    if group.chief != interviewer:
        return JsonResponse({'success': False, 'message': '您不是该组的主面试官，无法管理'})

    members = group.members.all()
    member_data = []
    for member in members:
        member_data.append({
            'id': member.id,
            'name': member.name,
            'department': member.get_department_display(),
            'department_code': member.department,
            'is_chief': group.chief and group.chief.id == member.id,
        })

    data = {
        'id': group.id,
        'name': group.name or f"{group.get_department_display()}组",
        'department': group.get_department_display(),
        'department_code': group.department,
        'status': group.get_status_display(),
        'status_code': group.status,
        'chief_id': group.chief.id if group.chief else None,
        'chief_name': group.chief.name if group.chief else None,
        'members': member_data,
        'member_count': len(member_data),
        'created_at': group.created_at.strftime('%Y-%m-%d %H:%M') if group.created_at else '-',
    }

    return JsonResponse({'success': True, 'data': data})


@csrf_exempt
@interviewer_required(return_json=True)
def api_interviewer_console_transfer_chief(request, group_id):
    """移交主面试官权限"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        interviewer = Interviewer.objects.get(user=request.user)
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '您还不是面试官'})

    try:
        group = InterviewerGroup.objects.get(id=group_id)
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})

    # 验证当前用户是否是该组的主面试官
    if group.chief != interviewer:
        return JsonResponse({'success': False, 'message': '您不是该组的主面试官，无法移交权限'})

    # 工作中和已销毁状态不能移交权限
    if group.status == InterviewerGroup.Status.WORKING:
        return JsonResponse({'success': False, 'message': '工作中的分组不能移交权限'})

    if group.status == InterviewerGroup.Status.ENDED:
        return JsonResponse({'success': False, 'message': '已销毁的分组不能进行操作'})

    try:
        data = json.loads(request.body)
        new_chief_id = data.get('chief_id')

        if not new_chief_id:
            return JsonResponse({'success': False, 'message': '请选择新的主面试官'})

        # 验证新主面试官是否在组内
        if not group.members.filter(id=new_chief_id).exists():
            return JsonResponse({'success': False, 'message': '主面试官必须是组成员'})

        # 不能移交给自己
        if int(new_chief_id) == interviewer.id:
            return JsonResponse({'success': False, 'message': '不能将权限移交给自己'})

        new_chief = Interviewer.objects.get(id=new_chief_id)

        # 移交主面试官权限
        group.chief = new_chief
        group.save()

        return JsonResponse({
            'success': True,
            'message': f'已成功将主面试官权限移交给 {new_chief.name}',
            'data': {
                'new_chief_id': new_chief.id,
                'new_chief_name': new_chief.name,
                'new_chief_department': new_chief.get_department_display(),
            }
        })

    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '选择的面试官不存在'})
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '请求数据格式错误'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})