// Test support for metric-emitters.test.ts: a static scan of every telemetry
// emitter in the repo, resolved to the category·action·type triples it can
// send. The dashboard never emits; it only asks "could anything produce the
// event this card counts?", and the answer used to be a regex that only saw
// `track('A', 'B', 'C')` written out literally. The Settings catalogue, a
// ternary, a lookup table and a forwarding helper were all invisible to it, so
// a card could read an event nothing sends (UI·Toggled·X, when the Settings
// row sends another category's ·Toggled·X) and nothing noticed.
//
// It parses with the TypeScript compiler API and resolves:
//   - string literals, `undefined`, ternaries (both branches), parens / `as`;
//   - consts with such an initializer, and `TABLE[key]` over a const object
//     literal (every value of the table), within the file;
//   - `titleCaseType('x')` (the editor's capitalise-the-first-letter helper);
//   - a parameter of the enclosing named function, per call site of that
//     function in the same file, so a forwarding helper keeps its category,
//     action and type correlated;
//   - a parameter of an anonymous callback, through the calls the function it
//     is handed to makes (`createVoteTally(id, (action, id) => track(...))`),
//     and of a returned closure, through the calls made on the variable it is
//     stored in (`const schedule = useDebouncedCanvasTelemetry(); schedule('k',
//     'BackgroundColor')`), in any file;
//   - objects handed to `insertTelemetryEvents` (the api worker's own writes);
//   - Settings catalogue rows (emitter-scan-settings.ts).
// Anything else is COMPUTED: the triple is known to exist but its value is not
// statically knowable. The test decides what a computed value may stand for.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  isArrowFunction,
  isAsExpression,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isReturnStatement,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isStringLiteral,
  isVariableDeclaration,
  SyntaxKind,
  type CallExpression,
  type Expression,
  type Identifier,
  type Node,
  type ObjectLiteralExpression,
  type SignatureDeclaration,
  type SourceFile,
} from 'typescript/unstable/ast';
import { parseSourceFiles } from '@livedesign/source-ast';
import { settingsRowEmits } from './emitter-scan-settings';

export const COMPUTED = Symbol('computed');
export type Value = string | null | typeof COMPUTED;
export type Emit = { category: Value; action: Value; type: Value; path: string };

// The emit helpers: `track` (browsers), `siteTrack` (the public sites' shared
// tracker, scanned under its own name where an app calls it directly rather
// than re-exporting it as `track` the way help does),
// `report` / `reportServerEvent` (api worker), `postTelemetry` (mcp worker).
// The workers' helpers take the Env first.
const EMITTERS = new Set(['track', 'siteTrack', 'report', 'reportServerEvent', 'postTelemetry']);
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

type Fn = SignatureDeclaration;

// Every kind that takes parameters: functions, methods, accessors and signature types.
const FUNCTION_LIKE = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
  SyntaxKind.CallSignature,
  SyntaxKind.ConstructSignature,
  SyntaxKind.MethodSignature,
  SyntaxKind.IndexSignature,
  SyntaxKind.FunctionType,
  SyntaxKind.ConstructorType,
]);
const isFunctionLike = (node: Node): node is Fn => FUNCTION_LIKE.has(node.kind);
type Bound = { node: Expression; bindings: Bindings; scan: FileScan };
type Bindings = Map<string, Bound>;
const NO_BINDINGS: Bindings = new Map();

// Cross-file lookups: functions by name, and the variables holding a call's
// result (`const schedule = useDebouncedCanvasTelemetry()`), by callee name.
class Repo {
  readonly scans: FileScan[] = [];
  readonly functions = new Map<string, { scan: FileScan; decl: Fn }[]>();
  readonly resultVars = new Map<string, { scan: FileScan; name: string }[]>();

  add(scan: FileScan) {
    this.scans.push(scan);
    for (const [name, decl] of scan.functions) push(this.functions, name, { scan, decl });
    for (const [callee, names] of scan.resultVars) {
      for (const name of names) push(this.resultVars, callee, { scan, name });
    }
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

class FileScan {
  readonly consts = new Map<string, Expression[]>();
  readonly functions = new Map<string, Fn>();
  readonly calls = new Map<string, CallExpression[]>();
  readonly resultVars = new Map<string, string[]>();
  readonly sf: SourceFile;
  readonly path: string;
  readonly repo: Repo;

  constructor(sf: SourceFile, path: string, repo: Repo) {
    this.sf = sf;
    this.path = path;
    this.repo = repo;
    const visit = (node: Node) => {
      if (isVariableDeclaration(node) && isIdentifier(node.name) && node.initializer) {
        const init = node.initializer;
        if (isArrowFunction(init) || isFunctionExpression(init)) {
          this.functions.set(node.name.text, init);
        } else {
          push(this.consts, node.name.text, init);
          if (isCallExpression(init) && isIdentifier(init.expression)) {
            push(this.resultVars, init.expression.text, node.name.text);
          }
        }
      }
      if (isFunctionDeclaration(node) && node.name) this.functions.set(node.name.text, node);
      if (isCallExpression(node) && isIdentifier(node.expression)) {
        push(this.calls, node.expression.text, node);
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }

  // Every value `node` can take, given the parameter bindings in force.
  values(node: Expression, bindings: Bindings, depth = 0): Value[] {
    if (depth > 8) return [COMPUTED];
    const next = (n: Expression) => this.values(n, bindings, depth + 1);
    if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (
      isParenthesizedExpression(node) ||
      isAsExpression(node) ||
      isSatisfiesExpression(node) ||
      isNonNullExpression(node)
    ) {
      return next(node.expression);
    }
    if (isConditionalExpression(node)) return [...next(node.whenTrue), ...next(node.whenFalse)];
    if (isIdentifier(node)) {
      if (node.text === 'undefined') return [null];
      const bound = bindings.get(node.text);
      if (bound) return bound.scan.values(bound.node, bound.bindings, depth + 1);
      if (isParameter(node)) return [COMPUTED];
      const inits = this.consts.get(node.text);
      return inits ? inits.flatMap(next) : [COMPUTED];
    }
    if (isElementAccessExpression(node) && isIdentifier(node.expression)) {
      const table = this.consts.get(node.expression.text)?.map(unwrap);
      if (table?.length === 1 && table[0] && isObjectLiteralExpression(table[0])) {
        return table[0].properties.flatMap((p) =>
          isPropertyAssignment(p) ? next(p.initializer) : [COMPUTED],
        );
      }
    }
    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === 'titleCaseType' &&
      node.arguments[0]
    ) {
      return next(node.arguments[0]).map((v) =>
        typeof v === 'string' ? v.charAt(0).toUpperCase() + v.slice(1) : v,
      );
    }
    return [COMPUTED];
  }

  // The binding sets an emit site runs under: one per call that can reach it,
  // so each caller's arguments stay together. Walks out through the enclosing
  // functions and binds the first one whose callers it can find.
  contexts(node: Node, hops = MAX_HOPS): Bindings[] {
    if (hops === 0) return [NO_BINDINGS];
    for (let n: Node | undefined = node.parent; n; n = n.parent) {
      if (!isFunctionLike(n)) continue;
      const name = functionName(n);
      if (name !== null) {
        if (this.functions.get(name) !== n) return [NO_BINDINGS];
        const sites = (this.calls.get(name) ?? []).map((call) => ({
          call,
          scan: this as FileScan,
        }));
        return sites.length ? this.bind(n, sites, hops) : [NO_BINDINGS];
      }
      const sites = [...this.callbackSites(n), ...this.closureSites(n)];
      if (sites.length) return this.bind(n, sites, hops);
    }
    return [NO_BINDINGS];
  }

  private bind(fn: Fn, sites: { call: CallExpression; scan: FileScan }[], hops: number) {
    return sites.flatMap(({ call, scan }) =>
      scan.contexts(call, hops - 1).map((outer) => {
        const b: Bindings = new Map();
        fn.parameters.forEach((p, i) => {
          const arg = call.arguments[i];
          if (isIdentifier(p.name) && arg) b.set(p.name.text, { node: arg, bindings: outer, scan });
        });
        return b;
      }),
    );
  }

  // `f(x, (a, b) => ...)`: the calls f's body makes on that parameter.
  private callbackSites(fn: Node) {
    const call = fn.parent;
    if (!call || !isCallExpression(call) || !isIdentifier(call.expression)) return [];
    const index = call.arguments.indexOf(fn as Expression);
    return this.resolve(call.expression.text).flatMap(({ scan, decl }) => {
      const param = decl.parameters[index]?.name;
      if (!param || !isIdentifier(param)) return [];
      const calls = (scan.calls.get(param.text) ?? []).filter((c) => within(c, decl));
      return calls.map((c) => ({ call: c, scan }));
    });
  }

  // `function f() { return (a, b) => ... }`: the calls made on `const g = f()`.
  private closureSites(fn: Node) {
    const ret = fn.parent;
    if (!ret || !isReturnStatement(ret)) return [];
    let outer: Node | undefined = ret.parent;
    while (outer && !isFunctionLike(outer)) outer = outer.parent;
    const name = outer ? functionName(outer) : null;
    if (name === null) return [];
    return (this.repo.resultVars.get(name) ?? []).flatMap(({ scan, name: v }) =>
      (scan.calls.get(v) ?? []).map((c) => ({ call: c, scan })),
    );
  }

  // A function by name: this file's first, else a unique one in the repo.
  private resolve(name: string): { scan: FileScan; decl: Fn }[] {
    const own = this.functions.get(name);
    if (own) return [{ scan: this, decl: own }];
    const found = this.repo.functions.get(name) ?? [];
    return found.length === 1 ? found : [];
  }
}

function functionName(n: Node): string | null {
  if (isFunctionDeclaration(n) && n.name) return n.name.text;
  if (
    (isArrowFunction(n) || isFunctionExpression(n)) &&
    isVariableDeclaration(n.parent) &&
    isIdentifier(n.parent.name)
  ) {
    return n.parent.name.text;
  }
  return null;
}

function within(node: Node, ancestor: Node): boolean {
  for (let n: Node | undefined = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

function unwrap(node: Expression): Expression {
  while (isParenthesizedExpression(node) || isAsExpression(node) || isSatisfiesExpression(node)) {
    node = node.expression;
  }
  return node;
}

function isParameter(id: Identifier): boolean {
  for (let n: Node | undefined = id.parent; n; n = n.parent) {
    if (isFunctionLike(n)) {
      if (n.parameters.some((p) => isIdentifier(p.name) && p.name.text === id.text)) return true;
    }
  }
  return false;
}

export function propertyValue(obj: ObjectLiteralExpression, key: string): Expression | undefined {
  for (const p of obj.properties) {
    if (isPropertyAssignment(p) && isIdentifier(p.name) && p.name.text === key) {
      return p.initializer;
    }
    if (isShorthandPropertyAssignment(p) && isIdentifier(p.name) && p.name.text === key)
      return p.name;
  }
  return undefined;
}

function product(scan: FileScan, args: (Expression | undefined)[], b: Bindings): Value[][] {
  const [c, a, t] = args.map((arg) => (arg ? scan.values(arg, b) : [null]));
  const out: Value[][] = [];
  for (const cv of c!) for (const av of a!) for (const tv of t!) out.push([cv, av, tv]);
  return out;
}

function emitsIn(scan: FileScan): Emit[] {
  const out: Emit[] = [];
  const add = (node: Node, args: (Expression | undefined)[]) => {
    for (const b of scan.contexts(node)) {
      for (const [category, action, type] of product(scan, args, b)) {
        out.push({ category: category!, action: action!, type: type!, path: scan.path });
      }
    }
  };
  const visit = (node: Node) => {
    if (isCallExpression(node) && isIdentifier(node.expression)) {
      const name = node.expression.text;
      let args = [...node.arguments];
      if (name !== 'track' && args[0] && isIdentifier(args[0]) && args[0].text === 'env') {
        args = args.slice(1);
      }
      if (EMITTERS.has(name) && args.length >= 2) add(node, [args[0], args[1], args[2]]);
      if (name === 'insertTelemetryEvents') {
        for (const arg of node.arguments) {
          arg.forEachChild(function find(child) {
            if (isObjectLiteralExpression(child)) {
              const prop = (key: string) => propertyValue(child, key);
              if (prop('category')) add(node, [prop('category'), prop('action'), prop('type')]);
            }
            child.forEachChild(find);
          });
        }
      }
    }
    if (isObjectLiteralExpression(node)) out.push(...settingsRowEmits(scan.path, node));
    node.forEachChild(visit);
  };
  visit(scan.sf);
  return out;
}

// Every emit in `roots`, skipping `skip` (the dashboard itself).
export function scanEmitters(repoRoot: string, roots: string[], skip: string): Emit[] {
  const repo = new Repo();
  const paths = roots.flatMap((root) => sourceFiles(join(repoRoot, root), skip));
  for (const sf of parseSourceFiles(paths)) {
    repo.add(new FileScan(sf, sf.fileName.slice(repoRoot.length + 1), repo));
  }
  return repo.scans.flatMap(emitsIn);
}
