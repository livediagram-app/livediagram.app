// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EditorHeader, headerActionTone } from './EditorHeader';
import { HEADER_ICON_SLOT_PX } from './header-action';

// The one editor header (docs/specs/007-editor/editor-app.md "Header actions"): each editor binds it with its logo,
// nouns and account control, so these hold what every editor's header does. Each editor's door test holds its own
// words, logo link and account menu.

const WORDS = {
  nameLabel: 'Item name',
  renameTitle: 'Rename item',
  copyDescription: 'Duplicate this item into your own files.',
};

type Props = ComponentProps<typeof EditorHeader>;

function header(overrides: Partial<Props> = {}) {
  return (
    <EditorHeader
      app="livedocuments"
      logoHref="/explorer?item=d%201"
      words={WORDS}
      name="Untitled item"
      showShare
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
      account={<button type="button">Account menu</button>}
      {...overrides}
    />
  );
}

const editing = () => screen.queryByDisplayValue('Untitled item');

describe('EditorHeader', () => {
  it('leads with the app logo, linked where the editor says, and ends with its account control', () => {
    const { container } = render(header());
    const logo = screen.getByRole('link', { name: 'livedocuments' });
    expect(logo.getAttribute('href')).toBe('/explorer?item=d%201');
    expect(logo.className).toContain('touch-target');
    const actions = container.querySelector('header > div:last-child')!;
    expect(actions.lastElementChild?.textContent).toBe('Account menu');
  });

  it('holds every action glyph in the shared 20px slot', () => {
    render(header({ onMakeCopy: () => {} }));
    for (const name of ['Copy', 'Share']) {
      const slot = screen.getByRole('button', { name }).firstElementChild as HTMLElement;
      expect(slot.dataset.optical).toBe('slot');
      expect(slot.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    }
  });

  it('lets a long name shrink and keeps the pills and actions whole', () => {
    const { container } = render(header());
    const bar = container.firstElementChild as HTMLElement;
    const name = screen.getByRole('button', { name: 'Untitled item' });
    expect(name.className).toContain('truncate');
    // 44px tall on a touch screen by padding, since `truncate` clips a ::before pad.
    expect(name.className).toMatch(/\bpointer-coarse:py-3\b/);
    for (let el = name.parentElement; el && el !== bar; el = el.parentElement) {
      expect(el.className, el.outerHTML.slice(0, 80)).toContain('min-w-0');
    }
    expect(container.querySelector('[data-header-pills]')?.className).toContain('shrink-0');
    const actions = screen.getByRole('button', { name: 'Share' }).closest('.self-stretch');
    expect(actions?.className).toContain('shrink-0');
  });
});

describe('EditorHeader title', () => {
  it('renames in place under the editor’s own label, and keeps the name for an empty one', () => {
    const onRename = vi.fn();
    render(header({ onRename }));
    fireEvent.click(screen.getByRole('button', { name: 'Untitled item' }));
    const field = screen.getByLabelText('Item name') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '  Roadmap ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenLastCalledWith('Roadmap');
    fireEvent.click(screen.getByRole('button', { name: 'Untitled item' }));
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByLabelText('Item name'), { key: 'Enter' });
    expect(onRename).toHaveBeenLastCalledWith('Untitled item');
  });

  it('cancels a rename and hands focus back to the title', async () => {
    render(header());
    fireEvent.click(screen.getByRole('button', { name: 'Untitled item' }));
    fireEvent.keyDown(screen.getByDisplayValue('Untitled item'), { key: 'Escape' });
    expect(editing()).toBeNull();
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Untitled item' }));
  });

  it('shows a viewer the name as plain text', () => {
    render(header({ readOnly: true }));
    expect(screen.queryByRole('button', { name: 'Untitled item' })).toBeNull();
    expect(screen.getByText('Untitled item').tagName).toBe('SPAN');
  });

  it('hides the title, pills and all, while asked to', () => {
    const { container } = render(header({ hideTitle: true }));
    expect(screen.queryByText('Untitled item')).toBeNull();
    expect(container.querySelector('[data-header-pills]')).toBeNull();
  });

  it('opens the name editor for a palette request, never on mount', () => {
    const { rerender } = render(header({ renameNonce: 0 }));
    expect(editing()).toBeNull();
    rerender(header({ renameNonce: 1 }));
    expect(editing()).not.toBeNull();
  });

  it('honours a request made while the title is hidden once it shows, and only once', () => {
    const { rerender } = render(header({ renameNonce: 0, hideTitle: true }));
    rerender(header({ renameNonce: 1, hideTitle: true }));
    expect(editing()).toBeNull();
    rerender(header({ renameNonce: 1 }));
    expect(editing()).not.toBeNull();
    fireEvent.blur(screen.getByDisplayValue('Untitled item'));
    expect(editing()).toBeNull();
    rerender(header({ renameNonce: 1, hideTitle: true }));
    rerender(header({ renameNonce: 1 }));
    expect(editing()).toBeNull();
  });

  it('ignores a palette request for a viewer', () => {
    const { rerender } = render(header({ readOnly: true, renameNonce: 0 }));
    rerender(header({ readOnly: true, renameNonce: 1 }));
    expect(editing()).toBeNull();
  });
});

describe('EditorHeader pills', () => {
  it('reads each visibility, the Community and This Browser winning', () => {
    const { rerender } = render(header({ team: true }));
    expect(screen.getByText('Team')).toBeTruthy();
    rerender(header({ shareable: true, community: true }));
    expect(screen.getByText('Public')).toBeTruthy();
    rerender(header({ shareable: true, offline: true }));
    expect(screen.getByText('This Browser')).toBeTruthy();
  });

  it('lets the owner open Share from the pill, and nobody else', () => {
    const onOpenShare = vi.fn();
    const { rerender } = render(header({ onOpenShare }));
    fireEvent.click(screen.getByRole('button', { name: 'Private' }));
    expect(onOpenShare).toHaveBeenCalledOnce();
    rerender(header({ onOpenShare, showShare: false }));
    expect(screen.queryByRole('button', { name: 'Private' })).toBeNull();
  });

  it('puts the role pill after the visibility pill', () => {
    render(header({ rolePill: <span>Editing</span> }));
    const pills = screen.getByText('Editing').closest('[data-header-pills]')!;
    expect(pills.textContent).toMatch(/^Private.*Editing$/);
  });
});

describe('EditorHeader actions', () => {
  it('offers a visitor Copy, and says so while copying', () => {
    const onMakeCopy = vi.fn();
    const { rerender } = render(header({ onMakeCopy, showShare: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onMakeCopy).toHaveBeenCalledOnce();
    rerender(header({ onMakeCopy, copying: true, showShare: false }));
    expect(screen.getByRole('button', { name: 'Copying' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('fills Share in brand while shared, its label unchanged', () => {
    const { rerender } = render(header());
    const share = () => screen.getByRole('button', { name: 'Share' });
    expect(share().getAttribute('aria-pressed')).toBe('false');
    expect(share().className).not.toContain('bg-brand-700');
    rerender(header({ shareable: true }));
    expect(share().getAttribute('aria-pressed')).toBe('true');
    expect(share().className).toContain('bg-brand-700');
    expect(share().getAttribute('data-tour-id')).toBe('share');
  });

  it('puts the editor’s own action in Share’s place', () => {
    render(header({ shareAction: <button type="button">Share Form</button> }));
    expect(screen.getByRole('button', { name: 'Share Form' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    // The pill still opens Share.
    expect(screen.getByRole('button', { name: 'Private' })).toBeTruthy();
  });

  it('has no Present button without something to present', () => {
    render(header());
    expect(screen.queryByRole('button', { name: /Present/ })).toBeNull();
  });

  it('puts Present just left of Share, presents, and refuses a second press while starting', () => {
    const onPresent = vi.fn();
    const { rerender } = render(header({ present: { slideCount: 3, starting: false, onPresent } }));
    const present = screen.getByRole('button', { name: 'Present' });
    const share = screen.getByRole('button', { name: 'Share' });
    expect(present.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(present.getAttribute('data-presentation-start')).toBe('header');
    fireEvent.click(present);
    expect(onPresent).toHaveBeenCalledOnce();
    rerender(header({ present: { slideCount: 3, starting: true, onPresent } }));
    expect(screen.getByRole('button', { name: 'Starting' })).toHaveProperty('disabled', true);
  });

  it('describes Present with the editor’s lead and the slide count', () => {
    const present = { slideCount: 1, starting: false, onPresent: () => {} };
    const { rerender } = render(header({ present }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Present' }));
    expect(document.body.textContent).toContain('Present: 1 slide.');
    rerender(
      header({
        present: { ...present, slideCount: 4 },
        words: { ...WORDS, presentLead: 'Present the slide deck' },
      }),
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Present' }));
    expect(document.body.textContent).toContain('Present the slide deck: 4 slides.');
  });
});

describe('headerActionTone', () => {
  it('fills an action that is on in brand, and leaves one that is off slate', () => {
    expect(headerActionTone(true)).toContain('bg-brand-700');
    expect(headerActionTone(false)).toContain('text-slate-600');
  });
});
