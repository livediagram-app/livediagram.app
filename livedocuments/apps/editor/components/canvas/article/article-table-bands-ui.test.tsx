// @vitest-environment jsdom
// docs/specs/007-editor/article-pages.md "The page toolbar" (its Table menu) and "Headers and footers" (the Style
// tab's section and the bands drawn on a page).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArticleStyle } from '@livedocuments/document';
import { ArticleBandsSection } from './ArticleBandsSection';
import { PageBands } from './PageBands';
import { TABLE_ENTRIES, TablePanel } from './page-toolbar-table';

afterEach(cleanup);

describe('the Table menu', () => {
  it('runs each entry, the header row a switch, an entry that cannot run unavailable', () => {
    const onCommand = vi.fn();
    render(
      <TablePanel
        header
        blockedOf={(name) => (name === 'rowAbove' ? 'The header row stays first' : null)}
        onCommand={onCommand}
      />,
    );
    const items = [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')];
    expect(items.map((i) => i.textContent)).toEqual(TABLE_ENTRIES.map((e) => e.label));
    const above = screen.getByRole('menuitem', { name: 'Insert Row Above' });
    expect(above.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(above);
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Insert Column Right' }));
    expect(onCommand).toHaveBeenCalledWith('colRight');
    const header = screen.getByRole('menuitemcheckbox', { name: 'Header Row' });
    expect(header.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(header);
    expect(onCommand).toHaveBeenCalledWith('header');
    expect(screen.getByRole('menuitem', { name: 'Delete Table' }).className).toContain('rose');
  });
});

describe('the Header and Footer section', () => {
  const setup = (style: ArticleStyle | undefined = undefined) => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    const utils = render(
      <ArticleBandsSection style={style} onChange={onChange} onPreview={onPreview} />,
    );
    return { ...utils, onChange, onPreview };
  };

  it('previews as it is typed and writes a box once, when it is left', () => {
    const { onChange, onPreview } = setup();
    const left = screen.getByLabelText('Header Left');
    fireEvent.focus(left);
    fireEvent.change(left, { target: { value: 'Brief' } });
    expect(onPreview).toHaveBeenLastCalledWith({ header: { left: 'Brief' }, footer: undefined });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(left);
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledWith({ header: { left: 'Brief' } });
  });

  it('writes on Enter, and nothing when the box is as it was', () => {
    const { onChange } = setup({ footer: { right: 'F' } });
    const right = screen.getByLabelText('Footer Right') as HTMLInputElement;
    expect(right.value).toBe('F');
    fireEvent.focus(right);
    fireEvent.keyDown(right, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(right, { target: { value: '' } });
    fireEvent.keyDown(right, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ footer: undefined });
    fireEvent.keyDown(right, { key: 'a' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('puts a field at the caret of the box last used, the caret after it', () => {
    const { onPreview } = setup();
    // No box used yet: nothing to put it in.
    fireEvent.click(screen.getByRole('button', { name: 'Page Number' }));
    expect(onPreview).not.toHaveBeenCalled();
    const centre = screen.getByLabelText('Footer Centre') as HTMLInputElement;
    fireEvent.focus(centre);
    fireEvent.change(centre, { target: { value: 'Page  of' } });
    centre.setSelectionRange(5, 5);
    const button = screen.getByRole('button', { name: 'Page Number' });
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    expect(centre.value).toBe('Page {page} of');
    expect(centre.selectionStart).toBe(11);
    expect(document.activeElement).toBe(centre);
  });

  it('refills from a change made elsewhere, unless a box is being typed in', () => {
    const { rerender, onChange, onPreview } = setup({ header: { left: 'A' } });
    const left = screen.getByLabelText('Header Left') as HTMLInputElement;
    rerender(
      <ArticleBandsSection
        style={{ header: { left: 'B' } }}
        onChange={onChange}
        onPreview={onPreview}
      />,
    );
    expect(left.value).toBe('B');
    fireEvent.focus(left);
    fireEvent.change(left, { target: { value: 'Mine' } });
    rerender(
      <ArticleBandsSection
        style={{ header: { left: 'C' } }}
        onChange={onChange}
        onPreview={onPreview}
      />,
    );
    expect(left.value).toBe('Mine');
  });

  it('turns Different First Page on and off', () => {
    const { onChange, rerender, onPreview } = setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Different First Page' }));
    expect(onChange).toHaveBeenLastCalledWith({ differentFirstPage: true });
    rerender(
      <ArticleBandsSection
        style={{ differentFirstPage: true }}
        onChange={onChange}
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Different First Page' }));
    expect(onChange).toHaveBeenLastCalledWith({ differentFirstPage: undefined });
  });
});

describe('a page’s header and footer', () => {
  it('draws each line’s three parts between the margins, the page number keeping its hook', () => {
    const { container } = render(
      <PageBands
        dark={false}
        layout={{
          left: 96,
          right: 720,
          font: 'Inter',
          header: { y: 88, parts: { left: 'Brief', right: 'Page 2' } },
          footer: { y: 1000, parts: { center: '2' } },
        }}
      />,
    );
    const header = container.querySelector<HTMLElement>('[data-page-band="header"]')!;
    expect(Array.from(header.children, (c) => c.textContent)).toEqual(['Brief', '', 'Page 2']);
    expect(header.style.left).toBe('96px');
    expect(header.style.width).toBe('624px');
    expect(header.hasAttribute('data-page-number')).toBe(false);
    const footer = container.querySelector<HTMLElement>('[data-page-band="footer"]')!;
    expect(footer.hasAttribute('data-page-number')).toBe(true);
  });

  it('draws only the lines it has, in the dark page’s ink', () => {
    const { container } = render(
      <PageBands
        dark
        layout={{ left: 0, right: 10, font: 'Inter', footer: { y: 9, parts: { left: 'x' } } }}
      />,
    );
    expect(container.querySelector('[data-page-band="header"]')).toBeNull();
    const footer = container.querySelector<HTMLElement>('[data-page-band="footer"]')!;
    expect(footer.hasAttribute('data-page-number')).toBe(false);
    expect(footer.style.color).toContain('255');
  });
});
