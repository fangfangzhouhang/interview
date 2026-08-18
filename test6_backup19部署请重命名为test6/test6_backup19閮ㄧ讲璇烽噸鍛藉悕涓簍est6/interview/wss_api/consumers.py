import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from .workflow_services import InterviewService


class InterviewConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.room_group_name = f'interview_{self.group_id}'

        if not self.scope['user'].is_authenticated:
            await self.close()
            return

        if not await self.check_user_permission(self.scope['user'], self.group_id):
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # 连接成功后发送初始题目数据和状态
        await self.send_initial_data()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action')

            if action == 'sync_questions':
                await self.handle_sync_questions(data)
            elif action == 'status_action':
                await self.handle_status_action(data)
            elif action == 'get_questions':
                await self.send_questions()
            else:
                await self.send_error('未知操作')

        except json.JSONDecodeError:
            await self.send_error('无效的JSON格式')
        except Exception as e:
            await self.send_error(str(e))

    async def handle_sync_questions(self, data):
        """处理题目同步"""
        user = self.scope['user']

        question_data = {
            'basic_question_1': data.get('basic_question_1', ''),
            'basic_question_2': data.get('basic_question_2', ''),
            'rush_question': data.get('rush_question', ''),
        }

        success, error = await self.save_questions_data(user, self.group_id, question_data)

        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'questions_updated',
                    **question_data
                }
            )
            await self.send_success('题目同步成功')
        else:
            await self.send_error(error)

    async def handle_status_action(self, data):
        """处理状态操作（开始/暂停/结束）"""
        user = self.scope['user']
        status_action = data.get('status_action')

        if not status_action:
            await self.send_error('缺少 status_action 参数')
            return

        success, result = await self.perform_status_action(
            self.group_id, status_action, user, True
        )

        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'status_changed',
                    'status': result['status'],
                    'start_time': result.get('start_time'),
                    'end_time': result.get('end_time'),
                    'message': result['message']
                }
            )
            await self.send_success(result['message'])
        else:
            await self.send_error(result.get('error', '操作失败'))

    async def questions_updated(self, event):
        """广播题目更新"""
        await self.send(text_data=json.dumps({
            'type': 'questions_updated',
            'basic_question_1': event.get('basic_question_1', ''),
            'basic_question_2': event.get('basic_question_2', ''),
            'rush_question': event.get('rush_question', ''),
        }))

    async def status_changed(self, event):
        """广播状态变化"""
        await self.send(text_data=json.dumps({
            'type': 'status_changed',
            'status': event['status'],
            'start_time': event.get('start_time'),
            'end_time': event.get('end_time'),
            'message': event.get('message')
        }))

    async def send_initial_data(self):
        """发送初始数据（题目 + 状态）"""
        questions = await self.get_questions(self.group_id)
        status = await self.get_group_status(self.group_id)
        await self.send(text_data=json.dumps({
            'type': 'initial_data',
            **questions,
            'status': status
        }))

    async def send_questions(self):
        """发送题目"""
        questions = await self.get_questions(self.group_id)
        await self.send(text_data=json.dumps({
            'type': 'questions',
            **questions
        }))

    async def send_success(self, message):
        await self.send(text_data=json.dumps({
            'type': 'success',
            'message': message
        }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    @database_sync_to_async
    def check_user_permission(self, user, group_id):
        return InterviewService.check_user_permission(user, group_id)

    @database_sync_to_async
    def get_questions(self, group_id):
        from django.apps import apps

        try:
            InterviewGroup = apps.get_model('interview', 'InterviewGroup')
            group = InterviewGroup.objects.get(id=group_id)
            return {
                'basic_question_1': group.basic_question1 or '',
                'basic_question_2': group.basic_question2 or '',
                'rush_question': group.rush_question or '',
            }
        except InterviewGroup.DoesNotExist:
            return {
                'basic_question_1': '',
                'basic_question_2': '',
                'rush_question': ''
            }

    @database_sync_to_async
    def get_group_status(self, group_id):
        from django.apps import apps
        try:
            InterviewGroup = apps.get_model('interview', 'InterviewGroup')
            group = InterviewGroup.objects.get(id=group_id)
            return group.status
        except InterviewGroup.DoesNotExist:
            return 'PENDING'

    @database_sync_to_async
    def save_questions_data(self, user, group_id, question_data):
        from django.apps import apps
        try:
            InterviewGroup = apps.get_model('interview', 'InterviewGroup')
            Interviewer = apps.get_model('interview', 'Interviewer')

            interviewer = Interviewer.objects.get(user=user)
            group = InterviewGroup.objects.get(id=group_id)

            if not group.interviewers.filter(id=interviewer.id).exists():
                return False, '您不是该场次的面试官'

            group.basic_question1 = question_data.get('basic_question_1', '')
            group.basic_question2 = question_data.get('basic_question_2', '')
            group.rush_question = question_data.get('rush_question', '')
            group.save()

            return True, None
        except InterviewGroup.DoesNotExist:
            return False, '面试组不存在'
        except Interviewer.DoesNotExist:
            return False, '面试官不存在'
        except Exception as e:
            return False, str(e)

    @database_sync_to_async
    def perform_status_action(self, group_id, action, user, is_websocket_mode):
        return InterviewService.perform_status_action(group_id, action, user, is_websocket_mode)