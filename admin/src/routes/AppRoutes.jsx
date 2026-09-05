import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ProtectedRoute, PublicRoute } from "../context/ProtectedRoute";

// Pages
import Dashboard from "../pages/Dashboard/Dashboard";
import Menu from "../pages/Menu/Menu";
import Orders from "../pages/Orders/Orders";
import Customers from "../pages/Customers/Customers";
import Coupons from "../pages/Coupons/Coupons";
import Reports from "../pages/Reports/Reports";
import Analytics from "../pages/Analytics/Analytics";
import Kitchen from "../pages/Kitchen/Kitchen";
import Settings from "../pages/Settings/Settings";
import Categories from "../pages/Categories/Categories";
import AdminLogin from "../pages/Login/AdminLogin";
import Unauthorized from "../pages/Unauthorized";
import Prediction from "../pages/AI/Prediction";
import Inventory from "../pages/Inventory/Inventory";
import OCRUpload from "../pages/OCRUpload";
import BarcodePOS from "../pages/BarcodePOS/BarcodePOS";
import ProductRegistration from "../pages/ProductRegistration";

// Layouts
import Layout from "../layouts/AdminLayout";

function AppRoutes() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <AdminLogin />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <AdminLogin />
              </PublicRoute>
            }
          />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Routes - Admin Only */}
          <Route
            element={
              <ProtectedRoute requiredRole={["admin", "manager"]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/barcode-pos" element={<BarcodePOS />} />
            <Route path="/products/register" element={<ProductRegistration />} />
            <Route path="/ai" element={<Prediction />} />
            <Route path="/ocr-upload" element={<OCRUpload />} />
          </Route>

          {/* Kitchen Routes - Kitchen Staff Only */}
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute requiredRole={["kitchen_staff", "admin"]}>
                <Kitchen />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRoutes;
