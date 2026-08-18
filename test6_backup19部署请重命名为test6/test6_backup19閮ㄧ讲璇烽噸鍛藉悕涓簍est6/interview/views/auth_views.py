from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.http import JsonResponse
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import csrf_exempt
import re

from ..models import Candidate, Interviewer, UserProfile

def login_view(request):
    """登录视图 - 根据用户角色导向不同页面"""
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            # 判断用户角色：先查 Interviewer，再查 Candidate
            if Interviewer.objects.filter(user=user).exists():
                # 面试官登录 - 导向面试官页面
                return JsonResponse({
                    'success': True,
                    'message': '登录成功',
                    'role': 'interviewer',
                    'redirect_url': '/interviewer/panel'
                })
            elif Candidate.objects.filter(user=user).exists():
                # 面试者登录 - 导向面试者页面
                return JsonResponse({
                    'success': True,
                    'message': '登录成功',
                    'role': 'candidate',
                    'redirect_url': '/profile'
                })
            else:
                return JsonResponse({
                    'success': True,
                    'message': '登录成功',
                    'role': 'unknown',
                    'redirect_url': '/subaddmin/users'
                })
        else:
            return JsonResponse({'success': False, 'message': '用户名或密码错误'})
    return render(request, 'auth/login.html')


@csrf_exempt
def logout_view(request):
    """登出视图"""
    logout(request)
    return redirect('login')


def register_view(request):
    """注册视图 - 支持面试官和面试者两种身份"""
    if request.method == 'POST':
        try:
            role = request.POST.get('role')
            username = request.POST.get('username')
            password = request.POST.get('password')
            confirm_password = request.POST.get('confirm_password')
            name = request.POST.get('name')
            gender = request.POST.get('gender')
            political_status = request.POST.get('political_status')
            telephone = request.POST.get('telephone')
            student_number = request.POST.get('student_number')
            homeroom = request.POST.get('homeroom')

            # 验证密码
            if password != confirm_password:
                return JsonResponse({
                    'success': False,
                    'message': '两次输入的密码不一致'
                })

            if len(password) < 8:
                return JsonResponse({
                    'success': False,
                    'message': '密码长度至少为8位'
                })
            if not re.match(r'^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:\'",.<>/?`~]+$', password):
                return JsonResponse({
                    'success': False,
                    'message': '密码只能包含英文、数字和符号'
                })

            if User.objects.filter(username=username).exists():
                return JsonResponse({
                    'success': False,
                    'message': '用户名已存在'
                })

            if not re.match(r'^2[0-6]\d{6}$', student_number):
                return JsonResponse({
                    'success': False,
                    'message': '学号格式不正确'
                })

            if Candidate.objects.filter(student_number=student_number).exists() or \
                    Interviewer.objects.filter(student_number=student_number).exists():
                return JsonResponse({
                    'success': False,
                    'message': '该学号已被注册'
                })

            # 验证角色
            if role not in ['candidate', 'interviewer']:
                return JsonResponse({
                    'success': False,
                    'message': '请选择有效的注册身份'
                })

            with transaction.atomic():
                # 创建用户
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=''
                )

                # 创建用户档案，设置角色
                profile = UserProfile.objects.create(
                    user=user,
                    role=role if role == 'candidate' else 'guest',
                )

                if role == 'interviewer':
                    department = request.POST.get('department')

                    # 验证部门
                    if not department or department == 'UNK':
                        return JsonResponse({
                            'success': False,
                            'message': '请选择部门'
                        })

                    interviewer = Interviewer.objects.create(
                        user=user,
                        name=name,
                        gender=gender,
                        political_status=political_status,
                        department=department,
                        homeroom=homeroom or '',
                        telephone=telephone,
                        student_number=student_number
                    )
                    return JsonResponse({
                        'success': True,
                        'message': '工作人员注册成功！请登录',
                        'user_id': user.id,
                        'role': 'interviewer'
                    })
                else:
                    school = request.POST.get('school')

                    # 验证学院
                    if not school or school == 'UN':
                        return JsonResponse({
                            'success': False,
                            'message': '请选择学院'
                        })

                    candidate = Candidate.objects.create(
                        user=user,
                        name=name,
                        gender=gender,
                        political_status=political_status,
                        school=school,
                        homeroom=homeroom or '',
                        telephone=telephone,
                        student_number=student_number,
                        qq_id='',
                        wx_id='',
                        email='',
                        character='',
                        introduction='',
                        experience='',
                        honor='',
                        racetrack='UNK',
                        adjustable='O',
                    )
                    return JsonResponse({
                        'success': True,
                        'message': '面试者注册成功！请登录',
                        'user_id': user.id,
                        'role': 'candidate'
                    })

        except ValidationError as e:
            return JsonResponse({
                'success': False,
                'message': str(e)
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'message': f'注册失败：{str(e)}'
            })

    return render(request, 'auth/register.html')