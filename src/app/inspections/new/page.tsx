import NewInspectionForm from "@/components/NewInspectionForm";
import { getDict } from "@/lib/i18n";
import { getLang } from "@/lib/server/session";
import type { Tier } from "@/lib/types";

export default async function NewInspectionPage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const lang = await getLang();
  const t = getDict(lang);
  const { tier } = await searchParams;
  const initialTier: Tier = tier === "basic" ? "basic" : "verified";
  return (
    <div className="sh-page sh-fill bg-surface-2">
      <div className="container sh-order-page">
        <header className="sh-page-head">
          <p className="eyebrow">{t.sectionOrder}</p>
          <h1 className="sh-page-title">{t.newTitle}</h1>
          <p className="sh-page-lead">{t.newLead}</p>
        </header>
        <NewInspectionForm lang={lang} initialTier={initialTier} />
      </div>
    </div>
  );
}
