from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # 管理员页面路由
    # ============================================================
    path('addmin/console/', views.admin_console_view, name='admin_console'),
    path('addmin/users/', views.admin_users_view, name='admin_users'),
    path('addmin/interviewers/', views.admin_interviewers_view, name='admin_interviewers'),
    path('addmin/groups/', views.admin_groups_view, name='admin_groups'),
    path('addmin/scores/', views.admin_scores_view, name='admin_scores'),

    # ============================================================
    # API 路由 - 管理员 - 下载专区
    # ============================================================
    path('api/addmin/download/candidates/', views.api_admin_download_candidates, name='api_admin_download_candidates'),
    path('api/addmin/download/export/', views.api_admin_download_export, name='api_admin_download_export'),

    # ============================================================
    # API 路由 - 管理员 - 用户管理
    # ============================================================
    path('api/addmin/users/', views.api_admin_users, name='api-admin-users'),
    path('api/addmin/users/', views.api_admin_users, name='api_admin_users'),
    path('api/addmin/users/<int:user_id>/', views.api_admin_user_detail, name='api-admin-user-detail'),
    path('api/addmin/users/<int:user_id>/', views.api_admin_user_detail, name='api_admin_user_detail'),
    path('api/addmin/users/<int:user_id>/reset-password/', views.api_admin_user_reset_password, name='api_admin_user_reset_password'),
    path('api/addmin/users/options/', views.api_admin_user_options, name='api_admin_user_options'),

    # ============================================================
    # API 路由 - 管理员 - 面试官管理
    # ============================================================
    path('api/addmin/interviewers/', views.api_admin_interviewers, name='api-admin-interviewers'),
    path('api/addmin/interviewers/<int:interviewer_id>/', views.api_admin_interviewer_detail, name='api-admin-interviewer-detail'),
    path('api/addmin/interviewers/all/', views.api_admin_interviewers_all, name='api-admin-interviewers-all'),
    path('api/addmin/interviewers/available/', views.api_admin_interviewer_available, name='api-admin-interviewer-available'),
    path('api/addmin/volunteer/<int:volunteer_id>/action/', views.api_admin_volunteer_action, name='api_admin_volunteer_action'),

# ============================================================
    # API 路由 - 管理员 - 面试官分组管理
    # ============================================================
    path('api/addmin/interviewer-groups/', views.api_admin_interviewer_groups, name='api_admin_interviewer_groups'),
    path('api/addmin/interviewer-groups/options/', views.api_admin_interviewer_groups_options, name='api_admin_interviewer_groups_options'),
    path('api/addmin/interviewer-groups/create/', views.api_admin_interviewer_group_create, name='api_admin_interviewer_group_create'),
    path('api/addmin/interviewer-groups/<int:group_id>/', views.api_admin_interviewer_group_detail, name='api_admin_interviewer_group_detail'),
    path('api/addmin/interviewer-groups/<int:group_id>/delete/', views.api_admin_interviewer_group_delete, name='api_admin_interviewer_group_delete'),
    path('api/addmin/interviewer-groups/<int:group_id>/members/', views.api_admin_interviewer_group_members, name='api_admin_interviewer_group_members'),
    path('api/addmin/interviewer-groups/<int:group_id>/members/add/', views.api_admin_interviewer_group_member_add, name='api_admin_interviewer_group_member_add'),
    path('api/addmin/interviewer-groups/<int:group_id>/members/<int:interviewer_id>/remove/', views.api_admin_interviewer_group_member_remove, name='api_admin_interviewer_group_member_remove'),
    path('api/addmin/interviewer-groups/<int:group_id>/chief/<int:interviewer_id>/set/', views.api_admin_interviewer_group_set_chief, name='api_admin_interviewer_group_set_chief'),

    # ============================================================
    # API 路由 - 管理员 - 场次管理
    # ============================================================
    path('api/addmin/groups/', views.api_admin_groups, name='api-admin-groups'),
    path('api/addmin/groups/<int:group_id>/', views.api_admin_group_detail, name='api-admin-group-detail'),
    path('api/addmin/groups/create/', views.api_admin_group_create, name='api-admin-group-create'),
    path('api/addmin/groups/options/', views.api_admin_groups_options, name='api-admin-groups-options'),
    path('api/addmin/groups/<int:group_id>/delete/', views.api_admin_group_cancel, name='api-admin-group-delete'),

    # API 路由 - 管理员 - 场次面试官管理
    path('api/addmin/groups/<int:group_id>/interviewers/', views.api_admin_group_interviewers, name='api-admin-group-interviewers'),

    # API 路由 - 管理员 - 场次候选人管理
    path('api/addmin/groups/<int:group_id>/candidates/', views.api_admin_group_candidates, name='api-admin-group-candidates'),
    path('api/addmin/candidates/all/', views.api_admin_candidates_all, name='api-admin-candidates-all'),

    # ============================================================
    # API 路由 - 管理员 - 评价管理
    # ============================================================
    path('api/addmin/scores/', views.api_admin_scores, name='api-admin-scores'),
    path('api/addmin/scores/options/', views.api_admin_scores_options, name='api_admin_scores_options'),
    path('api/addmin/groups/<int:group_id>/scores/', views.api_admin_group_scores, name='api_admin_group_scores'),
]