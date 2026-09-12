import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CircleDollarSign, Download, FileClock, ReceiptText, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/components/kit/LiveTable";
import { PageHero } from "@/components/kit/PageHero";
import { CardsSkeleton } from "@/components/kit/Skeletons";
import { StatCard } from "@/components/kit/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exportWorkbook } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [
    { title: "تقرير التحصيل الشهري | الرشودي للعقارات" },
    { name: "description", content: "تقرير شهري للمستحق والمحصّل والمتأخر ونسبة التحصيل مع تصدير Excel." },
    { property: "og:title", content: "تقرير التحصيل الشهري | الرشودي للعقارات" },
    { property: "og:description", content: "مؤشرات التحصيل الشهرية من بيانات النظام." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportsPage,
});

const monthLabel = (key: string) => new Intl.DateTimeFormat("ar-SA", { month: "short", year: "numeric" }).format(new Date(`${key}-01T12:00:00`));

function ReportsPage() {
  const report = useQuery({
    queryKey: ["reports-monthly"],
    queryFn: async () => {
      const [payments, invoices, contracts, opportunities] = await Promise.all([
        supabase.from("contract_payments").select("amount_due, amount_paid, status, due_date").order("due_date"),
        supabase.from("invoices").select("total, status"),
        supabase.from("contracts").select("status"),
        supabase.from("opportunities").select("stage, expected_value, close_probability"),
      ]);
      for (const result of [payments, invoices, contracts, opportunities]) if (result.error) throw result.error;
      const today = new Date().toISOString().slice(0, 10);
      const groups = new Map<string, { month: string; due: number; paid: number; overdue: number }>();
      for (const row of payments.data ?? []) {
        const key = row.due_date.slice(0, 7);
        const current = groups.get(key) ?? { month: key, due: 0, paid: 0, overdue: 0 };
        current.due += Number(row.amount_due ?? 0);
        current.paid += Number(row.amount_paid ?? 0);
        if (row.status !== "paid" && row.due_date < today) current.overdue += Number(row.amount_due ?? 0) - Number(row.amount_paid ?? 0);
        groups.set(key, current);
      }
      const monthly = [...groups.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map((row) => ({ ...row, label: monthLabel(row.month), rate: row.due ? Math.round(row.paid / row.due * 100) : 0 }));
      const due = monthly.reduce((sum, row) => sum + row.due, 0);
      const paid = monthly.reduce((sum, row) => sum + row.paid, 0);
      const overdue = monthly.reduce((sum, row) => sum + row.overdue, 0);
      const weightedPipeline = (opportunities.data ?? []).filter((o) => !["won", "lost"].includes(o.stage)).reduce((sum, o) => sum + Number(o.expected_value ?? 0) * Number(o.close_probability ?? 0) / 100, 0);
      return { monthly, due, paid, overdue, collectionRate: due ? Math.round(paid / due * 100) : 0, invoicesUnpaid: (invoices.data ?? []).filter((i) => i.status !== "paid").length, contractsActive: (contracts.data ?? []).filter((c) => c.status === "active").length, weightedPipeline };
    },
  });

  const download = () => {
    const data = report.data;
    if (!data) return;
    void exportWorkbook(`تقرير-التحصيل-${new Date().toISOString().slice(0, 10)}`, [
      { name: "الملخص", rows: [{ "إجمالي المستحق": data.due, "إجمالي المحصل": data.paid, "المتأخر": data.overdue, "نسبة التحصيل": `${data.collectionRate}%`, "قيمة الفرص المرجحة": data.weightedPipeline }] },
      { name: "التحصيل الشهري", rows: data.monthly.map((r) => ({ الشهر: r.label, المستحق: r.due, المحصل: r.paid, المتأخر: r.overdue, "نسبة التحصيل": `${r.rate}%` })) },
    ]);
  };

  return <>
    <PageHero title="تقرير التحصيل الشهري" subtitle="المستحق والمحصّل والمتأخر ونسبة التحصيل خلال آخر 12 شهرًا." icon={BarChart3} />
    <div className="flex justify-end"><Button onClick={download} disabled={!report.data}><Download />تصدير Excel</Button></div>
    {report.isLoading ? <CardsSkeleton count={6} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي المستحق" value={report.data?.due ?? 0} suffix="ر.س" icon={CircleDollarSign} />
        <StatCard label="إجمالي المحصّل" value={report.data?.paid ?? 0} suffix="ر.س" icon={TrendingUp} />
        <StatCard label="المتأخرات" value={report.data?.overdue ?? 0} suffix="ر.س" icon={FileClock} />
        <StatCard label="نسبة التحصيل" value={report.data?.collectionRate ?? 0} suffix="%" icon={BarChart3} />
        <StatCard label="فواتير غير مسددة" value={report.data?.invoicesUnpaid ?? 0} icon={ReceiptText} />
        <StatCard label="عقود سارية" value={report.data?.contractsActive ?? 0} icon={FileClock} />
        <StatCard label="قيمة الفرص المرجّحة" value={report.data?.weightedPipeline ?? 0} suffix="ر.س" icon={TrendingUp} className="sm:col-span-2" />
      </div>
      <section className="surface-card p-5">
        <h2 className="mb-5 text-[14px] font-bold">التحصيل حسب الشهر</h2>
        {report.data?.monthly.length ? <div className="h-[360px] w-full" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.data.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Bar dataKey="due" name="المستحق" fill="var(--color-warning)" radius={[4,4,0,0]} /><Bar dataKey="paid" name="المحصّل" fill="var(--color-success)" radius={[4,4,0,0]} /><Bar dataKey="overdue" name="المتأخر" fill="var(--color-destructive)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div> : <p className="py-16 text-center text-muted-foreground">لا توجد دفعات لعرضها.</p>}
      </section>
    </>}
  </>;
}