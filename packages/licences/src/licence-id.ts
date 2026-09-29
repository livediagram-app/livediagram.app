// A work's licence id, as an SPDX expression, and whether we may ship it
// (docs/specs/002-project-scope/third-party-licences.md "Licence texts").

type Manifest = { license?: unknown; licenses?: unknown };

const typeOf = (v: unknown): string | undefined =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'
    ? (v as { type: string }).type
    : undefined;

// The `license` field, or the legacy `license: { type }` and `licenses: [...]`
// forms. `SEE LICENSE IN <file>` names no licence, so it counts as absent.
export function licenceFromManifest(manifest: Manifest): string | undefined {
  const { license, licenses } = manifest;
  if (typeof license === 'string') {
    return license && !/^see licen[cs]e in /i.test(license) ? license : undefined;
  }
  if (license !== undefined) return typeOf(license);
  if (!Array.isArray(licenses) || licenses.length === 0) return undefined;
  const types = licenses.map(typeOf);
  if (types.some((t) => t === undefined)) return undefined;
  return types.length === 1 ? types[0] : `(${types.join(' OR ')})`;
}

const RECOGNISED: [id: string, test: (text: string) => boolean][] = [
  [
    'MIT',
    (t) => /permission is hereby granted, free of charge, to any person obtaining a copy/.test(t),
  ],
  [
    'ISC',
    (t) =>
      /permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee is hereby granted, provided that/.test(
        t,
      ),
  ],
  ['Apache-2.0', (t) => /apache license,? version 2\.0/.test(t)],
  [
    'BSD-3-Clause',
    (t) =>
      /redistribution and use in source and binary forms/.test(t) && /neither the name/.test(t),
  ],
  [
    'BSD-2-Clause',
    (t) =>
      /redistribution and use in source and binary forms/.test(t) && !/neither the name/.test(t),
  ],
];

// Recognises the common permissive licences from their text, for a work whose
// package.json names none. Exactly one must match; anything else is undefined.
export function detectLicenceId(text: string): string | undefined {
  const flat = text.replace(/\s+/g, ' ').toLowerCase();
  const hits = RECOGNISED.filter(([, test]) => test(flat));
  return hits.length === 1 ? hits[0]![0] : undefined;
}

// Permissive and weak-copyleft licences a shipped work may carry (blueprint
// D10). Anything else fails the build so that adding it is a human decision.
export const LICENCE_ALLOWLIST: ReadonlySet<string> = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BSL-1.0',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0',
  'OFL-1.1',
  'Python-2.0',
  'Unlicense',
  'Zlib',
]);

const ALLOWED_LOWER = new Set([...LICENCE_ALLOWLIST].map((id) => id.toLowerCase()));

// Evaluates an SPDX expression: AND binds tighter than OR, parentheses group,
// `WITH <exception>` keeps its base licence, a trailing `+` (or later) keeps
// the id. OR needs one allowed branch, AND needs all. Unparsable is refused.
export function isLicenceAllowed(expression: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const peek = () => tokens[at]?.toUpperCase();
  const syntax = () => {
    throw new SyntaxError(expression);
  };

  const primary = (): boolean => {
    const token = tokens[at++];
    if (token === '(') {
      const value = or();
      if (tokens[at++] !== ')') syntax();
      return value;
    }
    if (
      token === undefined ||
      token === ')' ||
      ['AND', 'OR', 'WITH'].includes(token.toUpperCase())
    ) {
      syntax();
    }
    return ALLOWED_LOWER.has(token!.replace(/\+$/, '').toLowerCase());
  };
  const withExpr = (): boolean => {
    const value = primary();
    if (peek() === 'WITH') {
      at += 1;
      if (tokens[at++] === undefined) syntax();
    }
    return value;
  };
  const and = (): boolean => {
    let value = withExpr();
    while (peek() === 'AND') {
      at += 1;
      value = withExpr() && value;
    }
    return value;
  };
  const or = (): boolean => {
    let value = and();
    while (peek() === 'OR') {
      at += 1;
      value = and() || value;
    }
    return value;
  };

  try {
    const value = or();
    return at === tokens.length && value;
  } catch {
    return false;
  }
}
