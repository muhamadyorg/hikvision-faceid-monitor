import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Trash2, Filter, ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";
import type { Event, Device } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

function formatDT(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const PAGE_SIZE = 20;

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pendingDel, setPendingDel] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (deviceFilter && deviceFilter !== "all") params.set("deviceId", deviceFilter);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data, isLoading } = useQuery<{ events: Event[]; total: number }>({
    queryKey: [`/api/events?${params.toString()}`],
  });
  const { data: devices } = useQuery<Device[]>({ queryKey: ["/api/devices"] });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/events/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event o'chirildi" });
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleFilter = () => setPage(0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Eventlar</h1>
        <p className="text-muted-foreground text-sm">Barcha qurilmalardan kelgan eventlarni ko'rish va filtrlash</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ism bo'yicha qidirish..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilter(); }}
                data-testid="input-search-events"
              />
            </div>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); handleFilter(); }}
              data-testid="input-date-from"
            />
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); handleFilter(); }}
              data-testid="input-date-to"
            />
            <Select value={deviceFilter} onValueChange={(v) => { setDeviceFilter(v); handleFilter(); }}>
              <SelectTrigger className="w-44" data-testid="select-device-filter">
                <SelectValue placeholder="Qurilma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha qurilmalar</SelectItem>
                {devices?.map((d) => (
                  <SelectItem key={d.id} value={d.deviceIdentifier}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || dateFrom || dateTo || deviceFilter !== "all") && (
              <Button variant="outline" size="default" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setDeviceFilter("all"); setPage(0); }}>
                <Filter className="w-4 h-4 mr-2" />
                Tozalash
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {isLoading ? <Skeleton className="h-5 w-32" /> : `${total} ta event`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {totalPages > 0 ? `${page + 1} / ${totalPages}` : "0 / 0"}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-6 py-3 flex gap-3">
                  <Skeleton className="h-8 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
              ))
            ) : data?.events.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Eventlar topilmadi</p>
              </div>
            ) : (
              data?.events.map((ev) => (
                <div key={ev.id} className="px-6 py-3 flex items-center gap-3 group" data-testid={`event-row-${ev.id}`}>
                  <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${
                    ev.eventType === "enter"
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  }`}>
                    {ev.eventType === "enter" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                    {ev.eventType === "enter" ? "KELDI" : "KETDI"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{ev.resolvedName || ev.faceUserId || "Noma'lum"}</p>
                    <p className="text-xs text-muted-foreground">{ev.deviceId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-mono text-foreground">{formatDT(ev.timestamp)}</p>
                  </div>
                  {user?.role === "sudo" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => {
                        if (pendingDel === ev.id) {
                          deleteMut.mutate(ev.id);
                          setPendingDel(null);
                        } else {
                          setPendingDel(ev.id);
                          setTimeout(() => setPendingDel(null), 3000);
                        }
                      }}
                      data-testid={`button-delete-event-${ev.id}`}
                    >
                      <Trash2 className={`w-4 h-4 ${pendingDel === ev.id ? "text-destructive" : ""}`} />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
