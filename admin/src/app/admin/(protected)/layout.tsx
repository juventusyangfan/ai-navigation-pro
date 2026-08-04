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
        {children}
        <div style={{ marginTop: 28, color: "var(--muted)", fontSize: 12 }}>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
