import { Glyph } from '@livediagram/ui';
// Accordion disclosure chevron: points down, rotates 180° when open. Was
// copy-pasted identically into SettingsDialog and ShortcutsDialog (and is
// the natural glyph for any future single-open accordion), so it lives here
// as one definition. Colour comes from `currentColor`, so the parent's text
// colour (or a passed `className`) tints it.
export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <Glyph
      size={12}
      units={12}
      className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <path d="M2 4l4 4 4-4" />
    </Glyph>
  );
}
