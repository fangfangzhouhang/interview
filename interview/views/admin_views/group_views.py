import json
from datetime import datetime
from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt

from ..permission import (
    admin_required,
)

from ...models import InterviewGroup, Interviewer, CandidateInGroup, Candidate, InterviewerGroup, Volunteer


@admin_required()
def admin_groups_view(request):
    """管理员面试场次管理视图"""
    return render(request, 'addmin/addmin_groups.html')

def validate_interviewer_group_constraint(interviewer_ids):
    """
    验证面试官列表是否符合约束：
    1. 所有面试官属于同一个 InterviewerGroup（子集关系）
    2. 该组的状态必须为启用中（ONUSE）
    3. 该组的主面试官（chief）在列表中

    返回: (is_valid, error_message, target_group)
    """
    if not interviewer_ids:
        # 没有选择面试官，直接返回错误（场次必须有面试官）
        return False, '请至少选择一个面试官', None

    selected_interviewers = Interviewer.objects.filter(id__in=interviewer_ids)
    selected_ids_set = set(interviewer_ids)

    # 检查是否所有选中的面试官都存在
    if len(selected_interviewers) != len(interviewer_ids):
        return False, '部分面试官不存在，请刷新后重试', None

    # 找出所有面试官共同所属的组（且状态为启用中）
    common_groups = None
    for interviewer in selected_interviewers:
        # 只获取状态为启用中的组
        groups = interviewer.groups.filter(status=InterviewerGroup.Status.ONUSE)
        if not groups.exists():
            return False, f'面试官 "{interviewer.name}" 不属于任何启用中的面试官组，请先将其加入启用中的组', None
        group_ids = set(groups.values_list('id', flat=True))
        if common_groups is None:
            common_groups = group_ids
        else:
            common_groups = common_groups & group_ids

        if not common_groups:
            return False, f'面试官 "{interviewer.name}" 与已选面试官不属于同一个启用中的组', None

    # 取第一个共同组
    target_group_id = list(common_groups)[0]
    target_group = InterviewerGroup.objects.get(id=target_group_id)

    # 验证：选中的面试官是否是该组的子集
    group_member_ids = set(target_group.members.values_list('id', flat=True))
    if not selected_ids_set.issubset(group_member_ids):
        return False, '所选面试官不属于同一个面试官组，请确保所有面试官属于同一组', None

    # 验证：该组的主面试官必须在选中列表中
    # 直接通过 chief 字段获取主面试官
    chief = target_group.chief
    if chief:
        if chief.id not in selected_ids_set:
            return False, f'该面试官组的主面试官 "{chief.name}" 必须在面试官列表中', None
    else:
        return False, '所选面试官组未设置主面试官，请先设置主面试官', None

    return True, None, target_group

@csrf_exempt
@admin_required(return_json=True)
def api_admin_groups(request):
    """获取面试场次列表 / 批量取消"""
    if request.method == 'GET':
        groups = InterviewGroup.objects.all().prefetch_related('interviewers', 'candidates__candidate')

        search = request.GET.get('search', '')
        if search:
            groups = groups.filter(
                Q(group_id__icontains=search) |
                Q(departments__icontains=search)
            )

        department = request.GET.get('department', '')
        if department:
            groups = groups.filter(departments=department)

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

        # ====== 修改排序逻辑：与 subadmin 保持一致 ======
        # 暂停中 > 待开始 > 进行中 > 已结束 > 已取消，同状态按ID降序
        status_order = {
            'PENDING': 2,    # 暂停中
            'PAUSE': 1,      # 待开始
            'ONGOING': 3,    # 进行中
            'ENDED': 4,      # 已结束
            'CANCELLED': 5,  # 已取消
        }
        all_data.sort(key=lambda x: (
            status_order.get(x.get('status_code', ''), 99),
            -x.get('id', 0)  # ID大的在前
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
        pass
        '''
        try:
            data = json.loads(request.body)
            ids = data.get('ids', [])
            if ids:
                CandidateInGroup.objects.filter(group_id__in=ids).delete()
                InterviewGroup.objects.filter(id__in=ids).delete()
                return JsonResponse({'success': True, 'message': f'成功删除 {len(ids)} 条记录'})
            return JsonResponse({'success': False, 'message': '请选择要删除的记录'})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)})
        '''


@csrf_exempt
@admin_required(return_json=True)
def api_admin_groups_options(request):
    """获取场次管理所需的选项数据（部门、状态、面试官列表）"""
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
            #{'value': 'UNK', 'label': '未知'},
        ]

        statuses = [
            {'value': 'PENDING', 'label': '待开始'},
            {'value': 'ONGOING', 'label': '进行中'},
            {'value': 'PAUSE', 'label': '暂停中'},
            {'value': 'ENDED', 'label': '已结束'},
            {'value': 'CANCELLED', 'label': '已取消'},
        ]

        interviewers = Interviewer.objects.all().select_related('user')
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
            'departments': departments,
            'statuses': statuses,
            'interviewers': interviewer_options,
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'获取选项失败：{str(e)}'
        })


@csrf_exempt
@admin_required(return_json=True)
def api_admin_group_detail(request, group_id):
    """获取/更新面试场次详情"""
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

            # 获取提交的新状态
            new_status = data.get('status', group.status)

            # Admin逻辑：原来不是待开始 且 提交后也不是待开始，则拦截
            if group.status != InterviewGroup.Status.PENDING and new_status != InterviewGroup.Status.PENDING:
                return JsonResponse({
                    'success': False,
                    'message': f'当前场次状态为 {group.get_status_display()}，只有"待开始"状态或修改为"待开始"状态时才能修改场次详情'
                })

            # ========== 验证面试官组约束 ==========
            interviewer_ids = data.get('interviewer_ids', [])
            is_valid, error_msg, target_group = validate_interviewer_group_constraint(interviewer_ids)
            if not is_valid:
                return JsonResponse({'success': False, 'message': error_msg})
            # ========== 验证结束 ==========

            # 获取当前组内的面试者ID列表
            old_candidate_ids = set(group.candidates.values_list('candidate_id', flat=True))
            old_department = group.departments
            old_status = group.status

            # 更新基本信息
            new_group_id = data.get('group_id', '').strip()
            if new_group_id:
                group.group_id = new_group_id

            group.departments = data.get('department', group.departments)
            group.status = new_status

            # 更新面试时间
            interview_date = data.get('interview_date')
            if interview_date:
                from django.utils import timezone
                naive_datetime = datetime.strptime(interview_date, '%Y-%m-%dT%H:%M')
                group.interview_date = timezone.make_aware(naive_datetime)

            # 更新关联面试官
            if interviewer_ids is not None:
                group.interviewers.set(interviewer_ids)

            # 更新关联面试者
            candidates_data = data.get('candidates', [])

            # 获取新提交的面试者ID列表
            new_candidate_ids = set()
            for candidate_info in candidates_data:
                candidate_id = candidate_info.get('candidate_id') or candidate_info.get('id')
                if candidate_id:
                    new_candidate_ids.add(candidate_id)

            # 计算被移除的面试者（旧有但新提交中没有）
            removed_candidate_ids = old_candidate_ids - new_candidate_ids

            # 将被移除的面试者状态改为 WAITING（候场中）
            if removed_candidate_ids:
                Candidate.objects.filter(id__in=removed_candidate_ids).update(
                    status=Candidate.Status.WAITING
                )
                # 更新对应部门的志愿状态为 WAITING
                Volunteer.objects.filter(
                    candidate_id__in=removed_candidate_ids,
                    department=old_department
                ).update(status=Volunteer.Status.WAITING)

            # 删除该组所有现有的面试者关联
            group.candidates.all().delete()

            # 重新创建新的关联
            for candidate_info in candidates_data:
                candidate_id = candidate_info.get('candidate_id') or candidate_info.get('id')
                order = candidate_info.get('order', 0)

                if not candidate_id or not order:
                    continue

                # 检查该面试者是否已被分配到其他有效场次
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

                # 将新增的面试者状态改为 INQUEUE（队列中）
                Candidate.objects.filter(id=candidate_id).update(
                    status=Candidate.Status.INQUEUE
                )
                # 更新对应部门的志愿状态为 INQUEUE
                Volunteer.objects.filter(
                    candidate_id=candidate_id,
                    department=group.departments
                ).update(status=Volunteer.Status.INQUEUE)

            # ========== 根据场次状态更新面试者的志愿状态 ==========
            # 获取当前组内所有面试者ID（重新获取，因为上面删除了又重新创建）
            current_candidate_ids = set(group.candidates.values_list('candidate_id', flat=True))

            if current_candidate_ids:
                if new_status == InterviewGroup.Status.ONGOING or new_status == InterviewGroup.Status.PAUSE:
                    # 面试中或暂停中 -> 志愿状态为 INTERVIEWING，面试者状态为 INTERVIEWING
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.INTERVIEWING)
                    Candidate.objects.filter(id__in=current_candidate_ids).update(
                        status=Candidate.Status.INTERVIEWING
                    )
                elif new_status == InterviewGroup.Status.ENDED:
                    # 已结束 -> 更新志愿状态为 COMPLETED
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
                            # 还有其他志愿未完成 -> 状态改为 WAITING（候场中）
                            candidate.status = Candidate.Status.WAITING
                        else:
                            # 所有志愿都已完成 -> 状态改为 COMPLETED
                            candidate.status = Candidate.Status.COMPLETED
                        candidate.save()

                elif new_status == InterviewGroup.Status.CANCELLED:
                    # 已取消 -> 志愿状态为 FILLED
                    Volunteer.objects.filter(
                        candidate_id__in=current_candidate_ids,
                        department=group.departments
                    ).update(status=Volunteer.Status.FILLED)

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
                            # 还有其他志愿未完成 -> 状态改为 WAITING（候场中）
                            candidate.status = Candidate.Status.WAITING
                        else:
                            # 所有志愿都已完成 -> 状态改为 REGISTERED（已报名）
                            candidate.status = Candidate.Status.REGISTERED
                        candidate.save()

                elif new_status == InterviewGroup.Status.PENDING and old_status != InterviewGroup.Status.PENDING:
                    # 从其他状态改为待开始 -> 志愿状态为 INQUEUE
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

    # 添加默认返回，处理非 GET/POST 请求
    return JsonResponse({'success': False, 'message': '不支持的请求方法'})


@csrf_exempt
@admin_required(return_json=True)
def api_admin_group_create(request):
    """创建面试场次"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)

        # ========== 验证面试官组约束 ==========
        interviewer_ids = data.get('interviewer_ids', [])
        is_valid, error_msg, target_group = validate_interviewer_group_constraint(interviewer_ids)
        if not is_valid:
            return JsonResponse({'success': False, 'message': error_msg})
        # ========== 验证结束 ==========

        interview_date = data.get('interview_date')
        from django.utils import timezone
        if interview_date:
            naive_datetime = datetime.strptime(interview_date, '%Y-%m-%dT%H:%M')
            interview_date = timezone.make_aware(naive_datetime)
        else:
            interview_date = timezone.now()

        department = data.get('department', 'UNK')
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
            group_id = f"{department}_{group.id}_{timezone.now().strftime('%m%d%H%M%S')}"
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
                if not CandidateInGroup.objects.filter(candidate_id=candidate_id).exists():
                    CandidateInGroup.objects.create(
                        group=group,
                        candidate_id=candidate_id,
                        order=order
                    )
                    # 更新面试者状态为队列中
                    Candidate.objects.filter(id=candidate_id).update(
                        status=Candidate.Status.INQUEUE
                    )
                    # 更新该面试者对应部门的志愿状态为队列中
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
@admin_required(return_json=True)
def api_admin_group_cancel(request, group_id):
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
                # 检查该面试者是否还有其他志愿未完成（WAITING 或 INQUEUE 状态）
                has_pending_volunteers = Volunteer.objects.filter(
                    candidate_id=candidate_id
                ).exclude(
                    status__in=[Volunteer.Status.COMPLETED, Volunteer.Status.REJECTED, Volunteer.Status.ACCEPTED]
                ).exists()

                if has_pending_volunteers:
                    # 还有其他志愿未完成 -> 状态改为 WAITING（候场中）
                    candidate.status = Candidate.Status.WAITING
                else:
                    # 所有志愿都已完成 -> 状态改为 REGISTERED（已报名）
                    candidate.status = Candidate.Status.REGISTERED
                candidate.save()

        return JsonResponse({'success': True, 'message': '取消成功'})
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@admin_required(return_json=True)
def api_admin_candidates_all(request):
    """获取所有可用的面试者列表（对指定部门有WAITING志愿且未被分配到有效场次的）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        department = request.GET.get('department', '')

        # 获取已分配到有效场次（待开始/进行中/暂停中）的面试者ID
        valid_statuses = [InterviewGroup.Status.PENDING, InterviewGroup.Status.ONGOING, InterviewGroup.Status.PAUSE]
        assigned_candidate_ids = CandidateInGroup.objects.filter(
            group__status__in=valid_statuses
        ).values_list('candidate_id', flat=True)

        # 基础筛选：有志愿状态为 WAITING 的面试者
        candidates = Candidate.objects.filter(
            volunteers__status=Volunteer.Status.WAITING
        )

        # 如果指定了部门，只显示对该部门有 WAITING 志愿的面试者
        if department:
            candidates = candidates.filter(
                volunteers__department=department,
                volunteers__status=Volunteer.Status.WAITING
            )

        # 排除已分配到有效场次的面试者
        candidates = candidates.exclude(
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


@admin_required(return_json=True)
def api_admin_group_candidates(request, group_id):
    """获取场次关联的面试者列表"""
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


@csrf_exempt
@admin_required(return_json=True)
def api_admin_group_interviewers(request, group_id):
    """获取场次关联的面试官列表"""
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
