// Names and outlines made safe in the generated Markdown (docs/specs/027-repositories/blueprints/repository-link.md
// "INDEX.md", RL32): names escaped, code spans and fences one backtick longer than the longest run inside.

const longestRun = (text: string) =>
  Math.max(0, ...[...text.matchAll(/`+/g)].map(([run]) => run.length));

export function markdownText(text: string): string {
  return text
    .replace(/[\\`*_[\]<>#|~]/g, '\\$&')
    .replace(/^([+-]|\d+\.)/, (marker) =>
      marker.length === 1 ? `\\${marker}` : `${marker.slice(0, -1)}\\.`,
    );
}

export function codeSpan(text: string): string {
  const ticks = '`'.repeat(longestRun(text) + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

export function fenceFor(text: string): string {
  return '`'.repeat(Math.max(3, longestRun(text) + 1));
}
