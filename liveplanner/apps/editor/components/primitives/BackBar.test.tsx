// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedHeightBox } from './AnimatedHeightBox';
import { BackBar } from './BackBar';

// docs/specs/004-interface-design/back-bar.md "Always in view": the bar sticks to the top of its scroller, flush
// with its edge, in every host.
afterEach(cleanup);

describe('BackBar stays in view', () => {
  it('is sticky in both forms', () => {
    render(
      <>
        <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
        <BackBar label="Choose a Space" />
      </>,
    );
    expect(screen.getByRole('button', { name: /Tab Style/ }).className).toMatch(/\bsticky top-0\b/);
    expect(screen.getByText('Choose a Space').className).toMatch(/\bsticky top-0\b/);
  });

  it('lifts itself by the scroller top padding, so nothing shows above it once stuck', () => {
    render(
      <div style={{ overflowY: 'auto', paddingTop: '8px' }}>
        <div>
          <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
        </div>
      </div>,
    );
    expect(screen.getByRole('button', { name: /Tab Style/ }).style.top).toBe('-8px');
  });

  it('is not trapped by an AnimatedHeightBox: uncapped, it clips without making a scroll box', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    render(
      <AnimatedHeightBox viewKey="colours">
        <BackBar label="Tab Style" current="Colours" onClick={() => {}} />
      </AnimatedHeightBox>,
    );
    const box = screen.getByRole('button', { name: /Tab Style/ }).closest('.overflow-clip');
    expect(box).not.toBeNull();
    expect(box!.className).not.toMatch(/overflow-hidden/);
    vi.unstubAllGlobals();
  });

  it('keeps top 0 when a clipping box sits between it and the scroller', () => {
    render(
      <div style={{ overflowY: 'auto', paddingTop: '20px' }}>
        <div style={{ overflowY: 'hidden' }}>
          <BackBar label="Choose a Space" />
        </div>
      </div>,
    );
    expect(screen.getByText('Choose a Space').style.top).toBe('');
  });

  it('keeps top 0 with no scroller above it', () => {
    render(<BackBar label="Tab Style" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Tab Style/ }).style.top).toBe('');
  });
});
