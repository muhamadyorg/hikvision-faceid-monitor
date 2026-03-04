import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileDown, BarChart3, Calendar, Clock, User } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface DayReport {
  date: string;
  isHoliday: boolean;
  holidayName?: string;
  arrived: string | null;
  departed: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  present: boolean;
}

interface WorkerReport {
  worker: { id: string; fullName: string; faceUserId: string | null };
  days: DayReport[];
  totalWorkDays: number;
  totalWorkedMinutes: number;
}

interface ReportResponse {
  report: WorkerReport[];
  dates: string[];
  holidays: Array<{ date: string; description: string }>;
}

interface Group {
  id: string;
  name: string;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

function fmtMins(m: number) {
  if (!m) return "";
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return h > 0 ? `${h}s ${mn}d` : `${mn}d`;
}

function fmtHours(m: number) {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return `${h}:${String(mn).padStart(2, "0")}`;
}

export default function ReportPage() {
  const { user } = useAuth();
  const today = new Date();
  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(today.getDate() - 9);

  const [dateFrom, setDateFrom] = useState(tenDaysAgo.toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(today.toISOString().split("T")[0]);
  const [groupId, setGroupId] = useState<string>("all");
  const [queryParams, setQueryParams] = useState<null | { from: string; to: string; gid: string }>(null);

  const canPrint = user?.role === "sudo" || user?.role === "admin";

  const { data: groups } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: user?.role !== "worker",
  });

  const url = queryParams
    ? `/api/events/report?dateFrom=${queryParams.from}&dateTo=${queryParams.to}${queryParams.gid ? `&groupId=${queryParams.gid}` : ""}`
    : null;

  const { data, isLoading } = useQuery<ReportResponse>({
    queryKey: [url ?? "/api/events/report"],
    queryFn: url ? getQueryFn({ on401: "throw" }) : undefined,
    enabled: !!queryParams,
  });

  function generate() {
    setQueryParams({ from: dateFrom, to: dateTo, gid: groupId === "all" ? "" : groupId });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          table { font-size: 9px !important; }
          td, th { padding: 2px 4px !important; }
        }
      `}</style>

      <div className="p-4 md:p-6 max-w-full">
        <div className="mb-6 no-print">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
            Davomat hisoboti
          </h1>
          <p className="text-gray-400 mt-1">Tanlangan sana oralig'i uchun davomat ma'lumotlari</p>
        </div>

        <Card className="bg-gray-800 border-gray-700 mb-6 no-print">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-gray-300 text-sm">Boshlanish sanasi</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  data-testid="input-date-from"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Tugash sanasi</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  data-testid="input-date-to"
                />
              </div>
              {user?.role !== "worker" && groups && groups.length > 0 && (
                <div>
                  <Label className="text-gray-300 text-sm">Guruh (ixtiyoriy)</Label>
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1" data-testid="select-group">
                      <SelectValue placeholder="Barcha guruhlar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Barcha guruhlar</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button onClick={generate} className="bg-emerald-600 hover:bg-emerald-700 flex-1" data-testid="button-generate-report">
                  <Calendar className="h-4 w-4 mr-2" />
                  Ko'rish
                </Button>
                {canPrint && data && (
                  <Button onClick={handlePrint} variant="outline" className="border-gray-600 text-gray-300" data-testid="button-print">
                    <Printer className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-gray-800" />
            ))}
          </div>
        )}

        {data && (
          <div id="print-area">
            <div className="print-header mb-6">
              <h1 className="text-xl font-bold text-white">Davomat hisoboti</h1>
              <p className="text-gray-400 text-sm">{dateFrom} — {dateTo}</p>
              {data.holidays.length > 0 && (
                <p className="text-yellow-400 text-xs mt-1">
                  Dam olish kunlari: {data.holidays.filter(h => h.date >= dateFrom && h.date <= dateTo).map(h => `${fmtDate(h.date)} (${h.description})`).join(", ")}
                </p>
              )}
            </div>

            {data.report.length === 0 && (
              <div className="text-center text-gray-400 py-10">Ma'lumot topilmadi</div>
            )}

            {data.report.map((entry) => (
              <Card key={entry.worker.id} className="bg-gray-800 border-gray-700 mb-4">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-400" />
                      {entry.worker.fullName}
                      {entry.worker.faceUserId && (
                        <span className="text-xs text-gray-500">#{entry.worker.faceUserId}</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-emerald-400">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {entry.totalWorkDays} kun
                      </span>
                      <span className="text-blue-400">
                        Jami: {fmtHours(entry.totalWorkedMinutes)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-1 px-2 text-gray-400 font-medium">Sana</th>
                        <th className="text-center py-1 px-2 text-gray-400 font-medium">Keldi</th>
                        <th className="text-center py-1 px-2 text-gray-400 font-medium">Ketdi</th>
                        <th className="text-center py-1 px-2 text-gray-400 font-medium">Kech</th>
                        <th className="text-center py-1 px-2 text-gray-400 font-medium">Erta</th>
                        <th className="text-center py-1 px-2 text-gray-400 font-medium">Soat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.days.map((day) => (
                        <tr
                          key={day.date}
                          className={
                            day.isHoliday
                              ? "bg-yellow-900/20 border-b border-gray-700/50"
                              : !day.present
                              ? "bg-red-900/10 border-b border-gray-700/50"
                              : "border-b border-gray-700/50 hover:bg-gray-700/30"
                          }
                        >
                          <td className="py-1.5 px-2 text-gray-300">
                            <span className="font-medium">{fmtDate(day.date)}</span>
                            {day.isHoliday && (
                              <Badge className="ml-2 bg-yellow-700 text-yellow-100 text-xs px-1">
                                {day.holidayName || "Dam olish"}
                              </Badge>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {day.isHoliday && !day.arrived ? (
                              <span className="text-yellow-500">—</span>
                            ) : day.arrived ? (
                              <span className={day.lateMinutes > 0 ? "text-orange-400" : "text-green-400"}>
                                {fmt(day.arrived)}
                              </span>
                            ) : (
                              <span className="text-red-500">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {day.departed ? (
                              <span className={day.earlyLeaveMinutes > 0 ? "text-orange-400" : "text-blue-400"}>
                                {fmt(day.departed)}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {day.lateMinutes > 0 ? (
                              <span className="text-orange-400">+{fmtMins(day.lateMinutes)}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {day.earlyLeaveMinutes > 0 ? (
                              <span className="text-orange-400">-{fmtMins(day.earlyLeaveMinutes)}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            {day.workedMinutes > 0 ? (
                              <span className="text-white">{fmtHours(day.workedMinutes)}</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-600">
                        <td colSpan={4} className="py-2 px-2 text-gray-400 text-xs">
                          Jami ish kunlari: <span className="text-emerald-400 font-bold">{entry.totalWorkDays}</span>
                        </td>
                        <td colSpan={2} className="py-2 px-2 text-right text-gray-400 text-xs">
                          Jami vaqt: <span className="text-blue-400 font-bold">{fmtHours(entry.totalWorkedMinutes)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
