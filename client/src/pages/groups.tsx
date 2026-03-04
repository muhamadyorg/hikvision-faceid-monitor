import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Plus, Trash2, Edit, Users, Key, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GroupItem {
  id: string;
  name: string;
  login: string;
  createdAt: string;
}

interface UserItem {
  id: string;
  username: string;
  role: string;
}

export default function GroupsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GroupItem | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", login: "", password: "" });
  const [joinForm, setJoinForm] = useState({ login: "", password: "" });
  const [addMemberUserId, setAddMemberUserId] = useState("");

  const { data: groups, isLoading } = useQuery<GroupItem[]>({ queryKey: ["/api/groups"] });
  const { data: allUsers } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === "sudo" || currentUser?.role === "admin",
  });
  const { data: members } = useQuery<UserItem[]>({
    queryKey: [`/api/groups/${membersOpen}/members`],
    enabled: !!membersOpen,
  });

  const createMut = useMutation({
    mutationFn: async (data: typeof form) => { const res = await apiRequest("POST", "/api/groups", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); setOpen(false); toast({ title: "Guruh qo'shildi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await apiRequest("PUT", `/api/groups/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); setOpen(false); setEditing(null); toast({ title: "Guruh yangilandi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/groups/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); toast({ title: "Guruh o'chirildi" }); },
  });

  const joinMut = useMutation({
    mutationFn: async (data: typeof joinForm) => { const res = await apiRequest("POST", "/api/groups/join", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); setJoinOpen(false); toast({ title: "Guruhga qo'shildingiz" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const addMemberMut = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await apiRequest("POST", `/api/groups/${groupId}/members`, { userId });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/groups/${membersOpen}/members`] }); toast({ title: "A'zo qo'shildi" }); },
    onError: (e: any) => toast({ title: "Xato", description: e.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await apiRequest("DELETE", `/api/groups/${groupId}/members/${userId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/groups/${membersOpen}/members`] }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", login: "", password: "" }); setOpen(true); };
  const openEdit = (g: GroupItem) => { setEditing(g); setForm({ name: g.name, login: g.login, password: "" }); setOpen(true); };

  const handleSubmit = () => {
    if (editing) {
      const data: any = {};
      if (form.name) data.name = form.name;
      if (form.login) data.login = form.login;
      if (form.password) data.password = form.password;
      updateMut.mutate({ id: editing.id, data });
    } else createMut.mutate(form);
  };

  const isSudoOrAdmin = currentUser?.role === "sudo" || currentUser?.role === "admin";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Guruhlar</h1>
          <p className="text-muted-foreground text-sm">Foydalanuvchi guruhlarini boshqarish</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setJoinForm({ login: "", password: "" }); setJoinOpen(true); }} data-testid="button-join-group">
            <Key className="w-4 h-4 mr-2" />
            Guruhga qo'shilish
          </Button>
          {currentUser?.role === "sudo" && (
            <Button onClick={openCreate} data-testid="button-add-group">
              <Plus className="w-4 h-4 mr-2" />
              Guruh qo'shish
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : groups?.map((g) => (
          <Card key={g.id} className="border-border/50" data-testid={`group-card-${g.id}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-blue-400" />
                </div>
                {isSudoOrAdmin && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setMembersOpen(g.id)} data-testid={`button-members-${g.id}`}>
                      <Users className="w-4 h-4" />
                    </Button>
                    {currentUser?.role === "sudo" && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(g)} data-testid={`button-edit-group-${g.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMut.mutate(g.id)} data-testid={`button-delete-group-${g.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <p className="font-semibold text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Login: <span className="font-mono">{g.login}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && groups?.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Hali guruhlar yo'q</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Guruhni tahrirlash" : "Yangi guruh"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Guruh nomi</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ofis" data-testid="input-group-name" />
            </div>
            <div className="space-y-2">
              <Label>Login</Label>
              <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="ofis_group" data-testid="input-group-login" />
            </div>
            <div className="space-y-2">
              <Label>{editing ? "Yangi parol (ixtiyoriy)" : "Parol"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" data-testid="input-group-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-group">
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guruhga qo'shilish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Guruh logini</Label>
              <Input value={joinForm.login} onChange={(e) => setJoinForm({ ...joinForm, login: e.target.value })} placeholder="ofis_group" data-testid="input-join-login" />
            </div>
            <div className="space-y-2">
              <Label>Guruh paroli</Label>
              <Input type="password" value={joinForm.password} onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })} placeholder="••••••••" data-testid="input-join-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>Bekor</Button>
            <Button onClick={() => joinMut.mutate(joinForm)} disabled={joinMut.isPending} data-testid="button-confirm-join">
              Qo'shilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!membersOpen} onOpenChange={() => { setMembersOpen(null); setAddMemberUserId(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guruh a'zolari</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="divide-y divide-border/40">
              {members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">{m.username}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{m.role}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeMemberMut.mutate({ groupId: membersOpen!, userId: m.id })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {members?.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Hali a'zolar yo'q</p>}
            </div>
            {isSudoOrAdmin && allUsers && (
              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Select value={addMemberUserId} onValueChange={setAddMemberUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Foydalanuvchi tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers.filter(u => !members?.find(m => m.id === u.id)).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="default" onClick={() => { if (addMemberUserId && membersOpen) { addMemberMut.mutate({ groupId: membersOpen, userId: addMemberUserId }); setAddMemberUserId(""); } }}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
