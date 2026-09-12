import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** يرسل تفاصيل المهمة فورًا على واتساب للموظفين المكلّفين. */
export const notifyTaskNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: z.string().min(1),
        userIds: z.array(z.string()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { notifyTaskAssigneesNow } = await import("@/lib/tasks.server");
    return notifyTaskAssigneesNow(data.taskId, data.userIds);
  });
