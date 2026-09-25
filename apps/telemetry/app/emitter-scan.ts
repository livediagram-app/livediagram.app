// Test support for metric-emitters.test.ts: a static scan of every telemetry
// emitter in the repo, resolved to the category·action·type triples it can
// send. The dashboard never emits; it only asks "could anything produce the
// event this card counts?", and the answer used to be a regex that only saw
// `track('A', 'B', 'C')` written out literally. The Settings catalogue, a
// ternary, a lookup table and a forwarding helper were all invisible to it, so
// a card could read an event nothing sends (UI·Toggled·AiOn, when the Settings
// row sends AI·Toggled·AiOn) and nothing noticed.
//
// It parses with the TypeScript compiler API and resolves, within one file:
//   - string literals, `undefined`, ternaries (both branches), parens / `as`;
//   - consts with such an initializer, and `TABLE[key]` over a const object
//     literal (every value of the table);
//   - `titleCaseType('x')` (the editor's capitalise-the-first-letter helper);
//   - a parameter of the enclosing named function, per call site of that
//     function in the same file (so `scheduleCanvasTelemetry('k', 'Type')`
//     resolves the `track(..., type)` inside it, and a forwarding `report`
//     keeps its category, action and type correlated);
//   - objects handed to `insertTelemetryEvents` (the api worker's own writes);
//   - Settings catalogue rows (`event: { category, on, off }` / `changed`),
//     which SettingsCategoryPane emits generically.
// Anything else is COMPUTED: the triple is known to exist but its value is not
// statically knowable. The test decides what a computed value may stand for.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const COMPUTED = Symbol('computed');
export type Value = string | null | typeof COMPUTED;
export type Emit = { category: Value; action: Value; type: Value; path: string };

const EMITTERS = new Set(['track', 'report', 'postTelemetry']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.next-dev', 'out', 'dist', '.wrangler']);
// How many forwarding hops a parameter is followed through.
const MAX_HOPS = 3;

function sourceFiles(dir: string, skip: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP_DIRS.has(name) || path === skip) continue;
    if (statSync(path).isDirectory()) sourceFiles(path, skip, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

type Bindings = Map<string, { node: ts.Expression; bindings: Bindings }>;
const NO_BINDINGS: Bindings = new Map();

class FileScan {
  readonly consts = new Map<string, ts.Expression[]>();
  readonly functions = new Map<string, ts.SignatureDeclaration>();
  readonly calls = new Map<string, ts.CallExpression[]>();
  readonly sf: ts.SourceFile;
  readonly path: string;

  constructor(sf: ts.SourceFile, path: string) {
    this.sf = sf;
    this.path = path;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const init = node.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          this.functions.set(node.name.text, init);
        } else {
          const list = this.consts.get(node.name.text) ?? [];
          list.push(init);
          this.consts.set(node.name.text, list);
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name) this.functions.set(node.name.text, node);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const list = this.calls.get(node.expression.text) ?? [];
        list.push(node);
        this.calls.set(node.expression.text, list);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  // Every value `node` can take, given the parameter bindings in force.
  values(node: ts.Expression, bindings: Bindings, depth = 0): Value[] {
    if (depth > 8) return [COMPUTED];
    const next = (n: ts.Expression, b: Bindings = bindings) => this.values(n, b, depth + 1);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return next(node.expression);
    }
    if (ts.isConditionalExpression(node)) return [...next(node.whenTrue), ...next(node.whenFalse)];
    if (ts.isIdentifier(node)) {
      if (node.text === 'undefined') return [null];
      const bound = bindings.get(node.text);
      if (bound) return this.values(bound.node, bound.bindings, depth + 1);
      if (isParameter(node)) return [COMPUTED];
      const inits = this.consts.get(node.text);
      return inits ? inits.flatMap((i) => next(i)) : [COMPUTED];
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const table = this.consts.get(node.expression.text)?.map(unwrap);
      if (table?.length === 1 && table[0] && ts.isObjectLiteralExpression(table[0])) {
        return table[0].properties.flatMap((p) =>
          ts.isPropertyAssignment(p) ? next(p.initializer) : [COMPUTED],
        );
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'titleCaseType' &&
      node.arguments[0]
    ) {
      return next(node.arguments[0]).map((v) =>
        typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1) : v,
      );
    }
    return [COMPUTED];
  }

  // The binding sets an emit site runs under: one per same-file call of its
  // enclosing named function, so each caller's arguments stay together.
  contexts(node: ts.Node, hops = MAX_HOPS): Bindings[] {
    const fn = enclosingNamedFunction(node);
    if (!fn || hops === 0) return [NO_BINDINGS];
    const decl = this.functions.get(fn.name);
    const sites = this.calls.get(fn.name) ?? [];
    if (!decl || decl !== fn.node || sites.length === 0) return [NO_BINDINGS];
    return sites.flatMap((site) =>
      this.contexts(site, hops - 1).map((outer) => {
        const b: Bindings = new Map();
        decl.parameters.forEach((p, i) => {
          const arg = site.arguments[i];
          if (ts.isIdentifier(p.name) && arg) b.set(p.name.text, { node: arg, bindings: outer });
        });
        return b;
      }),
    );
  }
}

function unwrap(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function isParameter(id: ts.Identifier): boolean {
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent) {
    if (ts.isFunctionLike(n)) {
      if (n.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === id.text)) return true;
    }
  }
  return false;
}

function enclosingNamedFunction(
  node: ts.Node,
): { name: string; node: ts.SignatureDeclaration } | null {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return { name: n.name.text, node: n };
    if (
      (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) &&
      ts.isVariableDeclaration(n.parent) &&
      ts.isIdentifier(n.parent.name)
    ) {
      return { name: n.parent.name.text, node: n };
    }
  }
  return null;
}

function product(scan: FileScan, args: (ts.Expression | undefined)[], b: Bindings): Value[][] {
  const [c, a, t] = args.map((arg) => (arg ? scan.values(arg, b) : [null]));
  const out: Value[][] = [];
  for (const cv of c!) for (const av of a!) for (const tv of t!) out.push([cv, av, tv]);
  return out;
}

function emitsIn(scan: FileScan): Emit[] {
  const out: Emit[] = [];
  const push = (triples: Value[][]) =>
    triples.forEach(([category, action, type]) =>
      out.push({ category: category!, action: action!, type: type!, path: scan.path }),
    );
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      let args = [...node.arguments];
      // The workers' helpers take the Env first: report(env, ...), postTelemetry(env, ...).
      if (name !== 'track' && args[0] && ts.isIdentifier(args[0]) && args[0].text === 'env') {
        args = args.slice(1);
      }
      if (EMITTERS.has(name) && args.length >= 2) {
        for (const b of scan.contexts(node)) push(product(scan, [args[0], args[1], args[2]], b));
      }
      if (name === 'insertTelemetryEvents') {
        for (const arg of node.arguments) {
          ts.forEachChild(arg, function find(child) {
            if (ts.isObjectLiteralExpression(child)) {
              const prop = (key: string) => propertyValue(child, key);
              const c = prop('category');
              if (c) {
                for (const b of scan.contexts(node)) {
                  push(product(scan, [c, prop('action'), prop('type')], b));
                }
              }
            }
            ts.forEachChild(child, find);
          });
        }
      }
    }
    if (ts.isObjectLiteralExpression(node)) out.push(...settingsRow(scan, node));
    ts.forEachChild(node, visit);
  };
  visit(scan.sf);
  return out;
}

function propertyValue(obj: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key) {
      return p.initializer;
    }
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === key) return p.name;
  }
  return undefined;
}

// A Settings catalogue row: `{ kind, event: { category, on, off } }` for a
// toggle, `{ kind, event: { category, changed } }` for a slider, and a choice
// row, whose type is `changed` + the picked option id capitalised
// (SettingsCategoryPane's choiceTelemetryType).
function settingsRow(scan: FileScan, row: ts.ObjectLiteralExpression): Emit[] {
  const event = propertyValue(row, 'event');
  if (!event || !ts.isObjectLiteralExpression(event)) return [];
  const category = propertyValue(event, 'category');
  const kind = propertyValue(row, 'kind');
  if (!category || !kind || !ts.isStringLiteral(kind) || !ts.isStringLiteral(category)) return [];
  const emit = (action: string, type: Value): Emit => ({
    category: category.text,
    action,
    type,
    path: scan.path,
  });
  const literal = (key: string) => {
    const v = propertyValue(event, key);
    return v && ts.isStringLiteral(v) ? v.text : COMPUTED;
  };
  if (kind.text === 'toggle')
    return [emit('Toggled', literal('on')), emit('Toggled', literal('off'))];
  if (kind.text === 'slider') return [emit('Changed', literal('changed'))];
  if (kind.text === 'choice') {
    const changed = literal('changed');
    const options = propertyValue(row, 'options');
    if (changed === COMPUTED || !options || !ts.isArrayLiteralExpression(options)) {
      return [emit('Changed', COMPUTED)];
    }
    return options.elements.map((o) => {
      const id = ts.isObjectLiteralExpression(o) ? propertyValue(o, 'id') : undefined;
      if (!id || !ts.isStringLiteral(id)) return emit('Changed', COMPUTED);
      return emit('Changed', changed + id.text.charAt(0).toUpperCase() + id.text.slice(1));
    });
  }
  return [];
}

// Every emit in `roots`, skipping `skip` (the dashboard itself).
export function scanEmitters(repo: string, roots: string[], skip: string): Emit[] {
  return roots
    .flatMap((root) => sourceFiles(join(repo, root), skip))
    .flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
      return emitsIn(new FileScan(sf, path.slice(repo.length + 1)));
    });
}
