import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Group, User, InsertGroup } from "@shared/schema";
import { Loader2, Plus, Pencil, Trash2, Users, Shield, FolderOpen } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGroupSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function GroupsPage() {
  const { toast } = useToast();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [assignType, setAssignType] = useState<"admin" | "worker">("admin");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: groups, isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<InsertGroup>({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: {
      name: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGroup) => {
      const res = await apiRequest("POST", "/api/groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Muvaffaqiyatli", description: "Guruh yaratildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertGroup> }) => {
      const res = await apiRequest("PATCH", `/api/groups/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsDialogOpen(false);
      setEditingGroup(null);
      form.reset();
      toast({ title: "Muvaffaqiyatli", description: "Guruh nomi o'zgartirildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Muvaffaqiyatli", description: "Guruh o'chirildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ groupId, type, userIds }: { groupId: string, type: "admin" | "worker", userIds: string[] }) => {
      await apiRequest("POST", `/api/groups/${groupId}/${type}s`, { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setIsAssignDialogOpen(false);
      toast({ title: "Muvaffaqiyatli", description: "Foydalanuvchilar biriktirildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    },
  });

  function onSubmit(data: InsertGroup) {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const handleOpenAssign = (group: Group, type: "admin" | "worker") => {
    setSelectedGroup(group);
    setAssignType(type);
    setSelectedUsers([]);
    setIsAssignDialogOpen(true);
  };

  const filteredUsers = users?.filter(u => 
    assignType === "admin" ? (u.role === "admin" || u.role === "sudo") : u.role === "worker"
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guruhlar boshqaruvi</h1>
          <p className="text-muted-foreground text-sm">Xodimlar guruhlarini boshqarish</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingGroup(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-group">
              <Plus className="w-4 h-4 mr-2" />
              Guruh qo'shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Guruhni tahrirlash" : "Yangi guruh qo'shish"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guruh nomi</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-group-name" placeholder="Masalan: Markaziy filial" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-group">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Saqlash
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </CardHeader>
            </Card>
          ))
        ) : groups?.length === 0 ? (
          <div className="col-span-full py-20 text-center border rounded-xl bg-muted/20">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Hali guruhlar yaratilmagan</p>
          </div>
        ) : (
          groups?.map((group) => (
            <Card key={group.id} className="border-border/50 hover-elevate">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <CardDescription>ID: {group.id.split('-')[0]}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingGroup(group);
                        form.reset({ name: group.name });
                        setIsDialogOpen(true);
                      }}
                      data-testid={`button-edit-group-${group.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Haqiqatan ham bu guruhni o'chirmoqchimisiz?")) {
                          deleteMutation.mutate(group.id);
                        }
                      }}
                      data-testid={`button-delete-group-${group.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={() => handleOpenAssign(group, "admin")}
                    data-testid={`button-assign-admins-${group.id}`}
                  >
                    <Shield className="w-4 h-4" />
                    Adminlar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start gap-2"
                    onClick={() => handleOpenAssign(group, "worker")}
                    data-testid={`button-assign-workers-${group.id}`}
                  >
                    <Users className="w-4 h-4" />
                    Ishchilar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assignType === "admin" ? "Adminlarni biriktirish" : "Ishchilarni biriktirish"}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup?.name} guruhiga {assignType === "admin" ? "adminlar" : "ishchilar"} tanlang.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox 
                    id={user.id} 
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    data-testid={`checkbox-user-${user.id}`}
                  />
                  <label 
                    htmlFor={user.id} 
                    className="flex-1 text-sm font-medium leading-none cursor-pointer"
                  >
                    {user.fullName}
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                      {user.username || user.faceUserId}
                    </span>
                  </label>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-sm text-center text-muted-foreground py-10">
                  Biriktirish uchun foydalanuvchilar topilmadi
                </p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button 
              onClick={() => {
                if (selectedGroup) {
                  assignMutation.mutate({ 
                    groupId: selectedGroup.id, 
                    type: assignType, 
                    userIds: selectedUsers 
                  });
                }
              }}
              disabled={assignMutation.isPending}
              data-testid="button-save-assignments"
            >
              {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
