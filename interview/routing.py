# workflow/routing.py
from django.urls import path
from .wss_api.consumers import InterviewConsumer

# WebSocket URL 路由配置
websocket_urlpatterns = [
    path('ws/interview/<int:group_id>/', InterviewConsumer.as_asgi()),
]
