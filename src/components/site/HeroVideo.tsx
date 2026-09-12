import { Link } from "@tanstack/react-router";
import { KeyRound, Home } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import desktopVideo from "@/assets/hero-desktop.mp4.asset.json";
import mobileVideo from "@/assets/hero-mobile.mp4.asset.json";

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ended, setEnded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const src = isMobile ? mobileVideo.url : desktopVideo.url;

  return (
    <section className="relative isolate overflow-hidden bg-foreground">
      <video
        key={src}
        ref={videoRef}
        src={src}
        autoPlay
        muted
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && el.currentTime >= el.duration - 0.35) setEnded(true);
        }}
        onEnded={() => {
          setEnded(true);
          videoRef.current?.pause();
        }}
        className="h-[68vh] min-h-[420px] w-full object-cover md:h-[80vh]"
      />

      {/* Cinematic scrim so the wordmark stays legible on any frame */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 transition-opacity duration-1000 ${
          ended ? "opacity-100" : "opacity-60"
        }`}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 pb-12 text-center">
            <h1 className="animate-pop-in max-w-full font-display text-4xl font-extrabold leading-tight text-primary-foreground drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
              الرشودي للعقارات
            </h1>
            <p
              className="animate-pop-in max-w-2xl text-[15px] font-semibold leading-8 text-primary-foreground/85 md:text-[19px]"
              style={{ animationDelay: "220ms" }}
            >
              نبني قرارك العقاري على معرفة حقيقية بسوق القصيم — عقار مدروس، عقد واضح، ومتابعة لا
              تتوقف.
            </p>
            <div
              className="animate-pop-in pointer-events-auto mt-2 flex flex-wrap items-center justify-center gap-3"
              style={{ animationDelay: "420ms" }}
            >
              <Link
                to="/rent"
                className="shine inline-flex items-center gap-2 rounded-xl bg-card/95 px-7 py-3.5 text-[14.5px] font-bold text-card-foreground"
              >
                <KeyRound className="size-4" />
                عقارات الإيجار
              </Link>
              <Link
                to="/sale"
                className="shine glass-dark inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-[14.5px] font-bold text-primary-foreground"
              >
                <Home className="size-4" />
                عقارات البيع
              </Link>
            </div>
      </div>

      {/* Scroll cue */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-5 left-1/2 h-10 w-6 -translate-x-1/2 rounded-full border border-primary-foreground/45"
      >
        <span className="absolute left-1/2 top-2 size-1.5 -translate-x-1/2 animate-bounce rounded-full bg-primary-foreground/80" />
      </span>
    </section>
  );
}
