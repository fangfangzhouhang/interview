from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # 面试官页面路由
    # ============================================================
    path('interviewer/profile/', views.interviewer_profile_view, name='interviewer_profile'),
    path('interviewer/panel/', views.interviewer_panel_view, name='interviewer_panel'),
    path('interviewer/console/', views.interviewer_console_view, name='interviewer_panel_groups'),

    # ============================================================
    # API 路由 - 面试官
    # ============================================================
    path('api/interviewer/groups/', views.api_interviewer_groups, name='api-interviewer-groups'),
    path('api/interviewer/profile/', views.get_interviewer_profile, name='get_interviewer_profile'),
    path('api/interviewer/profile/update/', views.update_interviewer_profile, name='update_interviewer_profile'),
    path('api/interviewer/console/', views.api_interviewer_console, name='api-interviewer-panel-groups'),
    path('api/interviewer/console/<int:group_id>/', views.api_interviewer_console_detail, name='api-interviewer-panel-group-detail'),
    path('api/interviewer/console/<int:group_id>/transfer-chief/', views.api_interviewer_console_transfer_chief, name='api-interviewer-panel-group-transfer-chief'),
]