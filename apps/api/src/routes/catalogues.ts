// The public catalogues (docs/specs/015-api/blueprints/cli.md "Catalogue routes", CLI72): the template library and one
// template as an outline, icon search, and the element format. Pure functions over bundled data; no identity, GET
// only, cached five minutes; each answer logs `[catalogues] <segment> <status>`.

import type { IconSearchResponse, TemplateCatalogueResponse } from '@livediagram/api-schema';
import { renderView } from '@livediagram/document-views';
import { addableKinds, elementFormatText, elementKindsText } from '@livediagram/edit-operations';
import { ICON_QUERY_MAX, ICON_SEARCH_MAX_LIMIT, searchIcons } from '@livediagram/icons/search';
import { buildTemplateTab, isTemplateKind, templateCatalogue } from '@livediagram/templates';
import { json, methodNotAllowed, notFound, textPlain } from '../responses';
import type { RouteContext } from './context';

export const CATALOGUE_CACHE_CONTROL = 'public, max-age=300';
export const ICON_SEARCH_DEFAULT_LIMIT = 20;

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
  const decoded = decodeURIComponent(kind);
  if (!isTemplateKind(decoded))
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

function icons(ctx: RouteContext): Response {
  if (ctx.segments.length !== 2) return notFound();
  const query = ctx.url.searchParams.get('query') ?? '';
  const rawLimit = ctx.url.searchParams.get('limit');
  const limit = rawLimit === null ? ICON_SEARCH_DEFAULT_LIMIT : Number(rawLimit);
  if (query.length < 1 || query.length > ICON_QUERY_MAX)
    return json(
      { error: 'invalid_value', message: `query is 1 to ${ICON_QUERY_MAX} characters` },
      { status: 400 },
    );
  if (!Number.isInteger(limit) || limit < 1 || limit > ICON_SEARCH_MAX_LIMIT)
    return json(
      { error: 'invalid_value', message: `limit is 1 to ${ICON_SEARCH_MAX_LIMIT}` },
      { status: 400 },
    );
  return json(searchIcons(query, limit) satisfies IconSearchResponse, { headers: cached });
}

function schema(ctx: RouteContext): Response {
  const kind = ctx.segments[2];
  if (kind === undefined) return textPlain(elementKindsText(), { headers: cached });
  if (ctx.segments.length > 3) return notFound();
  const text = elementFormatText(decodeURIComponent(kind));
  if (text === null)
    return json({ error: 'unknown_kind', kinds: [...addableKinds(), 'arrow'] }, { status: 404 });
  return textPlain(text, { headers: cached });
}

export function handleCatalogues(ctx: RouteContext): Response {
  const segment = ctx.segments[1]!;
  if (ctx.request.method !== 'GET') return answered(segment, methodNotAllowed());
  const route = segment === 'templates' ? templates : segment === 'icons' ? icons : schema;
  return answered(segment, route(ctx));
}
