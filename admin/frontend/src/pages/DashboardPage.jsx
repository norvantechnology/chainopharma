import { readAuth } from "../services/authStorage.js";
import AppShell from "../layouts/AppShell.jsx";
import { APP_DOCUMENT_TITLE } from "../constants/brand.js";

export default function DashboardPage() {
  const auth = readAuth();
  const email = auth?.user?.email || auth?.email || "";

  return (
    <AppShell title={APP_DOCUMENT_TITLE} userName={auth?.user?.full_name || email || "Admin"} userEmail={email} variant="admin">
      <div style={{ maxWidth: 960, margin: "0 auto", color: "var(--color-text-2)", fontFamily: "var(--font)" }}>
        Signed in as <strong>{email || "Admin"}</strong>
      </div>
    </AppShell>
  );
}
