import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import logoAsset from "@/assets/rushdy-logo-transparent.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { resolveClientLogin } from "@/lib/portal.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | الرشودي للعقارات" },
      { name: "description", content: "دخول فريق الرشودي للعقارات إلى لوحة التحكم الداخلية." },
      { property: "og:title", content: "تسجيل الدخول | الرشودي للعقارات" },
      { property: "og:description", content: "دخول فريق الرشودي للعقارات إلى لوحة التحكم الداخلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState<"staff" | "client">("staff");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const account = await supabase
        .from("client_accounts")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      navigate({ to: account.data ? "/portal" : "/dashboard" });
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (audience === "client") {
        const { email: loginEmail } = await resolveClientLogin({ data: { username } });
        if (!loginEmail) throw new Error("لا يوجد حساب عميل بهذا اسم المستخدم. تواصل مع الإدارة.");
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        navigate({ to: "/portal" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. إن طُلب تأكيد البريد فافتح الرسالة المرسلة إليك.");
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إكمال العملية");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("تعذّر الدخول عبر Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="min-h-screen bg-[#f6f3f1] p-3 sm:grid sm:place-items-center sm:p-6" dir="rtl">
      <div className="grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-card shadow-2xl sm:min-h-[720px] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground sm:p-12 lg:min-h-full">
          <div className="absolute -start-28 -top-28 size-80 rounded-full border border-primary-foreground/10" />
          <div className="absolute -bottom-32 -end-24 size-96 rounded-full border border-primary-foreground/10" />
          <img src={logoAsset.url} alt="الرشودي للعقارات" className="relative h-28 w-fit brightness-0 invert sm:h-36" />
          <div className="relative mt-10 max-w-md">
            <p className="text-sm font-bold text-secondary">بوابة الرشودي الرقمية</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">إدارة عقارية متكاملة، في مكان واحد.</h2>
            <p className="mt-4 text-sm leading-7 text-primary-foreground/75">تابع العقارات والعقود والعملاء والمهام بأمان وسهولة من لوحة موحدة.</p>
            <div className="mt-8 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <span className="flex items-center gap-3"><ShieldCheck className="size-5 text-secondary" /> دخول آمن ومخصص</span>
              <span className="flex items-center gap-3"><Building2 className="size-5 text-secondary" /> بياناتك العقارية لحظيًا</span>
            </div>
          </div>
          <p className="relative mt-8 text-xs text-primary-foreground/55">© الرشودي للعقارات</p>
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <p className="text-sm font-bold text-primary">مرحبًا بعودتك</p>
            <h1 className="mt-2 text-3xl font-black text-foreground">
              {audience === "client" ? "دخول بوابة العميل" : mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب موظف"}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">أدخل بياناتك للوصول إلى حسابك في الرشودي للعقارات.</p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
          {(["staff", "client"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAudience(a)}
              className={`rounded-lg py-2 transition ${audience === a ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {a === "staff" ? "موظف" : "عميل"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {audience === "staff" && mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <div className="relative"><UserRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input
                id="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: محمد الرشودي"
                className="pe-10"
              /></div>
            </div>
          ) : null}

          {audience === "client" ? (
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <div className="relative"><UserRound className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input
                id="username"
                dir="ltr"
                inputMode="numeric"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="1xxxxxxxxx"
                className="pe-10"
              /></div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative"><Mail className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="pe-10"
              /></div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <div className="relative"><LockKeyhole className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input
              id="password"
              type="password"
              dir="ltr"
              required
              minLength={audience === "client" ? 6 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pe-10"
            /></div>
          </div>

          {mode === "signin" ? <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground"><input type="checkbox" className="size-4 accent-primary" /> إبقاء الاتصال</label> : null}

          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {audience === "client" ? "دخول بوابتي" : mode === "signin" ? "دخول" : "إنشاء الحساب"}
          </Button>
        </form>

        {audience === "staff" && mode === "signin" ? (
          <>
            <div className="my-5 flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              أو
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
              الدخول باستخدام Google
            </Button>
          </>
        ) : null}


        {audience === "staff" ? (
          <button
            type="button"
            className="mt-6 w-full text-[13px] text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "ليس لديك حساب؟ إنشاء حساب" : "لدي حساب بالفعل — تسجيل الدخول"}
          </button>
        ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
