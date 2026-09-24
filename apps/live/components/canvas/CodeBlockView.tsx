import { codeTheme, type CodeTheme, type ShapeElement } from '@livediagram/diagram';
import { tokenizeLoaded, useCodeTokenizer } from '@/lib/code-highlight-registry';
import type { CodeTokenKind } from '@/lib/code-tokens';

// The code block's canvas view (spec/82): an editor card with monospace text,
// a muted language badge, and syntax highlighting once the lazy tokenizer
// chunk lands (plain mono until then: degrade, never blank).
//
// The card still ignores the element's fill / stroke / theme, the way a sticky
// stays a sticky: its colours come from its own SCHEME (code-themes.ts), which
// the Presets grid picks. That one dark look was the whole identity for a
// while, and it is still the default; a block on a light board just no longer
// has to be a hole in it.

const tokenColor = (scheme: CodeTheme): Record<CodeTokenKind, string> => ({
  plain: scheme.text,
  keyword: scheme.keyword,
  string: scheme.string,
  comment: scheme.comment,
  number: scheme.number,
});

export function CodeBlockView({ element }: { element: ShapeElement }) {
  const loaded = useCodeTokenizer();
  const code = element.code ?? '';
  const empty = code.trim().length === 0;
  const language = element.codeLanguage ?? 'plain';
  const tokenLines = !empty && loaded ? tokenizeLoaded(code, language) : undefined;
  const scheme = codeTheme(element.codeTheme);
  const colors = tokenColor(scheme);
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-lg border"
      style={{ backgroundColor: scheme.surface, borderColor: scheme.border }}
    >
      {language !== 'plain' ? (
        <span
          className="pointer-events-none absolute right-2.5 top-1.5 font-mono text-[10px]"
          style={{ color: scheme.muted }}
        >
          {language}
        </span>
      ) : null}
      <pre className="h-full w-full overflow-hidden p-3 font-mono text-xs leading-4">
        {empty ? (
          <span className="italic" style={{ color: scheme.muted }}>
            {'// double-click to add code'}
          </span>
        ) : tokenLines ? (
          tokenLines.map((line, i) => (
            <div key={i}>
              {line.length === 0
                ? ' '
                : line.map((t, j) => (
                    <span key={j} style={{ color: colors[t.kind] }}>
                      {t.text}
                    </span>
                  ))}
            </div>
          ))
        ) : (
          <span style={{ color: scheme.text }}>{code}</span>
        )}
      </pre>
    </div>
  );
}
