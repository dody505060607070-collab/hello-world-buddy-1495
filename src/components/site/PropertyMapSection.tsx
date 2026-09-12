import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { PublicProperty } from "@/lib/site-data";

const PropertyMap = lazy(() =>
  import("@/components/site/PropertyMap").then((m) => ({ default: m.PropertyMap })),
);

const Placeholder = () => (
  <section className="mx-auto max-w-6xl px-4 py-14">
    <div className="mx-auto aspect-square w-full max-w-[520px] animate-pulse rounded-full border border-border bg-secondary/60" />
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
