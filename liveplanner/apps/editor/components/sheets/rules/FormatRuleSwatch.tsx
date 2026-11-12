// A small "123" drawn in a Conditional Formatting rule's style, or its scale's gradient (SheetFormatRules.tsx).
import type { FormatRule } from '@liveplanner/sheets';

export function Swatch({
  rule,
}: {
  rule: Pick<FormatRule, 'is' | 'style' | 'min' | 'mid' | 'max'>;
}) {
  if (rule.is === 'scale')
    return (
      <span
        aria-hidden
        className="inline-block h-5 w-9 shrink-0 rounded border border-black/10"
        style={{
          background: `linear-gradient(90deg, ${[rule.min?.c, rule.mid?.c, rule.max?.c].filter(Boolean).join(', ')})`,
        }}
      />
    );
  const s = rule.style ?? {};
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-9 shrink-0 items-center justify-center rounded border border-black/10 text-[11px]"
      style={{
        backgroundColor: s.bg ?? '#ffffff',
        color: s.fc ?? '#1f2937',
        fontWeight: s.b ? 700 : 400,
        fontStyle: s.i ? 'italic' : undefined,
        textDecoration:
          [s.u ? 'underline' : '', s.st ? 'line-through' : ''].filter(Boolean).join(' ') ||
          undefined,
      }}
    >
      123
    </span>
  );
}
