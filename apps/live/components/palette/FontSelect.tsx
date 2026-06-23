import { FONTS } from '@/lib/fonts';
import { SizeButton } from '@/components/palette/palette-controls';

// Shared font picker (spec/28) used by the Tab Appearance menu's Font
// category. A compact 2-column grid of tiles rather than a native <select>:
// each tile renders the font's NAME in its own typeface, so the list is a
// genuine preview ("Caveat" looks like Caveat) instead of a row of look-alike
// names you have to guess between. Native <option> font-family is ignored by
// macOS / several browsers, which is exactly the guesswork this removes.
// `value` is the stored font id (or null for the default option).
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
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-cols-2 gap-1">
      {/* Default option in the plain UI font — it's the absence of a face, so
          there's nothing to preview. */}
      <SizeButton active={value == null} onClick={() => onChange(null)}>
        <span className="truncate">{defaultLabel}</span>
      </SizeButton>
      {FONTS.map((f) => (
        <SizeButton key={f.id} active={value === f.id} onClick={() => onChange(f.id)}>
          {/* The name rendered in its own face — the whole point: read the
              voice, don't guess from the label. */}
          <span className="truncate" style={{ fontFamily: f.stack }}>
            {f.label}
          </span>
        </SizeButton>
      ))}
    </div>
  );
}
