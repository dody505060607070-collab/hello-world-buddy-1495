import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/properties/import")({
  head: () => ({ meta: [
    { title: "استيراد العقارات | الرشودي للعقارات" }, { name: "description", content: "استيراد عقارات Excel ومراجعة البيانات قبل الحفظ." },
    { property: "og:title", content: "استيراد العقارات | الرشودي للعقارات" }, { property: "og:description", content: "مراجعة واستيراد عقارات Excel دفعة واحدة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PropertyImportPage,
});

type ImportRow = { code: string; name: string; purpose: string; property_type: string | null; city: string | null; district: string | null; price_value: number | null; price_text: string | null; status: string; is_visible: boolean; state: "valid" | "invalid"; issue?: string };
const value = (row: Record<string, unknown>, names: string[]) => { for (const name of names) if (row[name] != null) return String(row[name]).trim(); return ""; };

function PropertyImportPage() {
  const qc = useQueryClient(); const [rows, setRows] = useState<ImportRow[]>([]); const [fileName, setFileName] = useState("");
  const parse = async (file?: File) => {
    if (!file) return; const workbook = XLSX.read(await file.arrayBuffer()); const first = workbook.SheetNames[0]; if (!first) throw new Error("الملف لا يحتوي على أوراق");
    const sheet = workbook.Sheets[first]; if (!sheet) throw new Error("تعذّر قراءة الورقة الأولى");
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    setRows(raw.map((item, index) => {
      const name = value(item, ["اسم العقار", "الاسم", "name"]); const code = value(item, ["كود العقار", "الكود", "code"]) || `IMP-${Date.now()}-${index + 1}`;
      const purposeText = value(item, ["الغرض", "purpose"]); const purpose = purposeText.includes("بيع") || purposeText === "sale" ? "sale" : "rent";
      const price = Number(value(item, ["السعر", "price_value", "السعر الرقمي"]).replace(/,/g, ""));
      return { code, name, purpose, property_type: value(item, ["نوع العقار", "النوع", "property_type"]) || null, city: value(item, ["المدينة", "city"]) || null, district: value(item, ["الحي", "district"]) || null, price_value: Number.isFinite(price) && price > 0 ? price : null, price_text: value(item, ["نص السعر", "price_text"]) || null, status: "available", is_visible: false, state: name ? "valid" : "invalid", ...(name ? {} : { issue: "اسم العقار مطلوب" }) };
    })); setFileName(file.name);
  };
  const save = useMutation({ mutationFn: async () => {
    const valid = rows.filter((row) => row.state === "valid").map(({ state: _state, issue: _issue, ...row }) => row); if (!valid.length) throw new Error("لا توجد صفوف صالحة");
    const result = await supabase.from("properties").upsert(valid, { onConflict: "code" }); if (result.error) throw result.error; return valid.length;
  }, onSuccess: (count) => { void qc.invalidateQueries({ queryKey: ["properties"] }); toast.success(`تم استيراد ${count} عقار`); setRows([]); setFileName(""); }, onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الاستيراد") });
  return <><PageHero title="استيراد العقارات من Excel" subtitle="ارفع الملف، راجع الصفوف، ثم احفظ العقارات الصالحة دفعة واحدة." icon={FileSpreadsheet} />
    <div className="flex items-center justify-between"><Link to="/properties" className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary"><ArrowRight className="size-4" />رجوع للعقارات</Link>{rows.length ? <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}استيراد {rows.filter((r) => r.state === "valid").length} عقار</Button> : null}</div>
    <label className="surface-card grid cursor-pointer place-items-center gap-2 border-dashed px-6 py-12 text-center"><UploadCloud className="size-8 text-primary" /><strong>{fileName || "اختر ملف Excel"}</strong><span className="text-[12px] text-muted-foreground">الأعمدة المقبولة: اسم العقار، الكود، الغرض، النوع، المدينة، الحي، السعر</span><input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => void parse(e.target.files?.[0])} /></label>
    {rows.length ? <DataTable rows={rows} emptyState={<EmptyState text="لا توجد صفوف" />} rowClassName={(r) => r.state === "invalid" ? "bg-destructive/8" : "bg-success/5"} columns={[
      { header: "الحالة", cell: (r) => <Chip tone={r.state === "valid" ? "success" : "danger"}>{r.state === "valid" ? "صالح" : r.issue}</Chip> },
      { header: "الكود", cell: (r) => r.code }, { header: "اسم العقار", cell: (r) => r.name || "—" }, { header: "الغرض", cell: (r) => r.purpose === "sale" ? "بيع" : "إيجار" }, { header: "النوع", cell: (r) => r.property_type ?? "—" }, { header: "الموقع", cell: (r) => [r.city, r.district].filter(Boolean).join(" - ") || "—" }, { header: "السعر", cell: (r) => r.price_value?.toLocaleString("ar-SA") ?? r.price_text ?? "—" },
    ]} /> : null}
  </>;
}