import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, Monitor, FolderOpen, ArrowUpRight, ArrowDownRight, Wifi, WifiOff, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Event } from "@shared/schema";

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Stats {
  totalWorkers: number;
  presentToday: number;
  absentToday: number;
  totalGroups: number;
  totalDevices: number;
  recentEvents: Event[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const [liveEvents, setLiveEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (stats?.recentEvents) setLiveEvents(stats.recentEvents.slice(0, 10));
  }, [stats]);

  const { connected } = useWebSocket((data) => {
    if (data.type === "new_event" && data.event) {
      setLiveEvents((prev) => [data.event, ...prev].slice(0, 10));
    }
  });

  const statCards = user?.role === "worker"
    ? [
        { title: "Bugun keldi", value: stats?.presentToday ?? 0, icon: UserCheck, color: "text-green-400", sub: "Bugungi kirish" },
      ]
    : [
        { title: "Bugun keldi", value: stats?.presentToday ?? 0, icon: UserCheck, color: "text-green-400", sub: "Birinchi kirish", testId: "stat-present" },
        { title: "Bugun kelmadi", value: stats?.absentToday ?? 0, icon: UserX, color: "text-red-400", sub: "Hali kirish yo'q", testId: "stat-absent" },
        { title: "Jami ishchilar", value: stats?.totalWorkers ?? 0, icon: Users, color: "text-blue-400", sub: "Ro'yxatdagi", testId: "stat-total" },
        { title: "Guruhlar", value: stats?.totalGroups ?? 0, icon: FolderOpen, color: "text-purple-400", sub: "Faol guruhlar", testId: "stat-groups" },
      ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user?.role === "worker"
              ? `Xush kelibsiz, ${user.fullName || user.username}`
              : "Boshqaruv paneli"}
          </h1>
          <p className="text-muted-foreground text-sm">Hikvision FaceID monitoring tizimi</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="outline" className="gap-1.5 text-green-400 border-green-500/30 bg-green-500/10" data-testid="status-connected">
              <Wifi className="w-3 h-3" />
              Ulangan
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-red-400 border-red-500/30 bg-red-500/10" data-testid="status-disconnected">
              <WifiOff className="w-3 h-3" />
              Ulanmagan
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="border-border/50" data-testid={(stat as any).testId}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <div className="text-3xl font-bold mt-1">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                So'nggi hodisalar
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  Jonli
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-6 py-3 flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : liveEvents.length === 0 ? (
                  <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                    Hali hech qanday hodisa yo'q
                  </div>
                ) : (
                  liveEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-6 py-3 flex items-center gap-3 hover:bg-muted/20 cursor-default transition-colors"
                      data-testid={`event-row-${ev.id}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm ${
                        ev.eventType === "enter"
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {ev.eventType === "enter"
                          ? <ArrowUpRight className="w-5 h-5" />
                          : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {ev.resolvedName || ev.faceUserId || "Noma'lum"}
                        </p>
                        <p className="text-xs text-muted-foreground">{ev.deviceId}</p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <p className="text-xs font-mono text-foreground">{formatTime(ev.timestamp)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(ev.timestamp)}</p>
                        {ev.isFirstEnter && ev.eventType === "enter" && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-green-400 border-green-500/30">
                            1-kirish
                          </Badge>
                        )}
                        {ev.isFirstExit && ev.eventType === "exit" && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-red-400 border-red-500/30">
                            1-chiqish
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                Qurilmalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (stats?.totalDevices ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Qurilmalar yo'q</p>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/50" data-testid="device-count">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{stats?.totalDevices} ta qurilma</p>
                    <p className="text-xs text-muted-foreground">Faol</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
