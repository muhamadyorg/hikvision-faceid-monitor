import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { BarChart3, Clock, AlertTriangle, CheckCircle, LogIn, LogOut } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";

interface ReportEntry {
  day: string;
  personName: string;
  firstEnter: string | null;
  lastExit: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  schedule: { workStart: string; workEnd: string } | null;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}
function formatDay(day: string) {
  return new Date(day + "T12:00:00").toLocaleDateString("uz-UZ", { weekday: "short", day: "2-digit", month: "short" });
}
function formatMins(mins: number) {
  if (mins === 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}s ${m}d`;
  return `${m} daqiqa`;
}

export default function ReportPage() {
  const today = new Date();
  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(today.getDate() - 9);

  const [dateFrom, setDateFrom] = useState(tenDaysAgo.toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split("T")[0]);
  const [enabled, setEnabled] = useState(false);
  const [queryDates, setQueryDates] = useState({ from: dateFrom, to: dateTo });

  const { data: report, isLoading } = useQuery<ReportEntry[]>({
    queryKey: [`/api/events/report?dateFrom=${queryDates.from}&dateTo=${queryDates.to}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled,
  });

  const grouped = report?.reduce((acc, entry) => {
    if (!acc[entry.personName]) acc[entry.personName] = [];
    acc[entry.personName].push(entry);
    return acc;
  }, {} as Record<string, ReportEntry[]>) ?? {};

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hisobot</h1>
        <p className="text-muted-foreground text-sm">Tanlangan davr uchun to'liq ish hisoboti</p>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Boshlanish sana</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
                data-testid="input-report-from"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tugash sana</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
                data-testid="input-report-to"
              />
            </div>
            <Button
              onClick={() => { setQueryDates({ from: dateFrom, to: dateTo }); setEnabled(true); }}
              data-testid="button-generate-report"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Hisobot olish
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-16" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {enabled && !isLoading && report?.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Tanlangan davr uchun eventlar topilmadi</p>
          </CardContent>
        </Card>
      )}

      {enabled && !isLoading && Object.entries(grouped).map(([person, entries]) => {
        const totalLate = entries.reduce((s, e) => s + e.lateMinutes, 0);
        const totalEarly = entries.reduce((s, e) => s + e.earlyLeaveMinutes, 0);
        const days = entries.length;
        return (
          <Card key={person} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{person}</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {days} kun
                  </Badge>
                  {totalLate > 0 && (
                    <Badge variant="outline" className="gap-1 text-orange-400 border-orange-500/30 bg-orange-500/10">
                      <AlertTriangle className="w-3 h-3" />
                      Kech: {formatMins(totalLate)}
                    </Badge>
                  )}
                  {totalEarly > 0 && (
                    <Badge variant="outline" className="gap-1 text-blue-400 border-blue-500/30 bg-blue-500/10">
                      <LogOut className="w-3 h-3" />
                      Erta: {formatMins(totalEarly)}
                    </Badge>
                  )}
                  {totalLate === 0 && totalEarly === 0 && (
                    <Badge variant="outline" className="gap-1 text-green-400 border-green-500/30 bg-green-500/10">
                      <CheckCircle className="w-3 h-3" />
                      Tartibli
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {entries.map((entry) => (
                  <div key={entry.day} className="px-6 py-3 flex items-center gap-4 flex-wrap" data-testid={`report-row-${person}-${entry.day}`}>
                    <div className="w-28 flex-shrink-0">
                      <p className="text-sm font-medium">{formatDay(entry.day)}</p>
                      <p className="text-xs text-muted-foreground">{entry.day}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <LogIn className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-mono">{formatTime(entry.firstEnter)}</p>
                          {entry.schedule && (
                            <p className="text-xs text-muted-foreground">Reja: {entry.schedule.workStart}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground/40">→</div>
                      <div className="flex items-center gap-1.5">
                        <LogOut className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-mono">{formatTime(entry.lastExit)}</p>
                          {entry.schedule && (
                            <p className="text-xs text-muted-foreground">Reja: {entry.schedule.workEnd}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {entry.lateMinutes > 0 ? (
                        <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30 bg-orange-500/10">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {formatMins(entry.lateMinutes)} kech keldi
                        </Badge>
                      ) : entry.firstEnter ? (
                        <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          O'z vaqtida
                        </Badge>
                      ) : null}
                      {entry.earlyLeaveMinutes > 0 && (
                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30 bg-blue-500/10">
                          <LogOut className="w-3 h-3 mr-1" />
                          {formatMins(entry.earlyLeaveMinutes)} erta ketdi
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
