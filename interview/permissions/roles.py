from enum import Enum
from django.contrib.auth.models import Group

from ..models import UserProfile


class Role(Enum):
    SUPER_ADMIN = 'super_admin'
    ADMIN = 'admin'
    SUBADMIN = 'subadmin'  # 部门管理员
    INTERVIEWER = 'interviewer'
    CANDIDATE = 'candidate'
    GUEST = 'guest'


class RoleManager:
    """角色管理器"""
    # 角色对应的权限列表
    ROLE_PERMISSIONS = {
        Role.SUPER_ADMIN: [
            '*.*',
        ],
        Role.ADMIN: [
            'user.create', 'user.update', 'user.delete', 'user.view',
            'interviewer.create', 'interviewer.update', 'interviewer.delete', 'interviewer.view',
            'candidate.create', 'candidate.update', 'candidate.delete', 'candidate.view',
            'group.create', 'group.update', 'group.delete', 'group.view',
            'group.start', 'group.finish', 'group.cancel',
            'score.view_all', 'score.export',
            'department.view_all', 'department.manage',
        ],
        Role.SUBADMIN: [
            'interviewer.view_department',
            'candidate.view_department',
            'group.view_department',
            'group.create_department', 'group.update_department',
            'score.view_department', 'score.export_department',
        ],
        Role.INTERVIEWER: [
            'group.view_own',
            'candidate.view_in_group',
            'score.create', 'score.update', 'score.view_own',
        ],
        Role.CANDIDATE: [
            'candidate.view_own',
        ],
        Role.GUEST: [
            'public.view',
        ],
    }

    @classmethod
    def get_permissions(cls, role):
        """获取角色的权限列表"""
        return cls.ROLE_PERMISSIONS.get(role, [])

    @classmethod
    def create_groups(cls):
        """创建Django用户组"""
        for role in Role:
            group, created = Group.objects.get_or_create(name=role.value)
            if created:
                print(f"Created group: {role.value}")
        return cls._assign_permissions()

    @classmethod
    def _assign_permissions(cls):
        """分配权限到各组"""
        for role, permissions in cls.ROLE_PERMISSIONS.items():
            group = Group.objects.get(name=role.value)
            group.permissions.clear()
            for perm in permissions:
                pass
        return True

    @classmethod
    def assign_role_to_user(cls, user, role):
        """为用户分配角色（同时更新 UserProfile 和 Group）"""
        if not user:
            return False

        # 更新 UserProfile
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.role = role.value
        profile.save()

        # 更新 Django Group
        group, _ = Group.objects.get_or_create(name=role.value)
        user.groups.clear()
        user.groups.add(group)

        # Django admin 标志与应用角色同步，但不作为应用身份来源。
        user.is_superuser = role == Role.SUPER_ADMIN
        user.is_staff = role in [Role.SUPER_ADMIN, Role.ADMIN]
        user.save()

        return True

    @classmethod
    def get_user_role(cls, user):
        """获取用户角色；UserProfile 是应用身份的唯一来源。"""
        if not user or not user.is_authenticated:
            return Role.GUEST

        # UserProfile 是应用身份的唯一来源。业务资料、Django Group 和
        # is_superuser 均不得改变应用内角色判断。
        try:
            return Role(user.profile.role)
        except (UserProfile.DoesNotExist, ValueError):
            return Role.GUEST

    @classmethod
    def get_user_department(cls, user):
        """获取用户的部门"""
        if not user or not user.is_authenticated:
            return None

        if hasattr(user, 'interviewer'):
            return user.interviewer.department

        if hasattr(user, 'candidate'):
            return 'UNK'

        return None
