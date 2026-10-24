import { describe, expect, it } from 'vitest';

import { AI_CLIENTS, MCP_URL, STARTER_PROMPTS } from './ai-clients';

// docs/specs/019-marketing/build-with-ai.md "The clients". The client list itself is tested in
// @liveworkspace/marketing-site; this holds livedesign's binding and its own prompts.
describe('Build with AI clients', () => {
  it("point every snippet at this deployment's one MCP address", () => {
    const urls = AI_CLIENTS.flatMap((c) =>
      c.steps.flatMap((s) => (s.code ? (s.code.code.match(/https:\/\/[^\s"]+/g) ?? []) : [])),
    );
    expect(urls.length).toBeGreaterThanOrEqual(8);
    expect(new Set(urls)).toEqual(new Set([MCP_URL]));
  });
});

describe('starter prompts', () => {
  it('name livedesign, so the AI picks the right tool', () => {
    expect(STARTER_PROMPTS.length).toBe(5);
    for (const p of STARTER_PROMPTS) expect(p.prompt).toMatch(/livedesign/);
  });
});
