// A store read while rendering (each product's docs/specs/003-system-architecture/linting.md, `no-store-get-in-render`): the React
// Compiler takes a component's or a hook's `store.get()` for a pure read and keeps its first result while `store`
// keeps its identity, so the reader shows the value it mounted with for good (the Quick Style bar never showed,
// Work Tracker 946). A component or hook subscribes instead (the store's own hook, useSyncExternalStore), reads the
// store in an event handler or an effect, or says 'use no memo' with the reason. Only a call with no arguments is a
// store's read: Map, URLSearchParams and Headers take a key.

export const STORE_GET_IN_RENDER_MESSAGE =
  "A store's .get() while rendering is kept at its first value by the React Compiler. Subscribe (the store's hook, useSyncExternalStore), read it in a handler or effect, or say 'use no memo' with the reason.";

// The few node shapes the check reads, as oxlint's plugin AST (ESTree with `parent`) gives them.
export type AstNode = {
  type: string;
  parent?: AstNode | null;
  [key: string]: unknown;
};

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);
// A component (PascalCase) or a hook (useX): both run while rendering.
const RENDER_NAME = /^(?:[A-Z]|use[A-Z0-9])/;
const NO_MEMO = 'use no memo';

const nameOf = (node: unknown): string | undefined =>
  node && typeof node === 'object' && (node as AstNode).type === 'Identifier'
    ? ((node as AstNode).name as string)
    : undefined;

// The callee's own name: `useMemo(...)` or `React.useMemo(...)`.
function calleeName(call: AstNode): string | undefined {
  const callee = call.callee as AstNode;
  return callee.type === 'MemberExpression' ? nameOf(callee.property) : nameOf(callee);
}

/** True for `x.get()`: a member call named get with no arguments. */
export function isBareGet(node: AstNode): boolean {
  const callee = node.callee as AstNode | undefined;
  return (
    node.type === 'CallExpression' &&
    (node.arguments as unknown[]).length === 0 &&
    callee?.type === 'MemberExpression' &&
    callee.computed !== true &&
    nameOf(callee.property) === 'get'
  );
}

// A function's name as a reader knows it: its own, else the binding it is assigned to, through one wrapping call
// (`const Bar = memo(function (...) {...})`, `export const useX = () => ...`).
function functionName(fn: AstNode): string | undefined {
  const own = nameOf(fn.id);
  if (own) return own;
  let at = fn.parent;
  if (at?.type === 'CallExpression') at = at.parent;
  return at?.type === 'VariableDeclarator' ? nameOf(at.id) : undefined;
}

// A body or a program that opens with 'use no memo'.
function saysNoMemo(block: unknown): boolean {
  const body = (block as AstNode | undefined)?.body;
  if (!Array.isArray(body)) return false;
  // The prologue: the directives a body opens with ('use client', 'use no memo'), in any order.
  for (const statement of body as AstNode[]) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string')
      return false;
    if (statement.directive === NO_MEMO) return true;
  }
  return false;
}

/** True when `call` (a bare `.get()`) runs while a component or hook renders, outside a 'use no memo' file or
 *  function: in its body, or in a `useMemo` it computes, but not in a handler, an effect or another callback. */
export function storeGetInRender(call: AstNode): boolean {
  let at = call.parent;
  while (at) {
    if (FUNCTION_TYPES.has(at.type)) {
      const holder = at.parent;
      // A useMemo's compute runs while rendering: keep walking out to the component that calls it.
      if (holder?.type === 'CallExpression' && calleeName(holder) === 'useMemo') {
        at = holder.parent;
        continue;
      }
      const name = functionName(at);
      return !!name && RENDER_NAME.test(name) && !saysNoMemo(at.body);
    }
    if (at.type === 'Program') return false;
    at = at.parent;
  }
  return false;
}

/** The file opens with 'use no memo': nothing in it is compiled. */
export const fileSaysNoMemo = (program: AstNode): boolean => saysNoMemo(program);
