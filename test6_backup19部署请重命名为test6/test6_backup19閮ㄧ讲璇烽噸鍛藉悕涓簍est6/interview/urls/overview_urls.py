from django.urls import path
from .. import views

urlpatterns = [
    path('overview/', views.overview_dashboard, name='overview'),
    path('api/overview/data/', views.api_overview_data, name='api_overview_data'),
    path('api/overview/auto_group/', views.api_auto_group, name='api_auto_group'),
    path('api/overview/manual_refresh/', views.api_manual_refresh, name='api_manual_refresh'),
]