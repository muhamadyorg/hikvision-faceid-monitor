import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Trash2, Umbrella } from "lucide-react";
import type { Holiday } from "@shared/schema";

export default function HolidaysPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: ""
  });

  const { data: holidays, isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/holidays", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setOpen(false);
      toast({ title: "Bayram qo'shildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/holidays/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({ title: "Bayram o'chirildi" });
    },
    onError: (error: Error) => {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const sortedHolidays = holidays?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bayramlar</h1>
          <p className="text-muted-foreground">Dam olish kunlarini boshqarish</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-holiday">
          <Plus className="mr-2 h-4 w-4" />
          Bayram qo'shish
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
            </Card>
          ))
        ) : sortedHolidays?.map((holiday) => (
          <Card key={holiday.id} className="border-border/50 hover-elevate" data-testid={`card-holiday-${holiday.id}`}>
            <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">
                  {new Date(holiday.date).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{holiday.description}</p>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(holiday.id)} data-testid={`button-delete-holiday-${holiday.id}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
          </Card>
        ))}
        {!isLoading && holidays?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Umbrella className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Bayramlar topilmadi</p>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi bayram qo'shish</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">Sana</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                data-testid="input-holiday-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Tavsif</Label>
              <Input
                id="description"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mustaqillik kuni"
                data-testid="input-holiday-desc"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Bekor qilish</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-holiday">
                Qo'shish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
