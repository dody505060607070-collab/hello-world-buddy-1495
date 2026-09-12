import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import heroImage from "@/assets/hero-list-property.jpg";
import { PageHero } from "@/components/site/PageHero";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/list-property")({
  head: () => ({
    meta: [
      { title: "اعرض أو اطلب عقارك | الرشودي للعقارات" },
      {
        name: "description",
        content:
          "أرسل بيانات عقارك لعرضه للإيجار أو البيع في بريدة، أو اطلب عقاراً بمواصفات محددة وسيتواصل معك فريقنا.",
      },
      { property: "og:title", content: "اعرض أو اطلب عقارك | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "نموذج عرض العقار أو طلب عقار في بريدة مع متابعة مباشرة من فريق الرشودي للعقارات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://friendly-fellow-kit.lovable.app/list-property" }],
  }),
  component: ListPropertyPage,
});

type Mode = "offer" | "request";

function ListPropertyPage() {
  const [mode, setMode] = useState<Mode>("offer");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    purpose: "rent",
    property_type: "",
    city: "بريدة",
    district: "",
    asking_price: "",
    description: "",
    budget_min: "",
    budget_max: "",
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("الاسم ورقم الجوال مطلوبان");
      return;
    }
    setBusy(true);
    try {
      if (mode === "offer") {
        const attachments: { path: string; name: string; size: number; type: string }[] = [];
        for (const file of images) {
          const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
          const path = `public/${crypto.randomUUID()}.${extension}`;
          const uploaded = await supabase.storage.from("listing-request-media").upload(path, file, { contentType: file.type, upsert: false });
          if (uploaded.error) throw uploaded.error;
          attachments.push({ path, name: file.name, size: file.size, type: file.type });
        }
        const { error } = await supabase.from("listing_requests").insert({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          purpose: form.purpose,
          property_type: form.property_type || null,
          city: form.city || null,
          district: form.district || null,
          asking_price: form.asking_price || null,
          description: form.description || null,
          attachments,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supply_requests").insert({
          full_name: form.full_name,
          phone: form.phone,
          request_type: form.purpose,
          city: form.city || null,
          districts: form.district || null,
          property_type: form.property_type || null,
          requester_type: "client",
          budget_min: form.budget_min ? Number(form.budget_min) : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          requester_notes: form.description || null,
        });
        if (error) throw error;
      }
      try {
        const { reportPublicRequest } = await import("@/lib/automation.functions");
        await reportPublicRequest({
          data: {
            full_name: form.full_name,
            phone: form.phone,
            purpose: form.purpose,
            city: form.city || undefined,
            property_type: form.property_type || undefined,
          },
        });
      } catch {
        /* الأتمتة اختيارية */
      }
      toast.success("تم إرسال طلبك بنجاح، سيتواصل معك فريقنا قريباً.");
      setForm({
        full_name: "",
        phone: "",
        email: "",
        purpose: "rent",
        property_type: "",
        city: "بريدة",
        district: "",
        asking_price: "",
        description: "",
        budget_min: "",
        budget_max: "",
      });
      setImages([]);
      void navigate({ to: "/thank-you" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الطلب، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <PageHero
        image={heroImage}
        eyebrow="خدمة الملاك والباحثين"
        title="اعرض أو اطلب عقارك"
        subtitle="أرسل بيانات عقارك لعرضه للإيجار أو البيع، أو اطلب عقاراً بمواصفات محددة وسيتواصل معك فريقنا."
        height="md"
      />

      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1.5">
          {(
            [
              { id: "offer", label: "أعرض عقاري" },
              { id: "request", label: "أطلب عقاراً" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`rounded-lg py-2.5 text-[13.5px] font-bold transition-colors ${
                mode === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-border bg-card p-7 shadow-card"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">الاسم الكامل</Label>
              <Input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input
                id="phone"
                dir="ltr"
                required
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>

          {mode === "offer" ? (
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purpose">{mode === "offer" ? "الغرض" : "المطلوب"}</Label>
              <select
                id="purpose"
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[13.5px]"
              >
                <option value="rent">إيجار</option>
                <option value="sale">بيع</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="property_type">نوع العقار</Label>
              <Input
                id="property_type"
                value={form.property_type}
                onChange={(e) => set("property_type", e.target.value)}
                placeholder="شقة، فيلا، أرض، معرض..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">المدينة</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">{mode === "offer" ? "الحي" : "الأحياء المفضلة"}</Label>
              <Input
                id="district"
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
              />
            </div>
          </div>

          {mode === "offer" ? (
            <div className="space-y-2">
              <Label htmlFor="asking_price">السعر المطلوب</Label>
              <Input
                id="asking_price"
                value={form.asking_price}
                onChange={(e) => set("asking_price", e.target.value)}
                placeholder="مثال: 35,000 ريال سنوياً"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget_min">أقل ميزانية</Label>
                <Input
                  id="budget_min"
                  type="number"
                  dir="ltr"
                  value={form.budget_min}
                  onChange={(e) => set("budget_min", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget_max">أعلى ميزانية</Label>
                <Input
                  id="budget_max"
                  type="number"
                  dir="ltr"
                  value={form.budget_max}
                  onChange={(e) => set("budget_max", e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">
              {mode === "offer" ? "وصف العقار" : "تفاصيل الطلب"}
            </Label>
            <Textarea
              id="description"
              rows={5}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {mode === "offer" ? <div className="space-y-3">
            <Label>صور العقار (حتى 3 صور — خاصة ولا تظهر للعامة)</Label>
            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-5 text-center transition hover:border-primary/50">
              <ImagePlus className="size-6 text-primary" />
              <span className="text-[13px] font-semibold">اختر صور العقار</span>
              <span className="text-[11.5px] text-muted-foreground">JPG أو PNG، بحد أقصى 8 ميجابايت للصورة</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => {
                const selected = Array.from(event.target.files ?? []).filter((file) => file.size <= 8 * 1024 * 1024);
                setImages((current) => [...current, ...selected].slice(0, 3));
                event.target.value = "";
              }} />
            </label>
            {images.length ? <ul className="grid gap-2 sm:grid-cols-3">{images.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[12px]"><span className="truncate">{file.name}</span><button type="button" aria-label="حذف الصورة" onClick={() => setImages((current) => current.filter((_, i) => i !== index))} className="text-destructive"><X className="size-4" /></button></li>)}</ul> : null}
          </div> : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
          </Button>
        </form>
      </section>
    </SiteLayout>
  );
}
