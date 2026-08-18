# subadmin_groups_views.py
import json
from datetime import datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from ...models import InterviewGroup, Interviewer, CandidateInGroup, Candidate, InterviewerGroup, Volunteer

from ..permission import (
    subadmin_required,
    department_permission_required,
)

# 部门选项
DEPARTMENT_CHOICES = [
    {'value': 'BGS', 'label': '办公'},
    {'value': 'XCB', 'label': '信传'},
    {'value': 'QYB', 'label': '权益'},
    {'value': 'XSB', 'label': '学实'},
    {'value': 'WYB', 'label': '文艺'},
    {'value': 'TYB', 'label': '体育'},
]

INTERVIEWGROUPSTATUS_CHOICES = [
    {'value': 'PENDING', 'label': '待开始'},
    {'value': 'ONGOING', 'label': '进行中'},
    {'value': 'PAUSE', 'label': '暂停中'},
    {'value': 'ENDED', 'label': '已结束'},
    {'value': 'CANCELLED', 'label': '已取消'},
]

def validate_interviewer_group_constraint(interviewer_ids, department=None):
    """
    验证面试官列表是否符合约束（仅同部门）：
    1. 所有面试官属于同一个 InterviewerGroup（子集关系）
    2. 该组的状态必须为启用中（ONUSE）
    3. 该组的主面试官（chief）在列表中
    4. 该组属于指定部门

    返回: (is_valid, error_message, target_group)
    """
    if not interviewer_ids:
        return False, '请至少选择一个面试官', None

    selected_interviewers = Interviewer.objects.filter(id__in=interviewer_ids)
    selected_ids_set = set(interviewer_ids)

    if len(selected_interviewers) != len(interviewer_ids):
        return False, '部分面试官不存在，请刷新后重试', None

    # 如果指定了部门，只检查该部门的组
    common_groups = None
    for interviewer in selected_interviewers:
        groups = interviewer.groups.filter(status=InterviewerGroup.Status.ONUSE)
        if department and department != 'ALL':
            groups = groups.filter(department=department)
        if not groups.exists():
            return False, f'面试官 "{interviewer.name}" 不属于任何启用中的面试官组', None
        group_ids = set(groups.values_list('id', flat=True))
        if common_groups is None:
            common_groups = group_ids
        else:
            common_groups = common_groups & group_ids

        if not common_groups:
            return False, f'面试官 "{interviewer.name}" 与已选面试官不属于同一个启用中的组', None

    target_group_id = list(common_groups)[0]
    target_group = InterviewerGroup.objects.get(id=target_group_id)

    group_member_ids = set(target_group.members.values_list('id', flat=True))
    if not selected_ids_set.issubset(group_member_ids):
        return False, '所选面试官不属于同一个面试官组，请确保所有面试官属于同一组', None

    chief = target_group.chief
    if chief:
        if chief.id not in selected_ids_set:
            return False, f'该面试官组的主面试官 "{chief.name}" 必须在面试官列表中', None
    else:
        return False, '所选面试官组未设置主面试官，请先设置主面试官', None

    return True, None, target_group


@subadmin_required(return_json=True)
def subadmin_groups_view(request):
    """部门管理员面试场次管理视图"""
    return render(request, 'subaddmin/subaddmin_groups.html')


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_groups(request, department=None):
    """获取面试场次列表 / 批量取消（仅本部门）"""
    if request.method == 'GET':
        groups = InterviewGroup.objects.all().prefetch_related('interviewers', 'candidates__candidate')
        if department and department != 'ALL':
            groups = groups.filter(departments=department)

        search = request.GET.get('search', '')
        if search:
            groups = groups.filter(
                Q(group_id__icontains=search) |
                Q(departments__icontains=search)
            )

        status_filter = request.GET.get('status', '')
        if status_filter:
            groups = groups.filter(status=status_filter)

        all_data = []
        for group in groups:
            all_data.append({
                'id': group.id,
                'group_id': group.group_id or '未设置',
                'department': group.get_departments_display(),
                'department_code': group.departments,
                'status': group.get_status_display(),
                'status_code': group.status,
                'interview_date': group.interview_date.strftime('%Y-%m-%d %H:%M'),
                'interviewer_count': group.get_interviewer_count(),
                'candidate_count': group.get_candidate_in_group_count(),
                'interviewers': [
                    {'id': i.id, 'name': i.name}
                    for i in group.interviewers.all()
                ],
                'candidates': [
                    {'id': c.candidate.id, 'name': c.candidate.name}
                    for c in group.candidates.all()
                ],
            })

        # 固定排序：待开始 > 进行中 > 暂停中 > 已结束 > 已取消，同状态按ID降序
        status_order = {
            'PENDING': 2,
            'ONGOING': 3,
            'PAUSE': 1,
            'ENDED': 4,
            'CANCELLED': 5
        }
        all_data.sort(key=lambda x: (
            status_order.get(x.get('status_code', ''), 99),
            -x.get('id', 0)
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
        # 批量取消（改为状态变更为已取消）
        try:
            data = json.loads(request.body)
            ids = data.get('ids', [])
            if ids:
                groups_to_cancel = InterviewGroup.objects.filter(id__in=ids)
                if department and department != 'ALL':
                    groups_to_cancel = groups_to_cancel.filter(departments=department)
                # 只允许取消待开始状态的场次
                groups_to_cancel = groups_to_cancel.filter(status=InterviewGroup.Status.PENDING)
                count = groups_to_cancel.count()
                if count == 0:
                    return JsonResponse({'success': False, 'message': '所选场次中没有可取消的（仅"待开始"状态可取消）'})
                groups_to_cancel.update(status=InterviewGroup.Status.CANCELLED)
                return JsonResponse({'success': True, 'message': f'成功取消 {count} 条记录'})
            return JsonResponse({'success': False, 'message': '请选择要取消的记录'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_groups_options(request, department=None):
    """获取场次管理所需的选项数据（仅本部门）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:

        interviewers = Interviewer.objects.all().select_related('user')
        if department and department != 'ALL':
            interviewers = interviewers.filter(department=department)
        interviewer_options = [
            {
                'value': interviewer.id,
                'label': f"{interviewer.get_department_display()} - {interviewer.name}",
                'department' : f"{interviewer.department}",
            }
            for interviewer in interviewers
        ]

        return JsonResponse({
            'success': True,
            'departments': [dept for dept in DEPARTMENT_CHOICES if dept['value']==department] if department != 'ALL' else DEPARTMENT_CHOICES,
            'statuses': INTERVIEWGROUPSTATUS_CHOICES,
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
def api_subadmin_group_detail(request, group_id, department=None):
    """获取/更新面试场次详情（仅本部门）"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    if request.method == 'GET':
        data = {
            'id': group.id,
            'group_id': group.group_id,
            'department_code': group.departments,
            'department': group.get_departments_display(),
            'status_code': group.status,
            'status': group.get_status_display(),
            'interview_date': group.interview_date.strftime('%Y-%m-%d %H:%M'),
            'interviewer_ids': list(group.interviewers.values_list('id', flat=True)),
            'interviewers': [
                {'id': i.id, 'name': i.name, 'department': i.get_department_display()}
                for i in group.interviewers.all()
            ],
            'basic_question1': group.basic_question1,
            'basic_question2': group.basic_question2,
            'rush_question': group.rush_question,
        }
        return JsonResponse({'success': True, 'data': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)

            new_status = data.get('status', group.status)
            old_status = group.status

            # 只有待开始状态或修改为待开始状态时才能修改场次详情
            if group.status != InterviewGroup.Status.PENDING and new_status != InterviewGroup.Status.PENDING:
                return JsonResponse({
                    'success': False,
                    'message': f'当前场次状态为 {group.get_status_display()}，只有"待开始"状态或修改为"待开始"状态时才能修改场次详情'
                })

            # ========== 验证面试官组约束 ==========
            interviewer_ids = data.get('interviewer_ids', [])
            is_valid, error_msg, target_group = validate_interviewer_group_constraint(interviewer_ids, group.departments)
            if not is_valid:
                return JsonResponse({'success': False, 'message': error_msg})
            # ========== 验证结束 ==========

            old_candidate_ids = set(group.candidates.values_list('candidate_id', flat=True))
            old_department = group.departments

            new_group_id = data.get('group_id', '').strip()
            if new_group_id:
                group.group_id = new_group_id

            group.departments = data.get('department', group.departments)
            group.status = new_status

            interview_date = data.get('interview_date')
            if interview_date:
                from django.utils import timezone
                naive_datetime = datetime.strptime(interview_date, '%Y-%m-%dT%H:%M')
                group.interview_date = timezone.make_aware(naive_datetime)

            if interviewer_ids is not None:
                group.interviewers.set(interviewer_ids)

            candidates_data = data.get('candidates', [])

            new_candidate_ids = set()
            for candidate_info in candidates_data:
                candidate_id = candidate_info.get('candidate_id') or candidate_info.get('id')
                if candidate_id:
                    new_candidate_ids.add(candidate_id)

            removed_candidate_ids = old_candidate_ids - new_candidate_ids

            # 被移除的面试者状态改为 WAITING
            if removed_candidate_ids:
                Candidate.objects.filter(id__in=removed_candidate_ids).update(
                    status=Candidate.Status.WAITING
                )
                # 更新对应部门的志愿状态为 WAITING
                Volunteer.objects.filter(
                    candidate_id__in=removed_candidate_ids,
                    department=old_department
                ).update(status=Volunteer.Status.WAITING)

            group.candidates.all().delete()

            for candidate_info in candidates_data:
                candidate_id = candidate_info.get('candidate_id') or candidate_info.get('id')
                order = candidate_info.get('order', 0)

                if not candidate_id or not order:
                    continue

                # 检查该面试者是否已被分配到其他有效场次（待开始/进行中/暂停中）
                valid_statuses = [InterviewGroup.Status.PENDING, InterviewGroup.Status.ONGOING,
                                  InterviewGroup.Status.PAUSE]
                existing_in_other_group = CandidateInGroup.objects.filter(
                    candidate_id=candidate_id
                ).exclude(group=group).filter(
                    group__status__in=valid_statuses
                ).exists()

                if existing_in_other_group:
                    continue

                CandidateInGroup.objects.create(
                    group=group,
                    candidate_id=candidate_id,
                    order=order
                )

                Candidate.objects.filter(id=candidate_id).update(
                    status=Candidate.Status.INQUEUE
                )
                # 更新对应部门的志愿状态为 INQUEUE
                Volunteer.objects.filter(
                    candidate_id=candidate_id,
                    department=group.departments
                ).update(status=Volunteer.Status.INQUEUE)

            # ========== 根据场次状态更新面试者的志愿状态 ==========
            current_candidate_ids = set(group.candidates.values_list('candidate_id', flat=True))

            if current_candidate_ids:
                if new_status == InterviewGroup.Status.ONGOING or new_status == InterviewGroup.Status.PAUSE:
                    # 面试中或暂停中 -> 志愿状态为 INTERVIEWING，面试者状态为 INTERVIEWING
                    # 注意：subadmin 只更新该部门的志愿
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.INTERVIEWING)
                    Candidate.objects.filter(id__in=current_candidate_ids).update(
                        status=Candidate.Status.INTERVIEWING
                    )
                elif new_status == InterviewGroup.Status.ENDED:
                    # 已结束 -> 更新该部门志愿状态为 COMPLETED
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.COMPLETED)

                    # 逐个检查面试者是否还有其他未完成的志愿
                    for candidate_id in current_candidate_ids:
                        candidate = Candidate.objects.get(id=candidate_id)
                        # 检查该面试者是否还有其他志愿未完成（WAITING 或 INQUEUE 状态）
                        has_pending_volunteers = Volunteer.objects.filter(
                            candidate_id=candidate_id
                        ).exclude(
                            status__in=[Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED,
                                        Volunteer.Status.ACCEPTED]
                        ).exists()

                        if has_pending_volunteers:
                            candidate.status = Candidate.Status.WAITING
                        else:
                            candidate.status = Candidate.Status.COMPLETED
                        candidate.save()

                elif new_status == InterviewGroup.Status.CANCELLED:
                    # 已取消 -> 该部门志愿状态为 FILLED
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.FILLED)

                    # 逐个检查面试者是否还有其他未完成的志愿
                    for candidate_id in current_candidate_ids:
                        candidate = Candidate.objects.get(id=candidate_id)
                        has_pending_volunteers = Volunteer.objects.filter(
                            candidate_id=candidate_id
                        ).exclude(
                            status__in=[Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED,
                                        Volunteer.Status.ACCEPTED]
                        ).exists()

                        if has_pending_volunteers:
                            candidate.status = Candidate.Status.WAITING
                        else:
                            candidate.status = Candidate.Status.REGISTERED
                        candidate.save()

                elif new_status == InterviewGroup.Status.PENDING and old_status != InterviewGroup.Status.PENDING:
                    # 从其他状态改为待开始 -> 该部门志愿状态为 INQUEUE
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.INQUEUE)
                    Candidate.objects.filter(id__in=current_candidate_ids).update(
                        status=Candidate.Status.INQUEUE
                    )
            # ========== 状态同步结束 ==========
            '''
            这里有一个业务逻辑漏洞：如果部门改变了（面试官对应修改），状态也改变了，
            面试者列表没改或子集，那么原部门的志愿状态会被跳过更改
            '''
            group.save()
            return JsonResponse({'success': True, 'message': '更新成功'})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'success': False, 'message': str(e)})

    # 处理非 GET/POST 请求
    return JsonResponse({'success': False, 'message': '不支持的请求方法'})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_group_create(request, department=None):
    """创建面试场次（仅本部门）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)

        if not department or department == 'ALL':
            department = data.get('department', 'UNK')

        interviewer_ids = data.get('interviewer_ids', [])
        is_valid, error_msg, target_group = validate_interviewer_group_constraint(interviewer_ids, department)
        if not is_valid:
            return JsonResponse({'success': False, 'message': error_msg})

        interview_date = data.get('interview_date')
        from django.utils import timezone
        if interview_date:
            naive_datetime = datetime.strptime(interview_date, '%Y-%m-%dT%H:%M')
            interview_date = timezone.make_aware(naive_datetime)
        else:
            interview_date = timezone.now()

        group_id = data.get('group_id', '').strip()

        group = InterviewGroup.objects.create(
            group_id='',
            departments=department,
            status=data.get('status', 'PENDING'),
            interview_date=interview_date,
            basic_question1='',
            basic_question2='',
            rush_question='',
        )

        if not group_id:
            group_id = f"{department}_{group.id}_{datetime.now().strftime('%m%d%H%M%S')}"
            group.group_id = group_id
            group.save()
        else:
            group.group_id = group_id
            group.save()

        if interviewer_ids:
            group.interviewers.set(interviewer_ids)

        candidates_data = data.get('candidates', [])
        for candidate_info in candidates_data:
            candidate_id = candidate_info.get('candidate_id') or candidate_info.get('id')
            order = candidate_info.get('order', 0)

            if candidate_id and order:
                # 检查该面试者是否已被分配到其他有效场次
                valid_statuses = [InterviewGroup.Status.PENDING, InterviewGroup.Status.ONGOING, InterviewGroup.Status.PAUSE]
                existing_in_other_group = CandidateInGroup.objects.filter(
                    candidate_id=candidate_id
                ).filter(
                    group__status__in=valid_statuses
                ).exists()

                if not existing_in_other_group:
                    CandidateInGroup.objects.create(
                        group=group,
                        candidate_id=candidate_id,
                        order=order
                    )
                    # 更新面试者状态为队列中
                    Candidate.objects.filter(id=candidate_id).update(
                        status=Candidate.Status.INQUEUE
                    )
                    # 更新该面试者对应部门的志愿状态为 INQUEUE
                    Volunteer.objects.filter(
                        candidate_id=candidate_id,
                        department=department
                    ).update(status=Volunteer.Status.INQUEUE)

        return JsonResponse({'success': True, 'message': '创建成功', 'id': group.id})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_group_cancel(request, group_id, department=None):
    """取消面试场次（改为状态变更为已取消）"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
        # 只有待开始状态才能取消
        if group.status != InterviewGroup.Status.PENDING:
            return JsonResponse({
                'success': False,
                'message': f'当前场次状态为 {group.get_status_display()}，只有"待开始"状态才能取消'
            })

        # 获取该组关联的面试者ID
        candidate_ids = set(group.candidates.values_list('candidate_id', flat=True))

        # 将状态改为已取消
        group.status = InterviewGroup.Status.CANCELLED
        group.save()

        # 更新对应部门的志愿状态为 FILLED
        if candidate_ids:
            Volunteer.objects.filter(
                candidate_id__in=candidate_ids,
                department=group.departments
            ).update(status=Volunteer.Status.FILLED)

            # 逐个检查面试者是否还有其他未完成的志愿
            for candidate_id in candidate_ids:
                candidate = Candidate.objects.get(id=candidate_id)
                has_pending_volunteers = Volunteer.objects.filter(
                    candidate_id=candidate_id
                ).exclude(
                    status__in=[Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED, Volunteer.Status.ACCEPTED]
                ).exists()

                if has_pending_volunteers:
                    candidate.status = Candidate.Status.WAITING
                else:
                    candidate.status = Candidate.Status.REGISTERED
                candidate.save()

        return JsonResponse({'success': True, 'message': '取消成功'})
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_candidates_all(request, department=None):
    """获取所有可用的面试者列表（对指定部门有WAITING志愿且未被分配到有效场次的，仅显示本部门）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        if not department or department == 'ALL':
            department = request.GET.get('department', '')

        if not department:
            return JsonResponse({
                'success': False,
                'message': '缺少部门参数'
            })

        # 获取已分配到有效场次（待开始/进行中/暂停中）的面试者ID
        valid_statuses = [InterviewGroup.Status.PENDING, InterviewGroup.Status.ONGOING, InterviewGroup.Status.PAUSE]
        assigned_candidate_ids = CandidateInGroup.objects.filter(
            group__status__in=valid_statuses
        ).values_list('candidate_id', flat=True)

        # 筛选条件：对该部门有 WAITING 志愿的面试者，且未被分配到有效场次
        candidates = Candidate.objects.filter(
            volunteers__department=department,
            volunteers__status=Volunteer.Status.WAITING
        ).exclude(
            id__in=assigned_candidate_ids
        ).distinct().order_by('name')

        data = []
        for candidate in candidates:
            # 获取该面试者 WAITING 状态的志愿部门列表
            volunteer_depts = candidate.volunteers.filter(
                status=Volunteer.Status.WAITING
            ).values_list('department', flat=True)
            data.append({
                'id': candidate.id,
                'name': candidate.name,
                'student_number': candidate.student_number,
                'school': candidate.get_school_display(),
                'gender': candidate.get_gender_display(),
                'volunteer_departments': list(volunteer_depts),
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
def api_subadmin_group_candidates(request, group_id, department=None):
    """获取场次关联的面试者列表（仅本部门）"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    if request.method == 'GET':
        candidates_in_group = group.candidates.all().select_related('candidate').order_by('order')

        data = []
        for cig in candidates_in_group:
            data.append({
                'id': cig.id,
                'candidate_id': cig.candidate.id,
                'name': cig.candidate.name,
                'student_number': cig.candidate.student_number,
                'school': cig.candidate.get_school_display(),
                'gender': cig.candidate.get_gender_display(),
                'order': cig.order,
            })

        return JsonResponse({
            'success': True,
            'data': data,
            'max_order': 6
        })

    return JsonResponse({'success': False, 'message': '请求方法错误'})


@subadmin_required(return_json=True)
@department_permission_required(return_json=True)
def api_subadmin_group_interviewers(request, group_id, department=None):
    """获取场次关联的面试官列表（仅本部门）"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    if request.method == 'GET':
        interviewers = group.interviewers.all()

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

    return JsonResponse({'success': False, 'message': '请求方法错误'})

