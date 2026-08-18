from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('interview.urls')),
]
# 说明：/api/* 未知路径的 JSON 兜底已通过 middleware (EnforceJsonApiResponseMiddleware) 实现，
# 不写在这里是因为 include('') 匹配空前缀后，内部 resolver 一旦 resolve 失败就不再回根 urls 匹配后续 rule。
