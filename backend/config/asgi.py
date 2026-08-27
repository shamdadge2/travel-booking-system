"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()

# Same auto-create for ASGI
try:
    from django.contrib.auth import get_user_model

    User = get_user_model()
    su_user = os.getenv("DJANGO_SUPERUSER_USERNAME")
    su_email = os.getenv("DJANGO_SUPERUSER_EMAIL", "")
    su_pass = os.getenv("DJANGO_SUPERUSER_PASSWORD")
    if su_user and su_pass and not User.objects.filter(username=su_user).exists():
        User.objects.create_superuser(username=su_user, email=su_email, password=su_pass)
        try:
            u = User.objects.get(username=su_user)
            if hasattr(u, "role"):
                u.role = "admin"
                u.save(update_fields=["role"])
        except Exception:
            pass
except Exception:
    pass
