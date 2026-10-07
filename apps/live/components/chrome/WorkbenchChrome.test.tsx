// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchChrome } from './WorkbenchChrome';

// The workbench's chrome (docs/specs/013-workspace/blueprints/workbench-embeds.md "Presentation and UX",
// "Accessibility"): Open in livediagram, and the Reconnect line once the session ended.

describe('WorkbenchChrome', () => {
  it('links to the document in a new tab, named as such', () => {
    render(<WorkbenchChrome documentId="doc 1" workbenchName="Spinner" ended={null} />);

    const link = screen.getByRole('link', { name: 'Open in livediagram (opens in a new tab)' });
    expect(link.getAttribute('href')).toBe('/document/doc%201');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toBe('Open in livediagram');
  });

  it('says nothing while the session edits, in a polite live region', () => {
    render(<WorkbenchChrome documentId="d" workbenchName="Spinner" ended={null} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('');
  });

  it.each(['expired', 'revoked'] as const)('says how to edit again once %s', (ended) => {
    render(<WorkbenchChrome documentId="d" workbenchName="Spinner" ended={ended} />);

    expect(screen.getByRole('status').textContent).toBe('Reconnect in Spinner to keep editing.');
  });

  it('leaves a trashed document to the deleted card', () => {
    render(<WorkbenchChrome documentId="d" workbenchName="Spinner" ended="trashed" />);

    expect(screen.getByRole('status').textContent).toBe('');
  });
});
