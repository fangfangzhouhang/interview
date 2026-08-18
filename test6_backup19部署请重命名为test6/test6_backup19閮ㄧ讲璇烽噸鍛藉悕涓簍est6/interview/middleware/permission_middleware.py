from django.shortcuts import redirect
from django.http import JsonResponse


class PermissionMiddleware:
    """权限中间件 - 只负责全局认证"""

    # 公开URL（不需要登录）
    PUBLIC_URLS = [
        '/login/',
        '/logout/',
        '/register/',
        '/admin/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        if path == '/':
            return self.get_response(request)
        else:
            for public_url in self.PUBLIC_URLS:
                if path.startswith(public_url):
                    return self.get_response(request)

        # 2. 检查用户是否认证
        if not request.user.is_authenticated:
            # AJAX请求返回JSON
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    'success': False,
                    'error': '请先登录',
                    'code': 401
                }, status=401)
            return redirect('/login/')
        # 3. 用户已认证，交给视图层处理具体权限
        return self.get_response(request)