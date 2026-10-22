// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

// docs/specs/007-editor/start-diagramming.md
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (onTemplate = vi.fn(), tabId = 't1') =>
  render(<StartFromTemplates mode="pages" tabId={tabId} onTemplate={onTemplate} />);

describe('StartFromTemplates', () => {
  it('names its start', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('lands a chosen template', () => {
    const onTemplate = vi.fn();
    mount(onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="blank-slide-deck"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank-slide-deck');
  });

  it('remembers a close per tab', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
    cleanup();
    mount();
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
    cleanup();
    mount(vi.fn(), 't2');
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('closes on Escape once its search has nothing to clear', () => {
    mount();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'slide' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start Making Pages' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount();
    expect(frameOf().className).toContain('max-sm:pb-[calc(var(--start-floor)-8px)]');
    expect(frameOf().style.getPropertyValue('--start-floor')).toBe('16px');
  });

  it('stands on the tab bar where it shows', () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-editor-tabbar', '');
    bar.getBoundingClientRect = () =>
      ({ top: 616, left: 0, right: 390, width: 390, height: 48 }) as DOMRect;
    document.body.appendChild(bar);
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 664);
    try {
      mount();
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount();
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="wireframes"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});
