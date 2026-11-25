// Each app's tools under the one MCP's names (liveworkspace/docs/specs/021-mcp/mcp.md "Names by what they make"):
// renamed by what they make, never by app, every description opening with the noun people use, and every old name
// inside a description, a schema or an answer rewritten to its new one. Pure, so the eval and the naming test build
// exactly the catalogue the Worker serves.
import type { AppSpec } from './apps';

export type ListedTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AppCatalogue = {
  spec: AppSpec;
  // The renamed tools, as listed.
  tools: ListedTool[];
  // New name to the app's own.
  toApp: ReadonlyMap<string, string>;
  // Rewrites every old tool name inside a text to its new one.
  rewrite: (text: string) => string;
};

// The words that say what a tool works on. A name with none of them gets its app's noun after the verb.
const SUBJECT_WORDS: ReadonlySet<string> = new Set([
  'diagram',
  'diagrams',
  'doc',
  'docs',
  'plan',
  'plans',
  'design',
  'designs',
  'knowledge',
  'knowledgebase',
  'knowledgebases',
  'card',
  'cards',
  'sheet',
  'sheets',
  'board',
  'boards',
  'form',
  'forms',
  'article',
  'articles',
  'item',
  'items',
]);

export function hasSubject(name: string): boolean {
  return name.split('_').some((segment) => SUBJECT_WORDS.has(segment));
}

/** An app's tool name under the one MCP. */
export function renameTool(spec: AppSpec, name: string): string {
  const override = spec.overrides[name];
  if (override) return override;
  let renamed = name;
  if (spec.app === 'liveknowledge')
    renamed = renamed.replace(/(^|_)page(s?)(?=_|$)/, '$1knowledge_page$2');
  renamed = renamed.replace(
    new RegExp(`(^|_)${spec.itemWord}(s?)(?=_|$)`),
    (_m, lead: string, plural: string) => `${lead}${spec.itemNoun}${plural}`,
  );
  if (hasSubject(renamed)) return renamed;
  const [verb, ...rest] = renamed.split('_');
  return [verb, spec.insertNoun, ...rest].join('_');
}

// A deprecated alias an app still serves (livediagram's `*_diagram(s)` names): left out of the catalogue.
function isDeprecated(tool: ListedTool): boolean {
  return (
    /\(deprecated\)\s*$/i.test(tool.title ?? '') || /^Deprecated:/.test(tool.description ?? '')
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A rewriter of old tool names (whole words only) to new ones. */
export function nameRewriter(renames: ReadonlyMap<string, string>): (text: string) => string {
  const changed = [...renames].filter(([from, to]) => from !== to);
  if (changed.length === 0) return (text) => text;
  const byOld = new Map(changed);
  const pattern = new RegExp(
    `(?<![A-Za-z0-9_])(${changed
      .map(([from]) => from)
      .toSorted((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})(?![A-Za-z0-9_])`,
    'g',
  );
  return (text) => text.replace(pattern, (old) => byOld.get(old) ?? old);
}

/** Every string inside a JSON value, rewritten; keys are left as they are. */
export function rewriteJson<T>(value: T, rewrite: (text: string) => string): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return rewrite(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object')
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    return node;
  };
  return walk(value) as T;
}

// The keys under which an app's answer carries its own guidance ("read_page reads it back"). Every other string in
// an answer may be what a person wrote (a page's Markdown, a card's title, a comment) and is never rewritten.
const GUIDANCE_KEYS: ReadonlySet<string> = new Set(['next', 'note', 'hint']);

/** The strings under an answer's guidance keys, rewritten, at any depth; everything else exactly as it was. */
export function rewriteGuidance<T>(value: T, rewrite: (text: string) => string): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object')
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => [
          k,
          GUIDANCE_KEYS.has(k) ? rewriteJson(v, rewrite) : walk(v),
        ]),
      );
    return node;
  };
  return walk(value) as T;
}

export function opening(spec: AppSpec): string {
  return `For ${spec.nounPhrase} (${spec.app}).`;
}

/** One app's tools/list, renamed. The old names of the deprecated aliases are rewritten too, should a text name one. */
export function buildAppCatalogue(spec: AppSpec, listed: readonly ListedTool[]): AppCatalogue {
  const kept = listed.filter((tool) => !isDeprecated(tool));
  const renames = new Map(kept.map((tool) => [tool.name, renameTool(spec, tool.name)]));
  const rewrite = nameRewriter(renames);
  const tools = kept.map((tool) => {
    const name = renames.get(tool.name)!;
    const rewritten = rewriteJson(tool, rewrite);
    return {
      ...rewritten,
      name,
      description: `${opening(spec)} ${rewritten.description ?? ''}`.trim(),
    };
  });
  const toApp = new Map(kept.map((tool) => [renames.get(tool.name)!, tool.name]));
  return { spec, tools, toApp, rewrite };
}

/** An app's prompt name under the one MCP: its item word made its noun (`show_my_document` is `show_my_diagram`). */
export function promptName(spec: AppSpec, name: string): string {
  return name
    .split('_')
    .map((part) =>
      part === spec.itemWord
        ? spec.itemNoun
        : part === `${spec.itemWord}s`
          ? `${spec.itemNoun}s`
          : part,
    )
    .join('_');
}

/** Clashes and vague names across a whole catalogue: what the naming test and the Worker's own check refuse. */
export function namingProblems(names: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) problems.push(`${name}: two tools share this name`);
    seen.add(name);
    if (/(^|_)documents?(_|$)/.test(name)) problems.push(`${name}: says a bare "document"`);
    if (!hasSubject(name) && !CORE_SUBJECTLESS.has(name))
      problems.push(`${name}: names nothing it works on`);
  }
  return problems;
}

// The core verbs whose subject is the app's tools themselves.
const CORE_SUBJECTLESS: ReadonlySet<string> = new Set([
  'list_app_tools',
  'read_with_app_tool',
  'change_with_app_tool',
]);
