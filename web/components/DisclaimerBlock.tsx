import {
  DISCLAIMER_SHORT,
  DISCLAIMER_TITLE,
  FRESHNESS_POLICY_PARAGRAPHS,
  FRESHNESS_POLICY_TITLE,
} from "@/lib/legal";

type DisclaimerBlockProps = {
  compact?: boolean;
};

export function DisclaimerBlock({ compact = false }: DisclaimerBlockProps) {
  const textClass = compact
    ? "text-xs leading-relaxed text-slate-500"
    : "text-sm leading-[1.75] text-slate-600 sm:text-[0.9375rem]";

  return (
    <div className="max-w-3xl space-y-4">
      <p className={textClass}>
        <span className="font-semibold text-slate-400">{DISCLAIMER_TITLE}: </span>
        {DISCLAIMER_SHORT}
      </p>

      <div className={textClass}>
        <p className="font-semibold text-slate-400">{FRESHNESS_POLICY_TITLE}</p>
        {FRESHNESS_POLICY_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="mt-2">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
