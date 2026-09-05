"""
Django settings for the Travel Package Booking System.

Generated for Django 6.1 / DRF-based backend.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# ------------------------------------------------------------------
# BASE PATHS
# ------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Load variables from backend/.env
load_dotenv(BASE_DIR / ".env")


def env_bool(key, default=False):
    value = os.getenv(key)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def env_list(key, default=""):
    value = os.getenv(key, default)
    return [item.strip() for item in value.split(",") if item.strip()]


# ------------------------------------------------------------------
# CORE SECURITY SETTINGS
# ------------------------------------------------------------------
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "django-insecure-dev-only-change-me-in-production",
)

DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")

# Render sets this automatically for every web service — adding it
# here means you don't have to manually keep ALLOWED_HOSTS in sync
# with the *.onrender.com hostname Render assigns you.
RENDER_EXTERNAL_HOSTNAME = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# ------------------------------------------------------------------
# APPLICATION DEFINITION
# ------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "cloudinary",
    "cloudinary_storage",
]

LOCAL_APPS = [
    "accounts",
    "destinations",
    "packages",
    "itineraries",
    "bookings",
    "payments",
    "reviews",
    "contact",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# ------------------------------------------------------------------
# DATABASE
# ------------------------------------------------------------------
# Three ways this resolves, in priority order:
#   1. DATABASE_URL set (Render's managed Postgres injects this
#      automatically) -> parsed directly, used as-is.
#   2. USE_SQLITE=True -> local SQLite file, no Postgres server needed.
#   3. Otherwise -> Postgres via the individual DATABASE_* variables
#      (for a self-hosted/manually-configured Postgres).

DATABASE_URL = os.getenv("DATABASE_URL")
USE_SQLITE = env_bool("USE_SQLITE", False)

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=not env_bool("DEBUG", False),
        )
    }
elif USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            # SQLite has no real row-level locking — select_for_update()
            # is effectively a no-op, and concurrent writers instead race
            # for a whole-database-file lock. Without a busy timeout, the
            # loser of that race fails immediately with "database is
            # locked" instead of waiting. This keeps SQLite usable for
            # local dev under light concurrent load; PostgreSQL (the
            # intended production database) handles this correctly via
            # real row locks and doesn't need this workaround.
            "OPTIONS": {"timeout": 20},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DATABASE_NAME", "travel_booking_db"),
            "USER": os.getenv("DATABASE_USER", "postgres"),
            "PASSWORD": os.getenv("DATABASE_PASSWORD", "postgres"),
            "HOST": os.getenv("DATABASE_HOST", "localhost"),
            "PORT": os.getenv("DATABASE_PORT", "5432"),
        }
    }


# ------------------------------------------------------------------
# CUSTOM USER MODEL
# ------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"


# ------------------------------------------------------------------
# PASSWORD VALIDATION
# ------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ------------------------------------------------------------------
# INTERNATIONALIZATION
# ------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ------------------------------------------------------------------
# STATIC & MEDIA FILES
# ------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# When CLOUDINARY_URL is set (e.g. on Render), store uploaded media in
# Cloudinary so images survive deploys/restarts. Without it, the local
# filesystem is used (fine for local dev).
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")
if CLOUDINARY_URL:
    STORAGES["default"] = {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    }


# ------------------------------------------------------------------
# DJANGO REST FRAMEWORK
# ------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.SingleSessionJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
}


# ------------------------------------------------------------------
# SIMPLE JWT
# ------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", 60))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", 7))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}


# ------------------------------------------------------------------
# RAZORPAY (Test Mode is free - use rzp_test_ keys)
# ------------------------------------------------------------------
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# ------------------------------------------------------------------
# GOOGLE SIGN-IN
# ------------------------------------------------------------------
# The frontend obtains an ID token from Google Identity Services; the
# backend verifies it was actually issued by Google for THIS app
# (matching this client ID) before trusting the email/name inside it.
# Get this value from Google Cloud Console > APIs & Services >
# Credentials > OAuth 2.0 Client ID (Web application).
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


# ------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://travelbookingsystem-one.vercel.app,https://travel-booking-system-1-tsta.onrender.com",
)
CORS_ALLOW_CREDENTIALS = True
# Allow Vercel preview deployments (*-*.vercel.app) without listing each one
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
]


# ------------------------------------------------------------------
# DEFAULT PRIMARY KEY
# ------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
