import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CaptureClient, { type CaptureItem } from "@/components/CaptureClient";
import { aiEngine } from "@/lib/ai";
import { AREA_LABEL, getTemplate, riskNotes } from "@/lib/checklist";
import { getDict } from "@/lib/i18n";
import { CONSTRUCTION_LABEL, PROPERTY_TYPE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { getBundle } from "@/lib/repo";
import { readyToSubmit } from "@/lib/report";
import { getLang } from "@/lib/server/session";
import type { InspectionStatus } from "@/lib/types";
import { formatAddress } from "@/lib/postcodes";

const STATUS_ICON: Record<InspectionStatus, string> = {
  capturing: "bi-camera",
  in_review: "bi-hourglass-split",
  ai_report: "bi-file-earmark-text",
  verified: "bi-patch-check",
};

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  if (bundle.inspection.kind === "annual") redirect(`/inspections/${id}/annual`);
  const lang = await getLang();
  const t = getDict(lang);
  const { inspection } = bundle;

  const propertyLine = [
    PROPERTY_TYPE_LABEL[inspection.propertyType][lang],
    `${t.shBuilt} ${inspection.buildYear}`,
    `${inspection.sizeM2.toLocaleString(lang === "is" ? "is-IS" : "en-GB")}\u00a0m²`,
    CONSTRUCTION_LABEL[inspection.construction][lang],
  ].join(" · ");

  if (inspection.status !== "capturing") {
    const canView = inspection.status === "ai_report" || inspection.status === "verified";
    // Where the inspection is in its flow: photos → (inspector review →) report.
    const flow: { key: InspectionStatus; label: string }[] =
      inspection.tier === "verified"
        ? [
            { key: "capturing", label: t.captureTitle },
            { key: "in_review", label: t.reviewTitle },
            { key: "verified", label: t.reportTitle },
          ]
        : [
            { key: "capturing", label: t.captureTitle },
            { key: "ai_report", label: t.reportTitle },
          ];
    const current = flow.findIndex((s) => s.key === inspection.status);
    const finished = canView;
    return (
      <div className="sh-page sh-fill bg-surface-2">
        <div className="container sh-status-page">
          <article className="sh-status-card">
            <span className={`sh-status-icon is-${inspection.status}`} aria-hidden>
              <i className={`bi ${STATUS_ICON[inspection.status]}`} />
            </span>
            <p className="sh-status-pill">{STATUS_LABEL[inspection.status][lang]}</p>
            <h1 className="sh-status-title">
              {formatAddress(inspection.address, inspection.postalCode)}
            </h1>
            <p className="sh-status-meta">{propertyLine}</p>

            {current >= 0 && (
              <ol className="sh-flow">
                {flow.map((s, i) => {
                  const state = i < current || (i === current && finished) ? "done" : i === current ? "current" : "todo";
                  return (
                    <li key={s.key} className={`sh-flow-step is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                      <span className="sh-flow-dot" aria-hidden>
                        {state === "done" ? <i className="bi bi-check-lg" /> : state === "current" ? <i className="bi bi-hourglass-split" /> : i + 1}
                      </span>
                      <span className="sh-flow-label">{s.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {inspection.status === "in_review" && (
              <div className="sh-callout sh-callout-info text-start">
                <i className="bi bi-envelope" aria-hidden />
                <div>{t.submittedVerified}</div>
              </div>
            )}
            {canView && (
              <Link href={`/inspections/${id}/report`} className="btn btn-primary btn-lg">
                <i className="bi bi-file-earmark-text me-2" aria-hidden />
                {t.viewReport}
              </Link>
            )}
          </article>
        </div>
      </div>
    );
  }

  const notes = riskNotes(inspection);
  const items: CaptureItem[] = bundle.items.flatMap((item) => {
    const tpl = getTemplate(item.itemKey);
    if (!tpl) return [];
    return [
      {
        key: item.itemKey,
        area: tpl.area,
        areaLabel: AREA_LABEL[tpl.area][lang],
        title: tpl.title[lang],
        instructions: tpl.instructions[lang],
        minPhotos: tpl.minPhotos,
        status: item.status,
        notes: item.notes,
        notAccessible: item.notAccessible,
        naReason: item.naReason,
        analysis: item.analysis,
        photoIds: bundle.photos.filter((p) => p.itemKey === item.itemKey).map((p) => p.id),
        photoChecks: Object.fromEntries(
          bundle.photos.filter((p) => p.itemKey === item.itemKey).map((p) => [p.id, { status: p.checkStatus, reason: p.checkReason }]),
        ),
        findings: bundle.findings.filter((f) => f.itemKey === item.itemKey),
        focus: notes.filter((n) => n.itemKeys.includes(item.itemKey)).map((n) => n.text[lang]),
      },
    ];
  });
  const ready = readyToSubmit(bundle);
  const missingTitles = ready.missing.map((k) => getTemplate(k)?.title[lang] ?? k);

  return (
    <CaptureClient
      inspectionId={id}
      lang={lang}
      tier={inspection.tier}
      address={formatAddress(inspection.address, inspection.postalCode)}
      propertyLine={propertyLine}
      items={items}
      focusNotes={notes.filter((n) => n.itemKeys.length === 0).map((n) => n.text[lang])}
      demo={aiEngine() === "mock"}
      missingTitles={missingTitles}
      missingKeys={ready.missing}
    />
  );
}
