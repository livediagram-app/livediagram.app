// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchOpenLink, WorkbenchReconnectLine } from './WorkbenchChrome';

// The workbench's chrome (docs/specs/013-workspace/blueprints/workbench-embeds.md "Presentation and UX",
// "Accessibility"): Open in livediagram in the tab bar, and the Reconnect line once the session ended.

describe('WorkbenchOpenLink', () => {
  it('links to the document in a new tab, named as such', () => {
    render(<WorkbenchOpenLink documentId="doc 1" labelled />);

    const link = screen.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' });
    expect(link.getAttribute('href')).toBe('/document/doc%201');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toBe('Open in livediagram');
    expect(link.className).toContain('min-w-7');
  });

  it('is an icon alone where the bar has no room for words', () => {
    render(<WorkbenchOpenLink documentId="d" labelled={false} />);

    const link = screen.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' });
    expect(link.textContent).toBe('');
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

    expect(screen.getByRole('status').textContent).toBe('Reconnect in Acme Editor to keep editing.');
  });

  it('leaves a trashed document to the deleted card', () => {
    render(<WorkbenchReconnectLine workbenchName="Acme Editor" ended="trashed" />);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});
