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

# Auto-seed missing media files on ephemeral Render disk
# DB persists but /media/ is wiped on every deploy/restart → re-download a fallback
try:
    from django.core.files.base import ContentFile
    import requests

    from packages.models import TourPackage
    from destinations.models import Destination

    # Seed package 1 featured image if missing on disk
    try:
        pkg = TourPackage.objects.filter(id=1).first()
        if pkg and (not pkg.featured_image or not pkg.featured_image.storage.exists(pkg.featured_image.name)):
            url = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80"
            r = requests.get(url, timeout=15)
            if r.ok:
                pkg.featured_image.save("ladakh-featured.jpg", ContentFile(r.content), save=True)
    except Exception:
        pass

    # Seed destination 1 image if missing
    try:
        dest = Destination.objects.filter(id=1).first()
        if dest and (not dest.image or not dest.image.storage.exists(dest.image.name)):
            url = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
            r = requests.get(url, timeout=15)
            if r.ok:
                dest.image.save("ladakh.jpg", ContentFile(r.content), save=True)
    except Exception:
        pass
except Exception:
    pass
