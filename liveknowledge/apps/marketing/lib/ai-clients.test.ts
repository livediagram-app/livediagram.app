import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { TRANSCRIPT_TOOLS } from '@/components/ai/AgentTranscript';
import { AI_CLIENTS, MCP_URL, STARTER_PROMPTS } from './ai-clients';

// docs/specs/019-marketing/build-with-ai.md "The clients".
describe('the Build with AI clients', () => {
  it("point every snippet at this deployment's one MCP address", () => {
    const urls = AI_CLIENTS.flatMap((c) =>
      c.steps.flatMap((s) => (s.code ? (s.code.code.match(/https:\/\/[^\s"]+/g) ?? []) : [])),
    );
    expect(urls.length).toBeGreaterThanOrEqual(8);
    expect(new Set(urls)).toEqual(new Set([MCP_URL]));
  });

  it('name liveknowledge, so the AI picks the right tool', () => {
    for (const prompt of STARTER_PROMPTS) expect(prompt.prompt).toContain('liveknowledge');
  });

  it('ask for nothing the fork brought and liveknowledge cut', () => {
    for (const { title, prompt } of STARTER_PROMPTS) {
      expect(`${title} ${prompt}`).not.toMatch(/slide|deck|infographic|poster|resume|layout/i);
    }
  });
});

// The transcript on the landing page and /ai shows real tool names: each is one the MCP server registers
// (packages/agent-verbs declares them; apps/mcp/src registers each by that declaration).
describe('the agent transcript', () => {
  const declared = readFileSync(
    fileURLToPath(new URL('../../../packages/agent-verbs/src/verbs/mcp-tools.ts', import.meta.url)),
    'utf8',
  );
  const tools = new Set([...declared.matchAll(/mcpTool\(\s*'([a-z_]+)'/g)].map((m) => m[1]));

  it('finds the catalogue it checks against', () => {
    expect(tools.size).toBeGreaterThan(5);
  });

  it.each(TRANSCRIPT_TOOLS)('%s is a tool the MCP server has', (tool) => {
    expect(tools.has(tool)).toBe(true);
  });
});
