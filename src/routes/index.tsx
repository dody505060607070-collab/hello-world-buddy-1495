import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import socialCard from "@/assets/rushdy-social-card.jpg.asset.json";
import { HeroVideo } from "@/components/site/HeroVideo";
import { PropertyGrid } from "@/components/site/PropertyCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { publicPropertiesQuery } from "@/lib/site-data";

const SITE_URL = "https://mitharfinale.lovable.app";
const SOCIAL_IMAGE = `${SITE_URL}${socialCard.url}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
      {
        name: "description",
        content:
          "الرشودي للعقارات في بريدة: شقق وفلل ومعارض للإيجار والبيع، خبرة محلية تفوق 8 سنوات وخدمة سريعة عبر واتساب.",
      },
      { property: "og:title", content: "الرشودي للعقارات | عقارات بريدة للإيجار والبيع" },
      {
        property: "og:description",
        content: "خبرة محلية في سوق عقارات بريدة: إيجار، بيع، إدارة أملاك ومتابعة عقود.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "شعار الرشودي للعقارات" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: SOCIAL_IMAGE },
      { name: "twitter:image:alt", content: "شعار الرشودي للعقارات" },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: HomePage,
});

function HomePage() {
  const all = useQuery(publicPropertiesQuery(undefined, 200));

  const [purpose, setPurpose] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [rentPeriod, setRentPeriod] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const types = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.property_type).filter(Boolean))] as string[],
    [all.data],
  );
  const districts = useMemo(
    () => [...new Set((all.data ?? []).map((p) => p.district).filter(Boolean))] as string[],
    [all.data],
  );
  const rentPeriods = ["سنوي", "شهري", "يومي"];

  const results = useMemo(() => {
    if (!searchSubmitted) return null;
    return (all.data ?? []).filter(
      (p) =>
        (!purpose || p.purpose === purpose) &&
        (!type || p.property_type === type) &&
        (!district || p.district === district) &&
        (!rentPeriod || `${p.name} ${p.description ?? ""} ${p.price_text ?? ""}`.includes(rentPeriod)),
    );
  }, [all.data, purpose, type, district, rentPeriod, searchSubmitted]);


  return (
    <SiteLayout>
      <HeroVideo
        types={types}
        districts={districts}
        rentPeriods={rentPeriods}
        type={type}
        district={district}
        rentPeriod={rentPeriod}
        onTypeChange={setType}
        onDistrictChange={setDistrict}
        onRentPeriodChange={setRentPeriod}
        onSearch={() => {
          setPurpose(rentPeriod ? "rent" : "");
          setSearchSubmitted(true);
          window.setTimeout(() => document.querySelector("#search-results")?.scrollIntoView({ behavior: "smooth" }), 0);
        }}
      />

      {results ? (
        <section id="search-results" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
          <h2 className="mb-6 text-[22px] font-bold text-foreground">نتائج البحث</h2>
          <PropertyGrid
            properties={results}
            loading={all.isLoading}
            error={all.error}
            emptyText="لا توجد عقارات مطابقة لبحثك حالياً."
          />
        </section>
      ) : null}

    </SiteLayout>
  );
}
