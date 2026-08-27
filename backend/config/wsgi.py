"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

# Auto-create superuser on Render free tier (Shell not available)
# Set DJANGO_SUPERUSER_USERNAME / EMAIL / PASSWORD in Render Env Vars
try:
    from django.contrib.auth import get_user_model

    User = get_user_model()
    su_user = os.getenv("DJANGO_SUPERUSER_USERNAME")
    su_email = os.getenv("DJANGO_SUPERUSER_EMAIL", "")
    su_pass = os.getenv("DJANGO_SUPERUSER_PASSWORD")
    if su_user and su_pass and not User.objects.filter(username=su_user).exists():
        User.objects.create_superuser(username=su_user, email=su_email, password=su_pass)
        # ensure role matches custom User model
        try:
            u = User.objects.get(username=su_user)
            if hasattr(u, "role"):
                u.role = "admin"
                u.save(update_fields=["role"])
        except Exception:
            pass
except Exception:
    # DB not ready during collectstatic or migrations — ignore
    pass
