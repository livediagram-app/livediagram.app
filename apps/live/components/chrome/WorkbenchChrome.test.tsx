// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import {
  WorkbenchBackButton,
  WorkbenchDocumentBar,
  WorkbenchOpenLink,
  WorkbenchReconnectLine,
} from './WorkbenchChrome';

// The workbench's chrome (docs/specs/013-workspace/blueprints/workbench-embeds.md "Presentation and UX",
// "Accessibility"): Open in livediagram in the tab bar, and the Reconnect line once the session ended.

describe('WorkbenchOpenLink', () => {
  it('links to the document in a new tab, named as such', () => {
    render(<WorkbenchOpenLink href="/document/doc%201" labelled />);

    const link = screen.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' });
    expect(link.getAttribute('href')).toBe('/document/doc%201');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toBe('Open in livediagram');
    expect(link.className).toContain('min-w-7');
  });

  it('is an icon alone where the bar has no room for words', () => {
    render(<WorkbenchOpenLink href="/document/d" labelled={false} />);

    const link = screen.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' });
    expect(link.textContent).toBe('');
  });
});

describe('WorkbenchBackButton', () => {
  it('goes back, named by where it goes, a native button with the bar’s target size', () => {
    const onBack = vi.fn();
    render(<WorkbenchBackButton onBack={onBack} backTitle="Minigames" labelled />);

    const back = screen.getByRole('button', { name: 'Back to Minigames' });
    fireEvent.click(back);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(back.textContent).toBe('Back');
    expect(back.className).toContain('min-w-7');
  });
});

describe('WorkbenchDocumentBar', () => {
  it('holds Back alone, at its left, first in the keyboard order and the Header region for F6', () => {
    const onBack = vi.fn();
    const { container } = render(
      <WorkbenchDocumentBar frame={{ back: onBack, backTitle: 'Minigames' }} />,
    );

    const bar = container.firstElementChild as HTMLElement;
    const back = screen.getByRole('button', { name: 'Back to Minigames' });
    expect(bar.querySelectorAll('button, a, input')).toHaveLength(1);
    expect(bar.querySelector('button')).toBe(back);
    expect(bar.className).toContain('h-12');
    expect(bar.dataset.region).toBe('header');
    expect(back.textContent).toBe('Back');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
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
