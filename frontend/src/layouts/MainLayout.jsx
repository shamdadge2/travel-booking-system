import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const HIDE_FOOTER_ROUTES = ["/login"];

export default function MainLayout() {
  const { pathname } = useLocation();
  const hideFooter = HIDE_FOOTER_ROUTES.includes(pathname);
  return (
    <>
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </>
  );
}
