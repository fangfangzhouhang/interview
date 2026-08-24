from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # 面试叫号看板（多部门轮播展示）
    # ============================================================
    path('board/', views.board_view, name='board'),
    path('board/admin/', views.board_admin_view, name='board_admin'),
    path('api/board/', views.api_board, name='api_board'),
    path('api/board/call-next/<int:group_id>/', views.api_board_call_next, name='api_board_call_next'),
    path('api/board/assign-volunteer/', views.api_board_assign_volunteer, name='api_board_assign_volunteer'),
    path('api/board/create-group/', views.api_board_create_group, name='api_board_create_group'),
    path('api/board/interviewers/', views.api_board_interviewers, name='api_board_interviewers'),
    path('api/board/classroom/<int:group_id>/', views.api_board_set_classroom, name='api_board_set_classroom'),
]
