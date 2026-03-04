import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Trash2, Edit2, Users, FolderOpen } from "lucide-react";
import type { User, Group } from "@shared/schema";

interface WorkerWithGroups extends User {
  groups: Group[];
}

export default function WorkersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerWithGroups | null>(null);
  
  const [form, setForm] = useState({
    fullName: "",
    faceUserId: "",
    username: "",
    password: "",
    groupId: ""
  });

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"]
  });

  const { data: workers, isLoading: workersLoading } = useQuery<WorkerWithGroups[]>({
    queryKey: ["/api/workers"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/workers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setOpen(false);
      toast({ title: "Ishchi muvaffaqiyatli qo'shildi" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Xatolik", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/workers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setOpen(false);
      toast({ title: "Ishchi ma'lumotlari yangilandi" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Xatolik", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const deleteFromGroupMutation = useMutation({
    mutationFn: async ({ groupId, workerId }: { groupId: string; workerId: string }) => {
      await apiRequest("DELETE", `/api/groups/${groupId}/workers/${workerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Ishchi guruhdan o'chirildi" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Xatolik", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editingWorker) {
      updateMutation.mutate({ 
        id: editingWorker.id, 
        data: {
          fullName: form.fullName,
          faceUserId: form.faceUserId,
          username: form.username || null,
          password: form.password || undefined,
          groupId: form.groupId
        } 
      });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (worker: WorkerWithGroups) => {
    setEditingWorker(worker);
    setForm({
      fullName: worker.fullName,
      faceUserId: worker.faceUserId || "",
      username: worker.username || "",
      password: "",
      groupId: worker.groups[0]?.id || ""
    });
    setOpen(true);
  };

  const handleAdd = () => {
    setEditingWorker(null);
    setForm({
      fullName: "",
      faceUserId: "",
      username: "",
      password: "",
      groupId: groups?.[0]?.id || ""
    });
    setOpen(true);
  };

  const filteredWorkers = workers?.filter(w => 
    w.fullName.toLowerCase().includes(search.toLowerCase()) || 
    w.faceUserId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ishchilar</h1>
          <p className="text-muted-foreground">Guruhlardagi ishchilarni boshqarish</p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-worker" className="hover-elevate">
          <UserPlus className="mr-2 h-4 w-4" />
          Ishchi qo'shish
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Qidirish..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-workers"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workersLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : filteredWorkers?.map((worker) => (
          <Card key={worker.id} className="border-border/50 hover-elevate" data-testid={`card-worker-${worker.id}`}>
            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">{worker.fullName}</CardTitle>
                <CardDescription className="font-mono text-xs">ID: {worker.faceUserId}</CardDescription>
              </div>
              <div className="flex gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => handleEdit(worker)}
                  data-testid={`button-edit-worker-${worker.id}`}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {worker.groups.map(g => (
                    <Badge key={g.id} variant="secondary" className="flex items-center gap-1">
                      <FolderOpen className="h-3 w-3" />
                      {g.name}
                      <button 
                        onClick={() => deleteFromGroupMutation.mutate({ groupId: g.id, workerId: worker.id })}
                        className="ml-1 hover:text-destructive transition-colors"
                        title="Guruhdan o'chirish"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {worker.groups.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Guruhsiz</span>
                  )}
                </div>
                {worker.username && (
                  <p className="text-xs text-muted-foreground">
                    Login: <span className="font-medium text-foreground">{worker.username}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!workersLoading && filteredWorkers?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Ishchilar topilmadi</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorker ? "Ishchini tahrirlash" : "Yangi ishchi qo'shish"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">To'liq ism</Label>
              <Input
                id="fullName"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Falonchi Pistonchiyev"
                data-testid="input-worker-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faceUserId">FaceID User ID</Label>
              <Input
                id="faceUserId"
                required
                value={form.faceUserId}
                onChange={(e) => setForm({ ...form, faceUserId: e.target.value })}
                placeholder="101"
                data-testid="input-worker-faceid"
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
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm font-medium mb-3">Tizimga kirish (ixtiyoriy)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Login</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="user123"
                    data-testid="input-worker-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Parol</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingWorker ? "O'zgartirish uchun..." : "••••••••"}
                    data-testid="input-worker-password"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-worker">
                {editingWorker ? "Saqlash" : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
