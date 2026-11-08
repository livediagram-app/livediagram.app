// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnimationLayer } from '@liveworkspace/workbench/components/canvas/AnimationLayer';
import { InlineTextLine } from '@liveworkspace/workbench/components/canvas/InlineTextLine';

describe('AnimationLayer', () => {
  it('is a plain layer for the ring, halo and band, and a measured outline for Trace', () => {
    expect(
      renderToStaticMarkup(<AnimationLayer animation="pulse" width={80} height={40} radius={6} />),
    ).toBe('<span class="lvd-anim-layer" aria-hidden="true"></span>');
    const trace = renderToStaticMarkup(
      <AnimationLayer animation="trace" width={80} height={40} radius={100} />,
    );
    expect(trace).toContain('lvd-svg-trace-tail');
    expect(trace).toContain('lvd-svg-trace-head');
    // The corner never exceeds half the box.
    expect(trace).toContain('rx="20"');
  });
});

describe('InlineTextLine with a Text animation', () => {
  it('draws the animated copy over the line, which stays for editing', () => {
    const { container } = render(
      <InlineTextLine
        value="Plan"
        placeholder="Title"
        editable
        onCommit={() => {}}
        zoom={1}
        maxLength={80}
        ariaLabel="Page title"
        animated={{
          node: <span className="lvd-tx-unit">Plan</span>,
          className: 'lvd-tx',
          style: {},
        }}
      />,
    );
    expect(container.querySelector('.lvd-tx .lvd-tx-unit')).not.toBeNull();
    expect(container.querySelector('[role="textbox"]')!.className).toContain('opacity-0');
  });
});
