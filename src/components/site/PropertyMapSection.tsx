import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { PublicProperty } from "@/lib/site-data";

const PropertyMap = lazy(() =>
  import("@/components/site/PropertyMap").then((m) => ({ default: m.PropertyMap })),
);

const Placeholder = () => (
  <section className="mx-auto max-w-6xl px-4 py-14">
    <div className="h-[420px] w-full animate-pulse rounded-xl border border-border bg-secondary/60 sm:h-[520px] lg:h-[600px]" />
  </section>
);

export function PropertyMapSection(props: {
  properties: PublicProperty[] | undefined;
  title?: string;
  description?: string;
}) {
  return (
    <ClientOnly fallback={<Placeholder />}>
      <Suspense fallback={<Placeholder />}>
        <PropertyMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
