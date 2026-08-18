from django.contrib import admin
from .models import (
    UserProfile,
    Interviewer,
    InterviewerGroup,
    Candidate,
    Volunteer,
    InterviewGroup,
    CandidateInGroup,
    InterviewerScore,
)

admin.site.register(UserProfile)
admin.site.register(Interviewer)
admin.site.register(InterviewerGroup)
admin.site.register(Candidate)
admin.site.register(Volunteer)
admin.site.register(InterviewGroup)
admin.site.register(CandidateInGroup)
admin.site.register(InterviewerScore)