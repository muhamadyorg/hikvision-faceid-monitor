import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Wifi, WifiOff, LogIn, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@shared/schema";
import { useEffect } from "react";

function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDateFull(d: string | Date) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RealtimePage() {
  const { data: eventsData, isLoading } = useQuery<{ events: Event[]; total: number }>({
    queryKey: ["/api/events?limit=100"],
  });
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (eventsData?.events) setLiveEvents(eventsData.events);
  }, [eventsData]);

  const { connected } = useWebSocket((data) => {
    if (data.type === "new_event") {
      const ev = data.event as Event;
      setLiveEvents((prev) => [ev, ...prev]);
      setNewIds((prev) => { const next = new Set(Array.from(prev)); next.add(ev.id); return next; });
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(Array.from(prev));
          next.delete(ev.id);
          return next;
        });
      }, 3000);
    }
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Realtime Monitor</h1>
          <p className="text-muted-foreground text-sm">Qurilmalardan kelayotgan eventlar jonli ko'rinishi</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono">{liveEvents.length} ta event</Badge>
          {connected ? (
            <Badge variant="outline" className="gap-1.5 text-green-400 border-green-500/30 bg-green-500/10">
              <Wifi className="w-3 h-3" />
              Jonli
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-red-400 border-red-500/30 bg-red-500/10">
              <WifiOff className="w-3 h-3" />
              Uzilgan
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground font-normal">
            <Activity className="w-4 h-4 text-primary" />
            Event lenti
          </CardTitle>
        </CardHeader>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="divide-y divide-border/30">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-4 flex gap-4">
                  <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-10 w-20 flex-shrink-0" />
                </div>
              ))
            ) : liveEvents.length === 0 ? (
              <div className="py-20 text-center">
                <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Hali hech qanday event qayd etilmagan</p>
              </div>
            ) : (
              liveEvents.map((ev) => {
                const isNew = newIds.has(ev.id);
                const isEnter = ev.eventType === "enter";
                return (
                  <div
                    key={ev.id}
                    data-testid={`realtime-event-${ev.id}`}
                    className={`p-4 flex items-center gap-4 transition-all duration-500 ${isNew ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 border ${
                      isEnter
                        ? "bg-green-500/10 border-green-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    }`}>
                      {isEnter ? (
                        <LogIn className="w-6 h-6 text-green-400" />
                      ) : (
                        <LogOut className="w-6 h-6 text-red-400" />
                      )}
                      <span className={`text-xs font-bold ${isEnter ? "text-green-400" : "text-red-400"}`}>
                        {isEnter ? "KELDI" : "KETDI"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-foreground">{ev.personName}</p>
                        {isNew && (
                          <Badge className="text-xs py-0 h-5 bg-primary/20 text-primary border-primary/30">
                            Yangi
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{ev.deviceId}</p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-mono font-semibold text-foreground">{formatTime(ev.timestamp)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateFull(ev.timestamp)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
