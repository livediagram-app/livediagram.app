// view_live's server side every product shares (each product's docs/specs/015-api/mcp-server.md "Live updates"): the
// api path that mints the view-only room ticket for the token's owner (`?cap=view`), the room's socket on the editor
// host, and the tool's answer around the ticket. The ticket rides structured content only: the text line, the logs and
// the telemetry never carry it. Pure: each product's view-tab.ts calls its own api with the path.
import { socketOriginOf } from './app-view';
import { errorResult, type ToolResult } from './tool-result';

/** The api's answer to a view-only mint (`RoomTicketResponse`, @liveworkspace/api-schema), as view_live reads it. */
export type ViewTicket = { ticket: string; expiresAt?: number; level?: string };

/** The api path that mints a view-only ticket into an item's room: `/<collection>/<id>/room-ticket?cap=view`. */
export function viewTicketPath(collection: string, id: string): string {
  return `/${collection}/${encodeURIComponent(id)}/room-ticket?cap=view`;
}

/** The room's socket for an item on this deployment's editor host, as the view opens it with `?t=`. */
export function roomSocketUrl(appBase: string, collection: string, id: string): string {
  return `${socketOriginOf(appBase)}/api/${collection}/${encodeURIComponent(id)}/ws`;
}

/**
 * view_live's answer: the file's id under the product's key, the socket and the ticket with its lapse, and, for a
 * view that edits (livediagram's "Edits in the view"), whether the token may: the level the api answered, edit only.
 * An answer with no lapse is not a view-only ticket, so nothing of it reaches the view.
 */
export function viewLiveResult(opts: {
  idKey: string;
  id: string;
  url: string;
  answer: ViewTicket;
  edits?: boolean;
}): ToolResult {
  const { answer } = opts;
  if (typeof answer.expiresAt !== 'number') return errorResult('Live updates are unavailable.');
  const canEdit = opts.edits ? { canEdit: answer.level === 'edit' } : {};
  console.info('[mcp] view_live', {
    lapsesInS: Math.round((answer.expiresAt - Date.now()) / 1000),
    ...canEdit,
  });
  return {
    content: [{ type: 'text', text: 'Opened live updates for the interactive view.' }],
    structuredContent: {
      [opts.idKey]: opts.id,
      url: opts.url,
      ticket: answer.ticket,
      expiresAt: answer.expiresAt,
      ...canEdit,
    },
  };
}
