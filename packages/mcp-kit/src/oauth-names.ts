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
  'liveknowledge',
] as const;

// Well-known AI tools, each with the domains its real redirect URIs sit on.
const TOOL_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  claude: ['claude.ai', 'claude.com', 'anthropic.com'],
  anthropic: ['claude.ai', 'claude.com', 'anthropic.com'],
  chatgpt: ['chatgpt.com', 'openai.com'],
  openai: ['chatgpt.com', 'openai.com'],
  cursor: ['cursor.com', 'cursor.sh'],
};

// The app schemes a well-known tool's own redirect uses (liveworkspace/docs/specs/021-mcp/mcp.md "Redirect
// addresses"): `Cursor` may send its code to `cursor://`, never to another app's scheme.
const TOOL_SCHEMES: Readonly<Record<string, readonly string[]>> = {
  claude: ['claude'],
  anthropic: ['claude'],
  cursor: ['cursor'],
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

// Where a redirect goes: a web address's host, or an app scheme (which is never loopback, whatever its host).
const targetOf = (uri: string): { host: string } | { scheme: string } | null => {
  try {
    const url = new URL(uri);
    if (url.protocol === 'https:' || url.protocol === 'http:') return { host: url.hostname };
    return { scheme: url.protocol.slice(0, -1) };
  } catch {
    return null;
  }
};

const onDomain = (host: string, domains: readonly string[]) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));

/** Why a registered client may not use this name, or null when it may. A name that reads as one of our apps or a
 *  well-known AI tool is refused unless every redirect URI is a loopback one (a code sent there stays on the
 *  person's own machine) or, for a tool, on that tool's own domains or its own app scheme (`cursor://` for Cursor).
 *  An app scheme any other name reserves is refused: any app on the machine could claim it. A tool that passes may
 *  name the server it connects to (Claude Code registers as "Claude Code (<server>)"). */
export function reservedNameRefusal(name: string, redirectUris: readonly string[]): string | null {
  const { squashed, starts } = wordStarts(name);
  const readsAs = (word: string) => starts.some((at) => squashed.startsWith(word, at));
  const targets = redirectUris.map(targetOf);
  const allOn = (domains: readonly string[], schemes: readonly string[] = []) =>
    targets.every(
      (t) =>
        t !== null &&
        ('host' in t
          ? isLoopbackHostname(t.host) || onDomain(t.host, domains)
          : schemes.includes(t.scheme)),
    );
  const tools = Object.keys(TOOL_DOMAINS).filter(readsAs);
  if (tools.some((word) => allOn(TOOL_DOMAINS[word]!, TOOL_SCHEMES[word] ?? []))) return null;
  const reserved = [...OWN_NAMES.filter(readsAs), ...tools][0];
  if (reserved && !allOn([])) return `client_name ${reserved} is reserved`;
  return null;
}
