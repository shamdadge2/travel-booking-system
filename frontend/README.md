# Travel Booking System — Frontend

React + Vite frontend for the Travel Package Booking System. Plain CSS
only (no Tailwind/Bootstrap) — every component/page has its own
`.css` file.

## Status

Every page in the app — including Payments and Reviews — calls the
real Django API via axios, with proper loading and error states.
Register/login (including Google Sign-In), destination and package
browsing, booking with server-computed pricing, itinerary lookup,
cancellation with slot restoration, admin CRUD, the mock UPI/card/
net-banking payment flow, and the review flow (submit → edit →
moderate, with the package's average rating recalculating live) are
all wired end-to-end.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://127.0.0.1:5173`. Make sure the backend is running at
`http://127.0.0.1:8000` (see `../backend/README.md`) — CORS is already
configured on the backend for `http://127.0.0.1:5173` and
`http://localhost:5173`.

### Environment variables

`.env` (copy from `.env.example`):
```
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Available scripts

```bash
npm run dev       # start the dev server
npm run build     # production build to dist/
npm run preview   # locally preview the production build
npm run lint      # run oxlint
```

## Folder structure

```
src/
├── api/            # axios.js (JWT-attaching client) + one module per resource
├── assets/
├── components/     # Navbar, Footer, PackageCard, DestinationCard, Loader, EmptyState, GoogleLoginButton
├── context/         # AuthContext (real login/register/logout/session persistence)
├── hooks/           # useAuth
├── layouts/         # MainLayout (public/user), AdminLayout (sidebar)
├── pages/
│   ├── public/       # Home, Destinations, DestinationDetails, Packages,
│   │                 # PackageDetails, SearchResults, Login, Register,
│   │                 # About, Contact, FAQ, NotFound
│   ├── user/          # Profile, MyBookings, BookingDetails, CreateBooking,
│   │                 # Payment, MyReviews, Itinerary
│   └── admin/         # Dashboard, Users, Destinations, Packages,
│                     # Itineraries, Bookings, Payments, Reviews
├── routes/          # AppRoutes (full route map), ProtectedRoute, AdminRoute
├── utils/            # formatCurrency, formatDate
├── App.jsx
├── main.jsx
└── index.css         # global design tokens (CSS variables) + shared classes
```

## Routes

| Path | Page | Access |
|---|---|---|
| `/` | Home | Public |
| `/destinations`, `/destinations/:id` | Destinations | Public |
| `/packages`, `/packages/:id` | Packages | Public |
| `/search` | Search results | Public |
| `/login`, `/register` | Auth | Public |
| `/about`, `/contact`, `/faq` | Info pages | Public |
| `/profile` | Profile | Authenticated |
| `/my-bookings`, `/my-bookings/:id` | Bookings | Authenticated |
| `/bookings/new` | Create booking | Authenticated |
| `/payment/:id` | Mock payment | Authenticated |
| `/my-reviews` | Reviews | Authenticated |
| `/admin/*` | Admin panel | Staff/Admin only |

## API layer (`src/api/`)

| File | Status |
|---|---|
| `axios.js` | Base client — attaches JWT to every request, auto-refreshes on 401, queues concurrent requests during a refresh |
| `tokenStorage.js` | localStorage helpers for access/refresh tokens |
| `authApi.js` | Real — register, login, logout, profile, change password, admin user management |
| `destinationApi.js` | Real — list, get, create, update, delete |
| `packageApi.js` | Real — list, search, featured, get, availability, create, update, delete, images |
| `itineraryApi.js` | Real — list/create per package, update/delete per day |
| `bookingApi.js` | Real — list, get, create, update, cancel, traveler ID-proof upload |
| `paymentApi.js` | Real — create, list, get, process (mock gateway) |
| `reviewApi.js` | Real — list per package, create, update, remove |

## Notes

- Setting `VITE_GOOGLE_CLIENT_ID` enables the "Sign in with Google" button on Login/Register — it's hidden automatically if unset.
- The admin Package form supports importing details from a JSON file/paste (e.g. generated with an AI tool) to speed up data entry, alongside full manual entry.
