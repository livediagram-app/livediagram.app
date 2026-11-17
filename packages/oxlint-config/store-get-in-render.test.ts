import { beforeAll, describe, expect, it } from 'vitest';
import { findingsOf, lintFixtures, type Finding } from './lint-fixtures';

// A store's .get() while rendering (each product's docs/specs/003-system-architecture/linting.md, `no-store-get-in-render`, Work
// Tracker 946): the React Compiler keeps a component's or a hook's read at its first value, so the shared config
// refuses one in a render body or a useMemo, and leaves handlers, effects, keyed gets and 'use no memo' alone.
const RULE = 'liveworkspace(no-store-get-in-render)';

const FIXTURES = {
  'component.tsx': 'export function Bar({ s }) { const v = s.get(); return <b>{v.n}</b>; }',
  'branch.tsx':
    'export function Bar({ s, on }) { if (on) { return <b>{s.get().n}</b>; } return null; }',
  'memo.tsx':
    "import { memo } from 'react';\nexport const Bar = memo(function ({ s }) { return <b>{s.get().n}</b>; });",
  'arrow-hook.ts': 'export const useNow = (s) => s.get();',
  'use-memo.tsx':
    "import { useMemo } from 'react';\nexport function Bar({ s }) { const v = useMemo(() => s.get().n, [s]); return <b>{v}</b>; }",
  'react-use-memo.tsx':
    "import * as React from 'react';\nexport function Bar({ s }) { const v = React.useMemo(() => s.get().n, [s]); return <b>{v}</b>; }",
  'handler.tsx':
    'export function Bar({ s }) { return <button type="button" onClick={() => s.get().go()}>Go</button>; }',
  'effect.tsx':
    "import { useEffect } from 'react';\nexport function Bar({ s }) { useEffect(() => { s.get().go(); }, [s]); return null; }",
  'keyed.tsx': 'export function Bar({ m }) { return <b>{m.get("k")}</b>; }',
  'computed.tsx': 'export function Bar({ s }) { return <b>{s["get"]().n}</b>; }',
  'no-memo-function.tsx': "export function useLatest(s) {\n  'use no memo';\n  return s.get();\n}",
  'no-memo-file.tsx':
    "'use client';\n'use no memo';\nexport function Bar({ s }) { return <b>{s.get().n}</b>; }",
  'late-directive.tsx':
    "export function Bar({ s }) { const a = 1; 'use no memo'; return <b>{s.get().n + a}</b>; }",
  'helper.ts': 'export function read(s) { return s.get(); }',
  'module.ts': 'declare const store: { get(): number };\nexport const now = store.get();',
  'bar.test.tsx': 'export function Bar({ s }) { return <b>{s.get().n}</b>; }',
};

let findings: Finding[];
beforeAll(() => {
  findings = lintFixtures(FIXTURES);
});

const errors = (file: keyof typeof FIXTURES) => findingsOf(findings, file, RULE);

describe('store reads in render rule', () => {
  it("rejects a store's .get() in a component's or a hook's body", () => {
    for (const file of ['component.tsx', 'branch.tsx', 'memo.tsx', 'arrow-hook.ts'] as const) {
      expect(errors(file), file).toHaveLength(1);
    }
    expect(errors('component.tsx')[0]?.message).toMatch(/React Compiler.*use no memo/);
  });

  it('rejects one in a useMemo, which computes while rendering', () => {
    expect(errors('use-memo.tsx')).toHaveLength(1);
    expect(errors('react-use-memo.tsx')).toHaveLength(1);
  });

  it('allows a read in a handler or an effect', () => {
    expect(errors('handler.tsx')).toEqual([]);
    expect(errors('effect.tsx')).toEqual([]);
  });

  it("leaves a keyed get (a Map's) and a computed one alone", () => {
    expect(errors('keyed.tsx')).toEqual([]);
    expect(errors('computed.tsx')).toEqual([]);
  });

  it("allows a function or a file that says 'use no memo', but only in its prologue", () => {
    expect(errors('no-memo-function.tsx')).toEqual([]);
    expect(errors('no-memo-file.tsx')).toEqual([]);
    expect(errors('late-directive.tsx')).toHaveLength(1);
  });

  it('leaves plain functions, module scope and tests alone', () => {
    expect(errors('helper.ts')).toEqual([]);
    expect(errors('module.ts')).toEqual([]);
    expect(errors('bar.test.tsx')).toEqual([]);
  });
});
