// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInlineScript } from '@liveplanner/vitest-config/inline-script';
import {
  EARLY_MODE_ATTRIBUTE,
  EARLY_MODE_SCRIPT,
  EARLY_MODE_STYLE,
  takeEarlyModeChoice,
} from './early-mode-choice';

// The page's inline script, run as the browser would, with the page's window and document.
const runScript = () => runInlineScript(EARLY_MODE_SCRIPT, { window, document });

let root: HTMLDivElement;
let reactSaw: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  delete (window as unknown as Record<string, unknown>).__lvdEarlyMode;
  // React's listeners sit on the root container, below window.
  root = document.createElement('div');
  root.innerHTML =
    '<button data-new-mode="draw"><span>Draw</span></button><button id="other">Other</button>';
  document.body.appendChild(root);
  reactSaw = vi.fn<() => void>();
  root.addEventListener('click', () => reactSaw());
});

afterEach(() => {
  root.remove();
  document.documentElement.removeAttribute(EARLY_MODE_ATTRIBUTE);
});

const click = (selector: string) => {
  root.querySelector<HTMLElement>(selector)!.click();
};

describe('a mode chosen before hydration', () => {
  it('is kept and answered once, and the card never also handles it', () => {
    runScript();
    click('[data-new-mode="draw"] span');
    expect(reactSaw).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(EARLY_MODE_ATTRIBUTE)).toBe(true);
    expect(takeEarlyModeChoice()).toBe('draw');
    expect(document.documentElement.hasAttribute(EARLY_MODE_ATTRIBUTE)).toBe(false);
    expect(takeEarlyModeChoice()).toBeNull();
  });

  it('lets every click through once the wizard has taken over', () => {
    runScript();
    expect(takeEarlyModeChoice()).toBeNull();
    click('[data-new-mode="draw"]');
    expect(reactSaw).toHaveBeenCalledTimes(1);
    expect(takeEarlyModeChoice()).toBeNull();
  });

  it('leaves clicks on anything but a mode card alone', () => {
    runScript();
    click('#other');
    expect(reactSaw).toHaveBeenCalledTimes(1);
    expect(takeEarlyModeChoice()).toBeNull();
  });

  it('keeps the last card chosen, and listens once however often the script runs', () => {
    runScript();
    runScript();
    root.insertAdjacentHTML('beforeend', '<button data-new-mode="plan">Plan</button>');
    click('[data-new-mode="draw"]');
    click('[data-new-mode="plan"]');
    expect(takeEarlyModeChoice()).toBe('plan');
  });

  it('answers nothing for a value that is not a mode, or with no script', () => {
    expect(takeEarlyModeChoice()).toBeNull();
    delete (window as unknown as Record<string, unknown>).__lvdEarlyMode;
    runScript();
    root.insertAdjacentHTML('beforeend', '<button data-new-mode="nope">?</button>');
    click('[data-new-mode="nope"]');
    expect(takeEarlyModeChoice()).toBeNull();
  });

  it('shows the page is working only while a choice waits', () => {
    expect(EARLY_MODE_STYLE).toContain(`html[${EARLY_MODE_ATTRIBUTE}]`);
  });
});
