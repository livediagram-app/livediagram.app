// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MenuToolsSection } from './MenuToolsSection';

afterEach(cleanup);

const A = () => <button type="button">Slots</button>;
const B = () => <button type="button">Tags</button>;

describe('MenuToolsSection', () => {
  it('draws nothing when the element has no sections of its own', () => {
    const { container } = render(
      <MenuToolsSection title="Card" icon={null} onOpen={() => {}}>
        {null}
        {false}
      </MenuToolsSection>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('keeps a lone section as its own row in the menu', () => {
    render(
      <MenuToolsSection title="Card" icon={null} onOpen={() => {}}>
        <A />
        {null}
      </MenuToolsSection>,
    );
    expect(screen.getByText('Slots')).toBeTruthy();
    expect(screen.queryByText('Card')).toBeNull();
  });

  it('is one row named for the element when it has several, and opens the dialog', () => {
    const onOpen = vi.fn();
    render(
      <MenuToolsSection title="Card" icon={null} onOpen={onOpen}>
        <A />
        <B />
      </MenuToolsSection>,
    );
    expect(screen.queryByText('Slots')).toBeNull();
    const row = screen.getByRole('button', { name: /Card/ });
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is always the row when asked, even for one section', () => {
    render(
      <MenuToolsSection title="Configure" icon={null} onOpen={() => {}} always>
        <A />
      </MenuToolsSection>,
    );
    expect(screen.queryByText('Slots')).toBeNull();
    expect(screen.getByRole('button', { name: /Configure/ })).toBeTruthy();
  });

  it('lays the sections out themselves inside the dialog', () => {
    render(
      <MenuToolsSection title="Card" icon={null} onOpen={() => {}} inline>
        <A />
        <B />
      </MenuToolsSection>,
    );
    expect(screen.getByText('Slots')).toBeTruthy();
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Card/ })).toBeNull();
  });
});
