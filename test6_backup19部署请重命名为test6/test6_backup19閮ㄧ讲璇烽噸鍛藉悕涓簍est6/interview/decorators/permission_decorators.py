from functools import wraps
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse
from ..permissions.permissions import PermissionChecker
from ..permissions.roles import RoleManager, Role


def permission_required(permission, raise_exception=True, return_json=False):
    """
    权限验证装饰器

    Args:
        permission: 需要的权限 (字符串或列表)
        raise_exception: 是否抛出异常
        return_json: 是否返回JSON响应
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if isinstance(permission, str):
                permissions = [permission]
            else:
                permissions = permission

            # 检查权限
            has_permission = False
            for perm in permissions:
                if PermissionChecker.has_permission(request.user, perm):
                    has_permission = True
                    break

            if not has_permission:
                if return_json:
                    return JsonResponse({
                        'success': False,
                        'error': '权限不足',
                        'code': 403
                    }, status=403)
                if raise_exception:
                    raise PermissionDenied("您没有执行此操作的权限")
                return None

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def role_required(roles, raise_exception=True, return_json=False):
    """
    角色验证装饰器

    Args:
        roles: 允许的角色列表
        raise_exception: 是否抛出异常
        return_json: 是否返回JSON响应
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user_role = RoleManager.get_user_role(request.user)

            if user_role not in roles:
                if return_json:
                    return JsonResponse({
                        'success': False,
                        'error': '权限不足',
                        'code': 403
                    }, status=403)
                if raise_exception:
                    raise PermissionDenied("您没有权限访问此页面")
                return None

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def department_permission_required(return_json=False):
    """
    部门权限装饰器 - 确保用户只能访问自己部门的数据
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user_role = RoleManager.get_user_role(request.user)

            # 超级管理员和管理员可以访问所有
            if user_role in [Role.SUPER_ADMIN, Role.ADMIN]:
                kwargs['department'] = 'ALL'
                return view_func(request, *args, **kwargs)

            # 部门管理员只能访问自己部门
            if user_role == Role.SUBADMIN:
                user_department = PermissionChecker.get_user_department(request.user)
                if not user_department:
                    if return_json:
                        return JsonResponse({
                            'success': False,
                            'error': '您没有所属部门',
                            'code': 403
                        }, status=403)
                    raise PermissionDenied("您没有所属部门")

                kwargs['department'] = user_department
                return view_func(request, *args, **kwargs)

            # 其他角色无权访问
            if return_json:
                return JsonResponse({
                    'success': False,
                    'error': '权限不足',
                    'code': 403
                }, status=403)
            raise PermissionDenied("您没有权限访问此页面")

        return wrapper

    return decorator


# ========== 组合装饰器（常用场景） ==========

def interviewer_required(return_json=False):
    """要求是面试官（或更高权限）"""
    return role_required(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.SUBADMIN, Role.INTERVIEWER],
        return_json=return_json
    )


def admin_required(return_json=False):
    """要求是管理员（或更高权限）"""
    return role_required(
        [Role.SUPER_ADMIN, Role.ADMIN],
        return_json=return_json
    )


def subadmin_required(return_json=False):
    """要求是部门管理员（或更高权限）"""
    return role_required(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.SUBADMIN],
        return_json=return_json
    )


def candidate_required(return_json=False):
    """要求是面试者（或更高权限）"""
    return role_required(
        [Role.SUPER_ADMIN, Role.ADMIN, Role.CANDIDATE],
        return_json=return_json
    )

'''
def group_owner_required(group_id_field='group_id', return_json=False):
    """
    检查组所有者权限（面试官只能操作自己的组）

    Args:
        group_id_field: URL中组ID的参数名
        return_json: 是否返回JSON响应
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            group_id = kwargs.get(group_id_field)
            if not group_id:
                if return_json:
                    return JsonResponse({
                        'success': False,
                        'error': '缺少组ID',
                        'code': 400
                    }, status=400)
                raise PermissionDenied("缺少组ID")

            from ..models import InterviewGroup
            from ..permissions.mixins import GroupPermissionMixin

            try:
                group = InterviewGroup.objects.get(id=group_id)
                mixin = GroupPermissionMixin()
                if not mixin.check_group_permission(request, group_id)[0]:
                    if return_json:
                        return JsonResponse({
                            'success': False,
                            'error': '您没有权限操作此面试组',
                            'code': 403
                        }, status=403)
                    raise PermissionDenied("您没有权限操作此面试组")

                # 将group注入到kwargs
                kwargs['group'] = group
                return view_func(request, *args, **kwargs)

            except InterviewGroup.DoesNotExist:
                if return_json:
                    return JsonResponse({
                        'success': False,
                        'error': '面试组不存在',
                        'code': 404
                    }, status=404)
                raise PermissionDenied("面试组不存在")

        return wrapper

    return decorator
'''