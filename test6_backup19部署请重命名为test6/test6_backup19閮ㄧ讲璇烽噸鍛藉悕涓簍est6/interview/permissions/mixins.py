from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from .permissions import PermissionChecker
from .roles import RoleManager, Role


class PermissionMixin:
    """视图权限混入类"""
    # 需要的权限列表
    permission_required = None
    # 是否需要所有权限 (True=需要所有, False=任意一个)
    require_all_permissions = True

    def check_permissions(self, request, *args, **kwargs):
        """检查权限"""
        if not self.permission_required:
            return True

        if isinstance(self.permission_required, str):
            permissions = [self.permission_required]
        else:
            permissions = self.permission_required

        if self.require_all_permissions:
            # 需要所有权限
            for perm in permissions:
                if not PermissionChecker.has_permission(request.user, perm):
                    return False
            return True
        else:
            for perm in permissions:
                if PermissionChecker.has_permission(request.user, perm):
                    return True
            return False

    def dispatch(self, request, *args, **kwargs):
        """重写dispatch方法进行权限检查"""
        if not self.check_permissions(request, *args, **kwargs):
            # 如果是AJAX请求，返回JSON错误
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'error': '权限不足',
                    'code': 403
                }, status=403)
            raise PermissionDenied("您没有执行此操作的权限")

        return super().dispatch(request, *args, **kwargs)


class GroupPermissionMixin:
    """面试组权限混入类"""

    def check_group_permission(self, request, group_id):
        """检查组权限"""
        from ..models import InterviewGroup

        try:
            group = InterviewGroup.objects.get(id=group_id)
            if not PermissionChecker.check_group_permission(request.user, group):
                return False, None
            return True, group
        except InterviewGroup.DoesNotExist:
            return False, None

    def get_group_or_403(self, request, group_id):
        """获取组或返回403"""
        has_perm, group = self.check_group_permission(request, group_id)
        if not has_perm:
            raise PermissionDenied("您没有权限访问此面试组")
        return group


class CandidateInGroupPermissionMixin:
    """组内面试者权限混入类"""

    def check_candidate_permission(self, request, candidate_in_group_id):
        """检查面试者权限"""
        from ..models import CandidateInGroup

        try:
            candidate_in_group = CandidateInGroup.objects.get(id=candidate_in_group_id)
            if not PermissionChecker.check_candidate_in_group_permission(request.user, candidate_in_group):
                return False, None
            return True, candidate_in_group
        except CandidateInGroup.DoesNotExist:
            return False, None

    def get_candidate_or_403(self, request, candidate_in_group_id):
        """获取面试者或返回403"""
        has_perm, candidate = self.check_candidate_permission(request, candidate_in_group_id)
        if not has_perm:
            raise PermissionDenied("您没有权限访问此面试者")
        return candidate


class DepartmentPermissionMixin:
    """部门权限混入类"""

    def get_user_department(self, request):
        """获取当前用户的部门"""
        return PermissionChecker.get_user_department(request.user)

    def filter_by_department(self, request, queryset, department_field='departments'):
        """
        根据用户部门过滤查询集

        Args:
            request: 请求对象
            queryset: 要过滤的查询集
            department_field: 部门字段名，默认为 'departments'

        Returns:
            过滤后的查询集
        """
        role = RoleManager.get_user_role(request.user)

        # 超级管理员和管理员可以查看所有
        if role in [Role.SUPER_ADMIN, Role.ADMIN]:
            return queryset

        # 部门管理员只能查看自己部门的
        if role == Role.SUBADMIN:
            department = self.get_user_department(request)
            if department:
                return queryset.filter(**{department_field: department})
            return queryset.none()

        return queryset

    def get_department_filter_kwargs(self, request, department_field='departments'):
        """
        获取部门过滤参数

        Returns:
            过滤参数字典，如果用户没有部门限制则返回空字典
        """
        role = RoleManager.get_user_role(request.user)

        if role in [Role.SUPER_ADMIN, Role.ADMIN]:
            return {}

        if role == Role.SUBADMIN:
            department = self.get_user_department(request)
            if department:
                return {department_field: department}

        return {}