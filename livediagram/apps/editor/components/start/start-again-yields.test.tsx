// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { ModeBanner } from '@/components/chrome/ModeBanner';
import { usePaletteStripBox } from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { StartAgainTray } from './StartAgainTray';

// docs/specs/007-editor/start-diagramming.md "Bringing it back": an empty tab's Show Templates steps aside while a
// mode's message (an armed tool's Cancel) is up, as both stand in the same place under the strip or the Draw dock.
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.innerHTML = '';
});

function mountStrip() {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
  root.append(card);
  document.body.append(root);
}

function TrayBanner() {
  return (
    <ModeBanner
      icon={<span>✎</span>}
      message="Click to place text"
      onAction={() => {}}
      tray={usePaletteStripBox()}
    />
  );
}

describe('Show Templates and a mode message', () => {
  it('without a strip (Draw), the pill yields and the mode banner marks itself', () => {
    dismissEmptyCard('t:draw');
    render(
      <>
        <StartAgainTray mode="draw" tabId="t" tabName="Tab 2" />
        <ModeBanner icon={<span>✎</span>} message="Click to place text" onAction={() => {}} />
      </>,
    );
    expect(document.querySelectorAll('[data-yields-to-mode]')).toHaveLength(1);
    expect(document.querySelector('[data-yields-to-mode]')?.textContent).toMatch(/Tab 2 is empty/);
    expect(document.querySelector('[data-mode-message]')?.textContent).toMatch(
      /Click to place text/,
    );
  });

  it('under the strip, the start-again tray yields and the mode tray marks itself', () => {
    mountStrip();
    dismissEmptyCard('t:diagram');
    render(
      <>
        <StartAgainTray mode="diagram" tabId="t" tabName="Tab 2" />
        <TrayBanner />
      </>,
    );
    const yields = [...document.querySelectorAll('[data-yields-to-mode]')];
    const modes = [...document.querySelectorAll('[data-mode-message]')];
    expect(yields.map((n) => n.textContent)).toEqual([expect.stringMatching(/Tab 2 is empty/)]);
    expect(modes.map((n) => n.textContent)).toEqual([expect.stringMatching(/Click to place text/)]);
  });

  it('globals.css hides the yielding message while a mode message is on the page', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(css).toMatch(
      /body:has\(\[data-mode-message\]\) \[data-yields-to-mode\] \{\s*display: none;\s*\}/,
    );
  });
});
