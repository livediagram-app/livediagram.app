// Helpers the editor's tours share. The Diagram tab's own tour is Watch It Built (docs/specs/007-editor/watch-it-built.md);
// its stepped predecessor's steps lived here until November 2026.

import { waitForSelector } from '@liveworkspace/workbench/components/tour/tour-dom';
import { stepTelemetryType } from '@liveworkspace/workbench/components/tour/tour-step';

// Telemetry `type` token for a step or chapter viewed: 'connect' → 'TourStepConnect'.
export function tourStepTelemetryType(stepId: string): string {
  return stepTelemetryType('TourStep', stepId);
}

// Wait for the palette strip (docs/specs/007-editor/toolbar-layout.md), always open while the
// chrome is up, so callers can chain.
export async function ensurePaletteOpen() {
  await waitForSelector('[data-tour-id="palette"]');
}
