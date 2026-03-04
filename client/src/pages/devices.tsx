import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Plus, Trash2, Edit, MapPin } from "lucide-react";
import type { Device } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function DevicesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState({ name: "", deviceIdentifier: "", location: "" });

  const { data: devices, isLoading } = useQuery<Device[]>({ queryKey: ["/api/devices"] });

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/devices", data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/devices"] }); setOpen(false); toast({ title: "Qurilma qo'shildi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof form> }) => {
      const res = await apiRequest("PUT", `/api/devices/${id}`, data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/devices"] }); setOpen(false); setEditing(null); toast({ title: "Qurilma yangilandi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/devices/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/devices"] }); toast({ title: "Qurilma o'chirildi" }); },
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", deviceIdentifier: "", location: "" }); setOpen(true); };
  const openEdit = (dev: Device) => { setEditing(dev); setForm({ name: dev.name, deviceIdentifier: dev.deviceIdentifier, location: dev.location ?? "" }); setOpen(true); };

  const handleSubmit = () => {
    if (editing) updateMut.mutate({ id: editing.id, data: form });
    else createMut.mutate(form);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Qurilmalar</h1>
          <p className="text-muted-foreground text-sm">Hikvision FaceID qurilmalarini boshqarish</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-device">
          <Plus className="w-4 h-4 mr-2" />
          Qurilma qo'shish
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : devices?.map((dev) => (
          <Card key={dev.id} className="border-border/50" data-testid={`device-card-${dev.id}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(dev)} data-testid={`button-edit-device-${dev.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(dev.id)} data-testid={`button-delete-device-${dev.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <p className="font-semibold text-foreground">{dev.name}</p>
                <Badge variant="outline" className="font-mono text-xs">{dev.deviceIdentifier}</Badge>
              </div>
              {dev.location && (
                <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {dev.location}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-muted-foreground">Aktiv</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && devices?.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Hali qurilmalar qo'shilmagan</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Qurilmani tahrirlash" : "Yangi qurilma qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Qurilma nomi</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asosiy kirish" data-testid="input-device-name" />
            </div>
            <div className="space-y-2">
              <Label>Qurilma identifikatori</Label>
              <Input value={form.deviceIdentifier} onChange={(e) => setForm({ ...form, deviceIdentifier: e.target.value })} placeholder="hikvision_1" data-testid="input-device-identifier" />
            </div>
            <div className="space-y-2">
              <Label>Joylashuv</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="1-qavat kirish" data-testid="input-device-location" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-device">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
