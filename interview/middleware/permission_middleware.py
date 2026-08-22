from django.contrib.auth.views import redirect_to_login
from django.http import JsonResponse
from django.urls import reverse


class PermissionMiddleware:
    """权限中间件 - 只负责全局认证"""

    # 公开URL（不需要登录）
    PUBLIC_URLS = [
        '/login/',
        '/logout/',
        '/register/',
        '/admin/',
    ]

    # 精确匹配的公开URL（叫号看板投屏页/快照接口，供等候区大屏免登录展示）
    # 注意：叫号控制接口 /api/board/call-next/ 等不在其中，仍需登录+部门权限
    EXACT_PUBLIC_URLS = {
        '/board/',
        '/api/board/',
    }

    # 路径上属于 API 的前缀（命中后统一以 JSON 403 响应认证失败，而不是 302 跳登录页）
    API_PATH_PREFIXES = [
        '/api/',
        '/addmin/api/',
        '/subaddmin/api/',
        '/interviewer/api/',
        '/workflow/api/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _is_api_request(request):
        path = request.path
        for prefix in PermissionMiddleware.API_PATH_PREFIXES:
            if path.startswith(prefix):
                return True
        # 传统 jQuery/AJAX
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return True
        # 现代 fetch/axios 约定：Accept 包含 application/json
        accept = request.headers.get('Accept', '')
        if 'application/json' in accept:
            return True
        return False

    def __call__(self, request):
        path = request.path

        if path == '/':
            return self.get_response(request)
        if path in self.EXACT_PUBLIC_URLS:
            return self.get_response(request)
        for public_url in self.PUBLIC_URLS:
            if path.startswith(public_url):
                return self.get_response(request)

        # 2. 检查用户是否认证
        if not request.user.is_authenticated:
            # API/AJAX 请求始终返回 JSON 403；普通 HTML 页面跳转到登录页
            if self._is_api_request(request):
                return JsonResponse({
                    'success': False,
                    'error': '请先登录',
                    'code': 403
                }, status=403)
            return redirect_to_login(
                request.get_full_path(),
                login_url=reverse('login'),
            )
        # 3. 用户已认证，交给视图层处理具体权限
        return self.get_response(request)
