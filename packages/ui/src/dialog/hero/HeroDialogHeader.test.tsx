// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroDialogHeader } from './HeroDialogHeader';
import { HERO_PLACE, heroTexture, type HeroArt } from './hero-art';

// liveworkspace/docs/specs/004-index/dialog-hero-header.md: the frame every dialog's hero header is drawn in.
const plain: HeroArt = {
  name: 'test',
  glyph: <circle cx="10" cy="10" r="4" fill="var(--hero-accent)" />,
  texture: heroTexture('dots'),
  pieces: <svg className={HERO_PLACE.bottomLeft} />,
};
const withCentre: HeroArt = { ...plain, name: 'centred', centre: true };

function header(props: Partial<Parameters<typeof HeroDialogHeader>[0]> = {}) {
  return render(
    <HeroDialogHeader
      art={plain}
      titleId="t"
      title="Share This Plan"
      subtitle="Private"
      {...props}
    />,
  );
}

describe('the dialog hero header', () => {
  it('titles the dialog with a real heading, by id, in the app’s heading face', () => {
    header();
    const h2 = screen.getByRole('heading', { level: 2, name: 'Share This Plan' });
    expect(h2.id).toBe('t');
    expect(h2.className).toContain('[font-family:var(--hero-heading-family)]');
    expect(h2.className).toContain('[font-weight:var(--hero-heading-weight,800)]');
    expect(h2.className).toContain('text-[20px]');
    expect(h2.className).toContain('max-sm:text-[18px]');
    // One line from sm, never wrapping the band taller; up to two on a phone, where the header is not fixed.
    expect(h2.className).toContain('sm:truncate');
    expect(h2.className).toContain('max-sm:line-clamp-2');
  });

  it('stands exactly 100px tall from sm, compact on a phone, its line one row and heard there, not shown', () => {
    const { container } = header();
    const root = container.querySelector('header')!;
    expect(root.className).toMatch(/\bsm:h-\[100px\]/);
    expect(root.className).toContain('max-sm:py-3');
    const line = container.querySelector('[data-dialog-hero-subtitle]')!;
    expect(line.className).toContain('truncate');
    expect(line.className).toContain('max-sm:sr-only');
  });

  it('carries the colour tokens and follows the app’s light or dark class', () => {
    const { container } = header();
    const root = container.querySelector('header')!;
    expect(root.style.getPropertyValue('--hero-paper')).toContain('light-dark(');
    expect(root.style.getPropertyValue('--hero-lift')).toBe('32px');
    expect(root.className).toContain('[color-scheme:light]');
    expect(root.className).toContain('dark:[color-scheme:dark]');
    expect(root.className).toContain('@container');
  });

  it('draws the band hidden, out of the pointer’s way, with the art’s texture and pieces', () => {
    const { container } = header();
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('test');
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.className).toContain('pointer-events-none');
    expect(band.style.backgroundImage).toContain('radial-gradient');
    expect(band.querySelector('svg')).not.toBeNull();
    expect(band.className).not.toContain('max-sm:top-');
  });

  it('runs the band up under a phone sheet’s handle when asked', () => {
    const { container } = header({ underHandle: true });
    expect(container.querySelector('[data-dialog-hero-art]')!.className).toContain(
      'max-sm:top-[calc(var(--hero-lift)*-1)]',
    );
  });

  it('marks the title with the art’s glyph on a 36px tile, 32px on a phone', () => {
    const { container } = header();
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.className).toContain('size-9');
    expect(mark.className).toContain('max-sm:size-8');
    const svg = mark.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.querySelector('circle')).not.toBeNull();
  });

  it('puts the actions before the close, and the close closes', () => {
    const onClose = vi.fn();
    header({ actions: <button type="button">Show Me</button>, onClose });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual([
      'Show Me',
      'Close',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('leaves out the line and the action row when there are none', () => {
    const { container } = render(<HeroDialogHeader art={plain} titleId="t" title="Plain" />);
    expect(container.querySelector('[data-dialog-hero-subtitle]')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('stops the title and line short of a centre piece, only where the art has one', () => {
    const { container, rerender } = header();
    const h2 = () => container.querySelector('h2')!;
    expect(h2().className).not.toContain('@4xl:max-w-[26rem]');
    rerender(<HeroDialogHeader art={withCentre} titleId="t" title="Wide" subtitle="Line" />);
    expect(h2().className).toContain('@4xl:max-w-[26rem]');
    expect(container.querySelector('[data-dialog-hero-subtitle]')!.className).toContain(
      '@4xl:max-w-[26rem]',
    );
  });

  it('paints the band once: a re-render with the same art keeps its node and its pieces', () => {
    const { container, rerender } = header();
    const band = container.querySelector('[data-dialog-hero-art]');
    const piece = band!.firstElementChild;
    rerender(<HeroDialogHeader art={plain} titleId="t" title="Renamed" subtitle="Private" />);
    expect(container.querySelector('[data-dialog-hero-art]')).toBe(band);
    expect(band!.firstElementChild).toBe(piece);
  });
});

describe('the textures', () => {
  it('fades dots and grids in from the title’s side when asked', () => {
    const dots = heroTexture('dots', { fade: true });
    expect(String(dots.backgroundImage)).toMatch(/^linear-gradient\(90deg, var\(--hero-paper\)/);
    expect(dots.backgroundSize).toBe('100% 100%, 22px 22px');
    const grid = heroTexture('grid');
    expect(String(grid.backgroundImage).match(/linear-gradient/g)).toHaveLength(2);
    expect(grid.backgroundSize).toBe('24px 24px, 24px 24px');
  });

  it('spreads rings from a corner and draws a baseline grid', () => {
    expect(String(heroTexture('rings', { from: 'top-right' }).backgroundImage)).toContain(
      'circle at calc(100% - 3rem) 0',
    );
    expect(String(heroTexture('rings', { from: 'bottom-left' }).backgroundImage)).toContain(
      'circle at 3rem 100%',
    );
    expect(String(heroTexture('rings').backgroundImage)).toContain('repeating-radial-gradient');
    expect(heroTexture('baseline').backgroundPosition).toBe('0 4px');
  });
});
