from rest_framework import serializers
from .models import Candidate, InterviewGroup, CandidateInGroup, InterviewerScore, Interviewer


class CandidateSerializer(serializers.ModelSerializer):
    """面试者序列化器"""
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    school_display = serializers.CharField(source='get_school_display', read_only=True)

    class Meta:
        model = Candidate
        fields = [
            'id', 'name', 'gender', 'gender_display', 'political_status',
            'school', 'school_display', 'homeroom', 'telephone',
            'student_number', 'qq_id', 'wx_id', 'email',
            'character', 'introduction', 'experience', 'honor'
        ]


class InterviewerSerializer(serializers.ModelSerializer):
    """面试官序列化器"""
    department_display = serializers.CharField(source='get_department_display', read_only=True)

    class Meta:
        model = Interviewer
        fields = ['id', 'name', 'department', 'department_display']


class InterviewerScoreSerializer(serializers.ModelSerializer):
    """面试官评分序列化器"""
    interviewer_name = serializers.CharField(source='interviewer.name', read_only=True)
    candidate_name = serializers.CharField(source='candidate.name', read_only=True)

    class Meta:
        model = InterviewerScore
        fields = [
            'id', 'interviewer', 'interviewer_name',
            'candidate', 'candidate_name',
            'interview_group', 'self_intro', 'comment', 'score', 'updated_at'
        ]


class CandidateInGroupSerializer(serializers.ModelSerializer):
    """组内面试者序列化器"""
    candidate = CandidateSerializer(read_only=True)
    candidate_id = serializers.PrimaryKeyRelatedField(
        source='candidate',
        queryset=Candidate.objects.all(),
        write_only=True
    )
    # 注意：self_intro 已移除，通过 scores 获取
    scores = InterviewerScoreSerializer(many=True, read_only=True)
    average_score = serializers.SerializerMethodField()

    class Meta:
        model = CandidateInGroup
        fields = [
            'id', 'group', 'candidate', 'candidate_id', 'order',
            'scores', 'average_score'
        ]

    def get_average_score(self, obj):
        return obj.get_average_score()


class InterviewGroupSerializer(serializers.ModelSerializer):
    """面试组序列化器"""
    interviewers = InterviewerSerializer(many=True, read_only=True)
    candidates = CandidateInGroupSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    department_display = serializers.CharField(source='get_departments_display', read_only=True)
    interviewer_count = serializers.SerializerMethodField()
    candidate_count = serializers.SerializerMethodField()

    class Meta:
        model = InterviewGroup
        fields = [
            'id', 'interviewers', 'departments', 'department_display',
            'group_id', 'interview_date', 'status', 'status_display',
            'basic_question1', 'basic_question2', 'rush_question',
            'candidates', 'interviewer_count', 'candidate_count'
        ]

    def get_interviewer_count(self, obj):
        return obj.get_interviewer_count()

    def get_candidate_count(self, obj):
        return obj.get_candidate_in_group_count()