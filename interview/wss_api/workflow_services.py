from django.utils import timezone
from django.core.exceptions import ValidationError
from django.apps import apps

from ..models import SCORE_DIMENSIONS
from ..permissions.roles import Role, RoleManager


class InterviewService:
    """面试业务逻辑服务类"""

    WORKFLOW_ROLES = {
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.SUBADMIN,
        Role.INTERVIEWER,
    }

    @staticmethod
    def _has_workflow_role(user):
        """Identity gate; Interviewer records are checked later only for scope."""
        return RoleManager.get_user_role(user) in InterviewService.WORKFLOW_ROLES

    @staticmethod
    def _get_models():
        """延迟获取所有模型 - 在函数调用时加载"""
        return {
            'Interviewer': apps.get_model('interview', 'Interviewer'),
            'InterviewGroup': apps.get_model('interview', 'InterviewGroup'),
            'InterviewerGroup': apps.get_model('interview', 'InterviewerGroup'),
            'InterviewerScore': apps.get_model('interview', 'InterviewerScore'),
            'CandidateInGroup': apps.get_model('interview', 'CandidateInGroup'),
            'Candidate': apps.get_model('interview', 'Candidate'),
            'Volunteer': apps.get_model('interview', 'Volunteer'),
        }

    @staticmethod
    def check_user_permission(user, group_id):
        """检查用户是否有权限访问该组"""
        if not InterviewService._has_workflow_role(user):
            return False

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']

            interviewer = Interviewer.objects.get(user=user)
            group = InterviewGroup.objects.get(id=group_id)
            return group.interviewers.filter(id=interviewer.id).exists()
        except (Interviewer.DoesNotExist, InterviewGroup.DoesNotExist):
            return False

    @staticmethod
    def is_chief(user, group_id):
        """检查用户是否是该场次的主考官

        判定规则（稳健版）：
        - 用户必须是该场次的面试官（成员校验）
        - 用户是某个未销毁、同部门面试官组的主考官

        说明：场次创建时已强制"面试官列表 ⊆ 某个面试官组，且 chief 必须在列表中"，
        因此不再做严格子集匹配（成员后续变动会导致子集校验永久失败、主考官按钮失灵）。
        """
        if not InterviewService._has_workflow_role(user):
            return False

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']
            InterviewerGroup = models['InterviewerGroup']

            interviewer = Interviewer.objects.get(user=user)
            group = InterviewGroup.objects.get(id=group_id)

            # 必须是该场次的面试官
            if not group.interviewers.filter(id=interviewer.id).exists():
                return False

            # 是某个未销毁、同部门面试官组的主考官
            return InterviewerGroup.objects.filter(
                chief=interviewer,
                department=group.departments,
            ).exclude(
                status=InterviewerGroup.Status.ENDED,
            ).exists()
        except (Interviewer.DoesNotExist, InterviewGroup.DoesNotExist):
            return False

    @staticmethod
    def find_group_chief(group):
        """查找场次的关联面试官组与其主考官（用于展示）

        优先返回覆盖场次面试官最多的未销毁面试官组。
        返回: (interviewer_group, chief)
        """
        models = InterviewService._get_models()
        InterviewerGroup = models['InterviewerGroup']

        interviewer_ids = list(group.interviewers.values_list('id', flat=True))
        if not interviewer_ids:
            return None, None

        candidates_ig = InterviewerGroup.objects.filter(
            members__in=interviewer_ids,
        ).exclude(
            status=InterviewerGroup.Status.ENDED,
        ).distinct()

        best_ig = None
        best_overlap = 0
        for ig in candidates_ig:
            ig_member_ids = set(ig.members.values_list('id', flat=True))
            overlap = len(ig_member_ids & set(interviewer_ids))
            if overlap > best_overlap:
                best_overlap = overlap
                best_ig = ig

        if best_ig is None:
            return None, None
        return best_ig, best_ig.chief

    @staticmethod
    def sync_questions_from_polling(user, group_id, question_data):
        """HTTP轮询时同步题目 - 保存用户编辑的内容"""
        if not InterviewService._has_workflow_role(user):
            return False, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']

            interviewer = Interviewer.objects.get(user=user)
            group = InterviewGroup.objects.get(id=group_id)

            if not group.interviewers.filter(id=interviewer.id).exists():
                return False, '您不是该场次的面试官'

            # 保存题目
            group.basic_question1 = question_data.get('basic_question_1', '')
            group.basic_question2 = question_data.get('basic_question_2', '')
            group.rush_question = question_data.get('rush_question', '')
            group.save()

            return True, None
        except InterviewGroup.DoesNotExist:
            return False, '面试组不存在'
        except Interviewer.DoesNotExist:
            return False, '面试官不存在'
        except Exception as e:
            return False, str(e)

    @staticmethod
    def get_group_detail(user, group_id, is_websocket_mode=False):
        """获取面试组详细信息

        Args:
            user: 当前用户
            group_id: 组ID
            is_websocket_mode: 是否处于WebSocket模式（所有面试官都有控制权限）
        """
        if not InterviewService._has_workflow_role(user):
            return None, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']
            InterviewerGroup = models['InterviewerGroup']

            group = InterviewGroup.objects.get(id=group_id)

            try:
                interviewer = Interviewer.objects.get(user=user)
                if not group.interviewers.filter(id=interviewer.id).exists():
                    return None, '您不是该场次的面试官'
            except Interviewer.DoesNotExist:
                return None, '面试官业务资料不存在'

            # WebSocket模式下所有面试官都有控制权限
            if is_websocket_mode:
                is_chief = True
                chief_name = 'WebSocket协作模式'
            else:
                is_chief = False
                chief_name = None
                _, chief = InterviewService.find_group_chief(group)
                if chief is not None:
                    chief_name = chief.name
                    if chief.id == interviewer.id:
                        is_chief = True
                elif group.interviewers.exists():
                    chief_name = '未设置'

            data = {
                'id': group.id,
                'group_id': group.group_id,
                'departments': group.departments,
                'status': group.status,
                'status_display': group.get_status_display(),
                'basic_question1': group.basic_question1 or '',
                'basic_question2': group.basic_question2 or '',
                'rush_question': group.rush_question or '',
                'start_time': group.start_time.isoformat() if group.start_time else None,
                'end_time': group.end_time.isoformat() if group.end_time else None,
                'is_chief': is_chief,
                'chief_name': chief_name,
                'interviewer_names': [i.name for i in group.interviewers.all()],
                'is_websocket_mode': is_websocket_mode,
            }
            return data, None
        except InterviewGroup.DoesNotExist:
            return {'error': '面试组不存在'}, None

    @staticmethod
    def get_candidates_in_group(group_id, user):
        """获取指定面试组的所有面试者"""
        if not InterviewService._has_workflow_role(user):
            return None, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']
            InterviewerScore = models['InterviewerScore']

            group = InterviewGroup.objects.get(id=group_id)

            interviewer = Interviewer.objects.get(user=user)
            if not group.interviewers.filter(id=interviewer.id).exists():
                return None, '您不是该场次的面试官'

            candidates_in_group = group.candidates.all().select_related('candidate')

            result = []
            for cig in candidates_in_group:
                try:
                    score_obj = InterviewerScore.objects.get(
                        candidate=cig.candidate,
                        interviewer=interviewer
                    )
                    score = float(score_obj.score)
                    comment = score_obj.comment
                    self_intro = score_obj.self_intro
                    has_score = score > 0
                except InterviewerScore.DoesNotExist:
                    score = None
                    comment = None
                    self_intro = None
                    has_score = False

                all_scores = InterviewerScore.objects.filter(
                    candidate=cig.candidate,
                    interview_group=group
                )
                avg_score = 0
                valid_scores = [s for s in all_scores if s.score > 0]
                if valid_scores:
                    avg_score = sum(s.score for s in valid_scores) / len(valid_scores)

                result.append({
                    'id': cig.id,
                    'order': cig.order,
                    'candidate': {
                        'id': cig.candidate.id,
                        'name': cig.candidate.name,
                    },
                    'score': score,
                    'comment': comment,
                    'self_intro': self_intro,
                    'has_score': has_score,
                    'avg_score': float(avg_score) if avg_score else 0,
                    'scores': [
                        {
                            'interviewer': s.interviewer.name,
                            'score': float(s.score)
                        } for s in all_scores
                    ]
                })

            return result, None
        except InterviewGroup.DoesNotExist:
            return None, '面试组不存在'
        except Interviewer.DoesNotExist:
            return None, '面试官不存在'

    @staticmethod
    def get_candidate_detail(candidate_in_group_id, user):
        """获取指定组内面试者的详细信息"""
        if not InterviewService._has_workflow_role(user):
            return None, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            CandidateInGroup = models['CandidateInGroup']
            InterviewerScore = models['InterviewerScore']

            candidate_in_group = CandidateInGroup.objects.get(id=candidate_in_group_id)
            group = candidate_in_group.group

            interviewer = Interviewer.objects.get(user=user)

            if not group.interviewers.filter(id=interviewer.id).exists():
                return None, '您不是该场次的面试官'

            try:
                score_obj = InterviewerScore.objects.get(
                    candidate=candidate_in_group.candidate,
                    interviewer=interviewer
                )
                current_score = float(score_obj.score)
                current_comment = score_obj.comment
                current_self_intro = score_obj.self_intro
            except InterviewerScore.DoesNotExist:
                current_score = None
                current_comment = None
                current_self_intro = None

            all_scores = InterviewerScore.objects.filter(
                candidate=candidate_in_group.candidate,
                interview_group=group
            )
            valid_scores = [s for s in all_scores if s.score > 0]
            avg_score = 0
            if valid_scores:
                avg_score = sum(s.score for s in valid_scores) / len(valid_scores)

            # 获取头像URL（优先使用缩略图）
            avatar_url = None
            avatar_thumbnail_url = None
            if candidate_in_group.candidate.avatar:
                avatar_url = candidate_in_group.candidate.avatar.url
                if candidate_in_group.candidate.avatar_thumbnail:
                    avatar_thumbnail_url = candidate_in_group.candidate.avatar_thumbnail.url
                else:
                    # 如果没有缩略图，使用原图但添加参数
                    avatar_thumbnail_url = f"{avatar_url}?w=80&h=106"

            data = {
                'id': candidate_in_group.id,
                'order': candidate_in_group.order,
                'candidate': {
                    'id': candidate_in_group.candidate.id,
                    'name': candidate_in_group.candidate.name,
                    'gender': candidate_in_group.candidate.gender,
                    'gender_display': candidate_in_group.candidate.get_gender_display(),
                    'political_status': candidate_in_group.candidate.political_status,
                    'school': candidate_in_group.candidate.school,
                    'school_display': candidate_in_group.candidate.get_school_display(),
                    'homeroom': candidate_in_group.candidate.homeroom,
                    'student_number': candidate_in_group.candidate.student_number,
                    'character': candidate_in_group.candidate.character,
                    'introduction': candidate_in_group.candidate.introduction,
                    'experience': candidate_in_group.candidate.experience,
                    'honor': candidate_in_group.candidate.honor,
                    'avatar_url': avatar_url,
                    'avatar_thumbnail_url': avatar_thumbnail_url,
                },
                'self_intro': current_self_intro or '',
                'score': current_score,
                'comment': current_comment or '',
                'avg_score': float(avg_score) if avg_score else 0,
                'scores': [
                    {
                        'interviewer': score.interviewer.name,
                        'score': float(score.score)
                    } for score in all_scores
                ]
            }
            return data, None
        except CandidateInGroup.DoesNotExist:
            return None, '面试者不存在'
        except Interviewer.DoesNotExist:
            return None, '面试官不存在'

    @staticmethod
    def get_existing_evaluation(candidate_in_group_id, user):
        """获取已存在的评价 - 支持返回多维度百分制评分"""
        if not InterviewService._has_workflow_role(user):
            return None, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            CandidateInGroup = models['CandidateInGroup']
            InterviewerScore = models['InterviewerScore']
            InterviewGroup = models['InterviewGroup']

            interviewer = Interviewer.objects.get(user=user)
            candidate_in_group = CandidateInGroup.objects.get(id=candidate_in_group_id)
            group = candidate_in_group.group

            if not group.interviewers.filter(id=interviewer.id).exists():
                return None, '您不是该场次的面试官'

            scores = {}
            dimension_scores = {}
            self_intros = {}
            comments = {}

            for order in range(1, 7):
                try:
                    target = CandidateInGroup.objects.get(group=group, order=order)
                    score_obj = InterviewerScore.objects.get(
                        candidate=target.candidate,
                        interviewer=interviewer,
                        interview_group=group
                    )
                    scores[f'score_{order}'] = float(score_obj.score)
                    dimension_scores[f'dimension_scores_{order}'] = score_obj.dimension_scores or {}
                    self_intros[f'self_intro_{order}'] = score_obj.self_intro or ''
                    comments[f'comment_{order}'] = score_obj.comment or ''
                except (CandidateInGroup.DoesNotExist, InterviewerScore.DoesNotExist):
                    scores[f'score_{order}'] = None
                    dimension_scores[f'dimension_scores_{order}'] = {}
                    self_intros[f'self_intro_{order}'] = ''
                    comments[f'comment_{order}'] = ''

            has_evaluation = any(
                v is not None and v > 0 for v in scores.values()
            ) or any(
                v for v in self_intros.values()
            ) or any(
                v for v in comments.values()
            )

            data = {
                'candidate_in_group_id': candidate_in_group.id,
                'has_evaluation': has_evaluation,
                **self_intros,
                **scores,
                **dimension_scores,
                **comments,
                'basic_question_1': group.basic_question1 or '',
                'basic_question_2': group.basic_question2 or '',
                'rush_question': group.rush_question or '',
                # 返回评分维度配置供前端使用
                'score_dimensions': [
                    {'code': d['code'], 'name': d['name'], 'max_score': d['max_score']}
                    for d in SCORE_DIMENSIONS
                ],
                'score_total_max': sum(d['max_score'] for d in SCORE_DIMENSIONS),
            }

            return data, None

        except CandidateInGroup.DoesNotExist:
            return {'has_evaluation': False}, None
        except Interviewer.DoesNotExist:
            return None, '面试官业务资料不存在'

    @staticmethod
    def save_evaluation(user, data, is_websocket_mode=False):
        """保存面试评价 - 支持多维度百分制评分

        Args:
            user: 当前用户
            data: 评价数据
                - score_{i}: 总分（向后兼容，0-100）
                - dimension_scores_{i}: 维度得分对象，如 {"expression": 20, "resume": 15, ...}
                - self_intro_{i}: 自我介绍
                - comment_{i}: 评语
            is_websocket_mode: 是否处于WebSocket模式
        """
        if not InterviewService._has_workflow_role(user):
            return False, '您没有面试工作流权限'

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            CandidateInGroup = models['CandidateInGroup']
            InterviewerScore = models['InterviewerScore']
            InterviewGroup = models['InterviewGroup']

            interviewer = Interviewer.objects.get(user=user)

            candidate_in_group_id = data.get('candidate_in_group_id')
            if not candidate_in_group_id:
                return False, '缺少面试者ID'

            candidate_in_group = CandidateInGroup.objects.get(id=candidate_in_group_id)
            group = candidate_in_group.group

            if not group.interviewers.filter(id=interviewer.id).exists():
                return False, '您不是该场次的面试官'

            if group.status == InterviewGroup.Status.ENDED:
                return False, '面试已结束，不可编辑'
            if group.status == InterviewGroup.Status.PENDING:
                return False, '面试尚未开始'
            if group.status == InterviewGroup.Status.CANCELLED:
                return False, '面试已取消'
            if group.status == InterviewGroup.Status.PAUSE:
                return False, '面试已暂停，不可编辑'

            for i in range(1, 7):
                score_key = f'score_{i}'
                dimension_key = f'dimension_scores_{i}'
                self_intro_key = f'self_intro_{i}'
                comment_key = f'comment_{i}'

                has_score = score_key in data
                has_dimensions = dimension_key in data
                has_self_intro = self_intro_key in data
                has_comment = comment_key in data

                if has_score or has_dimensions or has_self_intro or has_comment:
                    try:
                        target_candidate = CandidateInGroup.objects.get(group=group, order=i)

                        # 准备默认值
                        defaults = {
                            'self_intro': data.get(self_intro_key, ''),
                            'comment': data.get(comment_key, ''),
                        }

                        # 处理得分
                        if has_dimensions:
                            # 新格式：维度得分
                            dim_scores = data.get(dimension_key, {})
                            if isinstance(dim_scores, str):
                                import json
                                dim_scores = json.loads(dim_scores)
                            defaults['dimension_scores'] = dim_scores
                            # 总分会在 save() 时自动计算
                            defaults['score'] = 0  # 占位，save时计算
                        elif has_score:
                            # 向后兼容：直接使用总分
                            defaults['score'] = float(data[score_key])
                            defaults['dimension_scores'] = {}

                        score_obj, created = InterviewerScore.objects.get_or_create(
                            candidate=target_candidate.candidate,
                            interviewer=interviewer,
                            interview_group=group,
                            defaults={
                                'interview_group': group,
                                **defaults
                            }
                        )

                        if not created:
                            updated = False
                            if has_dimensions:
                                dim_scores = data.get(dimension_key, {})
                                if isinstance(dim_scores, str):
                                    import json
                                    dim_scores = json.loads(dim_scores)
                                score_obj.dimension_scores = dim_scores
                                # 总分通过维度得分计算
                                score_obj.score = score_obj.calculate_total()
                                updated = True
                            elif has_score:
                                score_obj.score = float(data[score_key])
                                updated = True
                            if has_self_intro:
                                score_obj.self_intro = data[self_intro_key]
                                updated = True
                            if has_comment:
                                score_obj.comment = data[comment_key]
                                updated = True
                            if updated:
                                score_obj.save()

                    except CandidateInGroup.DoesNotExist:
                        pass
                    except ValueError:
                        pass

            # WebSocket模式下所有面试官都可以编辑题目，HTTP模式下只有主面试官可以
            if is_websocket_mode or InterviewService.is_chief(user, group.id):
                if group.status == InterviewGroup.Status.ONGOING:
                    questions_updated = False
                    if 'basic_question_1' in data and data['basic_question_1'] != group.basic_question1:
                        group.basic_question1 = data['basic_question_1']
                        questions_updated = True
                    if 'basic_question_2' in data and data['basic_question_2'] != group.basic_question2:
                        group.basic_question2 = data['basic_question_2']
                        questions_updated = True
                    if 'rush_question' in data and data['rush_question'] != group.rush_question:
                        group.rush_question = data['rush_question']
                        questions_updated = True

                    if questions_updated:
                        group.save()

            return True, None

        except CandidateInGroup.DoesNotExist:
            return False, '面试者不存在'
        except Interviewer.DoesNotExist:
            return False, '面试官不存在'
        except Exception as e:
            return False, str(e)

    @staticmethod
    def perform_status_action(group_id, action, user, is_websocket_mode=False):
        """执行状态操作

        Args:
            group_id: 组ID
            action: 操作类型 (start/pause/end)
            user: 当前用户
            is_websocket_mode: 是否处于WebSocket模式（所有面试官都可以控制状态）
        """
        if not InterviewService._has_workflow_role(user):
            return False, {'error': '您没有面试工作流权限'}

        try:
            models = InterviewService._get_models()
            Interviewer = models['Interviewer']
            InterviewGroup = models['InterviewGroup']
            InterviewerGroup = models['InterviewerGroup']
            Candidate = models['Candidate']
            Volunteer = models['Volunteer']
            CandidateInGroup = models['CandidateInGroup']

            group = InterviewGroup.objects.get(id=group_id)
            interviewer = Interviewer.objects.get(user=user)

            # WebSocket模式下所有面试官都可以控制状态
            if not is_websocket_mode:
                if not InterviewService.is_chief(user, group_id):
                    return False, {'error': '只有主面试官可以控制面试状态'}

            if action == 'start':
                if group.status == InterviewGroup.Status.PENDING or group.status == InterviewGroup.Status.PAUSE:
                    if group.status == InterviewGroup.Status.PENDING:
                        group.start_time = timezone.now()

                        candidates_in_group = group.candidates.all()
                        for cig in candidates_in_group:
                            # 只更新已叫号（CALLED）的候选人，未叫号的保持 WAITING
                            if cig.call_status == CandidateInGroup.CallStatus.CALLED:
                                cig.call_status = CandidateInGroup.CallStatus.INTERVIEWING
                                cig.save(update_fields=['call_status'])

                                candidate = cig.candidate
                                candidate.status = Candidate.Status.INTERVIEWING
                                candidate.save()

                                Volunteer.objects.filter(
                                    candidate=candidate,
                                    department=group.departments
                                ).exclude(
                                    status__in=[Volunteer.Status.COMPLETED,
                                                Volunteer.Status.REJECTED,
                                                Volunteer.Status.ACCEPTED]
                                ).update(status=Volunteer.Status.INTERVIEWING)

                    interviewer_ids = list(group.interviewers.values_list('id', flat=True))
                    if interviewer_ids:
                        interviewer_groups = InterviewerGroup.objects.filter(
                            members__in=interviewer_ids,
                            status=InterviewerGroup.Status.ONUSE,
                        ).distinct()
                        for ig in interviewer_groups:
                            ig_member_ids = set(ig.members.values_list('id', flat=True))
                            if set(interviewer_ids).issubset(ig_member_ids):
                                ig.status = InterviewerGroup.Status.WORKING
                                ig.save()
                                break

                    group.status = InterviewGroup.Status.ONGOING
                    group.save()
                    return True, {
                        'status': group.status,
                        'message': '面试已开始',
                        'start_time': group.start_time.isoformat() if group.start_time else None
                    }
                else:
                    return False, {'error': f'当前状态为 {group.get_status_display()}，无法开始'}

            elif action == 'pause':
                if group.status == InterviewGroup.Status.ONGOING:
                    group.status = InterviewGroup.Status.PAUSE
                    group.save()
                    return True, {
                        'status': group.status,
                        'message': '面试已暂停'
                    }
                else:
                    return False, {'error': f'当前状态为 {group.get_status_display()}，无法暂停'}

            elif action == 'end':
                if group.status == InterviewGroup.Status.ONGOING or group.status == InterviewGroup.Status.PAUSE:
                    group.status = InterviewGroup.Status.ENDED
                    group.end_time = timezone.now()
                    group.save()

                    interviewer_ids = list(group.interviewers.values_list('id', flat=True))
                    if interviewer_ids:
                        interviewer_groups = InterviewerGroup.objects.filter(
                            members__in=interviewer_ids,
                            status=InterviewerGroup.Status.WORKING,
                        ).distinct()
                        for ig in interviewer_groups:
                            ig_member_ids = set(ig.members.values_list('id', flat=True))
                            if set(interviewer_ids).issubset(ig_member_ids):
                                ig.status = InterviewerGroup.Status.ONUSE
                                ig.save()
                                break

                    candidates_in_group = group.candidates.select_related('candidate')
                    now = timezone.now()
                    for cig in candidates_in_group:
                        candidate = cig.candidate
                        original_status = cig.call_status

                        # 终态化叫号状态：未完成的选手标记为已完成
                        if cig.call_status != CandidateInGroup.CallStatus.FINISHED:
                            cig.call_status = CandidateInGroup.CallStatus.FINISHED
                            cig.finished_at = now
                            cig.save(update_fields=['call_status', 'finished_at'])

                        # 只处理已叫号/面试中的候选人（未叫号的保持 WAITING 状态）
                        if original_status in (
                            CandidateInGroup.CallStatus.CALLED,
                            CandidateInGroup.CallStatus.INTERVIEWING,
                        ):
                            # 志愿状态推进为已完成（保护已录取/已淘汰的终态不被覆盖）
                            Volunteer.objects.filter(
                                candidate=candidate,
                                department=group.departments
                            ).exclude(
                                status__in=[Volunteer.Status.COMPLETED,
                                            Volunteer.Status.REJECTED,
                                            Volunteer.Status.ACCEPTED]
                            ).update(status=Volunteer.Status.COMPLETED)

                            has_waiting_volunteer = Volunteer.objects.filter(
                                candidate=candidate,
                                status=Volunteer.Status.WAITING
                            ).exists()

                            has_pending_volunteer = Volunteer.objects.filter(
                                candidate=candidate
                            ).exclude(
                                status__in=[Volunteer.Status.COMPLETED,
                                            Volunteer.Status.REJECTED,
                                            Volunteer.Status.ACCEPTED]
                            ).exists()

                            if has_waiting_volunteer:
                                candidate.status = Candidate.Status.WAITING
                            elif not has_pending_volunteer:
                                candidate.status = Candidate.Status.COMPLETED
                            candidate.save()

                    return True, {
                        'status': group.status,
                        'message': '面试已结束',
                        'end_time': group.end_time.isoformat() if group.end_time else None
                    }
                else:
                    return False, {'error': f'当前状态为 {group.get_status_display()}，无法结束'}

            else:
                return False, {'error': '无效的操作'}

        except InterviewGroup.DoesNotExist:
            return False, {'error': '面试组不存在'}
        except Interviewer.DoesNotExist:
            return False, {'error': '面试官不存在'}
        except Exception as e:
            return False, {'error': str(e)}

    @staticmethod
    def auto_save_all_scores(group):
        """自动保存该场次所有面试官的评价"""
        models = InterviewService._get_models()
        InterviewerScore = models['InterviewerScore']

        interviewers = group.interviewers.all()
        candidates_in_group = group.candidates.all()

        saved_count = 0
        for interviewer in interviewers:
            for cig in candidates_in_group:
                try:
                    score_obj, created = InterviewerScore.objects.get_or_create(
                        candidate=cig.candidate,
                        interviewer=interviewer,
                        defaults={
                            'interview_group': group,
                            'score': 0,
                            'self_intro': '',
                            'comment': '',
                        }
                    )
                    if created:
                        saved_count += 1
                    score_obj.save()
                except Exception:
                    pass

        return saved_count
