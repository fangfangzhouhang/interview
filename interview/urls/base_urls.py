from django.urls import path
from .. import views

urlpatterns = [
    # ============================================================
    # 基础页面路由
    # ============================================================
    path('', views.login_view, name='login'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('interview/', views.main_sheet, name='interview'),
    path('new-feature/', views.new_feature_view, name='new_feature'),
]

