from functools import wraps
from django.core.exceptions import PermissionDenied
from .roles import RoleManager, Role


class PermissionChecker:
    """权限检查器"""

    @staticmethod
    def has_permission(user, permission):
        """检查用户是否有特定权限"""
        if not user or not user.is_authenticated:
            return False

        # 超级管理员拥有所有权限
        if user.is_superuser:
            return True

        # 获取用户角色
        role = RoleManager.get_user_role(user)

        # 检查角色权限
        role_permissions = RoleManager.get_permissions(role)

        # 检查通配符
        if '*.*' in role_permissions:
            return True

        # 精确匹配
        if permission in role_permissions:
            return True

        # 模式匹配 (例如: group.* 匹配 group.create)
        for rp in role_permissions:
            if rp.endswith('.*'):
                prefix = rp[:-2]
                if permission.startswith(prefix):
                    return True

        return False

    @staticmethod
    def check_group_permission(user, group):
        """检查用户是否有权限操作特定面试组"""
        if not user or not user.is_authenticated:
            return False

        role = RoleManager.get_user_role(user)

        # 管理员和超级管理员可以操作所有组
        if role in [Role.SUPER_ADMIN, Role.ADMIN]:
            return True

        # 部门管理员只能操作自己部门的组
        if role == Role.SUBADMIN:
            user_department = RoleManager.get_user_department(user)
            if user_department and group.departments == user_department:
                return True
            return False

        # 面试官只能操作自己参与的组
        if role == Role.INTERVIEWER:
            try:
                interviewer = user.interviewer
                return group.interviewers.filter(id=interviewer.id).exists()
            except:
                return False

        # 面试者无权限查看组
        if role == Role.CANDIDATE:
            return False

        return False

    @staticmethod
    def check_candidate_in_group_permission(user, candidate_in_group):
        """检查用户是否有权限操作特定面试者"""
        if not user or not user.is_authenticated:
            return False

        role = RoleManager.get_user_role(user)

        # 管理员和超级管理员可以操作所有
        if role in [Role.SUPER_ADMIN, Role.ADMIN]:
            return True

        # 部门管理员只能操作自己部门的面试者
        if role == Role.SUBADMIN:
            user_department = RoleManager.get_user_department(user)
            return True
            if user_department:
                # 检查面试者的志愿是否包含该部门
                # 这里需要根据实际的志愿模型来实现
                # 目前先检查面试者所在的组是否属于该部门
                if candidate_in_group.group.departments == user_department:
                    return True
            return False

        # 面试官只能操作自己所在组的面试者
        if role == Role.INTERVIEWER:
            try:
                interviewer = user.interviewer
                return candidate_in_group.group.interviewers.filter(id=interviewer.id).exists()
            except:
                return False

        # 面试者只能查看自己的信息
        if role == Role.CANDIDATE:
            try:
                candidate = user.candidate
                return candidate_in_group.candidate == candidate
            except:
                return False

        return False

    @staticmethod
    def check_department_permission(user, department):
        """检查用户是否有权限操作特定部门"""
        if not user or not user.is_authenticated:
            return False

        role = RoleManager.get_user_role(user)

        # 超级管理员可以操作所有部门
        if role == Role.SUPER_ADMIN:
            return True

        # 管理员可以操作所有部门
        if role == Role.ADMIN:
            return True

        # 部门管理员只能操作自己的部门
        if role == Role.SUBADMIN:
            user_department = RoleManager.get_user_department(user)
            return user_department == department

        return False

    @staticmethod
    def get_user_department(user):
        """获取用户所属部门"""
        return RoleManager.get_user_department(user)