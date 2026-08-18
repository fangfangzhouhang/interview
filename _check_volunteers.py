"""直接模拟 admin 侧「点开始排队」按钮，查 volunteer 记录和 API 返回结构。"""
import os, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'interview_system.settings'
django.setup()

from django.contrib.auth.models import User
from interview.models import Candidate, UserProfile

print('=== DB 里 candidate + 其志愿 volunteer_1/2/3 情况 ===')
for u in User.objects.filter(profile__role='candidate').select_related('profile'):
    cand = getattr(u, 'candidate', None)
    if not cand:
        print('  user=%s  NO Candidate record' % u.username)
        continue
    print('  candidate: user=%s (id=%s)  name=%s' % (u.username, u.id, cand.name))
    for key in ['volunteer_1', 'volunteer_2', 'volunteer_3']:
        v = getattr(cand, key, None)
        if v:
            print('     %s: volunteer_id=%s  dept=%s  status=%s  is_in_queue=%s  queue_start=%s' % (
                key, v.id, v.department, v.status, v.is_in_queue, v.queue_start_time
            ))
        else:
            print('     %s: None' % key)
