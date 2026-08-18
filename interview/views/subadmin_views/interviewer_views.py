# subadmin_interviewers_views.py
import json
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.core.paginator import Paginator
from django.views.decorators.csrf import csrf_exempt

from ...models import Interviewer, InterviewerGroup

from ..permission import (
    subadmin_required,
    department_permission_required,
)

@subadmin_required()
def subadmin_interviewers_view(request):
    """部门管理员面试官分组管理视图"""
    return render(request, 'subaddmin/subaddmin_interviewers.html')

'''
def check_interviewer_in_active_groups(interviewer_ids, exclude_group_id=None, department=None):
    """
    检查面试官是否已在其他启用中的组（仅检查同部门）

    Args:
        interviewer_ids: 要检查的面试官ID列表
        exclude_group_id: 要排除的组ID（更新时排除自己）
        department: 部门代码，只检查同部门的组

    Returns:
        (has_conflict, conflict_names, conflict_ids)
    """
    # 获取所有启用中的面试官组（同部门）
    active_groups = InterviewerGroup.objects.filter(
        status=InterviewerGroup.Status.ONUSE
    )
    if department:
        active_groups = active_groups.filter(department=department)
    if exclude_group_id:
        active_groups = active_groups.exclude(id=exclude_group_id)

    # 获取所有已在启用中组的面试官ID
    busy_interviewer_ids = set()
    for group in active_groups:
        for member in group.members.all():
            busy_interviewer_ids.add(member.id)

    # 检查冲突
    conflict_ids = set(interviewer_ids) & busy_interviewer_ids
    if conflict_ids:
        conflict_names = Interviewer.objects.filter(id__in=conflict_ids).values_list('name', flat=True)
        return True, list(conflict_names), list(conflict_ids)

    return False, [], []
'''

def generate_group_name(department, exclude_group_id=None):
    """
    生成组名：部门+日期+组（数字），确保不与其他启用中的组冲突

    Args:
        department: 部门代码
        exclude_group_id: 要排除的组ID（通常是旧组ID）

    Returns:
        生成的不重复组名
    """
    from datetime import datetime
    import re

    dept_display = dict(Interviewer.Department.choices).get(department, department)
    date_str = datetime.now().strftime('%m%d')

    existing_groups = InterviewerGroup.objects.filter(
        department=department,
        status=InterviewerGroup.Status.ONUSE
    )
    if exclude_group_id:
        existing_groups = existing_groups.exclude(id=exclude_group_id)

    existing_numbers = set()
    pattern_template = r'{}' + date_str + r'组(\d+)$'

    for g in existing_groups:
        pattern = re.compile(pattern_template.format(re.escape(dept_display)))
        match = pattern.search(g.name)
        if match:
            existing_numbers.add(int(match.group(1)))

    num = 1
    while num in existing_numbers:
        num += 1

    return f"{dept_display}{date_str}组{num}"


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewers(request, department=None):
    """获取面试官列表（仅本部门）"""
    if request.method == 'GET':
        if not department or department =='ALL':
            department = request.GET.get('department', '')
        interviewers = Interviewer.objects.all().select_related('user')

        if department:
            interviewers = interviewers.filter(department=department)

        search = request.GET.get('search', '')
        if search:
            interviewers = interviewers.filter(
                Q(name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(department__icontains=search)
            )

        sort_field = request.GET.get('sort', 'id')
        sort_order = request.GET.get('order', 'asc')
        if sort_order == 'desc':
            sort_field = f'-{sort_field}'
        interviewers = interviewers.order_by(sort_field)

        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        paginator = Paginator(interviewers, page_size)
        page_obj = paginator.get_page(page)

        data = []
        for interviewer in page_obj:
            data.append({
                'id': interviewer.id,
                'username': interviewer.user.username,
                'name': interviewer.name,
                'department': interviewer.get_department_display(),
                'department_code': interviewer.department,
                'group_count': interviewer.interview_groups.count(),
                'created_at': interviewer.user.date_joined.strftime('%Y-%m-%d %H:%M'),
            })

        return JsonResponse({
            'success': True,
            'data': data,
            'total': paginator.count,
            'page': page,
            'page_size': page_size,
            'total_pages': paginator.num_pages
        })


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_detail(request, interviewer_id, department=None):
    """获取面试官详情（仅本部门）"""
    try:
        interviewer = Interviewer.objects.get(id=interviewer_id)
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '面试官不存在'})

    if request.method == 'GET':
        data = {
            'id': interviewer.id,
            'username': interviewer.user.username,
            'name': interviewer.name,
            'department_code': interviewer.department,
            'department': interviewer.get_department_display(),
        }
        return JsonResponse({'success': True, 'data': data})


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewers_all(request, department=None):
    """获取所有本部门面试官列表"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        if not department or department == 'ALL':
            department = request.GET.get('department', '')

        # 获取本部门所有面试官（不排除任何已分配的）
        interviewers = Interviewer.objects.all().select_related('user').order_by('name')
        if department:
            interviewers = interviewers.filter(department=department)

        data = []
        for interviewer in interviewers:
            data.append({
                'id': interviewer.id,
                'name': interviewer.name,
                'department': interviewer.get_department_display(),
                'department_code': interviewer.department,
                'username': interviewer.user.username,
                'is_chief': interviewer.is_chief(),
            })

        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        })


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_available(request, department=None):
    """获取当前可用的面试官列表（仅本部门，排除已在其他启用中组的）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        group_id = request.GET.get('group_id')
        if not department or department == 'ALL':
            department = request.GET.get('department', '')

        # 获取所有启用中的面试官组（同部门）
        active_groups = InterviewerGroup.objects.filter(
            status=InterviewerGroup.Status.ONUSE
        )
        if department:
            active_groups = active_groups.filter(department=department)
        if group_id:
            active_groups = active_groups.exclude(id=group_id)

        # 获取所有已在启用中组的面试官ID
        busy_interviewer_ids = set()
        for group in active_groups:
            for member in group.members.all():
                busy_interviewer_ids.add(member.id)

        # 获取可用面试官（本部门）
        interviewers = Interviewer.objects.all()
        if department:
            interviewers = interviewers.filter(department=department)
        interviewers = interviewers.exclude(id__in=busy_interviewer_ids).order_by('name')

        data = []
        for interviewer in interviewers:
            data.append({
                'id': interviewer.id,
                'name': interviewer.name,
                'department': interviewer.get_department_display(),
                'department_code': interviewer.department,
            })

        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        })


# ==================== 面试官分组管理 API ====================

@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_groups(request, department=None):
    """获取面试官分组列表 / 批量销毁（仅本部门）"""
    if request.method == 'GET':
        if not department or department == 'ALL':
            department = request.GET.get('department', '')
        groups = InterviewerGroup.objects.all().prefetch_related('members', 'chief')

        if department:
            groups = groups.filter(department=department)

        search = request.GET.get('search', '')
        if search:
            groups = groups.filter(
                Q(name__icontains=search) |
                Q(department__icontains=search)
            )

        status_filter = request.GET.get('status', '')
        if status_filter:
            groups = groups.filter(status=status_filter)

        all_data = []
        for group in groups:
            member_names = [m.name for m in group.members.all()]
            chief_name = group.chief.name if group.chief else '未设置'
            all_data.append({
                'id': group.id,
                'name': group.name or f"{group.get_department_display()}组",
                'department': group.get_department_display(),
                'department_code': group.department,
                'status': group.get_status_display(),
                'status_code': group.status,
                'chief': chief_name,
                'chief_id': group.chief.id if group.chief else None,
                'member_count': group.get_member_count(),
                'members': [
                    {'id': m.id, 'name': m.name, 'department': m.get_department_display()}
                    for m in group.members.all()
                ],
                'member_names': ', '.join(member_names) if member_names else '无',
                'created_at': group.created_at.strftime('%Y-%m-%d %H:%M') if group.created_at else '',
            })

        all_data.sort(key=lambda x: (
            0 if x.get('status_code') == 'ONUSE' else 1,  # 启用中优先
            -x.get('id', 0)  # ID降序（后创建的在前）
        ))

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

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            ids = data.get('ids', [])
            if not department or department == 'ALL':
                department = data.get('department', 'UNK')
            if ids:
                from django.utils import timezone
                groups_to_destroy = InterviewerGroup.objects.filter(
                    id__in=ids,
                    status=InterviewerGroup.Status.ONUSE
                )
                if department:
                    groups_to_destroy = groups_to_destroy.filter(department=department)

                working_groups = InterviewerGroup.objects.filter(
                    id__in=ids,
                    status=InterviewerGroup.Status.WORKING
                )
                if department:
                    working_groups = working_groups.filter(department=department)
                if working_groups.exists():
                    working_names = list(working_groups.values_list('name', flat=True))
                    return JsonResponse({
                        'success': False,
                        'message': f'以下分组处于工作中状态，不能被销毁：{", ".join(working_names)}'
                    })

                for group in groups_to_destroy:
                    if group.chief:
                        group.chief = None
                    group.status = InterviewerGroup.Status.ENDED
                    group.updated_at = timezone.now()
                    group.save()
                return JsonResponse({'success': True, 'message': f'成功销毁 {groups_to_destroy.count()} 条记录'})
            return JsonResponse({'success': False, 'message': '请选择要销毁的记录'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_groups_options(request, department=None):
    """获取分组管理所需的选项数据（仅本部门）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        if not department or department == 'ALL':
            department = request.GET.get('department', '')

        departments = [
            {'value': '', 'label': '--选择部门--'},
            {'value': 'BGS', 'label': '办公'},
            {'value': 'XCB', 'label': '信传'},
            {'value': 'QYB', 'label': '权益'},
            {'value': 'XSB', 'label': '学实'},
            {'value': 'WYB', 'label': '文艺'},
            {'value': 'TYB', 'label': '体育'},
        ]

        statuses = [
            {'value': 'ONUSE', 'label': '启用中'},
            {'value': 'ENDED', 'label': '已销毁'},
        ]

        # 获取本部门所有面试官（不排除任何已分配的）
        interviewers = Interviewer.objects.all().select_related('user')
        if department:
            interviewers = interviewers.filter(department=department)

        interviewer_options = [
            {
                'value': interviewer.id,
                'label': f"{interviewer.get_department_display()} - {interviewer.name}",
                'department': interviewer.department,
            }
            for interviewer in interviewers
        ]

        return JsonResponse({
            'success': True,
            'departments':  [departments[0]] + [dept for dept in departments[1:]if dept['value']==department] if department != 'ALL' else departments[1:],
            'statuses': statuses,
            'interviewers': interviewer_options,
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取选项失败：{str(e)}'
        })


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_group_detail(request, group_id, department=None):
    """获取/更新面试官分组详情（仅本部门）"""
    try:
        group = InterviewerGroup.objects.get(id=group_id)
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})

    if request.method == 'GET':
        data = {
            'id': group.id,
            'name': group.name,
            'department_code': group.department,
            'department': group.get_department_display(),
            'status_code': group.status,
            'status': group.get_status_display(),
            'chief_id': group.chief.id if group.chief else None,
            'chief_name': group.chief.name if group.chief else None,
            'member_ids': list(group.members.values_list('id', flat=True)),
            'members': [
                {'id': m.id, 'name': m.name, 'department': m.get_department_display()}
                for m in group.members.all()
            ],
            'created_at': group.created_at.strftime('%Y-%m-%d %H:%M') if group.created_at else '',
        }
        return JsonResponse({'success': True, 'data': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            if group.status == InterviewerGroup.Status.WORKING:
                return JsonResponse({
                    'success': False,
                    'message': '工作中状态的分组不能被编辑'
                })

            new_status = data.get('status', group.status)
            new_name = data.get('name', '').strip()
            new_department = data.get('department', group.department)
            member_ids = data.get('member_ids', [])
            chief_id = data.get('chief_id')

            # 已销毁状态处理
            if group.status == InterviewerGroup.Status.ENDED:
                if new_status == InterviewerGroup.Status.ENDED:
                    return JsonResponse({
                        'success': False,
                        'message': '已销毁的分组不允许修改任何信息'
                    })

                if new_status == InterviewerGroup.Status.ONUSE:
                    current_member_ids = set(group.members.values_list('id', flat=True))
                    new_member_ids_set = set(member_ids) if member_ids else current_member_ids

                    if not member_ids:
                        member_ids = list(current_member_ids)
                        new_member_ids_set = current_member_ids

                    if chief_id is None and group.chief:
                        chief_id = group.chief.id

                    if not member_ids:
                        return JsonResponse({
                            'success': False,
                            'message': '分组至少需要一名成员'
                        })

                    if not chief_id and len(member_ids) > 1:
                        return JsonResponse({
                            'success': False,
                            'message': '请指定主面试官'
                        })

                    if len(member_ids) == 1 and not chief_id:
                        chief_id = member_ids[0]

                    if chief_id and chief_id not in member_ids:
                        return JsonResponse({
                            'success': False,
                            'message': '主面试官必须是成员之一'
                        })

                    # 检查面试官冲突（同部门）
                    active_groups = InterviewerGroup.objects.filter(
                        status=InterviewerGroup.Status.ONUSE,
                        department=new_department
                    ).exclude(id=group_id)

                    busy_interviewer_ids = set()
                    for active_group in active_groups:
                        for member in active_group.members.all():
                            busy_interviewer_ids.add(member.id)

                    conflict_ids = set(member_ids) & busy_interviewer_ids
                    if conflict_ids:
                        conflict_names = Interviewer.objects.filter(
                            id__in=conflict_ids
                        ).values_list('name', flat=True)
                        return JsonResponse({
                            'success': False,
                            'message': f'以下面试官已在其他启用中的分组：{", ".join(conflict_names)}'
                        })

                    if new_name:
                        name_conflict_exists = InterviewerGroup.objects.filter(
                            name=new_name,
                            status=InterviewerGroup.Status.ONUSE,
                            department=new_department
                        ).exclude(id=group_id).exists()

                        if name_conflict_exists:
                            import re
                            match = re.search(r'(\d+)$', new_name)
                            if match:
                                num = int(match.group(1)) + 1
                                base_name = new_name[:match.start()]
                                final_name = f"{base_name}{num}"
                            else:
                                final_name = f"{new_name}1"

                            counter = 0
                            while InterviewerGroup.objects.filter(
                                    name=final_name,
                                    status=InterviewerGroup.Status.ONUSE,
                                    department=new_department
                            ).exclude(id=group_id).exists() and counter < 100:
                                match = re.search(r'(\d+)$', final_name)
                                if match:
                                    num = int(match.group(1)) + 1
                                    base_name = final_name[:match.start()]
                                    final_name = f"{base_name}{num}"
                                else:
                                    final_name = f"{final_name}1"
                                counter += 1
                        else:
                            final_name = new_name
                    else:
                        final_name = generate_group_name(new_department, exclude_group_id=group_id)

                    new_group = InterviewerGroup.objects.create(
                        name=final_name,
                        department=new_department,
                        status=InterviewerGroup.Status.ONUSE,
                    )

                    new_group.members.set(member_ids)

                    if chief_id:
                        chief = Interviewer.objects.get(id=chief_id)
                        if not new_group.members.filter(id=chief_id).exists():
                            new_group.members.add(chief)
                        new_group.chief = chief

                    new_group.save()

                    return JsonResponse({
                        'success': True,
                        'message': '已创建新的启用中分组',
                        'new_id': new_group.id
                    })

            # 启用中状态处理
            if group.status == InterviewerGroup.Status.ONUSE:
                if new_status == InterviewerGroup.Status.ENDED:
                    group.status = InterviewerGroup.Status.ENDED
                    group.save()
                    return JsonResponse({
                        'success': True,
                        'message': '已成功销毁分组'
                    })

                if new_status == InterviewerGroup.Status.ONUSE:
                    current_member_ids = set(group.members.values_list('id', flat=True))
                    new_member_ids_set = set(member_ids) if member_ids else current_member_ids

                    has_changes = False
                    if current_member_ids != new_member_ids_set:
                        has_changes = True
                    current_chief_id = group.chief.id if group.chief else None
                    if current_chief_id != chief_id:
                        has_changes = True
                    if new_name and group.name != new_name:
                        has_changes = True
                    if group.department != new_department:
                        has_changes = True

                    if has_changes:
                        active_groups = InterviewerGroup.objects.filter(
                            status=InterviewerGroup.Status.ONUSE,
                            department=new_department
                        ).exclude(id=group_id)

                        busy_interviewer_ids = set()
                        for active_group in active_groups:
                            for member in active_group.members.all():
                                busy_interviewer_ids.add(member.id)

                        conflict_ids = set(member_ids) & busy_interviewer_ids
                        if conflict_ids:
                            conflict_names = Interviewer.objects.filter(
                                id__in=conflict_ids
                            ).values_list('name', flat=True)
                            return JsonResponse({
                                'success': False,
                                'message': f'以下面试官已在其他启用中的分组：{", ".join(conflict_names)}'
                            })

                        if not member_ids:
                            return JsonResponse({
                                'success': False,
                                'message': '分组至少需要一名成员'
                            })

                        if not chief_id and len(member_ids) > 1:
                            return JsonResponse({
                                'success': False,
                                'message': '请指定主面试官'
                            })

                        if len(member_ids) == 1 and not chief_id:
                            chief_id = member_ids[0]

                        if chief_id and chief_id not in member_ids:
                            return JsonResponse({
                                'success': False,
                                'message': '主面试官必须是成员之一'
                            })

                        if new_name:
                            name_conflict_exists = InterviewerGroup.objects.filter(
                                name=new_name,
                                status=InterviewerGroup.Status.ONUSE,
                                department=new_department
                            ).exclude(id=group_id).exists()

                            if name_conflict_exists:
                                import re
                                match = re.search(r'(\d+)$', new_name)
                                if match:
                                    num = int(match.group(1)) + 1
                                    base_name = new_name[:match.start()]
                                    final_name = f"{base_name}{num}"
                                else:
                                    final_name = f"{new_name}1"

                                counter = 0
                                while InterviewerGroup.objects.filter(
                                        name=final_name,
                                        status=InterviewerGroup.Status.ONUSE,
                                        department=new_department
                                ).exclude(id=group_id).exists() and counter < 100:
                                    match = re.search(r'(\d+)$', final_name)
                                    if match:
                                        num = int(match.group(1)) + 1
                                        base_name = final_name[:match.start()]
                                        final_name = f"{base_name}{num}"
                                    else:
                                        final_name = f"{final_name}1"
                                    counter += 1
                            else:
                                final_name = new_name
                        else:
                            final_name = generate_group_name(new_department, exclude_group_id=group_id)

                        new_group = InterviewerGroup.objects.create(
                            name=final_name,
                            department=new_department,
                            status=InterviewerGroup.Status.ONUSE,
                        )

                        new_group.members.set(member_ids)

                        if chief_id:
                            chief = Interviewer.objects.get(id=chief_id)
                            if not new_group.members.filter(id=chief_id).exists():
                                new_group.members.add(chief)
                            new_group.chief = chief

                        new_group.save()

                        group.status = InterviewerGroup.Status.ENDED
                        group.save()

                        return JsonResponse({
                            'success': True,
                            'message': '更新成功（已重新创建分组）',
                            'new_id': new_group.id
                        })
                    else:
                        return JsonResponse({
                            'success': True,
                            'message': '没有检测到变更'
                        })

            return JsonResponse({
                'success': False,
                'message': f'当前状态 {group.get_status_display()} 不支持此操作'
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_group_create(request, department=None):
    """创建面试官分组（仅本部门）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)

        if not department or department == 'ALL':
            department = data.get('department', 'UNK')
        name = data.get('name', '').strip()

        if not name:
            name = generate_group_name(department)

        member_ids = data.get('member_ids', [])

        if not member_ids:
            return JsonResponse({'success': False, 'message': '分组至少需要一名成员'})

        # 检查面试官冲突（同部门）
        active_groups = InterviewerGroup.objects.filter(
            status=InterviewerGroup.Status.ONUSE,
            department=department
        )

        busy_interviewer_ids = set()
        for group in active_groups:
            for member in group.members.all():
                busy_interviewer_ids.add(member.id)

        conflict_ids = set(member_ids) & busy_interviewer_ids
        if conflict_ids:
            conflict_names = Interviewer.objects.filter(id__in=conflict_ids).values_list('name', flat=True)
            return JsonResponse({
                'success': False,
                'message': f'以下面试官已在其他启用中的分组：{", ".join(conflict_names)}'
            })

        # 检查名称冲突（同部门）
        if name:
            name_conflict_exists = InterviewerGroup.objects.filter(
                name=name,
                status=InterviewerGroup.Status.ONUSE,
                department=department
            ).exists()
            if name_conflict_exists:
                import re
                match = re.search(r'(\d+)$', name)
                if match:
                    num = int(match.group(1)) + 1
                    base_name = name[:match.start()]
                    final_name = f"{base_name}{num}"
                else:
                    final_name = f"{name}1"

                counter = 0
                while InterviewerGroup.objects.filter(
                        name=final_name,
                        status=InterviewerGroup.Status.ONUSE,
                        department=department
                ).exists() and counter < 100:
                    match = re.search(r'(\d+)$', final_name)
                    if match:
                        num = int(match.group(1)) + 1
                        base_name = final_name[:match.start()]
                        final_name = f"{base_name}{num}"
                    else:
                        final_name = f"{final_name}1"
                    counter += 1
                name = final_name

        group = InterviewerGroup.objects.create(
            name=name,
            department=department,
            status=InterviewerGroup.Status.ONUSE,
        )

        group.members.set(member_ids)

        chief_id = data.get('chief_id')

        if len(member_ids) == 1:
            chief_id = member_ids[0]

        if not chief_id and len(member_ids) > 1:
            return JsonResponse({'success': False, 'message': '请指定主面试官'})

        if chief_id:
            try:
                chief = Interviewer.objects.get(id=chief_id)
                if not group.members.filter(id=chief_id).exists():
                    group.members.add(chief)
                group.chief = chief
                group.save()
            except Interviewer.DoesNotExist:
                return JsonResponse({'success': False, 'message': '选中的主面试官不存在'})

        return JsonResponse({'success': True, 'message': '创建成功', 'id': group.id})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_group_delete(request, group_id, department=None):
    """销毁面试官分组（仅本部门）"""
    try:
        group = InterviewerGroup.objects.get(id=group_id)

        if group.status == InterviewerGroup.Status.WORKING:
            return JsonResponse(
                {'success': False, 'message': '工作中状态的分组不能被销毁'})

        if group.status != InterviewerGroup.Status.ONUSE:
            return JsonResponse(
                {'success': False, 'message': f'当前分组状态为 {group.get_status_display()}，只有"启用中"状态才能销毁'})

        group.status = InterviewerGroup.Status.ENDED
        group.save()
        return JsonResponse({'success': True, 'message': '销毁成功'})
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_group_members(request, group_id, department=None):
    """获取分组关联的面试官列表（仅本部门）"""
    try:
        group = InterviewerGroup.objects.get(id=group_id)
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})

    if request.method == 'GET':
        members = group.members.all()

        data = []
        for member in members:
            data.append({
                'id': member.id,
                'name': member.name,
                'department': member.get_department_display(),
                'department_code': member.department,
                'is_chief': group.chief and group.chief.id == member.id,
            })

        return JsonResponse({
            'success': True,
            'data': data
        })

    return JsonResponse({'success': False, 'message': '请求方法错误'})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_interviewer_group_set_chief(request, group_id, interviewer_id, department=None):
    """设置分组的主面试官（仅本部门）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        group = InterviewerGroup.objects.get(id=group_id)
    except InterviewerGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '分组不存在'})

    if group.status == InterviewerGroup.Status.WORKING:
        return JsonResponse(
            {'success': False, 'message': '工作中状态的分组不能修改主面试官'})

    if group.status != InterviewerGroup.Status.ONUSE:
        return JsonResponse(
            {'success': False, 'message': f'当前分组状态为 {group.get_status_display()}，只有"启用中"状态才能设置主面试官'})

    try:
        interviewer = Interviewer.objects.get(id=interviewer_id)
    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '面试官不存在'})

    if not group.members.filter(id=interviewer_id).exists():
        return JsonResponse({'success': False, 'message': '该面试官不在分组内'})

    group.chief = interviewer
    group.save()

    return JsonResponse({
        'success': True,
        'message': f'已设置 {interviewer.name} 为主面试官',
        'data': {
            'id': interviewer.id,
            'name': interviewer.name,
            'department': interviewer.get_department_display(),
        }
    })
