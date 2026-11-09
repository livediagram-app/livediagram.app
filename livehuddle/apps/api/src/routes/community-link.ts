// A Community visitor never joins the author's room (docs/specs/025-community/community.md): no presence, no
// cursors on the author's board, no live stream, no call. The room's doors (the ticket, the upgrade and the calls
// routes) run in the worker, before any canvas gate, so each checks a link visitor's code against the canvas's post.
import { documentRoom } from '../document-client';
import type { Env } from '../types';

export async function isCommunityCode(
  env: Env,
  documentId: string,
  code: string | null,
): Promise<boolean> {
  if (!code) return false;
  const post = await documentRoom(env, documentId).community();
  return post !== null && post.code === code;
}
