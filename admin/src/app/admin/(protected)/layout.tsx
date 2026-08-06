import { redirect } from "next/navigation";
import { loadSessionAdmin } from "@/lib/http";
import Sidebar from "./Sidebar";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await loadSessionAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="admin-shell">
      <Sidebar name={admin.name} role={admin.role.name} />
      <div className="main">
        {/* 顶部栏：登录状态 + 退出 */}
        <div className="topbar">
          <div className="user-info">
            <span className="name">{admin.name}</span>
            <span className="role-badge">{admin.role.name}</span>
          </div>
          <LogoutButton />
        </div>
        {/* 内容区 */}
        <div className="main-body">
          {children}
        </div>
      </div>
    </div>
  );
}
