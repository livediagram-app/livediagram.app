// Accordion disclosure chevron: points down, rotates 180° when open. Was
// copy-pasted identically into SettingsDialog and ShortcutsDialog (and is
// the natural glyph for any future single-open accordion), so it lives here
// as one definition. Colour comes from `currentColor`, so the parent's text
// colour (or a passed `className`) tints it.
export function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}
