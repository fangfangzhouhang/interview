# dashboard_views.py - 完整修复

from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Q
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
import json
import hashlib

from ..permission import admin_required
from ...models import Candidate, Volunteer, InterviewerScore, Interviewer, InterviewGroup, CandidateInGroup, SCORE_DIMENSIONS


@admin_required()
def admin_console_view(request):
    """下载专区视图"""
    return render(request, 'addmin/addmin_console.html')


@csrf_exempt
@admin_required(return_json=True)
def api_admin_download_candidates(request):
    """获取面试者列表（用于下载专区）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        # 获取筛选参数
        search = request.GET.get('search', '').strip()
        department = request.GET.get('department', '')

        # 获取所有面试者
        candidates = Candidate.objects.all().prefetch_related(
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

        # 部门筛选 - 只筛选有该志愿的面试者
        if department:
            candidates = candidates.filter(
                volunteers__department=department
            ).distinct()

        # 构建数据
        candidate_list = []
        for candidate in candidates:
            # 获取志愿信息
            volunteers = candidate.volunteers.all().order_by('priority')
            volunteer_info = []
            for vol in volunteers:
                volunteer_info.append({
                    'id': vol.id,
                    'department': vol.department,
                    'department_display': vol.get_department_display(),
                    'status': vol.status,
                    'status_display': vol.get_status_display(),
                    'priority': vol.priority,
                })

            # 计算平均分
            scores = candidate.scores.exclude(score=0)
            avg_score = 0
            if scores:
                total = sum(float(s.score) for s in scores)
                avg_score = round(total / len(scores), 2)

            # 获取面试状态
            status_display = candidate.get_status_display() if candidate.status else '未完善'

            # 获取面试记录（来自InterviewGroup的题目）
            interview_record = {}
            candidate_in_groups = candidate.candidateingroup_set.all()
            if candidate_in_groups.exists():
                latest_group = candidate_in_groups.order_by('-group__interview_date').first()
                if latest_group and latest_group.group:
                    group = latest_group.group
                    interview_record = {
                        'basic_question1': group.basic_question1,
                        'basic_question2': group.basic_question2,
                        'rush_question': group.rush_question,
                    }

            # 获取评价信息（来自InterviewerScore）
            evaluation = []
            for score in candidate.scores.all():
                evaluation.append({
                    'interviewer_name': score.interviewer.name,
                    'score': float(score.score),
                    'comment': score.comment,
                    'self_intro': score.self_intro,
                })

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
                'volunteers': volunteer_info,
                'created_at': candidate.created_at.isoformat() if candidate.created_at else None,
                'avatar_url': candidate.avatar.url if candidate.avatar else None,
                'avatar_thumbnail_url': candidate.avatar_thumbnail.url if candidate.avatar_thumbnail else None,
                'interview_record': interview_record,
                'evaluation': evaluation,
            })

        # 排序逻辑
        dept_order = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB', 'UNK']

        def get_dept_index(item):
            """获取第一志愿的部门索引"""
            vols = item.get('volunteers', [])
            if vols:
                sorted_vols = sorted(vols, key=lambda x: x.get('priority', 999))
                if sorted_vols:
                    first_dept = sorted_vols[0].get('department')
                    try:
                        return dept_order.index(first_dept)
                    except ValueError:
                        return 999
            return 999

        def get_sort_key(item):
            """排序键：先按分数降序，同分按部门顺序"""
            score = item.get('avg_score', 0)
            dept_idx = get_dept_index(item)
            return (-score, dept_idx)

        candidate_list.sort(key=get_sort_key)

        # 分页
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))

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


@csrf_exempt
@admin_required(return_json=True)
def api_admin_download_export(request):
    """导出面试者数据"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = json.loads(request.body)
        candidate_ids = data.get('candidate_ids', [])
        include_fields = data.get('include_fields', [])
        export_format = data.get('export_format', [])
        department_filter = data.get('department', '')

        if not candidate_ids:
            return JsonResponse({'success': False, 'message': '请选择至少一位面试者'})

        # 获取面试者数据
        candidates = Candidate.objects.filter(id__in=candidate_ids).prefetch_related(
            'volunteers',
            'scores__interviewer',
            'candidateingroup_set__group'
        )

        # 部门顺序
        dept_order = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB', 'UNK']
        dept_display_map = dict(Interviewer.Department.choices)

        # 存储所有导出数据
        all_export_data = []

        # 如果指定了部门，只导出该部门数据
        if department_filter:
            # 获取该部门的面试者，按创建时间排序
            dept_candidates = candidates.filter(volunteers__department=department_filter).distinct()
            dept_candidates = dept_candidates.order_by('created_at')

            for candidate in dept_candidates:
                item = build_candidate_export_data(candidate, include_fields)
                # 标记该记录属于哪个部门
                item['department_belong'] = department_filter
                item['department_belong_display'] = dept_display_map.get(department_filter, department_filter)
                all_export_data.append(item)
        else:
            # 全部部门：按部门顺序拼接
            for dept_code in dept_order:
                dept_candidates = candidates.filter(volunteers__department=dept_code).distinct()
                dept_candidates = dept_candidates.order_by('created_at')

                for candidate in dept_candidates:
                    item = build_candidate_export_data(candidate, include_fields)
                    # 标记该记录属于哪个部门（使用第一个匹配的志愿部门）
                    item['department_belong'] = dept_code
                    item['department_belong_display'] = dept_display_map.get(dept_code, dept_code)
                    all_export_data.append(item)

        # 获取选中的人数（去重）
        total_count = len(set(item['id'] for item in all_export_data))

        # 构建数据头
        download_time = timezone.now()
        client_ip = get_client_ip(request)
        username = request.user.username

        # 构建最终数据
        final_data = {
            'header': {
                'download_time': download_time.strftime('%Y-%m-%d %H:%M:%S'),
                'ip_address': client_ip,
                'username': username,
                'include_fields': include_fields,
                'department_filter': department_filter if department_filter else 'all',
                'selected_count': total_count,  # 选中的人数（去重）
                'record_count': len(all_export_data),  # 实际记录数（可能包含重复）
            },
            'data': all_export_data
        }

        # 计算MD5
        data_str = json.dumps(final_data, sort_keys=True, ensure_ascii=False)
        md5_hash = hashlib.md5(data_str.encode('utf-8')).hexdigest()
        final_data['md5'] = md5_hash

        # 构建响应
        result = {
            'success': True,
            'data': final_data,
            'count': len(all_export_data),
            'selected_count': total_count,
            'include_fields': include_fields,
            'export_format': export_format,
            'filename': f"数据导出_面试者_{download_time.strftime('%Y%m%d%H%M%S')}.json"
        }

        return JsonResponse(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


def build_candidate_export_data(candidate, include_fields):
    """构建单个面试者导出数据"""
    item = {
        'id': candidate.id,
        'name': candidate.name,
        'student_number': candidate.student_number,
        'gender': candidate.get_gender_display(),
        'school': candidate.get_school_display(),
        'homeroom': candidate.homeroom,
        'political_status': candidate.political_status,
        'racetrack': candidate.get_racetrack_display(),
        'adjustable': candidate.get_adjustable_display(),
        'status': candidate.get_status_display(),
        'created_at': candidate.created_at.isoformat() if candidate.created_at else None,
    }

    # 联系方式 (telephone, qq_id, wx_id, email)
    if 'contact' in include_fields:
        item['contact'] = {
            'telephone': candidate.telephone,
            'email': candidate.email,
            'qq_id': candidate.qq_id,
            'wx_id': candidate.wx_id,
        }

    # 证件照
    if 'photo' in include_fields:
        item['photo'] = {
            'avatar_url': candidate.avatar.url if candidate.avatar else None,
            'avatar_thumbnail_url': candidate.avatar_thumbnail.url if candidate.avatar_thumbnail else None,
        }

    # 面试记录 (basic_question1, basic_question2, rush_question) - 来自InterviewGroup
    if 'interview_record' in include_fields:
        interview_record = {}
        # 获取面试题目
        candidate_in_groups = candidate.candidateingroup_set.all()
        if candidate_in_groups.exists():
            latest_group = candidate_in_groups.order_by('-group__interview_date').first()
            if latest_group and latest_group.group:
                group = latest_group.group
                interview_record['basic_question1'] = group.basic_question1
                interview_record['basic_question2'] = group.basic_question2
                interview_record['rush_question'] = group.rush_question
        item['interview_record'] = interview_record

    # 评价信息 (self_intro, comment, score) - 来自InterviewerScore
    if 'evaluation' in include_fields:
        evaluation = []
        for score in candidate.scores.all():
            dim_scores = score.dimension_scores or {}
            dimension_details = []
            for dim in SCORE_DIMENSIONS:
                s = float(dim_scores.get(dim['code'], 0))
                pct = (s / dim['max_score'] * 100) if dim['max_score'] > 0 else 0
                dimension_details.append({
                    'code': dim['code'],
                    'name': dim['name'],
                    'max_score': dim['max_score'],
                    'score': s,
                    'percentage': round(pct, 1)
                })
            evaluation.append({
                'interviewer_name': score.interviewer.name,
                'score': float(score.score),
                'comment': score.comment,
                'self_intro': score.self_intro,
                'dimension_scores': dim_scores,
                'dimension_details': dimension_details,
            })
        item['evaluation'] = {
            'scores': evaluation,
            'avg_score': 0
        }
        if evaluation:
            total = sum(s['score'] for s in evaluation)
            item['evaluation']['avg_score'] = round(total / len(evaluation), 2)

    # 个人信息 (character, introduction, experience, honor) - 始终包含在基础信息中
    # 这些字段已经在 item 中，不需要额外处理

    # 志愿信息 - 包含该面试者的全部志愿
    volunteers = candidate.volunteers.all().order_by('priority')
    item['volunteers'] = [
        {
            'priority': v.priority,
            'department': v.get_department_display(),
            'status': v.get_status_display(),
        }
        for v in volunteers
    ]

    return item


def get_client_ip(request):
    """获取客户端IP地址"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
