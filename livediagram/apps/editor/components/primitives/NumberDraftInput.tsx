import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';

// A chart value's number field (docs/specs/009-elements/pie-chart.md). It keeps what is typed as text and
// passes on only a whole number: a number field reads a lone minus (or a cleared field) as empty, and turning
// that into 0 put a 0 under the caret, so a negative could only be typed digits first. On blur the text goes
// back to the value, so a half-typed entry never lingers. It follows the value when that changes elsewhere.
export function NumberDraftInput({
  value,
  min,
  onValue,
  onBlur,
  className,
  'aria-label': ariaLabel,
}: {
  value: number;
  // Values under it are passed on as it (a pie's slices stop at zero).
  min?: number;
  onValue: (value: number) => void;
  onBlur: () => void;
  className: string;
  'aria-label': string;
}) {
  const [text, setText] = useFollowingDraft<number, string>(value, String);
  return (
    <input
      className={className}
      type="number"
      min={min}
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        if (raw.trim() === '' || !Number.isFinite(n)) return;
        onValue(min === undefined ? n : Math.max(min, n));
      }}
      onBlur={() => {
        setText(String(value));
        onBlur();
      }}
    />
  );
}
