// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarTab, Scene } from './primitives';

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
