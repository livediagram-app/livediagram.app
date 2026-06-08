import { FONTS, resolveFontStack } from '@/lib/fonts';

// Shared font dropdown (spec/28) used by both the per-element Text
// accordion and the tab-level Current Tab section. A styled native
// <select> so keyboard + accessibility come for free; each option
// previews in its own face, and the closed control renders in the
// currently-selected font. `value` is the stored font id (or null for
// the default option).
export function FontSelect({
  value,
  onChange,
  defaultLabel = 'Default',
  ariaLabel = 'Font',
}: {
  value: string | null;
  onChange: (font: string | null) => void;
  // Label for the "no explicit font" option — "Tab default" for an
  // element, "Default" for the tab itself.
  defaultLabel?: string;
  ariaLabel?: string;
}) {
  const selectedStack = resolveFontStack(value);
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ''}
      // Empty option → null (clear the override / use the default).
      onChange={(e) => onChange(e.target.value || null)}
      onPointerDown={(e) => e.stopPropagation()}
      className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
      style={selectedStack ? { fontFamily: selectedStack } : undefined}
    >
      <option value="">{defaultLabel}</option>
      {FONTS.map((f) => (
        <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
