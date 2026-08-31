import { Routes, Route } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import AdminLayout from "../layouts/AdminLayout";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

// Public pages
import Home from "../pages/public/Home";
import Destinations from "../pages/public/Destinations";
import DestinationDetails from "../pages/public/DestinationDetails";
import Packages from "../pages/public/Packages";
import PackageDetails from "../pages/public/PackageDetails";
import SearchResults from "../pages/public/SearchResults";
import Login from "../pages/public/Login";
import Register from "../pages/public/Register";
import About from "../pages/public/About";
import Contact from "../pages/public/Contact";
import FAQ from "../pages/public/FAQ";
import NotFound from "../pages/public/NotFound";

// User (authenticated) pages
import Profile from "../pages/user/Profile";
import MyBookings from "../pages/user/MyBookings";
import BookingDetails from "../pages/user/BookingDetails";
import CreateBooking from "../pages/user/CreateBooking";
import CreateIndependentBooking from "../pages/user/CreateIndependentBooking";
import Payment from "../pages/user/Payment";
import MyReviews from "../pages/user/MyReviews";
import Itinerary from "../pages/user/Itinerary";

// Admin pages
import Dashboard from "../pages/admin/Dashboard";
import AdminUsers from "../pages/admin/Users";
import AdminDestinations from "../pages/admin/Destinations";
import AdminPackages from "../pages/admin/Packages";
import AdminServices from "../pages/admin/Services";
import AdminCoupons from "../pages/admin/Coupons";
import AdminItineraries from "../pages/admin/Itineraries";
import AdminBookings from "../pages/admin/Bookings";
import AdminPayments from "../pages/admin/Payments";
import AdminReviews from "../pages/admin/Reviews";
import AdminMessages from "../pages/admin/Messages";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public + authenticated-user routes share the main site layout (Navbar/Footer) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/destinations/:id" element={<DestinationDetails />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/packages/:id" element={<PackageDetails />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />

        {/* Authenticated-only pages */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/my-bookings/:id" element={<BookingDetails />} />
          <Route path="/my-bookings/:bookingId/itinerary" element={<Itinerary />} />
          <Route path="/bookings/new" element={<CreateBooking />} />
          <Route path="/bookings/independent" element={<CreateIndependentBooking />} />
          <Route path="/payment/:id" element={<Payment />} />
          <Route path="/my-reviews" element={<MyReviews />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin routes use their own sidebar layout */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="destinations" element={<AdminDestinations />} />
          <Route path="packages" element={<AdminPackages />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="itineraries" element={<AdminItineraries />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="messages" element={<AdminMessages />} />
        </Route>
      </Route>
    </Routes>
  );
}
