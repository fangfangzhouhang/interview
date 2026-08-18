from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # API 路由 - 面试组
    # ============================================================
    path('api/groups/', views.get_interview_groups, name='api-groups'),
    path('api/groups/<int:group_id>/', views.get_group_detail, name='api-group-detail'),
    path('api/groups/<int:group_id>/candidates/', views.get_candidates_in_group, name='api-candidates-in-group'),
    path('api/groups/<int:group_id>/status/', views.update_group_status, name='api-update-group-status'),
    path('api/groups/<int:group_id>/status/sync/', views.get_group_status, name='api-group-status-sync'),
    path('api/groups/<int:group_id>/questions_content/', views.get_group_questions_content, name='api-group-questions'),

    # ============================================================
    # API 路由 - 面试者 & 评价
    # ============================================================
    path('api/candidates/<int:candidate_in_group_id>/', views.get_candidate_detail, name='api-candidate-detail'),
    path('api/evaluation/<int:candidate_in_group_id>/', views.get_existing_evaluation, name='api-get-evaluation'),
    path('api/evaluation/', views.save_evaluation, name='api-save-evaluation'),
]