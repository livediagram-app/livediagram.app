// Where a project came from when a tool made it (docs/specs/013-workspace/folders.md "Provenance"; docs/specs/015-api/api.md):
// the editor's AI assistant, the MCP server, or the CLI. Absent is a person's project. Only the AI assistant and the
// MCP count as Made by AI; the CLI is a front door for scripts as much as for agents.

export const PROJECT_SOURCES = ['ai', 'mcp', 'cli'] as const;
export type ProjectSource = (typeof PROJECT_SOURCES)[number];

export function isProjectSource(value: unknown): value is ProjectSource {
  return PROJECT_SOURCES.some((source) => source === value);
}

export function isMadeByAiSource(source: string | null | undefined): boolean {
  return source === 'ai' || source === 'mcp';
}
