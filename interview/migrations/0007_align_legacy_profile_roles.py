from django.db import migrations


def align_legacy_profile_roles(apps, schema_editor):
    """Repair profiles created by the old interviewer/candidate registration flow."""
    UserProfile = apps.get_model('interview', 'UserProfile')

    UserProfile.objects.filter(
        role='guest',
        user__interviewer__isnull=False,
        user__candidate__isnull=True,
    ).update(role='interviewer')

    UserProfile.objects.filter(
        role='guest',
        user__candidate__isnull=False,
        user__interviewer__isnull=True,
    ).update(role='candidate')


class Migration(migrations.Migration):
    dependencies = [
        ('interview', '0006_candidate_created_at'),
    ]

    operations = [
        migrations.RunPython(align_legacy_profile_roles, migrations.RunPython.noop),
    ]
