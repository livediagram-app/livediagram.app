// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { WorkbenchBackButton, WorkbenchOpenLink, WorkbenchReconnectLine } from './WorkbenchChrome';

// The workbench's chrome (docs/specs/013-workspace/blueprints/workbench-embeds.md "Presentation and UX",
// "Accessibility"): Open in livedocuments in the tab bar, and the Reconnect line once the session ended.

describe('WorkbenchOpenLink', () => {
  it('links to the document in a new tab, named as such', () => {
    render(<WorkbenchOpenLink href="/document/doc%201" labelled />);

    const link = screen.getByRole('link', { name: 'Open in livedocuments (opens in a new tab)' });
    expect(link.getAttribute('href')).toBe('/document/doc%201');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toBe('Open in livedocuments');
    expect(link.className).toContain('min-w-7');
  });

  it('is an icon alone where the bar has no room for words', () => {
    render(<WorkbenchOpenLink href="/document/d" labelled={false} />);

    const link = screen.getByRole('link', { name: 'Open in livedocuments (opens in a new tab)' });
    expect(link.textContent).toBe('');
  });
});

describe('WorkbenchBackButton', () => {
  // docs/specs/007-editor/pages-mode.md "Joined to the menu box": a frame's Back takes the row as the menu box does.
  it('heads the docked Contents sidebar as the menu box does', () => {
    render(<WorkbenchBackButton onBack={() => {}} backTitle="Minigames" joinedWidth={236} />);
    const card = document.querySelector<HTMLElement>('[data-toolbar-menu]')!;
    expect(card.hasAttribute('data-menu-joined')).toBe(true);
    expect(card.style.width).toBe('216px');
  });

  it('goes back, named by where it goes, a native button at the toolbar’s size', () => {
    const onBack = vi.fn();
    render(<WorkbenchBackButton onBack={onBack} backTitle="Minigames" />);

    const back = screen.getByRole('button', { name: 'Back to Minigames' });
    fireEvent.click(back);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(back.textContent).toBe('Back');
    expect(back.className).toContain('min-w-9');
  });

  it('is the top-left card the strip keeps clear of, alone, and the Header region for F6', () => {
    render(<WorkbenchBackButton onBack={() => {}} backTitle="Minigames" />);

    const back = screen.getByRole('button', { name: 'Back to Minigames' });
    const card = back.closest<HTMLElement>('[data-toolbar-menu]')!;
    expect(card).not.toBeNull();
    expect(card.className).toContain('left-3 top-3');
    expect(card.dataset.region).toBe('header');
    expect(card.querySelectorAll('button, a, input')).toHaveLength(1);
  });

  it('sits in the strip’s row on a phone, the glyph alone', () => {
    render(<WorkbenchBackButton onBack={() => {}} backTitle="Minigames" inline />);

    const back = screen.getByRole('button', { name: 'Back to Minigames' });
    expect(back.textContent).toBe('');
    expect(back.closest<HTMLElement>('[data-toolbar-menu]')!.className).not.toContain('absolute');
  });
});

describe('WorkbenchReconnectLine', () => {
  it('says nothing while the session edits, in a polite live region', () => {
    render(<WorkbenchReconnectLine workbenchName="Acme Editor" ended={null} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
  });

  it.each(['expired', 'revoked'] as const)('says how to edit again once %s', (ended) => {
    render(<WorkbenchReconnectLine workbenchName="Acme Editor" ended={ended} />);

    expect(screen.getByRole('status').textContent).toBe(
      'Reconnect in Acme Editor to keep editing.',
    );
  });

  it('leaves a trashed document to the deleted card', () => {
    render(<WorkbenchReconnectLine workbenchName="Acme Editor" ended="trashed" />);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});
