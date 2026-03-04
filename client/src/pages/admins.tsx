import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Shield, Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface AdminUser {
  id: string;
  username: string | null;
  fullName: string;
  faceUserId: string | null;
  plainPassword: string | null;
  role: "sudo" | "admin" | "worker";
  createdAt: string | null;
}

interface AdminFormData {
  fullName: string;
  username: string;
  password: string;
  role: "sudo" | "admin";
}

export default function AdminsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<AdminFormData>({ fullName: "", username: "", password: "", role: "admin" });

  const { data: users, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: AdminFormData) => {
      const res = await apiRequest("POST", "/api/users", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xato");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      setForm({ fullName: "", username: "", password: "", role: "admin" });
      toast({ title: "Muvaffaqiyatli", description: "Admin yaratildi" });
    },
    onError: (e: Error) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdminFormData> }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Xato");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      setForm({ fullName: "", username: "", password: "", role: "admin" });
      toast({ title: "Muvaffaqiyatli", description: "Admin tahrirlandi" });
    },
    onError: (e: Error) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) throw new Error("O'chirishda xato");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Muvaffaqiyatli", description: "Admin o'chirildi" });
    },
    onError: (e: Error) => toast({ title: "Xatolik", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingUser(null);
    setForm({ fullName: "", username: "", password: "", role: "admin" });
    setIsDialogOpen(true);
  }

  function openEdit(admin: AdminUser) {
    setEditingUser(admin);
    setForm({ fullName: admin.fullName, username: admin.username || "", password: "", role: admin.role as "sudo" | "admin" });
    setIsDialogOpen(true);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editingUser) {
      const update: Partial<AdminFormData> = {};
      if (form.fullName !== editingUser.fullName) update.fullName = form.fullName;
      if (form.username !== editingUser.username) update.username = form.username;
      if (form.role !== editingUser.role) update.role = form.role;
      if (form.password) update.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data: update });
    } else {
      createMutation.mutate(form);
    }
  }

  const admins = users?.filter(u => u.role === "admin" || u.role === "sudo") || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-yellow-400" />
            Adminlar boshqaruvi
          </h1>
          <p className="text-gray-400 text-sm mt-1">Tizim adminlarini qo'shish, tahrirlash va boshqarish</p>
        </div>
        {user?.role === "sudo" && (
          <Button onClick={openCreate} className="bg-yellow-600 hover:bg-yellow-700" data-testid="button-add-admin">
            <Plus className="w-4 h-4 mr-2" />
            Admin qo'shish
          </Button>
        )}
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-400">F.I.SH</TableHead>
                  <TableHead className="text-gray-400">Login</TableHead>
                  <TableHead className="text-gray-400">Parol</TableHead>
                  <TableHead className="text-gray-400">Rol</TableHead>
                  <TableHead className="text-gray-400 text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">Admin topilmadi</TableCell>
                  </TableRow>
                ) : admins.map((admin) => (
                  <TableRow key={admin.id} className="border-gray-700 hover:bg-gray-700/50">
                    <TableCell className="text-white font-medium">{admin.fullName}</TableCell>
                    <TableCell className="text-gray-300 font-mono text-sm">{admin.username || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-300">
                          {showPasswords[admin.id] ? (admin.plainPassword || "[o'rnatilmagan]") : "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-500 hover:text-gray-300"
                          onClick={() => setShowPasswords(p => ({ ...p, [admin.id]: !p[admin.id] }))}
                          data-testid={`button-toggle-pass-${admin.id}`}
                        >
                          {showPasswords[admin.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={admin.role === "sudo" ? "bg-yellow-700/30 text-yellow-400 border-yellow-600" : "bg-blue-700/30 text-blue-400 border-blue-600"}>
                        {admin.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-white"
                          onClick={() => openEdit(admin)}
                          data-testid={`button-edit-admin-${admin.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {admin.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-400"
                            onClick={() => { if (confirm("O'chirishni tasdiqlaysizmi?")) deleteMutation.mutate(admin.id); }}
                            data-testid={`button-delete-admin-${admin.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-400" />
              {editingUser ? "Adminni tahrirlash" : "Yangi admin qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-300">F.I.SH *</Label>
              <Input
                className="bg-gray-800 border-gray-600 text-white mt-1"
                value={form.fullName}
                onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Ism Familiya"
                required
                data-testid="input-admin-fullname"
              />
            </div>
            <div>
              <Label className="text-gray-300">Login *</Label>
              <Input
                className="bg-gray-800 border-gray-600 text-white mt-1"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="login_nomi"
                required={!editingUser}
                data-testid="input-admin-username"
              />
            </div>
            <div>
              <Label className="text-gray-300">
                Parol {editingUser ? "(bo'sh qoldirsa o'zgarmaydi)" : "*"}
              </Label>
              <Input
                className="bg-gray-800 border-gray-600 text-white mt-1"
                type="text"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="kamida 4 ta belgi"
                required={!editingUser}
                data-testid="input-admin-password"
              />
            </div>
            <div>
              <Label className="text-gray-300">Rol</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v as "sudo" | "admin" }))}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1" data-testid="select-admin-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sudo">Sudo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Bekor</Button>
              <Button type="submit" disabled={isSaving} className="bg-yellow-600 hover:bg-yellow-700" data-testid="button-save-admin">
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingUser ? "Saqlash" : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
