import { Glyph } from '@livediagram/ui';
// Glyphs for the Layers panel (docs/specs/006-diagram/layers.md): the row controls (eye / eye-off,
// lock, ellipsis, merge up / down) and the footer add / delete, plus the
// dock-button LayersStackIcon that the CanvasChrome cluster and the mobile
// dock share. Split out of LayersPanel.tsx so the panel file stays focused
// on behaviour; these are pure presentational SVGs with no state.

// The dock-button glyph, exported so the CanvasChrome bottom-right cluster
// (minimised state) and the mobile dock share it. Drawn on a 20-unit grid and
// rendered 1:1 at the cluster's 20px icon size (matching ActivityIcon's stroke
// weight) so it rasterises crisp: the original 14-unit art scaled to 16px
// landed every stroke on fractional pixels and read blurry. The mobile dock
// renders it at its own 16px.
export function LayersStackIcon({ size = 20 }: { size?: number }) {
  return (
    <Glyph size={size} units={20}>
      <path d="M10 3 17 6.6 10 10.2 3 6.6 10 3z" />
      <path d="M3 10.4 10 14 17 10.4" />
      <path d="M3 13.8 10 17.4 17 13.8" />
    </Glyph>
  );
}

export function EyeIcon() {
  return (
    <Glyph size={13} units={14}>
      <path d="M1.5 7S3.5 3.5 7 3.5 12.5 7 12.5 7 10.5 10.5 7 10.5 1.5 7 1.5 7z" />
      <circle cx="7" cy="7" r="1.6" />
    </Glyph>
  );
}

export function EyeOffIcon() {
  return (
    <Glyph size={13} units={14}>
      <path d="M1.5 7S3.5 3.5 7 3.5c.8 0 1.5.18 2.2.46M12.5 7S10.5 10.5 7 10.5c-.8 0-1.5-.18-2.2-.46" />
      <path d="M2.5 11.5l9-9" />
    </Glyph>
  );
}

// `size` defaults to the row control's 12px; the row menu's Lock item draws
// it at 14.
export function LockIcon({ size = 12 }: { size?: number } = {}) {
  return (
    <Glyph size={size} units={14}>
      <rect x="3" y="6" width="8" height="5.5" rx="1" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
    </Glyph>
  );
}

export function EllipsisIcon() {
  return (
    <Glyph size={13} units={14} filled>
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <circle cx="11" cy="7" r="1.2" />
    </Glyph>
  );
}

export function MergeUpIcon() {
  return (
    <Glyph size={12} units={14}>
      <path d="M2.5 2.5h9" />
      <path d="M7 11.5V6M4.5 8.5 7 6l2.5 2.5" />
    </Glyph>
  );
}

export function MergeDownIcon() {
  return (
    <Glyph size={12} units={14}>
      <path d="M2.5 11.5h9" />
      <path d="M7 2.5V8M4.5 5.5 7 8l2.5-2.5" />
    </Glyph>
  );
}

export function PlusIcon() {
  return (
    <Glyph size={11} units={12}>
      <path d="M6 2v8M2 6h8" />
    </Glyph>
  );
}

export function TrashIcon() {
  return (
    <Glyph size={12} units={14}>
      <path d="M2.5 4h9M5.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1m2 0-.5 7a1 1 0 0 1-1 .93h-4a1 1 0 0 1-1-.93L3.5 4" />
    </Glyph>
  );
}
