import { describe, expect, it, vi } from 'vitest';
import { takeTicketFromAddress } from './workbench-fragment';

// The ticket travels in the fragment (docs/specs/013-workspace/workbench-embeds.md "The handoff"); the
// page reads it and clears it from its address before any request.

const TICKET = 'Ab3_-xYz0123456789abcd';

function address(href: string) {
  const url = new URL(href);
  const location = { hash: url.hash, pathname: url.pathname, search: url.search };
  const history = { replaceState: vi.fn() };
  return { location, history };
}

describe('takeTicketFromAddress', () => {
  it('reads the ticket and the document, and clears the fragment', () => {
    const { location, history } = address(
      `https://livediagram.app/embed/workbench?d=doc-1#ticket=${TICKET}`,
    );

    expect(takeTicketFromAddress(location, history)).toEqual({
      ticket: TICKET,
      documentId: 'doc-1',
    });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/embed/workbench?d=doc-1');
  });

  it('reads no ticket when the fragment has none, and still clears it', () => {
    const { location, history } = address('https://livediagram.app/embed/workbench?d=doc-1#x=1');

    expect(takeTicketFromAddress(location, history)).toEqual({ ticket: null, documentId: 'doc-1' });
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });

  it('reads a ticket of the wrong shape as none', () => {
    const { location, history } = address(
      'https://livediagram.app/embed/workbench?d=doc-1#ticket=short',
    );

    expect(takeTicketFromAddress(location, history).ticket).toBeNull();
  });

  it('reads a reload, whose fragment is gone, as no ticket and touches nothing', () => {
    const { location, history } = address('https://livediagram.app/embed/workbench?d=doc-1');

    expect(takeTicketFromAddress(location, history)).toEqual({ ticket: null, documentId: 'doc-1' });
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('reads no document when the address has none', () => {
    const { location, history } = address(
      `https://livediagram.app/embed/workbench#ticket=${TICKET}`,
    );

    expect(takeTicketFromAddress(location, history)).toEqual({ ticket: TICKET, documentId: null });
  });
});
