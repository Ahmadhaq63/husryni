"use client";

import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/types";

const OPTIONS: { value: Lang; short: string; name: string }[] = [
  { value: "is", short: "IS", name: "Íslenska" },
  { value: "en", short: "EN", name: "English" },
];

/** Compact segmented IS/EN control (styles: .sh-lang in src/styles/shell.css). */
export default function LangSwitch({ lang }: { lang: Lang }) {
  const router = useRouter();
  const set = (l: Lang) => {
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <div className="sh-lang" role="group" aria-label="Language / Tungumál">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          className={`sh-lang-btn${lang === o.value ? " is-active" : ""}`}
          aria-pressed={lang === o.value}
          aria-label={o.name}
          title={o.name}
          onClick={() => set(o.value)}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
