import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Clock, Plus, Save, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface WorkSchedule {
  id: string;
  personName: string;
  workStart: string;
  workEnd: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ personName: "", workStart: "09:00", workEnd: "18:00" });

  const { data: schedules, isLoading } = useQuery<WorkSchedule[]>({ queryKey: ["/api/work-schedules"] });

  const upsertMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/work-schedules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-schedules"] });
      setOpen(false);
      toast({ title: "Ish vaqti saqlandi" });
    },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const openEdit = (s: WorkSchedule) => {
    setForm({ personName: s.personName, workStart: s.workStart, workEnd: s.workEnd });
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sozlamalar</h1>
        <p className="text-muted-foreground text-sm">Tizim sozlamalari va ish vaqtlari</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Ish vaqti jadvali
          </CardTitle>
          <Button size="sm" onClick={() => { setForm({ personName: "", workStart: "09:00", workEnd: "18:00" }); setOpen(true); }} data-testid="button-add-schedule">
            <Plus className="w-4 h-4 mr-2" />
            Qo'shish
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-3 items-center">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))
            ) : schedules?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Ish vaqti sozlamasi qo'shilmagan</p>
              </div>
            ) : (
              schedules?.map((s) => (
                <div key={s.id} className="px-6 py-4 flex items-center gap-3 group" data-testid={`schedule-row-${s.personName}`}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.personName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs font-mono text-green-400 border-green-500/30 bg-green-500/10">
                        {s.workStart} — kirish
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono text-red-400 border-red-500/30 bg-red-500/10">
                        {s.workEnd} — chiqish
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-edit-schedule-${s.personName}`}>
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Tahrirlash
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            API Ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md bg-muted/30 border border-border/50">
            <p className="text-sm font-medium mb-1">Event qabul qilish endpoint:</p>
            <code className="text-xs font-mono text-primary">POST /api/events</code>
          </div>
          <div className="p-4 rounded-md bg-muted/30 border border-border/50">
            <p className="text-sm font-medium mb-2">Event JSON formati:</p>
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">{`{
  "device_id": "hikvision_1",
  "person_name": "Ali Valiyev",
  "event_type": "enter",
  "timestamp": "2026-03-04T08:21:10"
}`}</pre>
          </div>
          <div className="p-4 rounded-md bg-muted/30 border border-border/50">
            <p className="text-sm font-medium mb-2">cURL misoli:</p>
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">{`curl -X POST \\
  http://your-server/api/events \\
  -H "Content-Type: application/json" \\
  -d '{"device_id":"hikvision_1","person_name":"Ali Valiyev","event_type":"enter","timestamp":"2026-03-04T08:21:10"}'`}</pre>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ish vaqti sozlamasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Xodim ismi</Label>
              <Input value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} placeholder="Ali Valiyev" data-testid="input-schedule-person" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ish boshlanish</Label>
                <Input type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} data-testid="input-schedule-start" />
              </div>
              <div className="space-y-2">
                <Label>Ish tugash</Label>
                <Input type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} data-testid="input-schedule-end" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={() => upsertMut.mutate(form)} disabled={upsertMut.isPending} data-testid="button-save-schedule">
              <Save className="w-4 h-4 mr-2" />
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
