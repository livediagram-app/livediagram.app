import { describe, expect, it } from 'vitest';
import { COMMUNITY_HELP } from '@livedocuments/help-registry/community';
import { articles } from '@livedocuments/help-registry';
import { articleTelemetryId, helpPathTelemetryId } from '@livedocuments/help-registry/telemetry';

// The Community's deep links name registered articles, with the telemetry ids the registry gives them.
describe('COMMUNITY_HELP', () => {
  it('points at registered articles', () => {
    for (const { href, telemetryId } of Object.values(COMMUNITY_HELP)) {
      const path = href.replace(/^\/help\//, '').replace(/\/$/, '');
      const article = articles.find((a) => `${a.categorySlug}/${a.slug}` === path);
      expect(article, href).toBeTruthy();
      expect(articleTelemetryId(article!)).toBe(telemetryId);
      expect(helpPathTelemetryId(path)).toBe(telemetryId);
    }
  });
});
