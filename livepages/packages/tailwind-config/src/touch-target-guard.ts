// The static touch-target guard (docs/specs/004-interface-design/touch-targets.md, "How").
//
// `touch-target` and `touch-target-y` draw an absolutely positioned `::before` pad, so the control that carries one
// must be positioned itself. A static host lets the pad fill its nearest positioned ancestor instead: the help
// centre's last popular-topic chip took every tap on the hero, its search box included, and a Plan column's Remove
// Column took every tap in its popover on a phone. So a class list that names either utility names a position too
// (`relative`, `absolute`, `fixed` or `sticky`), in the same className attribute or `className:` property.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parseSourceFiles } from '@livediagram/source-ast';
import {
  isIdentifier,
  isJsxAttribute,
  isNoSubstitutionTemplateLiteral,
  isPropertyAssignment,
  isStringLiteral,
  isTemplateExpression,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast';

type TouchTargetViolation = { file: string; line: number; snippet: string };

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  '.next-analyze',
  'out',
  'coverage',
  'e2e',
  '.turbo',
  'dist',
]);
const PAD = /(^|\s)touch-target(-y)?(\s|$)/;
const POSITIONED = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // A file can vanish between the listing and the stat while other tasks run; it was never source.
    let isDir: boolean;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      return [];
    }
    if (isDir) return SKIP_DIRS.has(name) ? [] : sources(path);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || name.endsWith('.d.ts')) return [];
    return [path];
  });
}

/** Every static class chunk under a node: string literals, template heads and spans. */
function classText(node: Node): string {
  const parts: string[] = [];
  const visit = (n: Node): void => {
    if (isStringLiteral(n) || isNoSubstitutionTemplateLiteral(n)) parts.push(n.text);
    else if (isTemplateExpression(n)) {
      parts.push(n.head.text);
      for (const span of n.templateSpans) {
        visit(span.expression);
        parts.push(span.literal.text);
      }
      return;
    }
    n.forEachChild(visit);
  };
  visit(node);
  return parts.join(' ');
}

/** A className attribute's value, or a `className:` property's (props built for an element). */
function classValue(node: Node, sf: SourceFile): Node | undefined {
  if (isJsxAttribute(node) && node.name.getText(sf) === 'className') return node.initializer;
  if (isPropertyAssignment(node) && isIdentifier(node.name) && node.name.text === 'className')
    return node.initializer;
  return undefined;
}

export function checkTouchTargets({ root }: { root: string }): TouchTargetViolation[] {
  const violations: TouchTargetViolation[] = [];
  // Only a file naming the utility can break the rule; skipping the rest keeps the guard fast on a busy runner.
  const candidates = sources(root).filter((path) =>
    readFileSync(path, 'utf8').includes('touch-target'),
  );
  for (const sf of parseSourceFiles(candidates)) {
    const visit = (node: Node): void => {
      const value = classValue(node, sf);
      if (value) {
        const text = classText(value);
        if (PAD.test(text) && !POSITIONED.test(text)) {
          violations.push({
            file: relative(root, sf.fileName).split(sep).join('/'),
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            snippet: text.replace(/\s+/g, ' ').trim().slice(0, 70),
          });
        }
        return;
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return violations;
}

export function formatTouchTargetViolations(violations: TouchTargetViolation[]): string {
  return violations
    .map(
      (v) =>
        `${v.file}:${v.line}  ${v.snippet}  (a touch-target host must be positioned: add relative)`,
    )
    .join('\n');
}
