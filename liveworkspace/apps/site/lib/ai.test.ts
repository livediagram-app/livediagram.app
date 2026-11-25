import { CONNECTOR_NAME } from '@liveworkspace/marketing-site/lib/ai-clients';
import { describe, expect, it } from 'vitest';
import { AI_CLIENTS, AI_PRODUCT, aiApps, MCP_URL, STARTER_PROMPTS } from './ai';
import { MCP_APPS } from './mcp-connect';

// liveworkspace/docs/specs/010-site/site.md "Build with AI": the one MCP, for every app at once.
describe("liveworkspace.app's Build with AI", () => {
  it('names the one MCP, under the one connector name, in every snippet', () => {
    expect(MCP_URL).toBe('https://mcp.liveworkspace.app/mcp');
    const claudeCode = AI_CLIENTS.find((c) => c.id === 'claude-code')!;
    expect(claudeCode.steps[0]!.code!.code).toBe(
      `claude mcp add --transport http --scope user ${CONNECTOR_NAME} ${MCP_URL}`,
    );
    expect(CONNECTOR_NAME).toBe('liveworkspace');
  });

  it('asks for every app ticked and offers no CLI', () => {
    expect(AI_PRODUCT.ticked).toBe('every app you want');
    expect(AI_PRODUCT.cli).toBe(false);
    expect(JSON.stringify(AI_CLIENTS)).toContain('with every app you want ticked');
  });

  it('starts every prompt in one app and finishes it in another, naming both', () => {
    expect(STARTER_PROMPTS).toHaveLength(6);
    const apps = MCP_APPS.map((m) => m.app);
    for (const { title, prompt } of STARTER_PROMPTS) {
      const named = apps.filter((app) => prompt.includes(app));
      expect(named.length, title).toBeGreaterThanOrEqual(2);
    }
    // Every app the one MCP reaches is in one, but livedesign, as in the help article's Ask Across Apps.
    const named = new Set(
      apps.filter((app) => STARTER_PROMPTS.some((p) => p.prompt.includes(app))),
    );
    expect([...named].sort()).toEqual([
      'livediagram',
      'livedocuments',
      'liveknowledge',
      'liveplanner',
    ]);
  });

  it('lists the apps the one connection reaches, never livehuddle, each with what it makes', () => {
    const listed = aiApps();
    expect(listed.map(({ app }) => app.id).sort()).toEqual(MCP_APPS.map((m) => m.site).sort());
    expect(listed.some(({ app }) => app.id === 'livehuddle.app')).toBe(false);
    for (const { makes } of listed) expect(makes.length).toBeGreaterThan(40);
  });
});
