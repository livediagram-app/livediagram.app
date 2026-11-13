// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Arrow, BarTab, Scene, Shape, stickyOnly } from './primitives';
import { BorderSection } from './illustrations/colours-borders';

// docs/specs/018-help/help-app.md "In-article illustrations": a figure is named by its caption, so its picture is
// hidden from screen readers rather than an image with no alternative.
describe('Scene', () => {
  it('draws an SVG hidden from assistive technology, never an unnamed image', () => {
    const html = renderToStaticMarkup(
      <Scene w={10} h={10}>
        <rect />
      </Scene>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).not.toContain('role="img"');
  });
});

// The editors' footer tabs: the open tab is a card standing on the bar, the rest are bare names,
// and a tab open in the other pane is a dashed outline. Nothing is a filled pill.
describe('BarTab', () => {
  const draw = (props: Partial<Parameters<typeof BarTab>[0]>) =>
    renderToStaticMarkup(
      <svg>
        <BarTab x={0} y={0} w={60} h={24} label="Plan" {...props} />
      </svg>,
    );

  it('draws the open tab as a card and a quiet tab as its name alone', () => {
    expect(draw({ active: true })).toContain('fill-white');
    const quiet = draw({});
    expect(quiet).not.toContain('<path');
    expect(quiet).not.toContain('<rect');
    expect(quiet).toContain('Plan');
  });

  it('outlines the tab in the other pane with a dashed line and no card', () => {
    const html = draw({ beside: true, anchor: 'start', size: 8 });
    expect(html).toContain('stroke-dasharray="3 2"');
    expect(html).not.toContain('fill-white');
  });

  it('draws its children inside the tab', () => {
    expect(draw({ children: <circle r={3} /> })).toContain('<circle');
  });
});

// A help app with no diagram shapes (livehuddle) sets HELP_STICKY_ONLY: every Shape is a sticky note and the Border
// figure has no Radius grid. The others leave it unset and draw as before.
describe('sticky-only help apps', () => {
  afterEach(() => vi.unstubAllEnvs());
  const shape = (kind: 'circle' | 'diamond' | 'rect', accent = false) =>
    renderToStaticMarkup(
      <svg>
        <Shape x={0} y={0} kind={kind} accent={accent} label="A" />
      </svg>,
    );

  it('draws every kind as it is by default', () => {
    expect(stickyOnly()).toBe(false);
    expect(shape('circle')).toContain('<ellipse');
    expect(shape('diamond')).toContain('<path');
    expect(renderToStaticMarkup(<BorderSection />)).toContain('Radius');
  });

  it('draws a square sticky, with no border, whatever kind a scene names', () => {
    vi.stubEnv('HELP_STICKY_ONLY', '1');
    expect(stickyOnly()).toBe(true);
    for (const kind of ['circle', 'diamond', 'rect'] as const) {
      const html = shape(kind);
      expect(html).not.toContain('<ellipse');
      expect(html).not.toContain('<path');
      expect(html).not.toContain('stroke-brand');
      expect(html).not.toContain('rx=');
      expect(html).toContain('fill-amber-100');
    }
    const accent = shape('rect', true);
    expect(accent).toContain('fill-brand-200');
    expect(accent).not.toContain('fill-white');
  });

  it('leaves the Radius grid out of the Border figure', () => {
    vi.stubEnv('HELP_STICKY_ONLY', '1');
    const html = renderToStaticMarkup(<BorderSection />);
    expect(html).not.toContain('Radius');
    expect(html).toContain('Strength');
    expect(html).toContain('Pattern');
    expect(html).toContain('Agenda');
  });

  it('draws a connector between elements only where shapes exist, and always a trail or step arrow', () => {
    const draw = (connector: boolean) =>
      renderToStaticMarkup(
        <svg>
          <Arrow from={[0, 0]} to={[40, 0]} connector={connector} />
        </svg>,
      );
    expect(draw(true)).toContain('<path');
    expect(draw(false)).toContain('<path');
    vi.stubEnv('HELP_STICKY_ONLY', '1');
    expect(draw(true)).toBe('<svg></svg>');
    expect(draw(false)).toContain('<path');
  });
});
