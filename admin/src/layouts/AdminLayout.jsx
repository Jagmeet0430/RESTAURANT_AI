import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import MainContent from "../components/layout/MainContent";

function AdminLayout() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--admin-shell-bg)",
      }}
    >
      <Sidebar />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Header />
        <MainContent>
          <Outlet />
        </MainContent>
      </div>
    </div>
  );
}

export default AdminLayout;
