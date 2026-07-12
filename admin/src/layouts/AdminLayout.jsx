import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import MainContent from "../components/layout/MainContent";

function AdminLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--admin-shell-bg)" }}>
      <Sidebar />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <Header />
        <MainContent>
          <Outlet />
        </MainContent>
      </div>
    </div>
  );
}

export default AdminLayout;
