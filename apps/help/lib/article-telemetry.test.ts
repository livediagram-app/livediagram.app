import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_ID_OVERRIDES,
  articlePath,
  articleTelemetryId,
  helpPathTelemetryId,
} from '@livediagram/help-registry/telemetry';
import { articles } from './articles';

// Help telemetry (docs/specs/017-telemetry/telemetry.md) names an article by its telemetry id: `Help·View`,
// `Help·Helpful` / `Help·Unhelpful` here, and the editor's help-link
// `UI·Opened`. Two articles with one id report one merged number, which is
// what happened to the two Format Painter and the two Palette articles while
// the id was the bare last path segment. Nothing at runtime notices, so this
// suite is the guard: a new article that reuses a slug fails here until it is
// given an explicit token in TELEMETRY_ID_OVERRIDES.

describe('article telemetry ids', () => {
  it('gives every registry article a distinct id', () => {
    const byId = new Map<string, string[]>();
    for (const a of articles) {
      const id = articleTelemetryId(a);
      byId.set(id, [...(byId.get(id) ?? []), articlePath(a)]);
    }
    const collisions = [...byId.entries()].filter(([, paths]) => paths.length > 1);
    expect(collisions).toEqual([]);
  });

  it('only produces tokens the telemetry ingest accepts', () => {
    // TELEMETRY_TYPE_PATTERN allows [A-Za-z0-9 ._-]{1,40}; a slug-shaped id
    // is a strict subset of that.
    for (const a of articles) expect(articleTelemetryId(a)).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it('points every override at a real article, with a token no slug already uses', () => {
    const paths = new Set(articles.map(articlePath));
    const slugs = new Set(articles.map((a) => a.slug));
    for (const [path, token] of Object.entries(TELEMETRY_ID_OVERRIDES)) {
      expect(paths.has(path), path).toBe(true);
      expect(slugs.has(token), token).toBe(false);
    }
  });

  it('keeps the plain slug for the feature articles and splits off the Tips copies', () => {
    expect(helpPathTelemetryId('/selection-modes/format-painter/')).toBe('format-painter');
    expect(helpPathTelemetryId('/tips-and-tricks/format-painter/')).toBe('tips-format-painter');
    expect(helpPathTelemetryId('search-panel/the-search-panel/command-palette')).toBe(
      'command-palette',
    );
    expect(helpPathTelemetryId('/tips-and-tricks/command-palette/')).toBe('tips-command-palette');
  });

  it('falls back to the last segment for a path that is not an article', () => {
    expect(helpPathTelemetryId('/palette/')).toBe('palette');
    expect(helpPathTelemetryId('')).toBe('');
  });
});
