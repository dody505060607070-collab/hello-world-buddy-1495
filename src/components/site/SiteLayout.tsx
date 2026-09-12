import { Link, useRouterState } from "@tanstack/react-router";
import { Clock, Heart, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import footerImage from "@/assets/bg-footer.jpg";
import logoAsset from "@/assets/rashudi-logo.webp.asset.json";
import logoWhiteAsset from "@/assets/rashudi-logo-white.png.asset.json";
import { FloatingActions, ScrollProgress } from "@/components/site/Chrome";
import { AiWidget } from "@/components/site/AiWidget";
import { useSession } from "@/hooks/useAuth";
import { COMPANY_EMAIL, COMPANY_PHONE } from "@/lib/site-data";
import { ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/rent", label: "قسم الإيجار" },
  { to: "/sale", label: "قسم البيع" },
  { to: "/about", label: "من نحن" },
  { to: "/contact", label: "تواصل معنا" },
] as const;

function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-primary-foreground/10 bg-primary text-primary-foreground shadow-md">
      <div className="relative mx-auto flex h-[74px] max-w-6xl items-center justify-between gap-4 px-4">
        {/* يمين الشريط: روابط الصفحات */}
        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative py-1 text-[14px] transition-opacity hover:opacity-100",
                pathname === item.to
                  ? "font-bold opacity-100 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gold"
                  : "opacity-80",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* منتصف الشريط: الشعار الأبيض */}
        <Link
          to="/"
          aria-label="الرشودي للعقارات"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <img
            src={logoWhiteAsset.url}
            alt="الرشودي للعقارات"
            width={360}
            height={112}
            className="h-11 w-auto transition-transform duration-300 hover:scale-105 md:h-14"
          />
        </Link>

        {/* يسار الشريط: زر اعرض/اطلب + أدوات */}
        <div className="flex items-center gap-2">
          <Link
            to="/list-property"
            className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-primary-foreground/40 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-primary-foreground/10"
          >
            اعرض | اطلب عقارك
          </Link>
          <ThemeToggle className="hidden border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 sm:inline-flex" />
          <Link
            to="/favorites"
            aria-label="المفضلة"
            className="hidden size-9 place-items-center rounded-full border border-primary-foreground/30 transition-colors hover:bg-primary-foreground/10 sm:grid"
          >
            <Heart className="size-4.5" />
          </Link>
          <Link
            to={session ? "/dashboard" : "/auth"}
            className="hidden shrink-0 whitespace-nowrap rounded-full bg-gold px-4 py-2 text-[13px] font-bold text-gold-foreground transition-opacity hover:opacity-90 md:inline-flex"
          >
            {session ? "لوحة التحكم" : "تسجيل الدخول"}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="القائمة"
            className="grid size-9 place-items-center rounded-full border border-primary-foreground/30 lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-primary-foreground/15 lg:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-3">
            {navLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-2.5 text-[14px] hover:bg-primary-foreground/10"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/list-property"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2 py-2.5 text-[14px] hover:bg-primary-foreground/10"
              >
                اعرض | اطلب عقارك
              </Link>
            </li>
            <li className="mt-2 border-t border-primary-foreground/15 pt-3">
              <ThemeToggle showLabel className="w-full justify-center border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20" />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden text-white">
      <img
        src={footerImage}
        alt=""
        aria-hidden
        width={1920}
        height={1080}
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary/80" />

      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Link to="/" aria-label="الرشودي للعقارات" className="inline-block">
          <img
            src={logoAsset.url}
            alt="الرشودي للعقارات"
            width={680}
            height={510}
            loading="lazy"
            className="mx-auto h-24 w-auto md:h-32"
          />
        </Link>

        <p className="mt-5 text-[14px] leading-7 text-white/85">
          الرشودي للعقارات — إيجار وبيع وإدارة أملاك في بريدة، القصيم.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13.5px] text-white/90">
          <a href={`tel:${COMPANY_PHONE}`} dir="ltr" className="flex items-center gap-2 hover:text-gold">
            <Phone className="size-4 text-gold" />
            {COMPANY_PHONE}
          </a>
          <a href={`mailto:${COMPANY_EMAIL}`} dir="ltr" className="flex items-center gap-2 hover:text-gold">
            <Mail className="size-4 text-gold" />
            {COMPANY_EMAIL}
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="size-4 text-gold" />
            بريدة — القصيم
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-gold" />
            السبت — الخميس 9ص — 10م
          </span>
        </div>

        <nav className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/80">
          {[
            ...navLinks.slice(1),
            { to: "/list-property", label: "اعرض | اطلب عقارك" },
            { to: "/favorites", label: "المفضلة" },
            { to: "/privacy", label: "سياسة الخصوصية" },
            { to: "/terms", label: "الشروط والأحكام" },
          ].map(
            (item) => (
              <Link key={item.to} to={item.to} className="hover:text-gold">
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <p className="mt-8 text-[12px] text-white/60">
          جميع الحقوق محفوظة © {new Date().getFullYear()} — مؤسسة الرشودي للعقارات
        </p>
      </div>
    </footer>
  );
}


function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cookie-consent") !== "accepted") setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-4 shadow-float">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
        <p className="flex-1 text-[13px] leading-6 text-muted-foreground">
          نستخدم ملفات تعريف الارتباط (Cookies) لتحسين تجربتك وتذكّر تفضيلاتك أثناء تصفح العقارات.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
          >
            موافق
          </button>
        </div>
      </div>
    </div>
  );
}


export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingActions />
      <AiWidget />
      <CookieBanner />
    </div>
  );
}
