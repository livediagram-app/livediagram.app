// An estimate card nobody has picked on yet (docs/specs/012-collaboration/estimate-card.md "The look"): a quiet
// line of face-down ghost cards that breathe, over the promise that a pick
// stays hidden until the reveal.

import { tint } from '../collab-chrome';

export function EstimateEmpty({ textColor, canPick }: { textColor: string; canPick: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="qa-ghost h-[46px] w-[34px] rounded-lg"
            style={{ backgroundColor: tint(textColor, 0.07), animationDelay: `${i * 250}ms` }}
          />
        ))}
      </div>
      <p className="text-[12.5px] font-semibold leading-tight" style={{ color: textColor }}>
        No picks yet
      </p>
      {canPick ? (
        <p
          className="-mt-2 max-w-[30ch] text-[11px] leading-relaxed"
          style={{ color: textColor, opacity: 0.55 }}
        >
          Your pick stays hidden from everyone until the reveal.
        </p>
      ) : null}
    </div>
  );
}
