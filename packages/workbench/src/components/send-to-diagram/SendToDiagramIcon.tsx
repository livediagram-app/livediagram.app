'use client';

// Send to Diagram's glyph: livediagram's logo (owner, 2026-11-23), as Send to Plan wears liveplanner's.
import { BrandMark } from '@liveworkspace/brand';

export function SendToDiagramIcon({ size = 16 }: { size?: number }) {
  return <BrandMark app="livediagram" className="shrink-0" style={{ width: size, height: size }} />;
}
