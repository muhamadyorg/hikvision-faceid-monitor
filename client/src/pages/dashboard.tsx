import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, Monitor, TrendingUp, ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from "lucide-react";
import type { Event, Device } from "@shared/schema";

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DashboardPage() {
  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events: Event[]; total: number }>({
    queryKey: ["/api/events?limit=10"],
  });
  const { data: devices } = useQuery<Device[]>({ queryKey: ["/api/devices"] });
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (eventsData?.events) setLiveEvents(eventsData.events.slice(0, 10));
  }, [eventsData]);

  const { connected } = useWebSocket((data) => {
    if (data.type === "new_event") {
      setLiveEvents((prev) => [data.event, ...prev].slice(0, 10));
    }
  });

  const total = eventsData?.total ?? 0;
  const enters = eventsData?.events.filter((e) => e.eventType === "enter").length ?? 0;
  const exits = eventsData?.events.filter((e) => e.eventType === "exit").length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Hikvision FaceID monitoring tizimi</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="outline" className="gap-1.5 text-green-400 border-green-500/30 bg-green-500/10">
              <Wifi className="w-3 h-3" />
              Ulangan
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-red-400 border-red-500/30 bg-red-500/10">
              <WifiOff className="w-3 h-3" />
              Ulanmagan
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Jami Eventlar", value: total, icon: Activity, color: "text-primary", sub: "Barcha vaqt" },
          { title: "Kirdi", value: enters, icon: ArrowUpRight, color: "text-green-400", sub: "So'nggi 50" },
          { title: "Chiqdi", value: exits, icon: ArrowDownRight, color: "text-red-400", sub: "So'nggi 50" },
          { title: "Qurilmalar", value: devices?.length ?? 0, icon: Monitor, color: "text-blue-400", sub: "Aktiv" },
        ].map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <div className="text-3xl font-bold mt-1">{eventsLoading ? <Skeleton className="h-8 w-16" /> : stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`p-3 rounded-xl bg-card border border-border/50`}>
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
                Realtime Eventlar
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  Jonli
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {eventsLoading ? (
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
                    Hali hech qanday event yo'q
                  </div>
                ) : (
                  liveEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="px-6 py-3 flex items-center gap-3 hover-elevate cursor-default"
                      data-testid={`event-row-${ev.id}`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm ${
                        ev.eventType === "enter"
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {ev.eventType === "enter" ? "IN" : "OUT"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{ev.personName}</p>
                        <p className="text-xs text-muted-foreground">{ev.deviceId}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono text-foreground">{formatTime(ev.timestamp)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(ev.timestamp)}</p>
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
              {devices?.map((dev) => (
                <div key={dev.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/50" data-testid={`device-status-${dev.id}`}>
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{dev.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{dev.location}</p>
                  </div>
                </div>
              ))}
              {!devices?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">Qurilmalar yo'q</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
