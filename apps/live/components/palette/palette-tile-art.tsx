import { trustedHtml } from '@liveplanner/ui';
// Tile pictures that are art, not icons (docs/specs/004-interface-design/iconography.md, "Art"):
// the code block's fixed dark card and the embed providers' marks. They keep their own paint.

// The code block's dark editor card with angle brackets; it stays untinted like the element.
export function CodeBlockTileArt() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" fill="rgb(15 23 42)" />
      <path
        d="M7 7 L5 9 L7 11 M11 7 L13 9 L11 11"
        fill="none"
        stroke="rgb(148 163 184)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YouTubeTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: trustedHtml(
          `<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10.5 8.75 16 12l-5.5 3.25z" fill="#ffffff" />`,
        ),
      }}
    />
  );
}

export function VimeoTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: trustedHtml(
          `<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M7 9c1.6-1.5 3 .4 3.4 2 .5 2 1 3.6 2 1.4C13.6 9.9 12.4 8 15 8c2 0 2.4 2.2 1.3 4.4C15 15.4 12.6 17 11 16c-1.7-1-2-4.2-2.6-5.4-.4-.8-.9-.4-1.4 0z" fill="currentColor" stroke="none" />`,
        ),
      }}
    />
  );
}

export function LoomTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: trustedHtml(
          `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /><path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
        ),
      }}
    />
  );
}

export function FigmaTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: trustedHtml(
          `<rect x="7" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="12" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="8.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><circle cx="14.5" cy="11.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="14.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" />`,
        ),
      }}
    />
  );
}
