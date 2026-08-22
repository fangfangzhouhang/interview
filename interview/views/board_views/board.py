"""面试叫号看板 - 视图与接口

设计原则：
- 只读接口（快照）对投屏公开，仅返回姓名/部门/房间等非隐私字段
- 控制接口（叫号/开始面试/设教室）复用现有部门权限装饰器
- 不改动现有报名、自动分组、评分、志愿决策逻辑，叫号状态独立于
  InterviewGroup.Status / Volunteer.Status 存在于 CandidateInGroup 上
"""
import json

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.conf import settings

from ...models import (
    InterviewGroup,
    Candidate,
    CandidateInGroup,
    Volunteer,
)
from ..permission import (
    department_permission_required,
)
from ...permissions.roles import RoleManager, Role

# 叫号看板展示的部门（排除 UNK）
BOARD_DEPARTMENTS = ['BGS', 'XCB', 'QYB', 'XSB', 'WYB', 'TYB']

DEPARTMENT_NAMES = {
    'BGS': '办公',
    'XCB': '信传',
    'QYB': '权益',
    'XSB': '学实',
    'WYB': '文艺',
    'TYB': '体育',
}

# 看板视为"活跃"的场次状态
ACTIVE_GROUP_STATUSES = [
    InterviewGroup.Status.PENDING,
    InterviewGroup.Status.ONGOING,
    InterviewGroup.Status.PAUSE,
]


def _get_control_scope(user):
    """判断当前用户可控制的部门范围

    Returns:
        ('ALL', True)  - 主管理员/超管，可控制全部
        (dept, True)   - 部门管理员，仅本部门
        (None, False)  - 无控制权限（未登录/其他角色）
    """
    if not user.is_authenticated:
        return None, False
    try:
        role = RoleManager.get_user_role(user)
    except Exception:
        return None, False

    if role in [Role.SUPER_ADMIN, Role.ADMIN]:
        return 'ALL', True
    if role == Role.SUBADMIN:
        try:
            dept = RoleManager.get_user_department(user)
        except Exception:
            return None, False
        if dept:
            return dept, True
    return None, False


def _call_status_to_display(call_status):
    """将内部call_status映射为展示用的中文状态"""
    mapping = {
        CandidateInGroup.CallStatus.WAITING: '等待中',
        CandidateInGroup.CallStatus.CALLED: '已叫号',
        CandidateInGroup.CallStatus.INTERVIEWING: '面试中',
        CandidateInGroup.CallStatus.FINISHED: '已完成',
    }
    return mapping.get(call_status, '未知')


def _build_group_snapshot(group):
    """构建单个场次的叫号快照"""
    cigs = list(
        group.candidates.select_related('candidate').order_by('order')
    )

    current_cig = None
    next_cig = None
    waiting_count = 0
    finished_count = 0

    # 构建完整队列列表
    queue_list = []
    for cig in cigs:
        if cig.call_status in (
            CandidateInGroup.CallStatus.CALLED,
            CandidateInGroup.CallStatus.INTERVIEWING,
        ):
            current_cig = cig
        elif cig.call_status == CandidateInGroup.CallStatus.WAITING:
            if next_cig is None:
                next_cig = cig
            waiting_count += 1
        elif cig.call_status == CandidateInGroup.CallStatus.FINISHED:
            finished_count += 1

        # 添加到队列列表（包含所有状态的候选人）
        queue_list.append({
            'order': cig.order,
            'name': cig.candidate.name,
            'call_status': cig.call_status,
            'call_status_display': _call_status_to_display(cig.call_status),
            'is_current': cig.call_status in (
                CandidateInGroup.CallStatus.CALLED,
                CandidateInGroup.CallStatus.INTERVIEWING,
            ),
            'is_finished': cig.call_status == CandidateInGroup.CallStatus.FINISHED,
        })

    total = len(cigs)

    # 场次展示状态（纯推导，不落库）
    if group.status == InterviewGroup.Status.PAUSE:
        display_status = '暂停中'
    elif group.status == InterviewGroup.Status.PENDING:
        display_status = '等待开始'
    else:  # ONGOING
        if current_cig is not None:
            display_status = '正在面试' if current_cig.call_status == CandidateInGroup.CallStatus.INTERVIEWING else '已叫号'
        elif finished_count > 0 and waiting_count > 0:
            display_status = '面试结束·待叫号'
        elif finished_count > 0 and waiting_count == 0:
            display_status = '本组已完成'
        else:
            display_status = '等待叫号'

    # 当前面试者信息（隐私保护：仅姓名）
    current_info = None
    if current_cig is not None:
        elapsed = None
        if current_cig.called_at:
            elapsed = int((timezone.now() - current_cig.called_at).total_seconds())
        current_info = {
            'name': current_cig.candidate.name,
            'order': current_cig.order,
            'call_status': current_cig.call_status,
            'call_status_display': current_cig.get_call_status_display(),
            'elapsed_seconds': elapsed,
        }

    next_info = None
    if next_cig is not None:
        next_info = {
            'name': next_cig.candidate.name,
            'order': next_cig.order,
        }

    return {
        'group_id': group.id,
        'group_code': group.group_id,
        'classroom': group.classroom or '待安排',
        'group_status': group.status,
        'group_status_display': group.get_status_display(),
        'display_status': display_status,
        'current': current_info,
        'next': next_info,
        'waiting_count': waiting_count,
        'finished_count': finished_count,
        'total_count': total,
        'start_time': group.start_time.isoformat() if group.start_time else None,
        'queue_list': queue_list,
    }


def _build_board_data():
    """构建完整看板快照：按部门汇总活跃场次 + 候场人数 + 完整队列"""
    data = []

    active_groups = InterviewGroup.objects.filter(
        status__in=ACTIVE_GROUP_STATUSES,
    ).prefetch_related('candidates__candidate')

    groups_by_dept = {}
    for g in active_groups:
        groups_by_dept.setdefault(g.departments, []).append(g)

    for dept in BOARD_DEPARTMENTS:
        dept_groups = sorted(
            groups_by_dept.get(dept, []),
            key=lambda x: x.id,
        )
        group_snapshots = [_build_group_snapshot(g) for g in dept_groups]

        # 现场候场人数（该部门志愿排队中、尚未进入任何场次）
        lobby_count = Volunteer.objects.filter(
            department=dept,
            status=Volunteer.Status.WAITING,
        ).count()

        # 构建完整展示队列：合并所有场次候选人 + 候场志愿者
        display_queue = []
        seq = 1

        # 1. 所有活跃场次的候选人（按场次顺序、组内顺序）
        for gs in group_snapshots:
            for item in gs['queue_list']:
                display_queue.append({
                    'seq': seq,
                    'order': item['order'],
                    'name': item['name'],
                    'call_status': item['call_status'],
                    'call_status_display': item['call_status_display'],
                    'is_current': item['is_current'],
                    'is_finished': item['is_finished'],
                    'group_id': gs['group_id'],
                    'classroom': gs['classroom'],
                })
                seq += 1

        # 2. 候场志愿者（未分配到场次）
        waiting_volunteers = list(
            Volunteer.objects.filter(
                department=dept,
                status=Volunteer.Status.WAITING,
            ).select_related('candidate')[:20]
        )
        for vol in waiting_volunteers:
            display_queue.append({
                'seq': seq,
                'order': seq,
                'name': vol.candidate.name if vol.candidate else '待分配',
                'call_status': 'WAITING',
                'call_status_display': '等待中',
                'is_current': False,
                'is_finished': False,
                'group_id': None,
                'classroom': '待安排',
                'is_lobby': True,
            })
            seq += 1

        # 计算等待中总数（不含已完成）
        waiting_total = sum(
            1 for q in display_queue
            if q['call_status'] not in ('CALLED', 'INTERVIEWING', 'FINISHED')
        )
        # 若有候场志愿者，也计入等待总数
        waiting_total = max(waiting_total, lobby_count + sum(
            1 for g in group_snapshots
            if g.get('waiting_count', 0)
        ))

        # 部门整体展示状态
        if not group_snapshots and lobby_count == 0:
            dept_status = '暂无场次'
        elif not group_snapshots and lobby_count > 0:
            dept_status = '候场中'
        else:
            first = group_snapshots[0]
            dept_status = first['display_status']

        # 获取教室信息
        classrooms = list(set(
            gs['classroom'] for gs in group_snapshots
            if gs['classroom'] != '待安排'
        ))
        classroom_display = classrooms[0] if classrooms else '待安排'

        data.append({
            'department': dept,
            'department_name': DEPARTMENT_NAMES.get(dept, dept),
            'status': dept_status,
            'lobby_count': lobby_count,
            'waiting_total': waiting_total,
            'classroom': classroom_display,
            'groups': group_snapshots,
            'display_queue': display_queue,
            'total_in_queue': len(display_queue),
        })

    return data


def board_view(request):
    """叫号看板页面（独立全屏轮播页）"""
    display_only = request.GET.get('display') == '1'
    _, can_control = _get_control_scope(request.user)

    # 提供部门列表供前端轮播使用
    departments = [
        {'code': dept, 'name': DEPARTMENT_NAMES.get(dept, dept)}
        for dept in BOARD_DEPARTMENTS
    ]

    return render(request, 'board/board.html', {
        'display_only': display_only,
        'can_control': can_control,
        'departments': departments,
        'departments_json': json.dumps(departments, ensure_ascii=False),
    })


@csrf_exempt
def board_admin_view(request):
    """管理员控制页面（密码保护）

    认证流程：
    - 首次访问 GET /board/admin/ → 返回登录页
    - POST /board/admin/ 提交密码 → 验证通过后写入 session
    - 后续访问通过 session 认证，不再需要密码
    """
    ADMIN_PASSWORD = getattr(settings, 'BOARD_ADMIN_PASSWORD', 'ecust2026')

    # 登出
    if request.GET.get('action') == 'logout':
        request.session.pop('board_admin_auth', None)
        return render(request, 'board/admin_login.html')

    authenticated = request.session.get('board_admin_auth', False)

    if request.method == 'POST':
        # POST 登录验证
        try:
            data = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            data = {}
        pwd = data.get('password', '')
        if pwd == ADMIN_PASSWORD:
            request.session['board_admin_auth'] = True
            authenticated = True
        else:
            return render(request, 'board/admin_login.html', {
                'error': '密码错误',
            })
    elif not authenticated:
        # 未认证的 GET 请求返回登录页
        return render(request, 'board/admin_login.html')

    return render(request, 'board/admin.html', {
        'can_control': True,
        'board_admin': True,
    })


@csrf_exempt
def api_board(request):
    """看板快照接口（公开只读，3s 轮询全量返回）"""
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        data = _build_board_data()
        control_scope, can_control = _get_control_scope(request.user)

        # 管理员控制台 session 也可控制
        if request.session.get('board_admin_auth'):
            can_control = True
            if control_scope is None:
                control_scope = 'ALL'

        return JsonResponse({
            'success': True,
            'data': data,
            'can_control': can_control,
            'control_scope': control_scope,
            'server_time': timezone.now().isoformat(),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': str(e)})


def _sync_candidate_statuses(cig, finished=False):
    """同步现有 Candidate / Volunteer 状态（与现有结束逻辑保持一致）

    仅做状态推进，不回退，避免影响既有流程：
    - 叫号（CALLED）→ Volunteer/Candidate → INTERVIEWING
    - 完成（FINISHED）→ Volunteer → COMPLETED；Candidate 按其余志愿重算
    """
    candidate = cig.candidate
    group = cig.group

    if not finished:
        Volunteer.objects.filter(
            candidate=candidate,
            department=group.departments,
        ).exclude(status__in=[
            Volunteer.Status.COMPLETED,
            Volunteer.Status.REJECTED,
            Volunteer.Status.ACCEPTED,
        ]).update(status=Volunteer.Status.INTERVIEWING)
        if candidate.status not in (
            Candidate.Status.INTERVIEWING,
            Candidate.Status.COMPLETED,
        ):
            candidate.status = Candidate.Status.INTERVIEWING
            candidate.save(update_fields=['status'])
    else:
        Volunteer.objects.filter(
            candidate=candidate,
            department=group.departments,
        ).update(status=Volunteer.Status.COMPLETED)

        has_waiting_volunteer = Volunteer.objects.filter(
            candidate=candidate,
            status=Volunteer.Status.WAITING,
        ).exists()
        has_pending_volunteer = Volunteer.objects.filter(
            candidate=candidate,
        ).exclude(status__in=[
            Volunteer.Status.COMPLETED,
            Volunteer.Status.REJECTED,
            Volunteer.Status.ACCEPTED,
        ]).exists()

        if has_waiting_volunteer:
            candidate.status = Candidate.Status.WAITING
        elif not has_pending_volunteer:
            candidate.status = Candidate.Status.COMPLETED
        candidate.save(update_fields=['status'])


def _get_board_control_dept(request):
    """获取当前请求可控制的部门范围

    返回:
        ('ALL', True)  - 超级管理员或 board_admin session
        (dept, True)   - 部门管理员
        (None, False)  - 无权控制
    """
    # Board admin session 允许控制所有部门
    if request.session.get('board_admin_auth'):
        return 'ALL', True

    return _get_control_scope(request.user)


@csrf_exempt
def api_board_call_next(request, group_id):
    """叫号控制接口

    action:
      - call_next: 结束当前（若有）并叫下一位；无下一位时仅结束当前
      - start_interview: 当前 CALLED → INTERVIEWING（确认开始面试）
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    # 权限校验
    control_dept, can_control = _get_board_control_dept(request)
    if not can_control:
        return JsonResponse({'success': False, 'message': '无权操作，请先登录管理员控制台'})

    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    # 部门权限校验
    if control_dept != 'ALL' and group.departments != control_dept:
        return JsonResponse({'success': False, 'message': '无权操作其他部门的场次'})

    if group.status == InterviewGroup.Status.CANCELLED:
        return JsonResponse({'success': False, 'message': '场次已取消，无法叫号'})
    if group.status == InterviewGroup.Status.ENDED:
        return JsonResponse({'success': False, 'message': '场次已结束，无法叫号'})

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        data = {}
    action = data.get('action', 'call_next')

    cigs = list(
        group.candidates.select_related('candidate').order_by('order')
    )
    if not cigs:
        return JsonResponse({'success': False, 'message': '该场次暂无面试者'})

    now = timezone.now()

    if action == 'start_interview':
        current = next(
            (c for c in cigs if c.call_status == CandidateInGroup.CallStatus.CALLED),
            None,
        )
        if current is None:
            return JsonResponse({'success': False, 'message': '当前没有已叫号的面试者'})
        current.call_status = CandidateInGroup.CallStatus.INTERVIEWING
        current.save(update_fields=['call_status'])
        return JsonResponse({
            'success': True,
            'message': f'{current.candidate.name} 已开始面试',
            'data': _build_group_snapshot(group),
        })

    # 默认：call_next（结束当前 + 叫下一位）
    current = next(
        (c for c in cigs if c.call_status in (
            CandidateInGroup.CallStatus.CALLED,
            CandidateInGroup.CallStatus.INTERVIEWING,
        )),
        None,
    )
    next_cig = next(
        (c for c in cigs if c.call_status == CandidateInGroup.CallStatus.WAITING),
        None,
    )

    if current is None and next_cig is None:
        return JsonResponse({'success': False, 'message': '该场次所有面试者均已完成'})

    finished_name = None
    if current is not None:
        current.call_status = CandidateInGroup.CallStatus.FINISHED
        current.finished_at = now
        current.save(update_fields=['call_status', 'finished_at'])
        _sync_candidate_statuses(current, finished=True)
        finished_name = current.candidate.name

    if next_cig is not None:
        next_cig.call_status = CandidateInGroup.CallStatus.CALLED
        next_cig.called_at = now
        next_cig.save(update_fields=['call_status', 'called_at'])
        _sync_candidate_statuses(next_cig, finished=False)
        if finished_name:
            message = f'{finished_name} 面试完成，请 {next_cig.candidate.name} 前往面试'
        else:
            message = f'请 {next_cig.candidate.name} 前往面试'
    else:
        message = f'{finished_name} 面试完成，本组已全部叫号完毕'

    return JsonResponse({
        'success': True,
        'message': message,
        'data': _build_group_snapshot(group),
    })


@csrf_exempt
def api_board_set_classroom(request, group_id):
    """设置场次教室（看板快捷入口）"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    # 权限校验
    control_dept, can_control = _get_board_control_dept(request)
    if not can_control:
        return JsonResponse({'success': False, 'message': '无权操作，请先登录管理员控制台'})

    try:
        group = InterviewGroup.objects.get(id=group_id)
    except InterviewGroup.DoesNotExist:
        return JsonResponse({'success': False, 'message': '场次不存在'})

    if control_dept != 'ALL' and group.departments != control_dept:
        return JsonResponse({'success': False, 'message': '无权操作其他部门的场次'})

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': '请求数据格式错误'})

    classroom = str(data.get('classroom', '')).strip()
    if len(classroom) > 20:
        return JsonResponse({'success': False, 'message': '教室名称过长（最多20字符）'})

    group.classroom = classroom
    group.save(update_fields=['classroom'])

    return JsonResponse({
        'success': True,
        'message': f'教室已设置为 {classroom}' if classroom else '教室已清空，看板将显示"待安排"',
        'data': _build_group_snapshot(group),
    })
