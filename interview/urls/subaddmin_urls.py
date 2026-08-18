from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # 部门管理员页面路由
    # ============================================================
    path('subaddmin/console/', views.subadmin_console_view, name='subadmin_console'),
    path('subaddmin/users/', views.subadmin_users_view, name='subadmin_users'),
    path('subaddmin/interviewers/', views.subadmin_interviewers_view, name='subadmin_interviewers'),
    path('subaddmin/groups/', views.subadmin_groups_view, name='subadmin_groups'),
    path('subaddmin/scores/', views.subadmin_scores_view, name='subadmin_scores'),

    # ============================================================
    # API 路由 - 部门管理员 - 仪表板（志愿管理）
    # ============================================================
    path('api/subaddmin/candidates/', views.api_subadmin_candidates, name='api_subadmin_candidates'),
    path('api/subaddmin/volunteer/accept/', views.api_subadmin_volunteer_accept, name='api_subadmin_volunteer_accept'),
    path('api/subaddmin/volunteer/reject/', views.api_subadmin_volunteer_reject, name='api_subadmin_volunteer_reject'),
    path('api/subaddmin/volunteer/<int:candidate_id>/action/', views.api_subadmin_volunteer_single_action, name='api_subadmin_volunteer_single_action'),

    # ============================================================
    # API 路由 - 部门管理员 - 用户管理
    # ============================================================
    path('api/subaddmin/users/', views.api_subadmin_users, name='api-subadmin-users'),
    path('api/subaddmin/users/<int:user_id>/', views.api_subadmin_user_detail, name='api-subadmin-user-detail'),
    path('api/subaddmin/users/options/', views.api_subadmin_user_options, name='api_subadmin_user_options'),
    path('api/subaddmin/volunteer/<int:volunteer_id>/action/', views.api_subadmin_volunteer_action, name='api_subadmin_volunteer_action'),

    # ============================================================
    # API 路由 - 部门管理员 - 面试官管理
    # ============================================================
    path('api/subaddmin/interviewers/', views.api_subadmin_interviewers, name='api_subadmin_interviewers'),
    path('api/subaddmin/interviewers/<int:interviewer_id>/', views.api_subadmin_interviewer_detail, name='api_subadmin_interviewer_detail'),
    path('api/subaddmin/interviewers/all/', views.api_subadmin_interviewers_all, name='api_subadmin_interviewers_all'),
    path('api/subaddmin/interviewers/available/', views.api_subadmin_interviewer_available, name='api_subadmin_interviewer_available'),

    # ============================================================
    # API 路由 - 部门管理员 - 面试官分组管理
    # ============================================================
    path('api/subaddmin/interviewer-groups/', views.api_subadmin_interviewer_groups, name='api_subadmin_interviewer_groups'),
    path('api/subaddmin/interviewer-groups/options/', views.api_subadmin_interviewer_groups_options, name='api_subadmin_interviewer_groups_options'),
    path('api/subaddmin/interviewer-groups/create/', views.api_subadmin_interviewer_group_create, name='api_subadmin_interviewer_group_create'),
    path('api/subaddmin/interviewer-groups/<int:group_id>/', views.api_subadmin_interviewer_group_detail, name='api_subadmin_interviewer_group_detail'),
    path('api/subaddmin/interviewer-groups/<int:group_id>/delete/', views.api_subadmin_interviewer_group_delete, name='api_subadmin_interviewer_group_delete'),
    path('api/subaddmin/interviewer-groups/<int:group_id>/members/', views.api_subadmin_interviewer_group_members, name='api_subadmin_interviewer_group_members'),
    path('api/subaddmin/interviewer-groups/<int:group_id>/chief/<int:interviewer_id>/set/', views.api_subadmin_interviewer_group_set_chief, name='api_subadmin_interviewer_group_set_chief'),

    # ============================================================
    # API 路由 - 部门管理员 - 场次管理
    # ============================================================
    path('api/subaddmin/groups/', views.api_subadmin_groups, name='api-subadmin-groups'),
    path('api/subaddmin/groups/<int:group_id>/', views.api_subadmin_group_detail, name='api-subadmin-group-detail'),
    path('api/subaddmin/groups/create/', views.api_subadmin_group_create, name='api-subadmin-group-create'),
    path('api/subaddmin/groups/options/', views.api_subadmin_groups_options, name='api-subadmin-groups-options'),
    path('api/subaddmin/groups/<int:group_id>/interviewers/', views.api_subadmin_group_interviewers, name='api-subadmin-group-interviewers'),
    path('api/subaddmin/groups/<int:group_id>/candidates/', views.api_subadmin_group_candidates, name='api-subadmin-group-candidates'),
    path('api/subaddmin/groups/<int:group_id>/cancel/', views.api_subadmin_group_cancel, name='api_subadmin_group_cancel'),
    path('api/subaddmin/candidates/all/', views.api_subadmin_candidates_all, name='api-subadmin-candidates-all'),

    # ============================================================
    # API 路由 - 部门管理员 - 评价管理
    # ============================================================
    path('api/subaddmin/scores/', views.api_subadmin_scores, name='api-subadmin-scores'),
    path('api/subaddmin/scores/options/', views.api_subadmin_scores_options, name='api_subadmin_scores_options'),
    path('api/subaddmin/groups/<int:group_id>/scores/', views.api_subadmin_group_scores, name='api_subadmin_group_scores'),
]