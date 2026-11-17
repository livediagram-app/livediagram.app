import { describe, expect, it, vi } from 'vitest';
import { roomSocketUrl, viewLiveResult, viewTicketPath } from './app-view-live';

// Each product's docs/specs/015-api/mcp-server.md "Live updates": view_live's shared server side.

describe('view_live', () => {
  it('mints at the item’s view-only path, and opens the room on the editor host', () => {
    expect(viewTicketPath('designs', 'g 1')).toBe('/designs/g%201/room-ticket?cap=view');
    expect(roomSocketUrl('https://www.liveplanner.app', 'projects', 'p/1')).toBe(
      'wss://www.liveplanner.app/api/projects/p%2F1/ws',
    );
    expect(roomSocketUrl('http://localhost:3200', 'projects', 'p1')).toBe(
      'ws://localhost:3200/api/projects/p1/ws',
    );
  });

  it('hands the ticket to the view alone, by the product’s id key, never to the text or the logs', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = viewLiveResult({
      idKey: 'projectId',
      id: 'p1',
      url: 'wss://x/api/projects/p1/ws',
      answer: { ticket: 'rt2~secret', expiresAt: Date.now() + 600_000, level: 'edit' },
    });
    expect(result.structuredContent).toEqual({
      projectId: 'p1',
      url: 'wss://x/api/projects/p1/ws',
      ticket: 'rt2~secret',
      expiresAt: expect.any(Number),
    });
    expect(JSON.stringify(result.content)).not.toContain('secret');
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret');
    expect(info.mock.calls[0]![1]).toEqual({ lapsesInS: 600 });
    info.mockRestore();
  });

  it('answers whether a view that edits may, at edit only', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const at = (level?: string) =>
      (
        viewLiveResult({
          idKey: 'documentId',
          id: 'd1',
          url: 'wss://x',
          answer: { ticket: 't', expiresAt: Date.now() + 1000, level },
          edits: true,
        }).structuredContent as { canEdit: boolean }
      ).canEdit;
    expect(at('edit')).toBe(true);
    for (const level of ['participate', 'view', undefined]) expect(at(level)).toBe(false);
    info.mockRestore();
  });

  it('answers an error, and no ticket, for an answer with no lapse', () => {
    const result = viewLiveResult({
      idKey: 'designId',
      id: 'g1',
      url: 'wss://x',
      answer: { ticket: 'G.bare' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('G.bare');
  });
});
