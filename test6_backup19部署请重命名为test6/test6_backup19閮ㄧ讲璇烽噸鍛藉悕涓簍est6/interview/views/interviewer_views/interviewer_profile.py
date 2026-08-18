from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
import json

from ...models import Interviewer

from ..permission import (
    interviewer_required,
)

@interviewer_required(return_json=True)
def interviewer_profile_view(request):
    """面试官个人中心页面视图"""
    return render(request, 'interviewer/interviewer_profile.html')


@csrf_exempt
@interviewer_required(return_json=True)
@transaction.atomic
def update_interviewer_profile(request):
    """更新面试官个人信息"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': '请求方法错误'})

    try:
        user = request.user

        # 获取面试官信息
        interviewer = Interviewer.objects.get(user=user)

        data = json.loads(request.body)

        # 更新基本信息
        interviewer.name = data.get('name', interviewer.name)
        interviewer.gender = data.get('gender', interviewer.gender)
        interviewer.political_status = data.get('political_status', interviewer.political_status)
        #interviewer.department = data.get('department', interviewer.department)
        interviewer.homeroom = data.get('homeroom', interviewer.homeroom)
        interviewer.telephone = data.get('telephone', interviewer.telephone)

        interviewer.save()

        return JsonResponse({
            'success': True,
            'message': '个人信息更新成功'
        })

    except Interviewer.DoesNotExist:
        return JsonResponse({'success': False, 'message': '面试官信息不存在，请确认您已注册为面试官'})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'更新失败：{str(e)}'})


@interviewer_required(return_json=True)
def get_interviewer_profile(request):
    """获取面试官个人信息"""
    try:
        user = request.user

        # 获取面试官信息
        interviewer = Interviewer.objects.get(user=user)

        data = {
            'username': user.username,
            'name': interviewer.name,
            'gender': interviewer.gender,
            'gender_display': interviewer.get_gender_display(),
            'political_status': interviewer.political_status,
            'department': interviewer.department,
            'department_display': interviewer.get_department_display(),
            'homeroom': interviewer.homeroom,
            'telephone': interviewer.telephone,
            'student_number': interviewer.student_number,
        }

        return JsonResponse({'success': True, 'data': data})

    except Interviewer.DoesNotExist:
        # 打印调试信息
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'success': False,
            'message': '面试官信息不存在，请确认您已注册为面试官',
            'debug': {
                'user_id': user.id,
                'username': user.username,
                'has_interviewer': Interviewer.objects.filter(user=user).exists()
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'message': f'获取信息失败：{str(e)}'})