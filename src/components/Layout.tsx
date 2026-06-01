import { NavLink } from "react-router-dom";
import { Mic, Settings } from "lucide-react";

const navItems = [
  { to: "/", label: "會議記錄", icon: Mic, end: true },
  { to: "/settings", label: "設定", icon: Settings, end: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* macOS-style sidebar */}
      <aside style={{
        width: 220,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--separator)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* App header */}
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--separator)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              background: "var(--blue)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,122,255,0.35)",
            }}>
              <Mic size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--label)", letterSpacing: -0.2 }}>
                MeetingScribe
              </div>
              <div style={{ fontSize: 11, color: "var(--label-3)", marginTop: 1 }}>AI 會議記錄</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              style={{ textDecoration: "none", display: "block", marginBottom: 2 }}>
              {({ isActive }) => (
                <div style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 9,
                  background: isActive ? "var(--blue)" : "transparent",
                  color: isActive ? "#fff" : "var(--label-2)",
                  fontSize: 14, fontWeight: isActive ? 500 : 400,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}>
                  <Icon size={16} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--separator)" }}>
          <div style={{ fontSize: 11, color: "var(--label-4)" }}>v0.1.0</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        {children}
      </main>
    </div>
  );
}
