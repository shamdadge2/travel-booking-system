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

# Auto-seed missing media files.
# On Render, CLOUDINARY_URL makes uploads persist in Cloudinary. On local
# dev (no Cloudinary) the filesystem is used. Either way, make sure every
# package/destination has a real image so the UI never shows broken images.
try:
    from django.core.files.base import ContentFile
    import requests

    from packages.models import TourPackage
    from destinations.models import Destination

    FALLBACK_PACKAGE_IMAGES = [
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1502602898657-3e90760937c2?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=800&q=80",
    ]
    FALLBACK_DESTINATION_IMAGES = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1502602898657-3e90760937c2?auto=format&fit=crop&w=800&q=80",
    ]

    def _ensure_image(obj, field_name, fallback_url, filename):
        field = getattr(obj, field_name)
        if not field or not field.storage.exists(field.name):
            r = requests.get(fallback_url, timeout=15)
            if r.ok:
                getattr(obj, field_name).save(filename, ContentFile(r.content), save=True)

    # Seed every package's featured image if missing/invalid
    for idx, pkg in enumerate(TourPackage.objects.all()):
        _ensure_image(
            pkg,
            "featured_image",
            FALLBACK_PACKAGE_IMAGES[idx % len(FALLBACK_PACKAGE_IMAGES)],
            f"package-{pkg.id}-featured.jpg",
        )

    # Seed every destination's image if missing/invalid
    for idx, dest in enumerate(Destination.objects.all()):
        _ensure_image(
            dest,
            "image",
            FALLBACK_DESTINATION_IMAGES[idx % len(FALLBACK_DESTINATION_IMAGES)],
            f"destination-{dest.id}.jpg",
        )
except Exception:
    pass
