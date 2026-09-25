import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUPS as ACQUISITION } from './AcquisitionView';
import { GROUPS as COLLABORATION } from './CollaborationView';
import { GROUPS as CONTENT } from './ContentView';
import { GROUPS as EDITING } from './EditingView';
import { GROUPS as EXCEPTIONS } from './ExceptionsView';
import { GROUPS as EXTERNAL } from './ExternalConnectionsView';
import { GROUPS as HELP } from './HelpView';
import { GROUPS as HIGHLIGHTS } from './HighlightsView';
import type { MetricGroup } from './MetricCards';

// A card that asks for `type: null` counts ONLY the bare event. When an
// emitter starts sending a type for that category·action, the card silently
// drops those events: "Diagrams Created" read 0 for months after the New
// Diagram wizard began typing it `Cloud` / `Offline`. So every such card must
// have no typed emitter anywhere; a card that wants the typed ones too says
// `allTypes` or `typeIn`.

const REPO = resolve(__dirname, '../../..');
const SOURCE_ROOTS = ['apps', 'packages'].map((d) => join(REPO, d));
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.wrangler']);
// The dashboard reads events, it never emits them.
const DASHBOARD = join(REPO, 'apps', 'telemetry');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP_DIRS.has(name) || path === DASHBOARD) continue;
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const SOURCES = SOURCE_ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
  path: path.slice(REPO.length + 1),
  text: readFileSync(path, 'utf8'),
}));

// The emit helpers: `track` (browser), `report` (api worker), `postTelemetry` (mcp worker).
function typedEmitters(category: string, action: string): string[] {
  const call = new RegExp(
    String.raw`\b(?:track|report|postTelemetry)\(\s*(?:env\s*,\s*)?'${category}'\s*,\s*'${action}'\s*,\s*(?!undefined\s*\))`,
  );
  return SOURCES.filter((s) => call.test(s.text)).map((s) => s.path);
}

const ALL: MetricGroup[] = [
  ...HIGHLIGHTS,
  ...ACQUISITION,
  ...CONTENT,
  ...COLLABORATION,
  ...EDITING,
  ...EXCEPTIONS,
  ...EXTERNAL,
  ...HELP,
];
const UNTYPED = ALL.flatMap((g) => g.metrics).filter(
  (m) => !m.allTypes && !m.typeIn && (m.type ?? null) === null,
);

describe('untyped metric cards', () => {
  it('finds the emitters it scans', () => {
    // Guards the scan itself: a path or regex slip would pass every card below.
    expect(typedEmitters('Diagram', 'Exported').length).toBeGreaterThan(0);
    expect(UNTYPED.length).toBeGreaterThan(0);
  });

  it.each(UNTYPED.map((m) => [m.title, m.category, m.action] as const))(
    '%s (%s·%s) has no typed emitter the card would miss',
    (_title, category, action) => {
      expect(typedEmitters(category, action)).toEqual([]);
    },
  );
});
