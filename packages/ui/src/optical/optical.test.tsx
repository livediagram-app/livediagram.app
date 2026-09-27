// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Chip, GlyphDisc, IconSlot } from './index';

// Primitive contracts (docs/specs/004-interface-design/blueprints/optical-alignment.md, "Primitives"):
// every text glyph sits in the cap-band utility, and every box is sized explicitly (no CLS).

const icon = <svg data-testid="icon" width="12" height="12" />;

describe('GlyphDisc', () => {
  it('centres a text glyph through the cap-band utility, at an explicit size', () => {
    const { container } = render(
      <GlyphDisc size={20} className="bg-brand-500 text-[10px]" aria-label="Webber">
        W
      </GlyphDisc>,
    );
    const disc = container.firstElementChild as HTMLElement;
    expect(disc.dataset.optical).toBe('disc');
    expect(disc.style.width).toBe('20px');
    expect(disc.style.height).toBe('20px');
    expect(disc.className).toContain('rounded-full');
    expect(disc.className).toContain('bg-brand-500');
    expect(disc.getAttribute('aria-label')).toBe('Webber');
    const glyph = disc.firstElementChild as HTMLElement;
    expect(glyph.className).toContain('text-optical-centre');
    expect(glyph.textContent).toBe('W');
  });

  it('wraps numbers too, and keeps caller style beside its size', () => {
    const { container } = render(
      <GlyphDisc size={28} style={{ color: 'red' }}>
        {3}
      </GlyphDisc>,
    );
    const disc = container.firstElementChild as HTMLElement;
    expect(disc.style.color).toBe('red');
    expect(disc.style.width).toBe('28px');
    expect(disc.querySelector('.text-optical-centre')?.textContent).toBe('3');
  });

  it('renders an icon as is, as a block so no baseline gap offsets it', () => {
    const { container, getByTestId } = render(<GlyphDisc size={24}>{icon}</GlyphDisc>);
    const disc = container.firstElementChild as HTMLElement;
    expect(getByTestId('icon').parentElement).toBe(disc);
    expect(disc.querySelector('.text-optical-centre')).toBeNull();
    expect(disc.className).toContain('[&>svg]:block');
  });

  it('treats mixed text children as one text glyph', () => {
    const overflow = 3;
    const { container } = render(<GlyphDisc size={16}>+{overflow}</GlyphDisc>);
    expect(container.querySelector('.text-optical-centre')?.textContent).toBe('+3');
  });

  it('leaves sizing to responsive classes when no size is given', () => {
    const { container } = render(<GlyphDisc className="h-9 w-9 sm:h-10 sm:w-10">1</GlyphDisc>);
    const disc = container.firstElementChild as HTMLElement;
    expect(disc.style.width).toBe('');
    expect(disc.style.height).toBe('');
    expect(disc.className).toContain('sm:h-10');
  });

  it('can be a disabled button', () => {
    const { container } = render(
      <GlyphDisc as="button" size={24} type="button" disabled>
        −
      </GlyphDisc>,
    );
    expect((container.firstElementChild as HTMLButtonElement).disabled).toBe(true);
  });

  it('can be a button', () => {
    const { container } = render(
      <GlyphDisc as="button" size={32} type="button" aria-label="Close">
        {icon}
      </GlyphDisc>,
    );
    expect(container.firstElementChild!.tagName).toBe('BUTTON');
  });
});

describe('IconSlot', () => {
  it('is an explicit size × size box that centres what it holds', () => {
    const { container } = render(<IconSlot size={20}>{icon}</IconSlot>);
    const slot = container.firstElementChild as HTMLElement;
    expect(slot.dataset.optical).toBe('slot');
    expect(slot.style.width).toBe('20px');
    expect(slot.style.height).toBe('20px');
    expect(slot.className).toMatch(/items-center/);
    expect(slot.className).toMatch(/justify-center/);
  });
});

describe('Chip', () => {
  it('holds a label in the cap-band utility at an explicit height', () => {
    const { container } = render(
      <Chip height={18} className="px-2">
        Private
      </Chip>,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.dataset.optical).toBe('chip');
    expect(chip.style.height).toBe('18px');
    expect(chip.className).toContain('rounded-full');
    expect(chip.className).toContain('px-2');
    const label = chip.lastElementChild as HTMLElement;
    expect(label.className).toContain('text-optical-line');
    expect(label.className).not.toContain('text-optical-caps');
  });

  it('renders a leading icon as its own first child, so the edge rule reaches it', () => {
    const { container, getByTestId } = render(
      <Chip height={18} icon={icon}>
        Private
      </Chip>,
    );
    expect(container.firstElementChild!.firstElementChild).toBe(getByTestId('icon'));
    expect((container.firstElementChild as HTMLElement).className).toContain('[&>svg]:block');
  });

  it('keeps its natural height when none is pinned', () => {
    const { container } = render(<Chip className="px-2 py-0.5">Private</Chip>);
    expect((container.firstElementChild as HTMLElement).style.height).toBe('');
  });

  it('can be a rectangular badge instead of a pill', () => {
    const { container } = render(
      <Chip height={19} radius="sm">
        Today
      </Chip>,
    );
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toContain('rounded');
    expect(chip.className).not.toContain('rounded-full');
  });

  it("measures its padding to an edge icon's ink", () => {
    const { container } = render(<Chip height={18}>Private</Chip>);
    expect((container.firstElementChild as HTMLElement).className).toContain('optical-edges');
  });

  it('gives a caps label back its trailing letter-space', () => {
    const { container } = render(
      <Chip height={18} caps>
        Private
      </Chip>,
    );
    const label = container.querySelector('.text-optical-line') as HTMLElement;
    expect(label.className).toContain('text-optical-caps');
  });
});
