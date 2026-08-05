// /api/custom-themes — user-built themes, owner-scoped (spec/44).
// Mirrors /api/folders one-for-one: requireOwner guard, 400/403/404
// conventions, list / create / update / delete. Guests included (the
// owner id is the X-Owner-Id header when there's no Clerk token).

import {
  createCustomTheme,
  deleteCustomTheme,
  getCustomTheme,
  listCustomThemesByOwner,
  updateCustomTheme,
} from '../db';
import type { CustomThemeDefinition } from '../types';
import { badRequest, forbidden, json, noContent, notFound } from '../responses';
import { requireOwner, type RouteContext } from './context';
import { MAX_NAME_LEN, MAX_THEME_DEF_BYTES, byteLength } from '../limits';
import { recordThemeDeleted, recordThemeSaved } from '../timeline';

// Reject an over-long name or an oversized definition JSON. Returns the
// rejection Response, or null when both are within bounds.
function themeTooLarge(
  name: string | undefined,
  definition: CustomThemeDefinition | undefined,
): Response | null {
  if (typeof name === 'string' && name.length > MAX_NAME_LEN) return badRequest('name too long');
  if (definition !== undefined && byteLength(JSON.stringify(definition)) > MAX_THEME_DEF_BYTES) {
    return json({ error: 'payload_too_large' }, { status: 413 });
  }
  return null;
}

export async function handleCustomThemes(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'custom-themes') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;

  // /api/custom-themes — list / create
  if (segments.length === 2) {
    if (request.method === 'GET') {
      const themes = await listCustomThemesByOwner(env, owner);
      return json({ themes });
    }
    if (request.method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        name?: string;
        definition?: CustomThemeDefinition;
      };
      if (!body.id || !body.name || !body.definition) {
        return badRequest('missing id/name/definition');
      }
      const tooBig = themeTooLarge(body.name, body.definition);
      if (tooBig) return tooBig;
      const theme = await createCustomTheme(env, {
        id: body.id,
        ownerId: owner,
        name: body.name,
        definition: body.definition,
      });
      ctx.waitUntil?.(recordThemeSaved(env, { id: theme.id, name: theme.name }, owner));
      return json({ theme }, { status: 201 });
    }
  }

  // /api/custom-themes/<id> — update / delete
  if (segments.length === 3) {
    const id = segments[2]!;
    const existing = await getCustomTheme(env, id);
    if (!existing) return notFound();
    if (existing.ownerId !== owner) return forbidden();
    if (request.method === 'PUT') {
      const body = (await request.json()) as {
        name?: string;
        definition?: CustomThemeDefinition;
      };
      const tooBig = themeTooLarge(body.name, body.definition);
      if (tooBig) return tooBig;
      await updateCustomTheme(env, id, { name: body.name, definition: body.definition });
      const updated = await getCustomTheme(env, id);
      return json({ theme: updated });
    }
    if (request.method === 'DELETE') {
      const doomed = await getCustomTheme(env, id);
      await deleteCustomTheme(env, id);
      if (doomed) {
        ctx.waitUntil?.(recordThemeDeleted(env, { id, name: doomed.name }, owner));
      }
      return noContent();
    }
  }
  return notFound();
}
