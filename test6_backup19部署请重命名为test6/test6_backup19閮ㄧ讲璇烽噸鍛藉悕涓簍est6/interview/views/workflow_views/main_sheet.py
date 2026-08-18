from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from ...models import (
    Interviewer,
    InterviewGroup,
    InterviewerGroup,
    InterviewerScore,
    CandidateInGroup,
    Candidate,
    Volunteer,
)

from ...serializers import InterviewGroupSerializer

from ..permission import (
    interviewer_required,
)

from ...wss_api.workflow_services import InterviewService


@interviewer_required(return_json=True)
def main_sheet(request):
    """面试页面视图"""
    group_id = request.GET.get('group')
    return render(request, 'workflow/main_sheet.html', {'group_id': group_id})


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_candidates_in_group(request, group_id):
    """获取指定面试组的所有面试者"""
    try:
        candidates, error = InterviewService.get_candidates_in_group(group_id, request.user)

        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        return Response(candidates)
    except Interviewer.DoesNotExist:
        return Response({'error': '您还不是面试官'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_candidate_detail(request, candidate_in_group_id):
    """获取指定组内面试者的详细信息"""
    try:
        detail, error = InterviewService.get_candidate_detail(candidate_in_group_id, request.user)

        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        return Response(detail)
    except Interviewer.DoesNotExist:
        return Response({'error': '面试官不存在'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@interviewer_required(return_json=True)
def save_evaluation(request):
    """保存面试评价 - HTTP模式（仅主面试官可编辑题目）"""
    try:
        success, error = InterviewService.save_evaluation(request.user, request.data, False)

        if success:
            return Response({'success': True, 'message': '评价保存成功'})
        else:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

    except Interviewer.DoesNotExist:
        return Response({'error': '面试官不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_existing_evaluation(request, candidate_in_group_id):
    """获取已存在的评价"""
    try:
        evaluation, error = InterviewService.get_existing_evaluation(candidate_in_group_id, request.user)

        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        return Response(evaluation, status=status.HTTP_200_OK)

    except Interviewer.DoesNotExist:
        return Response({
            'has_evaluation': False,
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_interview_groups(request):
    """获取所有面试组"""
    groups = InterviewGroup.objects.all()
    serializer = InterviewGroupSerializer(groups, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_group_detail(request, group_id):
    """获取面试组详细信息 - HTTP模式（仅主面试官有控制权限）"""
    try:
        detail, error = InterviewService.get_group_detail(request.user, group_id, False)

        if error:
            return Response({'error': error}, status=status.HTTP_403_FORBIDDEN)

        return Response(detail)
    except Interviewer.DoesNotExist:
        return Response({'error': '您还不是面试官'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@interviewer_required(return_json=True)
def update_group_status(request, group_id):
    """更新面试组状态 - HTTP模式（仅主面试官可操作）"""
    try:
        action = request.data.get('action')

        if action not in ['start', 'pause', 'end']:
            return Response({'error': '无效的操作'}, status=status.HTTP_400_BAD_REQUEST)

        success, result = InterviewService.perform_status_action(
            group_id, action, request.user, False
        )

        if success:
            return Response({
                'success': True,
                'message': result['message'],
                'status': result['status'],
                'should_sync': True
            })
        else:
            return Response({'error': result.get('error', '操作失败')}, status=status.HTTP_400_BAD_REQUEST)

    except Interviewer.DoesNotExist:
        return Response({'error': '面试官不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_group_status(request, group_id):
    """获取面试组最新状态"""
    try:
        group = InterviewGroup.objects.get(id=group_id)
        interviewer = Interviewer.objects.get(user=request.user)

        if not group.interviewers.filter(id=interviewer.id).exists():
            return Response({'error': '您不是该场次的面试官'}, status=status.HTTP_403_FORBIDDEN)

        return Response({'status': group.status})
    except InterviewGroup.DoesNotExist:
        return Response({'error': '面试组不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Interviewer.DoesNotExist:
        return Response({'error': '面试官不存在'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@interviewer_required(return_json=True)
def get_group_questions_content(request, group_id):
    """获取面试组的题目内容 - HTTP轮询时先保存用户编辑内容再返回最新数据"""
    try:
        interviewer = Interviewer.objects.get(user=request.user)
        group = InterviewGroup.objects.get(id=group_id)

        if not group.interviewers.filter(id=interviewer.id).exists():
            return Response({'error': '您不是该场次的面试官'}, status=status.HTTP_403_FORBIDDEN)

        # 检查是否有前端传来的待保存数据（通过URL参数或请求体）
        # 使用GET参数传递：?basic_question_1=xxx&basic_question_2=xxx&rush_question=xxx
        basic_1 = request.GET.get('basic_question_1')
        basic_2 = request.GET.get('basic_question_2')
        rush = request.GET.get('rush_question')

        if basic_1 is not None and basic_2 is not None and rush is not None:
            # 有前端数据，先保存再返回
            question_data = {
                'basic_question_1': basic_1,
                'basic_question_2': basic_2,
                'rush_question': rush,
            }
            success, error = InterviewService.sync_questions_from_polling(
                request.user, group_id, question_data
            )
            if not success:
                pass

        # 返回最新数据
        return Response({
            'success': True,
            'basic_question_1': group.basic_question1 or '',
            'basic_question_2': group.basic_question2 or '',
            'rush_question': group.rush_question or '',
            'timestamp': timezone.now().isoformat()
        })
    except InterviewGroup.DoesNotExist:
        return Response({'error': '面试组不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Interviewer.DoesNotExist:
        return Response({'error': '面试官不存在'}, status=status.HTTP_404_NOT_FOUND)