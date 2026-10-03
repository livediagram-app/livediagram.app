// The static optical-alignment guard (docs/specs/004-interface-design/optical-alignment.md,
// blueprint: docs/specs/004-interface-design/blueprints/optical-alignment.md, "Static guard").
//
// A circle or pill that centres a glyph must centre the glyph's cap band, not its line box. So a
// fixed-height, fully rounded, centring element may not hold text directly: the text goes through
// the `text-optical-centre` utility, or the shape is one of the shared primitives.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

export type OpticalViolation = { file: string; line: number; snippet: string };

// The primitives own the rule, so their call sites are compliant by construction.
const PRIMITIVES = new Set(['GlyphDisc', 'Chip', 'IconSlot']);
// ...and so is their own implementation (packages/ui/src/optical).
const PRIMITIVES_DIR = `${sep}optical${sep}`;
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  'out',
  'coverage',
  'e2e',
  '.turbo',
  'dist',
]);
const ROUND = /(^|\s)rounded-full(\s|$)/;
const CENTRING =
  /(^|\s)(items-center|justify-center|place-items-center|place-content-center)(\s|$)/;
const FIXED_HEIGHT = /(^|\s)(h|size)-(\d|\[)/;
// An identifier that names an icon is taken at its word; anything else may be text.
const ICON_NAME = /(icon|glyph|svg)/i;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : sources(path);
    if (!name.endsWith('.tsx') || /\.test\.tsx$/.test(name) || path.includes(PRIMITIVES_DIR))
      return [];
    return [path];
  });
}

/** Every static class chunk in a className attribute: literals, template heads and spans. */
function classText(attr: ts.JsxAttribute): string {
  const parts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) parts.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      parts.push(node.head.text);
      for (const span of node.templateSpans) {
        visit(span.expression);
        parts.push(span.literal.text);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  if (attr.initializer) visit(attr.initializer);
  return parts.join(' ');
}

// Inline wrappers that pass their text through untrimmed unless they carry the utility.
const PLAIN_WRAPPERS = new Set(['span', 'div', 'b', 'strong', 'em', 'small']);

function hasClass(opening: ts.JsxOpeningElement, sf: ts.SourceFile, cls: string): boolean {
  const attr = opening.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'className',
  );
  return attr ? classText(attr).split(/\s+/).includes(cls) : false;
}

/** The first child that can put untrimmed text in the shape, looking through plain wrappers. */
function bareText(children: ts.NodeArray<ts.JsxChild>, sf: ts.SourceFile): ts.Node | undefined {
  for (const c of children) {
    if (ts.isJsxText(c) && c.text.trim() !== '') return c;
    if (ts.isJsxExpression(c) && c.expression !== undefined && !elementOnly(c.expression)) return c;
    if (ts.isJsxElement(c)) {
      const tag = c.openingElement.tagName.getText(sf);
      if (PLAIN_WRAPPERS.has(tag) && !hasClass(c.openingElement, sf, 'text-optical-centre')) {
        const inner = bareText(c.children, sf);
        if (inner) return inner;
      }
    }
  }
  return undefined;
}

/** True when an expression child can only ever be an element (or nothing). */
function elementOnly(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return elementOnly(node.expression);
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
    return true;
  if (node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
    return true;
  if (ts.isIdentifier(node)) return node.text === 'undefined' || ICON_NAME.test(node.text);
  if (ts.isPropertyAccessExpression(node)) return ICON_NAME.test(node.name.text);
  if (ts.isConditionalExpression(node))
    return elementOnly(node.whenTrue) && elementOnly(node.whenFalse);
  if (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
    ].includes(node.operatorToken.kind)
  )
    return elementOnly(node.right);
  return false;
}

export function checkOpticalAlignment({ root }: { root: string }): OpticalViolation[] {
  const violations: OpticalViolation[] = [];
  for (const path of sources(root)) {
    const source = readFileSync(path, 'utf8');
    // A violation needs ROUND in one of this file's class literals: a file without the token has
    // none, and skipping its parse keeps the guard fast enough for a busy CI runner.
    if (!source.includes('rounded-full')) continue;
    const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node): void => {
      if (ts.isJsxElement(node)) {
        const opening = node.openingElement;
        const tag = opening.tagName.getText(sf);
        const cls = opening.attributes.properties.find(
          (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'className',
        );
        const text = cls ? classText(cls) : '';
        const style = opening.attributes.properties.find(
          (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'style',
        );
        const sized =
          FIXED_HEIGHT.test(text) || /\b(height|width)\b/.test(style?.getText(sf) ?? '');
        if (!PRIMITIVES.has(tag) && ROUND.test(text) && CENTRING.test(text) && sized) {
          const bare = bareText(node.children, sf);
          if (bare) {
            violations.push({
              file: relative(root, path).split(sep).join('/'),
              line: sf.getLineAndCharacterOfPosition(bare.getStart(sf)).line + 1,
              snippet: bare.getText(sf).replace(/\s+/g, ' ').slice(0, 60),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return violations;
}

export function formatViolations(violations: OpticalViolation[]): string {
  return violations
    .map(
      (v) =>
        `${v.file}:${v.line}  ${v.snippet}  (wrap in text-optical-centre, or use GlyphDisc / Chip)`,
    )
    .join('\n');
}
