import { NavLink } from "react-router-dom";
import { Mic, Settings, FileText } from "lucide-react";

const navItems = [
  { to: "/", label: "會議記錄", icon: Mic, end: true },
  { to: "/settings", label: "設定", icon: Settings, end: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-slate-900 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="text-indigo-400" size={20} />
            <span className="text-white font-semibold text-base">MeetingScribe</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">AI 會議記錄助手</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">v0.1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
