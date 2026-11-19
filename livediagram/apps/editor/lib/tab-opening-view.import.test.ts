// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importDrawio } from './drawio/import';
import { PHONE_READABLE_ZOOM, tabOpeningView } from './tab-opening-view';

// docs/specs/008-canvas/canvas-and-palette.md "On a phone the opening view focuses on the main element": an import
// lands the way a template does (useTabImport asks for the same landing view, never plain 100%).

const phoneCanvas = () => {
  const node = document.createElement('main');
  node.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 390, bottom: 700, width: 390, height: 700 }) as DOMRect;
  document.body.append(node);
  return node;
};

afterEach(() => document.body.replaceChildren());

describe('the view an imported draw.io diagram lands on', () => {
  it('is never past the readable zoom on a phone, and is the fitted view when that already reads', async () => {
    const text = readFileSync(
      join(__dirname, 'drawio/__fixtures__/cloud-architecture.drawio'),
      'utf8',
    );
    const result = await importDrawio({ kind: 'text', text }, { tabIdForPage: () => 'tab-1' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const elements = result.pages[0]!.elements;
    const view = tabOpeningView(phoneCanvas(), elements, true);
    expect(view).not.toBeNull();
    // Fitted to the screen, or held at the readable minimum when the whole diagram would be smaller: never 100%.
    expect(view!.zoom).toBeLessThan(1);
    const fit = tabOpeningView(phoneCanvas(), elements, false)!;
    // Off a phone it is the fit; on one it is the fit if that reads, otherwise exactly the readable minimum.
    expect(view!.zoom).toBe(fit.zoom >= PHONE_READABLE_ZOOM ? fit.zoom : PHONE_READABLE_ZOOM);
  });
});
