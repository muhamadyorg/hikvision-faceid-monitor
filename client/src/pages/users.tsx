import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Trash2, Edit, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserItem {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

const roleBadge: Record<string, string> = {
  sudo: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  user: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: "", password: "", role: "user" });

  const { data: users, isLoading } = useQuery<UserItem[]>({ queryKey: ["/api/users"] });

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setOpen(false); toast({ title: "Foydalanuvchi qo'shildi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); setOpen(false); setEditing(null); toast({ title: "Foydalanuvchi yangilandi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/users/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "Foydalanuvchi o'chirildi" }); },
  });

  const openCreate = () => { setEditing(null); setForm({ username: "", password: "", role: "user" }); setOpen(true); };
  const openEdit = (u: UserItem) => { setEditing(u); setForm({ username: u.username, password: "", role: u.role }); setOpen(true); };

  const handleSubmit = () => {
    if (editing) {
      const data: any = { role: form.role };
      if (form.username) data.username = form.username;
      if (form.password) data.password = form.password;
      updateMut.mutate({ id: editing.id, data });
    } else {
      createMut.mutate(form);
    }
  };

  const availableRoles = currentUser?.role === "sudo" ? ["user", "admin", "sudo"] : ["user", "admin"];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
          <p className="text-muted-foreground text-sm">Tizim foydalanuvchilarini boshqarish</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-2" />
          Foydalanuvchi qo'shish
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {isLoading ? <Skeleton className="h-5 w-20" /> : `${users?.length ?? 0} ta foydalanuvchi`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-3 items-center">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : users?.map((u) => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-3 group" data-testid={`user-row-${u.id}`}>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{u.username}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${roleBadge[u.role] ?? roleBadge.user}`}>
                      {u.role.toUpperCase()}
                    </span>
                    {u.id === currentUser?.id && (
                      <Badge variant="outline" className="text-xs">Siz</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(u.createdAt).toLocaleDateString("uz-UZ")} da qo'shilgan
                  </p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {currentUser?.role === "sudo" && u.id !== currentUser?.id && (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(u.id)} data-testid={`button-delete-user-${u.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Foydalanuvchi nomi</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" data-testid="input-user-username" />
            </div>
            <div className="space-y-2">
              <Label>{editing ? "Yangi parol (ixtiyoriy)" : "Parol"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" data-testid="input-user-password" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-user">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
