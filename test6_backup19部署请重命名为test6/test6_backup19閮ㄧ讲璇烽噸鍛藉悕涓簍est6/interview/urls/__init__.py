# interview/urls/__init__.py
from django.conf import settings
from django.conf.urls.static import static

from .base_urls import urlpatterns as base_urlpatterns
from .addmin_urls import urlpatterns as addmin_urlpatterns
from .subaddmin_urls import urlpatterns as subaddmin_urlpatterns
from .interviewer_urls import urlpatterns as interviewer_urlpatterns
from .workflow_urls import urlpatterns as workflow_urlpatterns
from .candidate_urls import urlpatterns as candidate_urlpatterns
from .overview_urls import urlpatterns as overview_urlpatterns

# 合并所有 URL 配置
urlpatterns = []
urlpatterns.extend(base_urlpatterns)
urlpatterns.extend(addmin_urlpatterns)
urlpatterns.extend(subaddmin_urlpatterns)
urlpatterns.extend(interviewer_urlpatterns)
urlpatterns.extend(workflow_urlpatterns)
urlpatterns.extend(candidate_urlpatterns)
urlpatterns.extend(overview_urlpatterns)

# 开发环境：提供静态文件和媒体文件服务
if settings.DEBUG:
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns
    urlpatterns += staticfiles_urlpatterns()  # 静态文件
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # 媒体文件