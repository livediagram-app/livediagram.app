'use client';

// The tab's canvas style behind a form link's page (docs/specs/030-forms/forms.md "Look"): the pattern in the
// respondent's half, fixed to the window so it stays put as the form scrolls. Loaded only for a form that has one.
import type { FormCanvas } from '@liveplanner/document';
import { useAppearance } from '@liveplanner/ui';
import { TabPatternLayer } from '@/components/canvas/TabPatternLayer';

export function FormCanvasLayer({ canvas }: { canvas: FormCanvas }) {
  const { appearance } = useAppearance();
  return (
    <TabPatternLayer
      pattern={canvas.pattern}
      color={canvas.color[appearance]}
      scale={canvas.scale}
      speed={canvas.speed}
      opacity={canvas.opacity}
      className="fixed inset-0"
    />
  );
}
