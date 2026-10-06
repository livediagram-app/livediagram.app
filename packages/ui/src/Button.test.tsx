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

  it("measures its padding to an edge icon's ink", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector('button')!.className).toContain('optical-edges');
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

// A button busy with its own action keeps focus: `aria-disabled` looks
// disabled without dropping focus the way `disabled` does.
describe('Button aria-disabled', () => {
  it('looks disabled', () => {
    const { container } = render(<Button aria-disabled>Sync now</Button>);
    expect(container.querySelector('button')!.className).toContain('aria-disabled:opacity-50');
  });
});

// The quiet header-row actions (Plan's Card Types panel): no fill or border until hovered.
describe('Button ghost variant', () => {
  it('has no border or fill at rest', () => {
    const { container } = render(<Button variant="ghost">Archive</Button>);
    const cls = container.querySelector('button')!.className;
    expect(cls).not.toContain('border');
    expect(cls).toContain('hover:bg-slate-100');
  });
});
