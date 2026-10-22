// The public catalogues (docs/specs/015-api/blueprints/cli.md "Catalogue routes", CLI72): the template library and one
// template as an outline, and the element format. Pure functions over bundled data; no identity, GET
// only, cached five minutes; each answer logs `[catalogues] <segment> <status>`.

import type { TemplateCatalogueResponse } from '@liveplanner/api-schema';
import { renderView } from '@liveplanner/project-views';
import { addableKinds, elementFormatText, elementKindsText } from '@liveplanner/edit-operations';
import { buildTemplateTab, templateCatalogue, templateKindOf } from '@liveplanner/templates';
import { json, methodNotAllowed, notFound, textPlain } from '../responses';
import type { RouteContext } from './context';

export const CATALOGUE_CACHE_CONTROL = 'public, max-age=300';

const cached = { 'Cache-Control': CATALOGUE_CACHE_CONTROL };

function answered(segment: string, res: Response): Response {
  console.info(`[catalogues] ${segment} ${res.status}`);
  return res;
}

function templates(ctx: RouteContext): Response {
  const kind = ctx.segments[2];
  if (kind === undefined)
    return json(templateCatalogue() satisfies TemplateCatalogueResponse, { headers: cached });
  if (ctx.segments.length > 3) return notFound();
  const decoded = templateKindOf(decodeURIComponent(kind));
  if (!decoded)
    return json(
      { error: 'unknown_template', kinds: templateCatalogue().templates.map((t) => t.kind) },
      { status: 404 },
    );
  const title = templateCatalogue().templates.find((t) => t.kind === decoded)?.title ?? decoded;
  const tab = buildTemplateTab(decoded, title, decoded);
  const view = renderView({ view: 'outline', door: 'cli' }, tab);
  if (!view.ok) return json({ error: 'view_failed' }, { status: 500 });
  return ctx.url.searchParams.get('json') === '1'
    ? json(view.json, { headers: cached })
    : textPlain(view.text, { headers: cached });
}

function schema(ctx: RouteContext): Response {
  const kind = ctx.segments[2];
  if (kind === undefined) return textPlain(elementKindsText(), { headers: cached });
  if (ctx.segments.length > 3) return notFound();
  const text = elementFormatText(decodeURIComponent(kind));
  if (text === null) return json({ error: 'unknown_kind', kinds: addableKinds() }, { status: 404 });
  return textPlain(text, { headers: cached });
}

export function handleCatalogues(ctx: RouteContext): Response {
  const segment = ctx.segments[1]!;
  if (ctx.request.method !== 'GET') return answered(segment, methodNotAllowed());
  const route = segment === 'templates' ? templates : schema;
  return answered(segment, route(ctx));
}
