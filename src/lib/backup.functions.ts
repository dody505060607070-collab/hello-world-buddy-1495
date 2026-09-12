import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = ["properties", "contacts", "contracts", "contract_payments", "invoices", "invoice_items", "tasks", "opportunities", "reservations", "listing_requests", "supply_requests"] as const;

export const createSystemBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (!role.data) throw new Error("النسخ الاحتياطي متاح للمدير العام فقط");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const run = await supabaseAdmin.from("backup_runs").insert({ requested_by: context.userId, status: "processing" }).select("id").single();
    if (run.error) throw new Error(run.error.message);
    try {
      const entries = await Promise.all(TABLES.map(async (table) => {
        const result = await supabaseAdmin.from(table).select("*");
        if (result.error) throw result.error;
        return [table, result.data ?? []] as const;
      }));
      const payload = JSON.stringify({ version: 1, created_at: new Date().toISOString(), tables: Object.fromEntries(entries) });
      await supabaseAdmin.from("backup_runs").update({ status: "completed", size_bytes: new TextEncoder().encode(payload).byteLength, tables_count: TABLES.length, completed_at: new Date().toISOString() }).eq("id", run.data.id);
      return { fileName: `rashoudi-backup-${new Date().toISOString().slice(0, 10)}.json`, payload };
    } catch (error) {
      await supabaseAdmin.from("backup_runs").update({ status: "failed", error_message: error instanceof Error ? error.message : "خطأ غير معروف", completed_at: new Date().toISOString() }).eq("id", run.data.id);
      throw error;
    }
  });