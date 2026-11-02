// @vitest-environment jsdom

// A menu row's label reads from the left beside its icon, however long it is (docs/specs/004-interface-design/menus.md
// "Item labels"). A <button> centres its text by default, so a label that wraps would centre its lines; the row
// says text-left, and a plain row keeps its icon level with the first line (items-start, an icon slot one line tall, h-lh, so no row grows).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MenuAccordionSection, MenuActionRow } from './PortalMenu';
import { plainTriggerClass, sectionTriggerClass } from './MenuFlyoutPanel';

const GLYPH = <svg aria-hidden />;
const LONG = 'Move to Selected for Development';

afterEach(cleanup);

describe('menu row labels', () => {
  it('a plain row is left-aligned, its icon level with the first line', () => {
    render(<MenuActionRow plain label={LONG} icon={GLYPH} onClick={() => {}} />);
    const row = screen.getByRole('button', { name: LONG });
    expect(row.className).toContain('text-left');
    expect(row.className).toContain('items-start');
    const [slot, label] = Array.from(row.children) as [Element, Element];
    expect(slot.className).toContain('h-lh');
    expect(label.className).toContain('flex-1');
    expect(label.textContent).toBe(LONG);
  });

  it('a plain row keeps its own label style', () => {
    render(
      <MenuActionRow
        plain
        label="Georgia"
        icon={GLYPH}
        labelStyle={{ fontFamily: 'Georgia' }}
        onClick={() => {}}
      />,
    );
    const label = screen.getByText('Georgia');
    expect(label.style.fontFamily).toBe('Georgia');
  });

  it('a disabled plain row has the same left-aligned shape', () => {
    render(<MenuActionRow plain disabled label={LONG} icon={GLYPH} onClick={() => {}} />);
    const row = screen.getByText(LONG).parentElement!;
    expect(row.className).toContain('text-left');
    expect(row.className).toContain('items-start');
  });

  it('category rows and triggers are left-aligned too', () => {
    render(
      <>
        <MenuActionRow label="Arrange" icon={GLYPH} onClick={() => {}} />
        <MenuActionRow disabled label="Paste" icon={GLYPH} onClick={() => {}} />
        <MenuAccordionSection title="Style" icon={GLYPH} open={false} onToggle={() => {}}>
          <p>body</p>
        </MenuAccordionSection>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Arrange' }).className).toContain('text-left');
    expect(screen.getByText('Paste').className).toContain('text-left');
    expect(screen.getByRole('button', { name: /Style/ }).className).toContain('text-left');
    expect(plainTriggerClass(false)).toContain('text-left');
    expect(sectionTriggerClass(true)).toContain('text-left');
  });
});
