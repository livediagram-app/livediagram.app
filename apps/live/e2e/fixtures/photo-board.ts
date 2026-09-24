import type { Page } from '@playwright/test';
import { dismissQuickTour, startTemplateDiagram } from '../fixtures';

// The boundary model's weights, a hashed static asset of the app.
export const BOUNDARY_WEIGHTS = /\/weights\.[^/]*\.bin$/;

// An Event storming board ready for a photo import (spec/139 Phase 8 + 9).
// Capabilities say a model is configured, so the SERVER reader runs: it is
// stubbed to answer blank rather than calling a real provider from a test. The
// detector and its boundary model are real; both are served by the app itself.
//
// `boundaryModel: false` blocks the model's weights, so the classical detector
// runs alone and the model's runtime stays off the wire. A drawn wall is flat,
// so the editor reads it with the classical detector alone either way
// (docs/vision/experiments/o-flat.md); photo-model.spec.ts covers both paths.
export async function openPhotoBoard(
  page: Page,
  opts: { boundaryModel?: boolean } = {},
): Promise<void> {
  if (opts.boundaryModel === false) await page.route(BOUNDARY_WEIGHTS, (route) => route.abort());
  await page.route('**/api/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ aiEnabled: true, emailEnabled: false }),
    });
  });
  await page.route('**/api/ai/read-notes', async (route) => {
    const crops = (JSON.parse(route.request().postData() ?? '{}').crops ?? []) as { id: number }[];
    await route.fulfill({
      json: { texts: crops.map((c) => ({ id: c.id, text: '', legible: false })) },
    });
  });
  // Safety net: no test may pull a reader's weights down the wire.
  await page.route('**/huggingface.co/**', (r) => r.abort());
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort());
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await page.waitForTimeout(500);
}
