// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsetContent } from './InsetContent';

// docs/specs/008-canvas/element-indicators.md: the content area moves out of the indicators' way.
describe('InsetContent', () => {
  it('adds no box when nothing moves', () => {
    const { container } = render(
      <InsetContent inset={{ top: 0, bottom: 0 }}>
        <p>Label</p>
      </InsetContent>,
    );
    expect(container.innerHTML).toBe('<p>Label</p>');
    expect(
      render(
        <InsetContent>
          <p>x</p>
        </InsetContent>,
      ).container.innerHTML,
    ).toBe('<p>x</p>');
  });

  it('pulls the content area in from the top or bottom', () => {
    const { container } = render(
      <InsetContent inset={{ top: 24, bottom: 0 }}>
        <p>Label</p>
      </InsetContent>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.top).toBe('24px');
    expect(box.style.bottom).toBe('0px');
    expect(box.textContent).toBe('Label');
  });
});
