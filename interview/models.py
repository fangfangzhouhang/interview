import re
import json
from django.db import models
from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from .validators import WordCountValidator


# 评分维度配置 - 百分制评分系统
SCORE_DIMENSIONS = [
    {
        'code': 'expression',
        'name': '表达能力',
        'max_score': 20,
        'description': '面试者的语言表达、沟通能力和逻辑性',
    },
    {
        'code': 'resume',
        'name': '简历得分',
        'max_score': 15,
        'description': '简历内容的真实性、完整性和相关经历',
    },
    {
        'code': 'innovation',
        'name': '创新能力',
        'max_score': 20,
        'description': '独立思考、创新思维和解决问题的能力',
    },
    {
        'code': 'responsibility',
        'name': '责任心',
        'max_score': 15,
        'description': '工作态度、责任感和执行力',
    },
    {
        'code': 'logic',
        'name': '逻辑思维',
        'max_score': 15,
        'description': '分析问题、逻辑推理和决策能力',
    },
    {
        'code': 'teamwork',
        'name': '团队协作',
        'max_score': 10,
        'description': '团队合作精神和人际交往能力',
    },
    {
        'code': 'match',
        'name': '部门匹配度',
        'max_score': 5,
        'description': '与部门需求的匹配程度和发展潜力',
    },
]

# 计算总分
SCORE_TOTAL_MAX = sum(d['max_score'] for d in SCORE_DIMENSIONS)


class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('super_admin', '超级管理员'),
        ('admin', '主管理员'),
        ('subadmin', '部门管理员'),
        ('interviewer', '面试官'),
        ('candidate', '面试者'),
        ('guest', '访客'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='candidate')

    class Meta:
        verbose_name = '用户档案'
        verbose_name_plural = '用户档案管理'
        ordering = ['user']

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"

class Interviewer(models.Model):
    class Department(models.TextChoices):
        BGS = 'BGS', '办公'
        XCB = 'XCB', '信传'
        QYB = 'QYB', '权益'
        XSB = 'XSB', '学实'
        WYB = 'WYB', '文艺'
        TYB = 'TYB', '体育'
        UNK = 'UNK', '未知'
    class Gender(models.TextChoices):
        M = 'M','男'
        F = 'F','女'
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    gender = models.CharField(max_length=1, choices=Gender.choices, default=Gender.M, verbose_name='性别')
    political_status = models.CharField(max_length=20, verbose_name='政治面貌')
    department = models.CharField(
        max_length=3,
        choices=Department.choices,
        default=Department.UNK,
        verbose_name = '部门',
    )
    homeroom = models.CharField(max_length=20, verbose_name='组别')
    telephone = models.CharField(
        max_length=11,
        validators=[
            RegexValidator(
                regex=r'^1[3-9]\d{9}$',
                message='请输入有效的中国手机号（11位数字）'
            )
        ],
        verbose_name='手机号',
        help_text='请输入11位中国手机号'
    )
    student_number = models.CharField(
        max_length=8,
        validators=[
            RegexValidator(
                regex=r'^2[0-6]\d{6}$',
                message='请输入有效的学号（8位数字）'
            )
        ],
        unique=True,
        verbose_name='学号',
        help_text='请输入8位学号'
    )

    class Meta:
        constraints = []
        ordering = ['department', 'name']

    def __str__(self):
        return f"{self.department} - {self.name}"

    def is_chief(self):
        """检查是否是主面试官"""
        return hasattr(self, 'chief_of_group') and self.chief_of_group is not None

class InterviewerGroup(models.Model):
    class Status(models.TextChoices):
        ONUSE = 'ONUSE', '启用中'
        WORKING = 'WORKING', '工作中'
        ENDED = 'ENDED', '已销毁'
    name = models.CharField(max_length=50, blank=True, verbose_name='组名')
    department = models.CharField(max_length=3, choices=Interviewer.Department.choices, verbose_name='部门')
    members = models.ManyToManyField(
        'Interviewer',
        related_name='groups',
        verbose_name='组成员'
    )
    chief = models.ForeignKey(
        'Interviewer',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='chief_of_group',
        verbose_name='主面试官',
        help_text='该组的主面试官'
    )
    status = models.CharField(
        max_length=8,
        choices=Status.choices,
        default=Status.ONUSE,
        verbose_name='状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')


    class Meta:
        verbose_name = '面试官组'
        verbose_name_plural = '面试官组管理'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - 主面试官: {self.chief.name if self.chief else '未设置'}"

    def clean(self):
        if self.chief:
            pass

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def get_chief(self):
        return self.chief

    def get_members(self):
        return self.members.all()

    def get_member_count(self):
        return self.members.count()

    def get_member_names(self):
        return list(self.members.values_list('name', flat=True))

    def get_members_with_department(self):
        return self.members.values('id', 'name', 'department')

    def is_member(self, interviewer):
        return self.members.filter(pk=interviewer.pk).exists()


class Candidate(models.Model):
    class Gender(models.TextChoices):
        M = 'M','男'
        F = 'F','女'
    class School(models.TextChoices):
        HG = 'HG', '化工学院'
        HF = 'HF', '化学与分子工程学院'
        SG = 'SG', '生物工程学院'
        YX = 'YX', '药学院'
        CL = 'CL', '材料科学与工程学院'
        XX = 'XX', '信息科学与工程学院'
        JX = 'JX', '机械与动力工程学院'
        ZH = 'ZH', '资源与环境工程学院'
        SY = 'SY', '数学学院'
        WL = 'WL', '物理学院'
        SX = 'SX', '商学院'
        SH = 'SH', '社会与公共管理学院'
        YS = 'YS', '艺术设计与传媒学院'
        WG = 'WG', '外国语学院'
        FX = 'FX', '法学院'
        TY = 'TY', '体育科学与工程学院'
        GZ = 'GZ', '国际卓越工程师学院'
        UN = 'UN', '请选择学院'
    class Status(models.TextChoices):
        INCOMPLETE = 'INCOMPLETE', '未完善'
        REGISTERED = 'REGISTERED', '已报名'
        WAITING = 'WAITING', '候场中'
        INQUEUE = 'INQUEUE', '队列中'
        INTERVIEWING = 'INTERVIEWING', '面试中'
        COMPLETED = 'COMPLETED', '已完成'
    class RaceTrack(models.TextChoices):
        POL = 'POL', '破浪赛道'
        ZHU = 'ZHU', '逐浪赛道'
        UNK = 'UNK', '暂未选择'
    class Adjustable(models.TextChoices):
        Y = 'Y', '是'
        N = 'N', '否'
        O = 'O', '或'

    """面试者模型"""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=20, verbose_name='姓名')
    gender = models.CharField(max_length=1, choices=Gender.choices, default=Gender.M, verbose_name='性别')
    political_status = models.CharField(max_length=20, verbose_name='政治面貌')
    school = models.CharField(max_length=2, choices=School.choices, default=School.UN, verbose_name='学院')
    homeroom = models.CharField(max_length=20, verbose_name='班级')
    telephone = models.CharField(
        max_length=11,
        validators=[
            RegexValidator(
                regex=r'^1[3-9]\d{9}$',
                message='请输入有效的中国手机号（11位数字）'
            )
        ],
        verbose_name='手机号',
        help_text='请输入11位中国手机号'
    )
    student_number = models.CharField(
        max_length=8,
        validators=[
            RegexValidator(
                regex=r'^2[0-6]\d{6}$',
                message='请输入有效的学号（8位数字）'
            )
        ],
        unique=True,
        verbose_name='学号',
        help_text='请输入8位学号'
    )
    qq_id = models.CharField(max_length=15, verbose_name='QQ号')
    wx_id = models.CharField(max_length=50, verbose_name='微信号')
    email = models.EmailField(verbose_name='电子邮箱')
    character = models.TextField(validators=[WordCountValidator(500, '兴趣爱好及特长')], verbose_name='兴趣爱好及特长',help_text='兴趣爱好及特长')
    introduction = models.TextField(validators=[WordCountValidator(150, '自我介绍及评价')], verbose_name='自我介绍及评价', help_text='自我介绍及评价（150字以内）')
    experience = models.TextField(validators=[WordCountValidator(500, '学生工作经历')], verbose_name='学生工作经历', help_text='学生工作经历', blank=True)
    honor = models.TextField(validators=[WordCountValidator(500, '所获荣誉')], verbose_name='所获荣誉', help_text='所获荣誉', blank=True)

    racetrack = models.CharField(max_length=3, choices=RaceTrack.choices, default=RaceTrack.UNK, verbose_name='赛道')
    adjustable = models.CharField(max_length=1, choices=Adjustable.choices, default=Adjustable.O, verbose_name='服从调剂')

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INCOMPLETE,
        verbose_name='面试状态'
    )

    avatar = models.ImageField(
        upload_to='avatar/',
        null=True,
        blank=True,
        verbose_name='证件照',
        help_text='请上传个人证件照，支持jpg/png格式'
    )

    avatar_thumbnail = models.ImageField(
        upload_to='avatar/thumbnails/',
        null=True,
        blank=True,
        verbose_name='证件照缩略图'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='注册时间')

    def __str__(self):
        return f"{self.name}{self.student_number}"

    def generate_thumbnail(self, size=(80, 106), quality=70):
        """生成缩略图，默认80x106像素"""
        if not self.avatar:
            return

        try:
            from PIL import Image
            from io import BytesIO
            from django.core.files.base import ContentFile

            img = Image.open(self.avatar.path)
            # 保持宽高比裁剪
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # 创建画布并居中
            canvas = Image.new('RGB', size, (240, 240, 240))
            x = (size[0] - img.width) // 2
            y = (size[1] - img.height) // 2
            canvas.paste(img, (x, y))

            # 保存到内存
            thumb_io = BytesIO()
            canvas.save(thumb_io, format='JPEG', quality=quality, optimize=True)

            # 生成文件名
            filename = f"{self.user.username}_{self.student_number}_thumb.jpg"

            self.avatar_thumbnail.save(
                filename,
                ContentFile(thumb_io.getvalue()),
                save=False
            )
        except Exception as e:
            print(f"生成缩略图失败: {e}")

    def save(self, *args, **kwargs):
        if self.avatar and not self.avatar_thumbnail:
            self.generate_thumbnail()
        super().save(*args, **kwargs)

    def get_current_volunteer(self):
        """获取当前正在排队的最高优先级志愿"""
        return self.volunteers.filter(status=Volunteer.Status.WAITING).order_by('priority').first()


class Volunteer(models.Model):
    class Status(models.TextChoices):
        FILLED = 'FILLED', '已填报'
        WAITING = 'WAITING', '排队中'
        INQUEUE = 'INQUEUE', '队列中'
        INTERVIEWING = 'INTERVIEWING', '面试中'
        COMPLETED = 'COMPLETED', '已完成'
        REJECTED = 'REJECTED', '已淘汰'
        ACCEPTED = 'ACCEPTED', '已录取'

    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name='volunteers',
        verbose_name='面试者'
    )
    department = models.CharField(
        max_length=3,
        choices=Interviewer.Department.choices,
        verbose_name='志愿部门'
    )
    priority = models.PositiveSmallIntegerField(
        verbose_name='志愿优先级',
        help_text='1=第一志愿，2=第二志愿，3=第三志愿'
    )
    queue_start_time = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='开始排队时间',
        help_text='志愿进入队列的时间'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.FILLED,
        verbose_name='志愿状态'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        unique_together = [
            ['candidate', 'priority'],
            ['candidate', 'department'],
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(priority__gte=1) & models.Q(priority__lte=3),
                name='volunteer_priority_range_1_3'
            )
        ]
        ordering = ['candidate', 'priority']
        verbose_name = '志愿信息'
        verbose_name_plural = '志愿信息管理'

    def __str__(self):
        return f"{self.candidate.name} - 第{self.priority}志愿: {self.get_department_display()}"

    def clean(self):
        """应用层验证"""
        self._validate_volunteer_count()

        if self.priority < 1 or self.priority > 3:
            raise ValidationError({'priority': '优先级必须在1-3之间'})

    def _validate_volunteer_count(self):
        existing_count = Volunteer.objects.filter(candidate=self.candidate)
        if self.pk:
            existing_count = existing_count.exclude(pk=self.pk)
        if existing_count.count() >= 3:
            raise ValidationError('每个面试者最多只能填写3个志愿')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self._reorder_all_priorities()

    def _reorder_all_priorities(self):
        """重新整理该候选人的所有志愿优先级，确保从1开始连续排列"""
        all_volunteers = Volunteer.objects.filter(
            candidate=self.candidate
        ).order_by('priority', 'created_at')

        for idx, volunteer in enumerate(all_volunteers, start=1):
            if volunteer.priority != idx:
                volunteer.priority = idx
                Volunteer.objects.filter(pk=volunteer.pk).update(priority=idx)

    def start_queue(self):
        """开始排队"""
        if self.status != self.Status.FILLED:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法开始排队')

        if self.status == self.Status.WAITING and self.queue_start_time is None:
            from django.utils import timezone
            self.queue_start_time = timezone.now()
            self.save(update_fields=['queue_start_time'])
            return

        from django.utils import timezone
        self.status = self.Status.WAITING
        self.queue_start_time = timezone.now()
        self.save()

    def cancel_queue(self):
        """取消排队 - 状态变为 FILLED（已填报）"""
        if self.status != self.Status.WAITING:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法取消排队')
        self.status = self.Status.FILLED
        self.queue_start_time = None
        self.save()
        return True

    def requeue(self):
        """重新排队"""
        if self.status != self.Status.WAITING:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法重新排队')
        from django.utils import timezone
        self.queue_start_time = timezone.now()
        self.save()
        return True

    def is_in_queue(self):
        """检查是否在排队中"""
        return self.status == self.Status.WAITING and self.queue_start_time is not None

    def get_queue_duration(self):
        """获取排队时长（秒）"""
        if not self.is_in_queue():
            return 0
        from django.utils import timezone
        return (timezone.now() - self.queue_start_time).total_seconds()

class InterviewGroup(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', '待开始'
        ONGOING = 'ONGOING', '进行中'
        PAUSE = 'PAUSE', '暂停中'
        ENDED = 'ENDED', '已结束'
        CANCELLED = 'CANCELLED', '已取消'
    """面试组"""
    interviewers = models.ManyToManyField(
        'Interviewer',
        verbose_name='面试官',
        related_name='interview_groups'
    )
    departments = models.CharField(max_length=3, choices=Interviewer.Department.choices, default=Interviewer.Department.UNK, verbose_name='部门')
    group_id = models.CharField(max_length=50, blank=True, verbose_name='组名')
    interview_date = models.DateTimeField(auto_now_add=True, verbose_name='面试时间')

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='面试状态'
    )

    basic_question1 = models.TextField(
        validators=[WordCountValidator(500, '基本题1')],
        verbose_name='基本题1',
        blank=True
    )
    basic_question2 = models.TextField(
        validators=[WordCountValidator(500, '基本题2')],
        verbose_name='基本题2',
        blank=True
    )
    rush_question = models.TextField(
        validators=[WordCountValidator(500, '抢答题1')],
        verbose_name='抢答题1',
        blank=True
    )

    start_time = models.DateTimeField(null=True, blank=True, verbose_name='面试开始时间')
    end_time = models.DateTimeField(null=True, blank=True, verbose_name='面试结束时间')

    classroom = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='面试教室',
        help_text='留空时叫号看板显示"待安排"'
    )

    class Meta:
        verbose_name = '面试组'
        verbose_name_plural = '面试组管理'
        ordering = ['-interview_date']

    def __str__(self):
        return f"{self.departments} - {self.group_id} - {self.interview_date.strftime('%Y-%m-%d %H:%M:%S')}"

    def get_interviewer_count(self):
        """获取面试官人数"""
        return self.interviewers.count()

    def get_candidate_in_group_count(self):
        return self.candidates.count()

    def start_interview(self):
        """开始面试"""
        if self.status == self.Status.PENDING or self.status == self.Status.PAUSE:
            self.status = self.Status.ONGOING
            self.save()
        else:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法开始面试')

    def pause_interview(self):
        """暂停面试"""
        if self.status == self.Status.ONGOING:
            self.status = self.Status.PAUSE
            self.save()
        else:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法暂停面试')

    def end_interview(self):
        """结束面试"""
        if self.status == self.Status.ONGOING or self.status == self.Status.PAUSE:
            self.status = self.Status.ENDED
            self.save()
        else:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法结束面试')

    def cancel_interview(self):
        """取消面试"""
        if self.status in [self.Status.PENDING, self.Status.ONGOING, self.Status.PAUSE]:
            self.status = self.Status.CANCELLED
            self.save()
        else:
            raise ValidationError(f'当前状态为 {self.get_status_display()}，无法取消面试')

    def is_full(self):
        """检查组是否已满"""
        return self.candidates.count() >= 6

    def get_available_orders(self):
        """获取可用的序号列表"""
        used_orders = set(self.candidates.values_list('order', flat=True))
        return [i for i in range(1, 7) if i not in used_orders]

    def get_candidates_with_scores(self):
        """获取所有面试者及其分数（用于结果汇总）"""
        result = []
        for candidate_in_group in self.candidates.all().select_related('candidate'):
            result.append({
                'candidate': candidate_in_group.candidate,
                'order': candidate_in_group.order,
                'average_score': candidate_in_group.get_average_score(),
                'scores': candidate_in_group.get_all_scores(),
                'score_count': candidate_in_group.scores.count()
            })
        # 按平均分降序排列
        return sorted(result, key=lambda x: x['average_score'] or 0, reverse=True)

class CandidateInGroup(models.Model):
    """组内面试者 - 每个组可以有1-6个面试者"""
    class CallStatus(models.TextChoices):
        WAITING = 'WAITING', '等待叫号'
        CALLED = 'CALLED', '已叫号'
        INTERVIEWING = 'INTERVIEWING', '正在面试'
        FINISHED = 'FINISHED', '面试完成'

    group = models.ForeignKey(
        InterviewGroup,
        on_delete=models.PROTECT,
        verbose_name='所属面试组',
        related_name='candidates'
    )
    candidate = models.ForeignKey(
        'Candidate',
        on_delete=models.PROTECT,
        verbose_name='面试者'
    )
    order = models.PositiveSmallIntegerField(
        verbose_name='序号',
        help_text='面试者在组内的顺序（1-6）'
    )
    call_status = models.CharField(
        max_length=15,
        choices=CallStatus.choices,
        default=CallStatus.WAITING,
        verbose_name='叫号状态'
    )
    called_at = models.DateTimeField(null=True, blank=True, verbose_name='叫号时间')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='面试完成时间')

    class Meta:
        unique_together = ['group', 'order']
        constraints = [
            models.CheckConstraint(
                check=models.Q(order__gte=1) & models.Q(order__lte=6),
                name='candidate_order_range_1_6'
            )
        ]
        ordering = ['order']
        verbose_name = '组内面试者'
        verbose_name_plural = '组内面试者'

    def __str__(self):
        return f"{self.group} - 第{self.order}位: {self.candidate.name}"

    def clean(self):
        """应用层验证：确保组内人数不超过6人"""
        existing_count = CandidateInGroup.objects.filter(group=self.group)
        if self.pk:
            existing_count = existing_count.exclude(pk=self.pk)
        if existing_count.count() >= 6:
            raise ValidationError('面试组已达最大人数限制，无法添加')
        if CandidateInGroup.objects.filter(group=self.group, order=self.order).exclude(pk=self.pk).exists():
            raise ValidationError({'order': f'序号{self.order}已被占用'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def get_average_score(self):
        """获取该面试者的平均分（仅统计有效评分，排除0分）"""
        scores = self.candidate.scores.exclude(score=0)
        if scores:
            return sum([s.score for s in scores]) / len(scores)
        return 0

    def get_all_scores(self):
        """获取所有面试官的评分列表（通过 candidate 获取评分）"""
        return [(s.interviewer.name, s.score) for s in self.candidate.scores.all()]


class InterviewerScore(models.Model):
    candidate = models.ForeignKey(
        'Candidate',
        on_delete=models.PROTECT,
        verbose_name='面试者',
        related_name='scores'
    )
    interviewer = models.ForeignKey(
        'Interviewer',
        on_delete=models.PROTECT,
        verbose_name='面试官',
        related_name='scores'
    )
    interview_group = models.ForeignKey(
        'InterviewGroup',
        on_delete=models.CASCADE,
        verbose_name='面试场次',
        related_name='scores',
        null=True,
        blank=True
    )

    self_intro = models.TextField(
        validators=[WordCountValidator(300, '自我介绍')],
        blank=True,
        verbose_name='自我介绍',
        help_text='面试官记录的面试者现场自我介绍'
    )

    comment = models.TextField(
        validators=[WordCountValidator(300, '评语')],
        blank=True,
        verbose_name='评语',
        help_text='面试官对面试者的综合评价'
    )

    # 百分制总分（0-100）
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        validators=[
            MinValueValidator(0),
            MaxValueValidator(100)
        ],
        verbose_name='总分',
        help_text='百分制评分，由各维度得分自动计算'
    )

    # 各维度得分详情
    dimension_scores = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='各维度得分',
        help_text='存储各评分维度的具体得分，格式：{dimension_code: score}'
    )

    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        # 唯一键包含面试场次：同一面试官在不同场次对同一选手的评分独立保存，
        # 避免新场次覆盖历史评分
        unique_together = ['candidate', 'interviewer', 'interview_group']
        verbose_name = '面试官评分'
        verbose_name_plural = '面试官评分'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.interviewer.name} 对 {self.candidate.name} 的评分: {self.score}"

    def calculate_total(self):
        """根据维度得分计算总分"""
        if not self.dimension_scores:
            return float(self.score)
        total = 0
        for dim in SCORE_DIMENSIONS:
            score = self.dimension_scores.get(dim['code'], 0)
            total += min(float(score), dim['max_score'])
        return round(total, 2)

    def get_dimension_score(self, code):
        """获取指定维度的得分"""
        if not self.dimension_scores:
            return 0
        return float(self.dimension_scores.get(code, 0))

    def set_dimension_score(self, code, value):
        """设置指定维度的得分"""
        if not self.dimension_scores:
            self.dimension_scores = {}
        dim_config = next((d for d in SCORE_DIMENSIONS if d['code'] == code), None)
        if dim_config:
            self.dimension_scores[code] = min(float(value), dim_config['max_score'])
            self.score = self.calculate_total()

    def save(self, *args, **kwargs):
        """保存时自动计算总分"""
        if self.dimension_scores:
            self.score = self.calculate_total()
        super().save(*args, **kwargs)
