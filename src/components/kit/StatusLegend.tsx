import { legendItems, toneDotClass } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export function StatusLegend({ className }: { className?: string }) {
  return (
    <div
      dir="rtl"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11.5px] text-muted-foreground",
        className,
      )}
    >
      <span className="font-bold text-foreground">دليل الألوان:</span>
      {legendItems.map((item) => (
        <span key={item.tone} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", toneDotClass[item.tone])} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
