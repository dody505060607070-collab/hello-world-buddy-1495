/**
 * محرّك الأتمتة الدورية — يُستدعى كل ساعة من cron خارجي عبر /api/public/n8n
 * server-only: لا يُستورد من كود المتصفح.
 */

type RunResult = {
  ok: true;
  ranAt: string;
  reminders: { due: number; sent: number; failed: number };
  overdue: { payments: number; notified: number };
};

function nextSendDate(from: Date, interval: string): string | null {
  const d = new Date(from);
  switch (interval) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return d.toISOString();
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d.toISOString();
    case "biweekly":
      d.setDate(d.getDate() + 14);
      return d.toISOString();
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d.toISOString();
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString();
    default:
      return null; // once
  }
}

export async function runHourlyAutomation(): Promise<RunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { twilioSend } = await import("@/lib/whatsapp.functions");
  const now = new Date();
  const nowIso = now.toISOString();

  // 1) التذكيرات والمتابعات المستحقة
  const { data: due } = await supabaseAdmin
    .from("reminder_followups")
    .select(
      "id, contract_id, payment_id, unit_id, recipient_name, recipient_phone, message_body, repeat_interval, sent_count",
    )
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .limit(50);

  let sent = 0;
  let failed = 0;

  for (const r of due ?? []) {
    const result = await twilioSend({ to: r.recipient_phone, body: r.message_body });
    if (result.ok) sent += 1;
    else failed += 1;

    await supabaseAdmin.from("message_log").insert({
      followup_id: r.id,
      contract_id: r.contract_id,
      payment_id: r.payment_id,
      unit_id: r.unit_id,
      recipient_name: r.recipient_name,
      recipient_phone: r.recipient_phone,
      body: r.message_body,
      channel: "whatsapp",
      result: result.ok ? "sent" : "failed",
      failure_reason: result.ok ? null : result.error,
      provider_message_id: result.ok ? result.sid : null,
      sent_by_system: true,
      idempotency_key: `followup:${r.id}:${nowIso.slice(0, 13)}`,
    });

    const next = nextSendDate(now, r.repeat_interval ?? "once");
    await supabaseAdmin
      .from("reminder_followups")
      .update({
        sent_count: (r.sent_count ?? 0) + 1,
        last_sent_at: nowIso,
        next_send_at: next,
        status: next ? "active" : "done",
      })
      .eq("id", r.id);
  }

  // 2) الدفعات المتأخرة → تنبيه الفريق
  const today = nowIso.slice(0, 10);
  const { data: overdue } = await supabaseAdmin
    .from("contract_payments")
    .select("id")
    .lt("due_date", today)
    .neq("status", "paid")
    .limit(200);

  let notified = 0;
  const overdueCount = (overdue ?? []).length;
  // تنبيه واحد يوميًا فقط (الساعة 8 صباحًا بتوقيت الرياض ≈ 05 UTC)
  if (overdueCount > 0 && now.getUTCHours() === 5) {
    const { data: staff } = await supabaseAdmin.from("user_roles").select("user_id");
    const ids = Array.from(new Set((staff ?? []).map((s) => s.user_id)));
    if (ids.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        ids.map((user_id) => ({
          user_id,
          title: "دفعات متأخرة",
          body: `يوجد ${overdueCount} دفعة متأخرة تحتاج متابعة`,
          link: "/payments",
        })),
      );
      notified = ids.length;
    }
  }

  await supabaseAdmin.from("automation_events").insert({
    event: "automation.hourly_run",
    direction: "in",
    payload: { due: (due ?? []).length, sent, failed, overdue: overdueCount } as never,
    status: failed > 0 ? "partial" : "sent",
  });

  return {
    ok: true,
    ranAt: nowIso,
    reminders: { due: (due ?? []).length, sent, failed },
    overdue: { payments: overdueCount, notified },
  };
}
