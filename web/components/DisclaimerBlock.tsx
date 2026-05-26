import { DISCLAIMER_SHORT, DISCLAIMER_TITLE } from "@/lib/legal";

type DisclaimerBlockProps = {
  compact?: boolean;
};

export function DisclaimerBlock({ compact = false }: DisclaimerBlockProps) {
  return (
    <div className={compact ? "max-w-3xl" : "max-w-3xl"}>
      <p
        className={
          compact
            ? "text-xs leading-relaxed text-slate-500"
            : "text-sm leading-[1.75] text-slate-600 sm:text-[0.9375rem]"
        }
      >
        <span className="font-semibold text-slate-400">{DISCLAIMER_TITLE}: </span>
        {DISCLAIMER_SHORT}
      </p>
    </div>
  );
}
