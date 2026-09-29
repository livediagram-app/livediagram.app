// Tool names before the container became a document (docs/specs/015-api/mcp-server.md,
// "Deprecated tool names"): each `*_document(s)` tool is also served under its old
// `*_diagram(s)` name, announced as deprecated, until the sunset.

export const LEGACY_TOOL_SUNSET = '2027-04-30';

export function legacyToolName(name: string): string | null {
  return /_documents?$/.test(name) ? name.replace(/_document(s?)$/, '_diagram$1') : null;
}

export function successorToolName(name: string): string {
  return name.replace(/_diagram(s?)$/, '_document$1');
}

export function isDeprecatedDescription(description: string | undefined): boolean {
  return (description ?? '').startsWith('Deprecated');
}

export function deprecatedDescription(successor: string, description: string): string {
  return `Deprecated: use ${successor} instead; this name is removed on ${LEGACY_TOOL_SUNSET}. ${description}`;
}
