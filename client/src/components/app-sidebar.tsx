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
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Activity,
  Monitor,
  Users,
  FolderOpen,
  Settings,
  LogOut,
  Camera,
  BarChart3,
  ClipboardList,
} from "lucide-react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Realtime", url: "/realtime", icon: Activity },
  { title: "Eventlar", url: "/events", icon: ClipboardList },
  { title: "Hisobot", url: "/report", icon: BarChart3 },
  { title: "Qurilmalar", url: "/devices", icon: Monitor, roles: ["sudo", "admin"] },
  { title: "Foydalanuvchilar", url: "/users", icon: Users, roles: ["sudo", "admin"] },
  { title: "Guruhlar", url: "/groups", icon: FolderOpen, roles: ["sudo", "admin"] },
  { title: "Sozlamalar", url: "/settings", icon: Settings, roles: ["sudo"] },
];

const roleColors: Record<string, string> = {
  sudo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  user: "bg-green-500/20 text-green-400 border-green-500/30",
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
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">HikVision</p>
            <p className="text-xs text-muted-foreground truncate">Monitor Tizimi</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigatsiya</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
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
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.username}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${roleColors[user.role] || roleColors.user}`}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Chiqish
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
