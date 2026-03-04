import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Trash2, Edit2, CalendarDays } from "lucide-react";
import type { Shift, Group } from "@shared/schema";

export default function ShiftsPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    groupId: "",
    startTime: "09:00",
    endTime: "18:00",
    isNightShift: false
  });

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"]
  });

  const { data: shifts, isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/shifts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setOpen(false);
      toast({ title: "Smena yaratildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/shifts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setOpen(false);
      toast({ title: "Smena yangilandi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Smena o'chirildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      groupId: shift.groupId,
      startTime: shift.startTime,
      endTime: shift.endTime,
      isNightShift: shift.isNightShift
    });
    setOpen(true);
  };

  const handleAdd = () => {
    setEditingShift(null);
    setForm({
      name: "",
      groupId: groups?.[0]?.id || "",
      startTime: "09:00",
      endTime: "18:00",
      isNightShift: false
    });
    setOpen(true);
  };

  const getGroupName = (id: string) => groups?.find(g => g.id === id)?.name || "Noma'lum";

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smenalar</h1>
          <p className="text-muted-foreground">Guruhlar uchun ish vaqtlarini sozlash</p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-shift">
          <Plus className="mr-2 h-4 w-4" />
          Smena qo'shish
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shiftsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))
        ) : shifts?.map((shift) => (
          <Card key={shift.id} className="border-border/50 hover-elevate" data-testid={`card-shift-${shift.id}`}>
            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">{shift.name}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {getGroupName(shift.groupId)}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => handleEdit(shift)} data-testid={`button-edit-shift-${shift.id}`}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(shift.id)} data-testid={`button-delete-shift-${shift.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-2xl font-mono font-bold text-foreground">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  {shift.startTime} - {shift.endTime}
                </div>
                {shift.isNightShift && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Tungi
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!shiftsLoading && shifts?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Smenalar topilmadi</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? "Smenani tahrirlash" : "Yangi smena yaratish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Smena nomi</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Asosiy smena"
                data-testid="input-shift-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupId">Guruh</Label>
              <Select 
                value={form.groupId} 
                onValueChange={(v) => setForm({ ...form, groupId: v })}
              >
                <SelectTrigger id="groupId">
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Boshlanish vaqti</Label>
                <Input
                  id="startTime"
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  data-testid="input-shift-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Tugash vaqti</Label>
                <Input
                  id="endTime"
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  data-testid="input-shift-end"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="isNightShift" 
                checked={form.isNightShift}
                onCheckedChange={(checked) => setForm({ ...form, isNightShift: !!checked })}
              />
              <Label htmlFor="isNightShift" className="text-sm font-medium leading-none cursor-pointer">
                Tungi smena (ertasi kuni tugaydi)
              </Label>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-shift">
                {editingShift ? "Saqlash" : "Yaratish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderOpen(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.97 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2" />
    </svg>
  );
}
