from django.urls import path
from .. import views
urlpatterns = [
    # ============================================================
    # 面试者页面路由
    # ============================================================
    path('profile/', views.profile_view, name='profile'),
    path('queue/', views.queue_view, name='queue'),

    # ============================================================
    # API 路由 - 个人资料
    # ============================================================
    path('api/profile/', views.get_profile, name='api-profile'),
    path('api/profile/update/', views.update_profile, name='api-profile-update'),
    path('api/profile/volunteer/action/', views.volunteer_action, name='api_profile_volunteer_action'),

    path('api/queue/info/', views.get_queue_info, name='api_queue_info'),
]