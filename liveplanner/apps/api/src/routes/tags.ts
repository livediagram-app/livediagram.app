// /api/tags — per-person project tags (docs/specs/013-workspace/tags.md "API").
//
// GET    /api/tags                               -> { tags, links }
// POST   /api/tags                               -> 201 { tag }   make one: { id, name, colour }
// PUT    /api/tags/:id                           -> { tag }       rename / recolour: { name?, colour? }
// DELETE /api/tags/:id                           -> 204           its links cascade
// PUT    /api/tags/:id/projects/:projectId     -> 204           put it on the project
// DELETE /api/tags/:id/projects/:projectId     -> 204           take it off
//
// Hybrid identity like the rest of the api, guests included. Like a star, putting a tag on a project checks no access
// to the project: the link is the tagger's own row, granting and revealing nothing, and the Tags page shows only the
// projects the reader can already open.

import {
  TAG_ERRORS,
  isTagColour,
  isTagId,
  normaliseTagName,
  type TagColour,
} from '@liveplanner/api-schema';
import { conflict, json, noContent, notFound } from '../responses';
import {
  addProjectTag,
  createTag,
  deleteTag,
  listTags,
  removeProjectTag,
  updateTag,
  type TagWriteResult,
} from '../db';
import { readBody, requireOwner, type RouteContext } from './context';

const invalid = (message: string) => json({ error: TAG_ERRORS.invalid, message }, { status: 400 });

// A refused write as its response; the reason logged without the tag's name.
function refused(result: Extract<TagWriteResult<unknown>, { ok: false }>, op: string): Response {
  console.info(`[tags] refused op=${op} reason=${result.reason}`);
  if (result.reason === 'name-taken') return conflict(TAG_ERRORS.nameTaken);
  if (result.reason === 'limit') return conflict(TAG_ERRORS.limit);
  return notFound();
}

// The name and colour of a body, each checked when present (`required` for a create).
function readFields(
  body: Record<string, unknown>,
  required: boolean,
): { name?: string; colour?: TagColour } | Response {
  const out: { name?: string; colour?: TagColour } = {};
  if (required || body.name !== undefined) {
    const name = normaliseTagName(body.name);
    if (!name) return invalid('name must be 1 to 32 characters');
    out.name = name;
  }
  if (required || body.colour !== undefined) {
    if (!isTagColour(body.colour)) return invalid('colour must be a standard colour or #rrggbb');
    out.colour = body.colour.toLowerCase();
  }
  return out;
}

export async function handleTags(ctx: RouteContext): Promise<Response> {
  const { request, env, segments } = ctx;
  if (segments[1] !== 'tags') return notFound();
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const tagId = segments[2];

  if (segments.length === 2) {
    if (request.method === 'GET') return json(await listTags(env, owner));
    if (request.method === 'POST') {
      const body = await readBody(ctx);
      if (body instanceof Response) return body;
      if (!isTagId(body.id)) return invalid('id must be a short id');
      const fields = readFields(body, true);
      if (fields instanceof Response) return fields;
      const result = await createTag(env, owner, {
        id: body.id,
        name: fields.name!,
        colour: fields.colour!,
      });
      if (!result.ok) return refused(result, 'create');
      return json({ tag: result.value }, { status: 201 });
    }
    return notFound();
  }

  if (!tagId || !isTagId(tagId)) return notFound();

  if (segments.length === 3) {
    if (request.method === 'PUT') {
      const body = await readBody(ctx);
      if (body instanceof Response) return body;
      const fields = readFields(body, false);
      if (fields instanceof Response) return fields;
      const result = await updateTag(env, owner, tagId, fields);
      if (!result.ok) return refused(result, 'update');
      return json({ tag: result.value });
    }
    if (request.method === 'DELETE') {
      return (await deleteTag(env, owner, tagId)) ? noContent() : notFound();
    }
    return notFound();
  }

  const projectId = segments[4];
  if (segments.length === 5 && segments[3] === 'projects' && projectId) {
    if (request.method === 'PUT') {
      return (await addProjectTag(env, owner, tagId, projectId)) ? noContent() : notFound();
    }
    if (request.method === 'DELETE') {
      return (await removeProjectTag(env, owner, tagId, projectId)) ? noContent() : notFound();
    }
  }
  return notFound();
}
