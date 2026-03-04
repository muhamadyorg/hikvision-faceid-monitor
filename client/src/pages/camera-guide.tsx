import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Shield, Users, Monitor, HelpCircle, CheckCircle2 } from "lucide-react";

export default function CameraGuidePage() {
  const steps = [
    {
      title: "Qurilma tarmog'ini sozlash",
      description: "Hikvision kamerasini lokal tarmoqqa ulang va unga statik IP manzil biriktiring. Gateway va DNS sozlamalari to'g'ri ekanligiga ishonch hosil qiling.",
      icon: Monitor,
    },
    {
      title: "FaceID funksiyasini faollashtirish",
      description: "Kamera web-interfeysiga kiring: Configuration -> Event -> Smart Event -> Face Detection. Bu yerda 'Enable Face Detection' katakchasini belgilang.",
      icon: Shield,
    },
    {
      title: "HTTP Event xabar berishni sozlash",
      description: "Configuration -> Network -> Advanced Settings -> HTTP Listening. Server manzili sifatida ushbu tizimning IP manzilini va portini (default 5000) kiriting.",
      icon: Camera,
    },
    {
      title: "Foydalanuvchilarni ro'yxatga olish",
      description: "Kamera xotirasiga xodimlarning yuzlarini va ularning ID raqamlarini (user_id) kiriting. Bu ID raqamlari tizimda 'FaceID User ID' sifatida ishlatiladi.",
      icon: Users,
    },
    {
      title: "Sinovdan o'tkazish",
      description: "Kamera oldidan o'tib ko'ring. Agar sozlamalar to'g'ri bo'lsa, 'Realtime' sahifasida yangi event paydo bo'lishi kerak.",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="w-8 h-8 text-primary" />
          Kamera sozlash qo'llanmasi
        </h1>
        <p className="text-muted-foreground mt-2">
          Hikvision FaceID kameralarini tizimga ulash bo'yicha bosqichma-bosqich ko'rsatmalar.
        </p>
      </div>

      <div className="grid gap-6">
        {steps.map((step, index) => (
          <Card key={index} className="border-border/50 hover-elevate">
            <CardHeader className="flex flex-row items-start gap-4 pb-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {index + 1}. {step.title}
                </CardTitle>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6">
          <h3 className="font-semibold text-primary flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4" />
            Muhim eslatma
          </h3>
          <p className="text-sm text-primary/80">
            Kamera va server o'rtasidagi aloqa uzluksiz bo'lishi uchun kamera statik IP manzilda bo'lishi va server porti (5000) firewall tomonidan bloklanmagan bo'lishi shart.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
