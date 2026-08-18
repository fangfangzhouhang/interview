"""强制 API 请求（/api/... 或 Accept: application/json）的错误响应统一返回 JSON，禁止 Django 默认的 HTML 错误页。

用于修复：当前端拼错 URL（例如 volunteerId=null 导致路径无效），Django 会返回 HTML 404，
前端 `await response.json()` 遇到 `<!DOCTYPE html>` 直接 SyntaxError → Trae 浏览器 React 壳
抛出 Minified React error #185（白屏）。该 middleware 在视图 response 之后拦截，只要是
API 请求 + 响应 Content-Type 是 text/html，就替换为标准 JSON 错误格式（success=false），
前端 response.json() 永远安全，再按 message 显示中文提示而不是崩。
"""
from django.http import JsonResponse


class EnforceJsonApiResponseMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # 与 PermissionMiddleware 保持一致的 API_PATH_PREFIXES
        self.API_PATH_PREFIXES = [
            '/api/',
            '/addmin/api/',
            '/subaddmin/api/',
            '/interviewer/api/',
            '/workflow/api/',
        ]

    def _is_api_request(self, request):
        path = request.path
        for prefix in self.API_PATH_PREFIXES:
            if path.startswith(prefix):
                return True
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return True
        accept = request.headers.get('Accept', '')
        if 'application/json' in accept:
            return True
        content_type = request.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            return True
        return False

    def __call__(self, request):
        response = self.get_response(request)

        if not self._is_api_request(request):
            return response

        # 只修正"本来就不是 JSON"的响应（2xx 业务接口一般正常 Content-Type: application/json，放行）
        content_type = (response.get('Content-Type', '') or '').lower()
        if 'application/json' in content_type:
            return response

        # API 请求但响应是 HTML/text（典型就是 Django 自带 404/403/500 错误页）→ 统一 JSON
        body = (response.content or b'').decode('utf-8', errors='ignore')[:400]
        if body.strip().startswith('<!DOCTYPE') or body.strip().startswith('<html') or 'text/html' in content_type or not content_type:
            message_by_status = {
                403: '无权限访问该接口',
                404: '接口不存在或参数错误',
                405: '请求方法不允许',
                500: '服务器内部错误',
            }
            default_msg = '接口返回了非 JSON 结果，请稍后刷新重试'
            msg = message_by_status.get(response.status_code, default_msg)
            data = {
                'success': False,
                'message': msg,
                'code': response.status_code,
                'path': request.path,
            }
            # 保留原状态码，Content-Type 改为 application/json
            new_response = JsonResponse(data, status=response.status_code)
            for hdr in ['Vary', 'Cache-Control']:
                if hdr in response:
                    new_response[hdr] = response[hdr]
            return new_response

        return response
