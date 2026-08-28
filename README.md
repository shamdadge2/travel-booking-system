# Travel Package Booking System

A full-stack travel package booking platform: browse destinations and
tour packages, book multi-traveler trips with server-computed pricing,
pay through a mock payment gateway, leave reviews, and manage the whole
catalog through a custom admin panel or the Django admin.

- **Backend:** Python 3, Django 6, Django REST Framework (function-based
  `@api_view` views throughout), Simple JWT, PostgreSQL (SQLite fallback
  for local dev)
- **Frontend:** React 19, Vite, React Router, Axios, plain CSS (no
  Tailwind/Bootstrap)

## Status

- [x] Custom accounts/JWT auth, destinations, packages, itineraries, bookings, payments, reviews, contact
- [x] Django admin fully configured (inlines, autocomplete, list-editable status fields, custom branding)
- [x] React frontend for every page — public, authenticated user, and admin
- [x] Frontend connected to the real API end-to-end (see [Testing](#testing) below)
- [x] Google Sign-In

---

## Features

**Public / customer-facing**
- Browse and search destinations and tour packages (filter by type,
  price, difficulty; sort by price)
- Full package detail pages: inclusions, exclusions, day-by-day
  itinerary, FAQs, reviews, and average rating
- Register / log in with JWT (access + refresh, auto-refresh on
  expiry, blacklist on logout), or sign in with Google
- Book a package for multiple travelers in one request — pricing is
  always computed server-side from the package's current price, never
  trusted from the client
- Real-time slot availability, with race-condition-safe booking
  (`select_for_update`) so a package can never be oversold
- Cancel a booking (restores the slots it used)
- UPI payment via a prefilled deep link (opens the customer's UPI app
  with the amount ready to send), verified by an admin before the
  booking is confirmed — plus a mock card/net-banking flow for demos
- Leave a rating + review for a package after booking it (one review
  per booking)
- Contact form — messages are stored and visible to admins, not just
  a client-side confirmation message

**Admin**
- Dashboard with live stats (users, packages, bookings, revenue,
  recent bookings, popular packages, status breakdown)
- Full CRUD for destinations, packages (including inclusions,
  exclusions, activities, FAQs, and a photo gallery with place names/
  descriptions, all editable in one form), itineraries; booking and
  payment status management; user activation/role management; review
  moderation; contact message inbox
- Verify UPI payments manually before confirming a booking (checks
  the customer-submitted transaction reference against your own
  bank/UPI records first — a customer can never self-confirm their
  own payment)
- Speed up package creation by importing details from a JSON file or
  pasted text (e.g. generated with an AI tool) instead of typing every
  field — manual entry is always still available
- Everything is also manageable through Django's built-in admin at
  `/admin/`, including nested inlines (package images, inclusions,
  exclusions, activities, FAQs, itinerary days, travelers)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | Django 6, Django REST Framework |
| Auth | `djangorestframework-simplejwt` (access + refresh + blacklist) |
| Database | PostgreSQL (production/intended), SQLite (dev fallback) |
| Images/files | Pillow, Django `ImageField`/`FileField` |
| CORS | `django-cors-headers` |
| Filtering | `django-filter` (installed; most filtering is done manually in views per the project's function-based-view style) |
| Frontend framework | React 19 (Vite) |
| Routing | React Router 7 |
| HTTP client | Axios (JWT interceptor with auto-refresh) |
| Styling | Plain CSS — one file per component/page, shared CSS variables in `index.css` |
| Linting | `oxlint` |

---

## Folder Structure

```
travel-booking-system/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example            # copy to .env
│   ├── config/                  # settings, root urls, wsgi/asgi, pagination
│   ├── accounts/                 # custom User model, JWT auth, admin user mgmt
│   ├── destinations/             # Destination CRUD
│   ├── packages/                 # TourPackage + images/inclusions/exclusions/activities/FAQs
│   ├── itineraries/               # day-by-day itinerary per package
│   ├── bookings/                  # Booking + Traveler, overbooking-safe creation
│   ├── payments/                  # mock Payment gateway
│   ├── reviews/                   # Review + average rating
│   └── media/                     # uploaded images (gitignored)
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example              # copy to .env
│   └── src/
│       ├── api/                   # axios client + one module per resource
│       ├── components/            # Navbar, Footer, cards, Loader, EmptyState
│       ├── context/                # AuthContext (real JWT-backed auth)
│       ├── hooks/                  # useAuth
│       ├── layouts/                # MainLayout, AdminLayout
│       ├── pages/public/            # Home, Destinations, Packages, Login, etc.
│       ├── pages/user/               # Profile, MyBookings, CreateBooking, Payment, MyReviews
│       ├── pages/admin/              # Dashboard, Users, Destinations, Packages, Bookings, Payments, Reviews
│       ├── routes/                   # AppRoutes, ProtectedRoute, AdminRoute
│       └── utils/                     # formatCurrency, formatDate
├── .gitignore
└── README.md
```

---

## Backend Setup

### 1. Virtual environment

```bash
cd backend
python3 -m venv venv

# macOS/Linux
source venv/bin/activate
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks the activation script:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment variables

```bash
cp .env.example .env       # macOS/Linux
copy .env.example .env     # Windows
```

Key variables in `.env`:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key — generate a real one for anything beyond local dev |
| `DEBUG` | `True` for local dev |
| `USE_SQLITE` | `True` to run without PostgreSQL installed (dev/demo). Set `False` for Postgres |
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT` | Only used when `USE_SQLITE=False` |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Token lifetimes |
| `CORS_ALLOWED_ORIGINS` | Must include your frontend's origin (`http://127.0.0.1:5173` by default) |
| `GOOGLE_CLIENT_ID` | Optional — enables "Sign in with Google". From Google Cloud Console > Credentials > OAuth 2.0 Client ID. Leave blank to disable. |
| `CLOUDINARY_URL` | **Required on Render/production.** Set to your Cloudinary URL (e.g. `cloudinary://key:secret@name`) so uploaded images persist across deploys. When unset, media falls back to the local filesystem (fine for local dev). |

### 4. PostgreSQL configuration (optional — SQLite works out of the box)

To use real PostgreSQL instead of the SQLite fallback:
1. Install PostgreSQL and create a database and user.
2. In `.env`, set `USE_SQLITE=False` and fill in `DATABASE_NAME`,
   `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_HOST`, `DATABASE_PORT`.
3. Continue with migrations below as normal.

### 5. Migrations & superuser

```bash
python manage.py migrate
python manage.py createsuperuser
```

### 6. Run the backend

```bash
python manage.py runserver
```

API root: `http://127.0.0.1:8000/api/` · Admin: `http://127.0.0.1:8000/admin/`

---

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env       # macOS/Linux — or `copy .env.example .env` on Windows
npm run dev
```

Visit `http://127.0.0.1:5173`. Make sure the backend is running first —
`VITE_API_BASE_URL` in `.env` points at it (`http://127.0.0.1:8000/api`
by default), and the backend's `CORS_ALLOWED_ORIGINS` must include the
frontend's origin (already configured for the Vite defaults).

To enable "Sign in with Google", set `VITE_GOOGLE_CLIENT_ID` here to
the **same** OAuth Client ID as the backend's `GOOGLE_CLIENT_ID`. In
Google Cloud Console, add both `http://localhost:5173` and
`http://127.0.0.1:5173` as authorized JavaScript origins for local
development.

Other frontend scripts:
```bash
npm run build      # production build → dist/
npm run preview    # locally preview the production build
npm run lint        # oxlint
```

---

## API Endpoints

All routes are prefixed with `/api/`. Endpoints marked 🔒 require a
`Authorization: Bearer <access_token>` header; 🔒👑 requires admin/staff.

### Accounts (`/api/auth/`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `register/` | Create a customer account |
| POST | `login/` | Log in (username or email) |
| POST | `refresh/` | Exchange refresh token for a new access token |
| POST | `logout/` 🔒 | Blacklist a refresh token |
| GET/PUT/PATCH | `profile/` 🔒 | View/update your own profile |
| POST | `change-password/` 🔒 | Change your password |
| GET | `users/` 🔒👑 | List all users |
| GET/PATCH/DELETE | `users/<id>/` 🔒👑 | Manage a user |

### Destinations (`/api/destinations/`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `` | List (search, filter, ordering, pagination) |
| POST | `create/` 🔒👑 | Create |
| GET | `<id>/` | Detail |
| PUT/PATCH | `<id>/update/` 🔒👑 | Update |
| DELETE | `<id>/delete/` 🔒👑 | Delete (409 if packages reference it) |

### Packages (`/api/packages/`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `` | List (search, filter, ordering, pagination) |
| POST | `create/` 🔒👑 | Create (accepts nested inclusions/exclusions/activities/FAQs) |
| GET | `featured/` | Featured packages |
| GET | `search/` | Dedicated search endpoint |
| GET | `<id>/` | Full detail (includes images, inclusions, exclusions, activities, FAQs, average_rating) |
| PUT/PATCH | `<id>/update/` 🔒👑 | Update |
| DELETE | `<id>/delete/` 🔒👑 | Delete (409 if bookings reference it) |
| GET | `<id>/availability/?travelers=N` | Slot availability check |
| POST | `<id>/images/add/` 🔒👑 | Upload a gallery image (multipart) |
| DELETE | `images/<image_id>/delete/` 🔒👑 | Remove a gallery image |

### Itineraries
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/packages/<package_id>/itinerary/` | List (public) / Create 🔒👑 a day |
| PUT/PATCH/DELETE | `/api/itinerary/<id>/` 🔒👑 | Update/delete a day |

### Bookings (`/api/bookings/`)
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `` 🔒 | List your own bookings (all, if admin) / create a booking |
| GET/PATCH | `<id>/` 🔒 | View/update (owner: special_requests only; admin: status fields) |
| POST | `<id>/cancel/` 🔒 | Cancel (restores slots) |
| POST | `travelers/<traveler_id>/id-proof/` 🔒 | Upload a traveler's ID proof (multipart) |

### Payments (`/api/payments/`)
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `` 🔒 | Payment history / create a pending payment attempt |
| GET | `<id>/` 🔒 | Detail |
| POST | `<id>/process/` 🔒 | Mock-process (`simulate_result: "success"\|"failure"`, defaults to success) |

### Reviews
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/packages/<package_id>/reviews/` | List (public) / create 🔒 (must own the booking) |
| PUT | `/api/reviews/<id>/` 🔒 | Edit your own review |
| DELETE | `/api/reviews/<id>/` 🔒 | Delete your own review, or any review if admin/staff |

---

## Testing

Every endpoint in this project has been verified against a **live
running server**, covering the full checklist below on a fresh
database.

```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

1. **Registration** — `POST /api/auth/register/` → `201` with user + tokens
2. **Login** — `POST /api/auth/login/` → `200` with tokens
3. **JWT** — protected route without a token → `401`; refresh → `200` with new access token; blacklisted refresh token reused → `401`
4. **Destinations** — admin create → `201`; public list/detail → `200`; non-admin create → `403`
5. **Packages** — admin create with nested inclusions/exclusions → `201`; public list/search/featured/detail/availability → `200`
6. **Itinerary** — admin create a day → `201`; public list for a package → `200`
7. **Booking** — customer books 2 travelers → `201` with server-computed `total_amount`; package `available_slots` decrements correctly; booking a sold-out package → `409`
8. **Payment** — create pending payment → `201`; process with `simulate_result: success` → booking auto-confirms and marks paid
9. **Reviews** — customer reviews their booking → `201`; average rating on the package recalculates immediately; duplicate review on the same booking → `400`

Plus a full security sweep: a customer JWT attempting every admin-only
action (create/delete destinations & packages, list all users) across
every app correctly returns `403`; deleting a destination/package/user
that still has dependent records returns a graceful `409` (never a raw
`500`).

### Postman-style examples

**Register**
```http
POST /api/auth/register/
Content-Type: application/json

{
  "username": "traveler1",
  "email": "traveler1@example.com",
  "password": "Journey123!",
  "password2": "Journey123!",
  "first_name": "Amy",
  "last_name": "Traveler",
  "phone": "9998887777"
}
```
→ `201`
```json
{
  "user": { "id": 2, "username": "traveler1", "role": "customer", "...": "..." },
  "tokens": { "access": "...", "refresh": "..." }
}
```

**Create a booking** (`Authorization: Bearer <access>`)
```http
POST /api/bookings/
Content-Type: application/json

{
  "package": 1,
  "travel_date": "2026-12-01",
  "number_of_travelers": 2,
  "special_requests": "Honeymoon suite please",
  "travelers": [
    { "full_name": "Amy Traveler", "age": 29, "gender": "female" },
    { "full_name": "Ben Traveler", "age": 31, "gender": "male" }
  ]
}
```
→ `201`
```json
{
  "id": 1,
  "booking_reference": "TBUFOO5UEW",
  "total_amount": "96000.00",
  "booking_status": "pending",
  "payment_status": "pending",
  "travelers": [ "..." ]
}
```
Note: any `total_amount` sent by the client is ignored — it's always
`package.effective_price × number_of_travelers`, computed server-side.

**Pay for a booking**
```http
POST /api/payments/
{ "booking": 1, "payment_method": "card" }
```
→ `201` (pending payment) →
```http
POST /api/payments/1/process/
{ "simulate_result": "success" }
```
→ `200`, `payment_status: "paid"`, and the booking automatically flips
to `booking_status: "confirmed"`, `payment_status: "paid"`.

**Leave a review**
```http
POST /api/packages/1/reviews/
{ "booking": 1, "rating": 5, "comment": "Perfect honeymoon trip!" }
```
→ `201`. The package's `average_rating`/`review_count` (visible on
`GET /api/packages/1/`) update immediately.

---

## Design decisions worth knowing about

- **Every price is server-computed.** Booking totals and payment
  amounts are never accepted from the client — always derived from the
  package's current price at the moment of the request.
- **Overbooking is prevented with `select_for_update()`** inside an
  atomic transaction. On PostgreSQL this makes concurrent booking
  requests for the last slot queue safely; on SQLite (no real row
  locking) a busy-timeout plus a graceful `503` fallback handle the
  rare contention case instead of a raw crash.
- **`PROTECT` foreign keys** guard `Destination → Package`,
  `Package → Booking`, and `User → Booking` — you can't accidentally
  delete a destination/package/user that still has dependent booking
  history. Every delete endpoint catches this and returns a helpful
  `409` instead of a `500`.
- **404, not 403, for "not yours."** Viewing someone else's booking,
  payment, or admin-only resource returns `404` rather than `403`, so
  the API never confirms whether a specific record exists to someone
  who isn't allowed to see it.
- **URL style:** most apps use suffix-style URLs (`/create/`,
  `/<id>/update/`, `/<id>/delete/`) to keep every view a single-method
  `@api_view` function rather than a class-based ViewSet. Bookings,
  itineraries, and reviews list+create instead share one URL, with
  method-based branching inside a single function.

## Future Improvements

- Wishlist feature
- Real payment gateway integration (Razorpay/Stripe) behind the same
  `payments` app structure
- Dedicated aggregate-stats endpoints for the admin dashboard (currently
  computed client-side from list endpoints — fine at this scale, worth
  revisiting if the catalog/booking volume grows significantly)
- Email notifications (booking confirmation, payment receipt)
- Pagination on the admin panel's tables (currently fetch up to 100 rows)
