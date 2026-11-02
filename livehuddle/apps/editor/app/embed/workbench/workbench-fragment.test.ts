import { describe, expect, it, vi } from 'vitest';
import { takeTicketFromAddress } from './workbench-fragment';

// The ticket travels in the fragment (docs/specs/013-workspace/workbench-embeds.md "The handoff"); the
// page reads it and clears it from its address before any request.

const TICKET = `Ab3_-xYz0123456789abcd.${'0f'.repeat(32)}`;

function address(href: string) {
  const url = new URL(href);
  const location = { hash: url.hash, pathname: url.pathname, search: url.search };
  const history = { replaceState: vi.fn() };
  return { location, history };
}

describe('takeTicketFromAddress', () => {
  it('reads the ticket and the document, and clears the fragment', () => {
    const { location, history } = address(
      `https://www.livehuddle.app/embed/workbench?d=doc-1#ticket=${TICKET}`,
    );

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: TICKET,
      scope: 'document',
      documentId: 'doc-1',
    });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/embed/workbench?d=doc-1');
  });

  it('reads no ticket when the fragment has none, and still clears it', () => {
    const { location, history } = address('https://www.livehuddle.app/embed/workbench?d=doc-1#x=1');

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: null,
      scope: 'document',
      documentId: 'doc-1',
    });
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });

  it('reads a ticket of the wrong shape as none', () => {
    const { location, history } = address(
      'https://www.livehuddle.app/embed/workbench?d=doc-1#ticket=short',
    );

    expect(takeTicketFromAddress(location, history).ticket).toBeNull();
  });

  it('reads a reload, whose fragment is gone, as no ticket and touches nothing', () => {
    const { location, history } = address('https://www.livehuddle.app/embed/workbench?d=doc-1');

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: null,
      scope: 'document',
      documentId: 'doc-1',
    });
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('reads no document when the address has none', () => {
    const { location, history } = address(
      `https://www.livehuddle.app/embed/workbench#ticket=${TICKET}`,
    );

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: TICKET,
      scope: 'document',
      documentId: null,
    });
  });
});

describe('takeTicketFromAddress, workspace scope', () => {
  it.each([
    'https://www.livehuddle.app/embed/workbench/explorer',
    'https://www.livehuddle.app/embed/workbench/explorer/folder/f1',
    'https://www.livehuddle.app/embed/workbench/document/doc-1',
  ])('reads %s as the workspace scope, with no document', (href) => {
    const { location, history } = address(`${href}#ticket=${TICKET}`);

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: TICKET,
      scope: 'workspace',
      documentId: null,
    });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', new URL(href).pathname);
  });

  it('reads the document page with a trailing slash as the document scope', () => {
    const { location, history } = address(
      `https://www.livehuddle.app/embed/workbench/?d=doc-1#ticket=${TICKET}`,
    );

    expect(takeTicketFromAddress(location, history).scope).toBe('document');
  });
});
