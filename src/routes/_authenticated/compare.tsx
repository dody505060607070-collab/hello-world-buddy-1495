import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Columns3, X } from "lucide-react";
import { useState } from "react";

import { EmptyState, formatCurrency } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({ meta: [
    { title: "مقارنة العقارات | الرشودي للعقارات" }, { name: "description", content: "مقارنة حتى ثلاثة عقارات جنبًا إلى جنب." },
    { property: "og:title", content: "مقارنة العقارات | الرشودي للعقارات" }, { property: "og:description", content: "مقارنة السعر والموقع والنوع والحالة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ComparePage,
});

function ComparePage() {
  const [ids, setIds] = useState<string[]>([]);
  const list = useQuery({ queryKey: ["compare-properties"], queryFn: async () => { const { data, error } = await supabase.from("properties").select("id,code,name,purpose,property_type,city,district,price_value,price_text,status,description").order("created_at", { ascending: false }).limit(300); if (error) throw error; return data ?? []; } });
  const selected = (list.data ?? []).filter((row) => ids.includes(row.id));
  return <><PageHero title="مقارنة العقارات" subtitle="اختر حتى ثلاثة عقارات لمقارنة تفاصيلها جنبًا إلى جنب." icon={Columns3} />
    <div className="surface-card p-4"><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-[13px]" value="" onChange={(e) => { if (e.target.value && !ids.includes(e.target.value) && ids.length < 3) setIds((current) => [...current, e.target.value]); }}><option value="">اختر عقارًا للمقارنة</option>{(list.data ?? []).filter((row) => !ids.includes(row.id)).map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</select></div>
    {!selected.length ? <div className="surface-card"><EmptyState text="لم تختر عقارات بعد" hint="اختر عقارين أو ثلاثة لبدء المقارنة." /></div> : <div className={`grid gap-4 ${selected.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>{selected.map((row) => <article key={row.id} className="surface-card overflow-hidden"><header className="flex items-start justify-between border-b border-border p-4"><div><p className="text-[11px] text-muted-foreground">{row.code}</p><h2 className="font-bold">{row.name}</h2></div><Button variant="ghost" size="icon-sm" onClick={() => setIds((current) => current.filter((id) => id !== row.id))} aria-label="إزالة"><X /></Button></header><dl className="divide-y divide-border">{[["الغرض", row.purpose === "sale" ? "بيع" : "إيجار"], ["النوع", row.property_type], ["المدينة", row.city], ["الحي", row.district], ["السعر", row.price_value ? formatCurrency(row.price_value) : row.price_text], ["الحالة", row.status], ["الوصف", row.description]].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_1fr] gap-3 p-3 text-[12.5px]"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value || "—"}</dd></div>)}</dl></article>)}</div>}
  </>;
}