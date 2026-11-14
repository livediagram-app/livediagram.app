import { describe, expect, it, vi } from 'vitest';
import { createOpenApiRoute } from './openapi-route';
import type { OpenApiDocument } from './openapi-types';

const build = vi.fn(() => ({ openapi: '3.1.0' }) as unknown as OpenApiDocument);
const route = createOpenApiRoute({
  build,
  json: (body, init) => Response.json(body, init),
  methodNotAllowed: () => new Response(null, { status: 405 }),
  notFound: () => new Response(null, { status: 404 }),
});
const ctx = (method: string, segments = ['api', 'openapi.json']) => ({
  request: new Request('https://app.test/api/openapi.json', { method }),
  segments,
});

describe('createOpenApiRoute', () => {
  it('answers 404 off its path and 405 for another method', () => {
    expect(route(ctx('GET', ['api', 'openapi.json', 'x'])).status).toBe(404);
    expect(route(ctx('POST')).status).toBe(405);
    expect(build).not.toHaveBeenCalled();
  });

  it('answers the description, cacheable, built once per isolate', async () => {
    const first = route(ctx('GET'));
    expect(first.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(await first.json()).toEqual({ openapi: '3.1.0' });
    route(ctx('GET'));
    expect(build).toHaveBeenCalledTimes(1);
  });
});
