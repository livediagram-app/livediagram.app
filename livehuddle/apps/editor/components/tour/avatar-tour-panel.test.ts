// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_TOUR_STEPS, tidyAvatarTour } from './avatar-tour-steps';

// docs/specs/008-canvas/avatar-tour.md: the tour leaves the Avatar panel as it found it.

const step = (id: string) => AVATAR_TOUR_STEPS.find((s) => s.id === id)!;
const run = async (id: string) => step(id).prepare?.({});
const panelOpen = () => document.querySelector('[data-tour-id="avatar-character"]') !== null;

beforeEach(() => {
  // jsdom lays nothing out: every element counts as on screen.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  // The Avatar button toggles the panel, as the cluster button does.
  const button = document.createElement('button');
  button.setAttribute('data-tour-id', 'avatar-button');
  button.addEventListener('click', () => {
    const open = document.querySelector('[data-tour-id="avatar-character"]');
    if (open) open.remove();
    else {
      const panel = document.createElement('div');
      panel.setAttribute('data-tour-id', 'avatar-character');
      document.body.append(panel);
    }
  });
  document.body.append(button);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('the Avatar tour and the panel', () => {
  it('reopens a panel the person had open, which the push step closed', async () => {
    document.querySelector<HTMLButtonElement>('[data-tour-id="avatar-button"]')!.click();
    await run('avatar-button');
    await run('character');
    await run('push');
    expect(panelOpen()).toBe(false);
    await run('outro');
    expect(panelOpen()).toBe(true);
  });

  it('closes a panel the tour opened', async () => {
    await run('avatar-button');
    await run('character');
    expect(panelOpen()).toBe(true);
    await run('outro');
    expect(panelOpen()).toBe(false);
  });

  it('on a Skip, closes a panel the tour opened and leaves one the person opened', async () => {
    await run('avatar-button');
    await run('character');
    tidyAvatarTour();
    expect(panelOpen()).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-tour-id="avatar-button"]')!.click();
    // Outside a tour it touches nothing.
    tidyAvatarTour();
    expect(panelOpen()).toBe(true);
  });
});
