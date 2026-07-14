import type { ShapeElement } from '@livediagram/diagram';
import { tokenizeLoaded, useCodeTokenizer } from '@/lib/code-highlight-registry';
import type { CodeTokenKind } from '@/lib/code-tokens';

// The code block's canvas view (spec/82): a fixed dark editor card with
// monospace text, a muted language badge, and syntax highlighting once the
// lazy tokenizer chunk lands (plain mono until then — degrade, never
// blank). Deliberately ignores the element's fill / stroke / theme: the
// dark card is its identity, the way a sticky stays amber.

const TOKEN_COLORS: Record<CodeTokenKind, string> = {
  plain: '#e2e8f0', // slate-200
  keyword: '#93c5fd', // blue-300
  string: '#86efac', // green-300
  comment: '#64748b', // slate-500
  number: '#fca5a5', // red-300
};

export function CodeBlockView({ element }: { element: ShapeElement }) {
  const loaded = useCodeTokenizer();
  const code = element.code ?? '';
  const empty = code.trim().length === 0;
  const language = element.codeLanguage ?? 'plain';
  const tokenLines = !empty && loaded ? tokenizeLoaded(code, language) : undefined;
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      {language !== 'plain' ? (
        <span className="pointer-events-none absolute right-2.5 top-1.5 font-mono text-[10px] text-slate-500">
          {language}
        </span>
      ) : null}
      <pre className="h-full w-full overflow-hidden p-3 font-mono text-xs leading-4">
        {empty ? (
          <span className="italic text-slate-500">{'// double-click to add code'}</span>
        ) : tokenLines ? (
          tokenLines.map((line, i) => (
            <div key={i}>
              {line.length === 0
                ? ' '
                : line.map((t, j) => (
                    <span key={j} style={{ color: TOKEN_COLORS[t.kind] }}>
                      {t.text}
                    </span>
                  ))}
            </div>
          ))
        ) : (
          <span className="text-slate-200">{code}</span>
        )}
      </pre>
    </div>
  );
}
