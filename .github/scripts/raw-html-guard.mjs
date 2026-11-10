// The raw HTML guard (docs/ci.md "One path for markup"): every raw HTML sink goes through one module,
// packages/trusted-types/src/html.ts (htmlProps, setHtml, setSrcdoc, each taking a SafeHtml), and no other
// non-test source file in the repository may write one. It fails on any sink outside that module and names
// each file and line. There is no baseline: none is left.
//
//   node .github/scripts/raw-html-guard.mjs
//
// It reads the files git tracks (`git ls-files`) and scans each source file's text with a handful of
// regular expressions: about 14,400 files, about 1.5 s of CPU time on the whole repository.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The one module that may write a raw HTML sink. */
export const HTML_MODULE = 'packages/trusted-types/src/html.ts';

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
// Tests, e2e specs and test helpers never ship; CI's own scripts and the repo's tooling never reach a page.
const LEFT_OUT =
  /\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:__tests__|test|tests|e2e|test-support)\/|(?:^|\/)test-support\.[cm]?[jt]sx?$|^\.github\/|(?:^|\/)node_modules\//;

/**
 * The sinks, each as it is written in code (an attribute, a property assignment, a call), so prose that names
 * one in a comment is not a hit. `(?!=)` keeps a comparison (`innerHTML === x`) out.
 * @type {{ name: string, pattern: RegExp }[]}
 */
export const SINKS = [
  { name: 'dangerouslySetInnerHTML', pattern: /\bdangerouslySetInnerHTML\s*[=:]/g },
  { name: 'innerHTML assignment', pattern: /\.innerHTML\s*\+?=(?!=)/g },
  { name: 'outerHTML assignment', pattern: /\.outerHTML\s*\+?=(?!=)/g },
  { name: 'srcdoc assignment', pattern: /\.srcdoc\s*\+?=(?!=)/g },
  { name: 'insertAdjacentHTML', pattern: /\binsertAdjacentHTML\s*\(/g },
  { name: 'createContextualFragment', pattern: /\bcreateContextualFragment\s*\(/g },
  { name: 'setHTMLUnsafe', pattern: /\b(?:setHTMLUnsafe|parseHTMLUnsafe)\s*\(/g },
  { name: 'document.write', pattern: /\bdocument\.write(?:ln)?\s*\(/g },
];

/**
 * Whether the guard reads a tracked path: a non-test source file, outside CI's scripts, other than the one module.
 * @param {string} file
 */
export function isScanned(file) {
  return SOURCE.test(file) && !LEFT_OUT.test(file) && file !== HTML_MODULE;
}

/**
 * Every raw sink in a file's text, as `file:line: sink`.
 * @param {string} file
 * @param {string} text
 * @returns {string[]}
 */
export function rawSinks(file, text) {
  /** @type {{ index: number, name: string }[]} */
  const hits = [];
  for (const { name, pattern } of SINKS)
    for (const m of text.matchAll(pattern)) hits.push({ index: m.index, name });
  return hits
    .sort((a, b) => a.index - b.index)
    .map(({ index, name }) => `${file}:${text.slice(0, index).split('\n').length}: ${name}`);
}

/**
 * The raw sinks in every scanned path.
 * @param {string[]} files tracked paths, relative to the root
 * @param {(file: string) => string} read
 */
export function findRawSinks(files, read) {
  return files.filter(isScanned).flatMap((file) => rawSinks(file, read(file)));
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  const hits = findRawSinks(files, (file) => {
    try {
      return readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      // Deleted in the working tree but still in the index: nothing to read.
      return '';
    }
  });
  if (hits.length === 0) return;
  console.error(
    `Raw HTML sinks outside ${HTML_MODULE} (docs/ci.md "One path for markup"):\n` +
      hits.map((h) => `  ${h}`).join('\n') +
      '\n\nGive markup to a React element as {...htmlProps(markup)}, to the DOM through setHtml(el, markup) or' +
      '\nsetSrcdoc(frame, markup), from @liveworkspace/trusted-types (or the product UI package that re-exports it).' +
      '\nThe markup is a SafeHtml: trustedConstant(...) for our own build-time markup, builtMarkup(...) for an' +
      "\nescaping builder's output, jsonScript(...) for inline JSON. A fixed picture is better written as JSX.",
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
