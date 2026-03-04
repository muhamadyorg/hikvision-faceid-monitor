import { type ElementType } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Activity,
  Monitor,
  UserCircle,
  Shield,
  Clock,
  Umbrella,
  FolderOpen,
  Settings,
  LogOut,
  Camera,
  BarChart3,
  ClipboardList,
  HelpCircle,
} from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: ElementType;
  iconColor: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, iconColor: "text-emerald-400" },
  { title: "Realtime", url: "/realtime", icon: Activity, iconColor: "text-cyan-400" },
  { title: "Eventlar", url: "/events", icon: ClipboardList, iconColor: "text-blue-400" },
  { title: "Hisobot", url: "/report", icon: BarChart3, iconColor: "text-violet-400" },
  { title: "Ishchilar", url: "/workers", icon: UserCircle, iconColor: "text-sky-400", roles: ["sudo", "admin"] },
  { title: "Smenalar", url: "/shifts", icon: Clock, iconColor: "text-orange-400", roles: ["sudo", "admin"] },
  { title: "Bayramlar", url: "/holidays", icon: Umbrella, iconColor: "text-pink-400", roles: ["sudo", "admin"] },
  { title: "Guruhlar", url: "/groups", icon: FolderOpen, iconColor: "text-amber-400", roles: ["sudo", "admin"] },
  { title: "Qurilmalar", url: "/devices", icon: Monitor, iconColor: "text-teal-400", roles: ["sudo", "admin"] },
  { title: "Adminlar", url: "/admins", icon: Shield, iconColor: "text-yellow-400", roles: ["sudo"] },
  { title: "Kamera qo'llanma", url: "/camera-guide", icon: HelpCircle, iconColor: "text-indigo-400", roles: ["sudo"] },
  { title: "Sozlamalar", url: "/settings", icon: Settings, iconColor: "text-slate-400", roles: ["sudo"] },
];

const roleLabels: Record<string, { label: string; cls: string }> = {
  sudo: { label: "SUDO", cls: "bg-yellow-500/25 text-yellow-300 border border-yellow-500/40" },
  admin: { label: "ADMIN", cls: "bg-blue-500/25 text-blue-300 border border-blue-500/40" },
  worker: { label: "ISHCHI", cls: "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40" },
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const filtered = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
            <Camera className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">HikVision</p>
            <p className="text-xs text-slate-400 truncate">Monitor Tizimi</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 py-2">
            Navigatsiya
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase()}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                          isActive
                            ? "bg-sidebar-accent text-white font-medium"
                            : "text-slate-300 hover:text-white hover:bg-sidebar-accent/60"
                        }`}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : item.iconColor}`} />
                        <span className="text-sm">{item.title}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2 px-2 mb-3 py-2 rounded-md bg-sidebar-accent/40">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-400">
                {(user.fullName || user.username || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.fullName || user.username}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${roleLabels[user.role]?.cls || "bg-slate-500/25 text-slate-300 border border-slate-500/40"}`}>
                {roleLabels[user.role]?.label || user.role.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Chiqish</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
