// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, ButtonContent } from './Button';

// A button's label centres its cap band, not its line box, at the button's usual height
// (docs/specs/004-interface-design/optical-alignment.md).
describe('Button label', () => {
  it('wraps a text label in the line-preserving optical utility', () => {
    const { container } = render(<Button>Save</Button>);
    const label = container.querySelector('button > span') as HTMLElement;
    expect(label.className).toBe('text-optical-line');
    expect(label.textContent).toBe('Save');
  });

  it('wraps each text run beside an icon, and leaves the icon alone', () => {
    const { container } = render(
      <Button>
        <svg data-testid="i" />
        Next {2}
      </Button>,
    );
    const button = container.querySelector('button')!;
    expect(button.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    expect([...button.querySelectorAll('.text-optical-line')].map((s) => s.textContent)).toEqual([
      'Next ',
      '2',
    ]);
  });

  it('is available to links styled as buttons', () => {
    const { container } = render(
      <a href="/new">
        <ButtonContent>Start drawing</ButtonContent>
      </a>,
    );
    expect(container.querySelector('a > .text-optical-line')?.textContent).toBe('Start drawing');
  });
});
