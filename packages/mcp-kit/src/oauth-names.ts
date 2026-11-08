// Names a registered client may not take (liveworkspace/docs/specs/003-accounts/blueprints/oauth.md "Registered
// clients"; each product's docs/specs/015-api/mcp-server.md §3). Registration is open, so a name is whatever the
// registrant typed; the consent screen marks every registered client Unverified App, but a name that reads as one of
// our own apps, or as a well-known AI tool sending its code somewhere else, is refused outright rather than shown.

import { isLoopbackHostname } from '@liveworkspace/api-kit/request-auth';

// Our own apps and the platform. No registered client is ours (our CLIs are built in), so these have no domains of
// their own here: only a loopback redirect, or an authentic tool naming the server it connects to, passes.
const OWN_NAMES = [
  'liveworkspace',
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livepages',
  'livedesign',
  'livehuddle',
] as const;

// Well-known AI tools, each with the domains its real redirect URIs sit on.
const TOOL_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  claude: ['claude.ai', 'claude.com', 'anthropic.com'],
  anthropic: ['claude.ai', 'claude.com', 'anthropic.com'],
  chatgpt: ['chatgpt.com', 'openai.com'],
  openai: ['chatgpt.com', 'openai.com'],
  cursor: ['cursor.com', 'cursor.sh'],
};

// The name as lower-case letters and digits, with the offsets its words start at: NFKC first (so full-width or
// styled letters read as plain ones), then words split on anything that is not a letter or digit and at a lower to
// upper case step (`MyClaude`), so a reserved word is found at any word start, across spaces and punctuation
// (`Live Diagram`, `C.l.a.u.d.e`).
function wordStarts(name: string): { squashed: string; starts: number[] } {
  const words = name
    .normalize('NFKC')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const starts: number[] = [];
  let squashed = '';
  for (const word of words) {
    starts.push(squashed.length);
    squashed += word;
  }
  return { squashed, starts };
}

const hostOf = (uri: string): string | null => {
  try {
    return new URL(uri).hostname;
  } catch {
    return null;
  }
};

const onDomain = (host: string, domains: readonly string[]) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));

/** Why a registered client may not use this name, or null when it may. A name that reads as one of our apps or a
 *  well-known AI tool is refused unless every redirect URI is a loopback one (a code sent there stays on the
 *  person's own machine) or, for a tool, on that tool's own domains. A tool that passes may name the server it
 *  connects to (Claude Code registers as "Claude Code (<server>)"). */
export function reservedNameRefusal(name: string, redirectUris: readonly string[]): string | null {
  const { squashed, starts } = wordStarts(name);
  const readsAs = (word: string) => starts.some((at) => squashed.startsWith(word, at));
  const hosts = redirectUris.map(hostOf);
  const allOn = (domains: readonly string[]) =>
    hosts.every((h) => h !== null && (isLoopbackHostname(h) || onDomain(h, domains)));
  const tools = Object.keys(TOOL_DOMAINS).filter(readsAs);
  if (tools.some((word) => allOn(TOOL_DOMAINS[word]!))) return null;
  const reserved = [...OWN_NAMES.filter(readsAs), ...tools][0];
  if (reserved && !allOn([])) return `client_name ${reserved} is reserved`;
  return null;
}
