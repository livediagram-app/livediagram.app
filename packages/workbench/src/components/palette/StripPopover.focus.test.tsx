// @vitest-environment jsdom
// A strip popover focuses its first text field when it opens, at every width; only a touch screen waits for a tap
// (docs/specs/007-editor/toolbar-layout.md "Search", Work Tracker 1224).
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StripPopover, touchScreen } from './ToolbarStripPopover';

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const touch = (on: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: on && query === '(pointer: coarse)', media: query })),
  );

function open(isMobile: boolean, body = <input aria-label="Search" />) {
  render(
    <StripPopover right={0} isMobile={isMobile} scale={1} dataAttr="data-test-popover">
      {body}
    </StripPopover>,
  );
}

describe('a strip popover’s field focus', () => {
  it('focuses the field on a desktop and in a phone-width window alike', () => {
    for (const isMobile of [false, true]) {
      touch(false);
      open(isMobile);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
      cleanup();
    }
  });

  it('leaves it for a tap on a touch screen', () => {
    touch(true);
    open(true);
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Search' }));
  });

  it('focuses a field its body mounts a beat later', async () => {
    touch(false);
    function Late() {
      const [ready, setReady] = useState(false);
      useEffect(() => {
        const t = setTimeout(() => setReady(true), 0);
        return () => clearTimeout(t);
      }, []);
      return ready ? <input aria-label="Late" /> : <p>Loading</p>;
    }
    open(false, <Late />);
    await act(async () => new Promise((r) => setTimeout(r, 5)));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Late' }));
  });

  it('reads no touch screen outside a browser’s media queries', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(touchScreen()).toBe(false);
  });
});
