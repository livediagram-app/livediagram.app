'use client';

// The look of a speech bubble (docs/specs/008-canvas/avatar-mode.md "Speech bubbles", blueprint
// docs/specs/008-canvas/blueprints/avatar-speech.md "Presentation and UX"), shared by the composer above your head
// and every floating bubble, so the one you type in is the one that floats away. Also the draft field and its word
// counter, shared by the composer and the panel's message popover.

import { forwardRef, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import { AVATAR_SAY_MAX_CHARS, AVATAR_SAY_MAX_WORDS, countWords } from '@livediagram/api-schema';
import { lucideSend } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { nextDraft, SPEECH_COUNTER_FROM_WORDS } from '@/lib/avatar-speech';

export const SendIcon = lucideGlyph(lucideSend, 14);

// The card. `colour` is the speaker's avatar colour: the border, the tail and the name under the words (the
// brand when there is none).
export const SpeechCard = forwardRef(function SpeechCard(
  {
    colour,
    name,
    tailRef,
    children,
    floating,
  }: {
    colour?: string;
    name?: string;
    // The tail's node, so a floating bubble can fade it as it lets go of the head.
    tailRef?: Ref<HTMLSpanElement>;
    children: ReactNode;
    // A floating bubble is read-only and inert to the pointer; the composer takes presses.
    floating?: boolean;
  },
  ref: Ref<HTMLDivElement>,
) {
  const tint = colour ? { borderColor: colour } : undefined;
  return (
    <div
      ref={ref}
      className={`relative max-w-[240px] rounded-2xl border-[1.5px] bg-white px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-lg shadow-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${
        colour ? '' : 'border-brand-500'
      } ${floating ? 'pointer-events-none select-none' : 'pointer-events-auto'}`}
      style={tint}
    >
      {children}
      {name ? (
        <div
          className="mt-0.5 truncate text-[10px] font-semibold leading-tight"
          style={{ color: colour }}
        >
          {name}
        </div>
      ) : null}
      {/* The tail: a rotated square straddling the bottom edge, bordered on its two outer sides. */}
      <span
        ref={tailRef}
        aria-hidden
        className={`absolute -bottom-[6px] left-1/2 h-[10px] w-[10px] -translate-x-1/2 rotate-45 border-b-[1.5px] border-r-[1.5px] bg-white dark:bg-slate-900 ${
          colour ? '' : 'border-brand-500'
        }`}
        style={tint}
      />
    </div>
  );
});

/** `43 / 50`, shown from SPEECH_COUNTER_FROM_WORDS words, amber at the limit. */
export function SpeechCounter({ text }: { text: string }) {
  const words = countWords(text);
  if (words < SPEECH_COUNTER_FROM_WORDS) return null;
  const full = words >= AVATAR_SAY_MAX_WORDS;
  return (
    <span
      className={`text-[10px] font-semibold tabular-nums ${
        full ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
      }`}
    >
      {words} / {AVATAR_SAY_MAX_WORDS}
    </span>
  );
}

const LINE_PX = 18;

/**
 * The draft's text area: newlines become spaces, a keystroke past the limits is refused and a paste is clamped
 * (nextDraft). Enter (with or without Shift) sends; Escape cancels. Grows with its text up to `maxRows`.
 */
export function SpeechDraftField({
  value,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
  autoFocus,
  minRows = 1,
  maxRows = 5,
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  minRows?: number;
  maxRows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow to fit, between minRows and maxRows lines.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight counts the padding, so the bounds do too.
    const cs = getComputedStyle(el);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) || 0;
    el.style.height = 'auto';
    el.style.height = `${Math.min(maxRows * LINE_PX + pad, Math.max(minRows * LINE_PX + pad, el.scrollHeight))}px`;
  }, [value, minRows, maxRows]);
  return (
    <textarea
      ref={ref}
      aria-label="Message"
      placeholder="Say something…"
      // React's autoFocus focuses on mount without scrolling the canvas.
      autoFocus={autoFocus}
      rows={minRows}
      maxLength={AVATAR_SAY_MAX_CHARS + 50}
      value={value}
      onChange={(e) => {
        // Only a key typed is refused at the limit; anything put in at once (a paste, a drop, an autocorrection, an
        // input method's composed text) is trimmed to it, as a refusal would snap the field back under the person.
        const typed = (e.nativeEvent as InputEvent).inputType === 'insertText';
        onChange(nextDraft(value, e.target.value, !typed));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!e.nativeEvent.isComposing) onSubmit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      onBlur={onBlur}
      className={`block w-full resize-none overflow-y-auto bg-transparent text-[13px] leading-[18px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 ${className}`}
    />
  );
}
