'use client';

// The microphone on every AI prompt field (liveworkspace/docs/specs/022-interface-design/voice-input.md "How it
// behaves"): a quiet 34 px round button; listening, a red circle with a Stop square and a soft pulse ring, pressed.
// Hidden where the browser cannot hear speech, so it is never a dead button. VoiceInputNote is the short line under
// the field when it could not listen.

import { lucideMic } from '@liveworkspace/icons/lucide';
import { Glyph } from '../icons/Glyph';
import { lucideGlyph } from '../icons/lucide-glyph';
import { Tooltip } from '../Tooltip';
import { VOICE_NOTE_WORDS } from './speech-recognition';
import type { VoiceInput } from './useVoiceInput';

const MicGlyph = /* @__PURE__ */ lucideGlyph(lucideMic, 18);

export const VOICE_START_LABEL = 'Speak Your Request';
export const VOICE_STOP_LABEL = 'Stop Speaking';

const BASE =
  'touch-target relative flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none motion-safe:transition-colors motion-safe:duration-micro focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900';
const IDLE =
  'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 enabled:active:bg-slate-200 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white dark:enabled:active:bg-slate-700';
// The ring is an ::after (touch-target owns ::before): a red halo that breathes out while it listens and holds still under
// reduced motion.
const LISTENING =
  'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 dark:bg-red-500 dark:hover:bg-red-600 after:pointer-events-none after:absolute after:-inset-[5px] after:rounded-full after:border-2 after:border-red-500/40 motion-safe:after:animate-voice-pulse';

function StopSquare() {
  return (
    <Glyph size={14} units={24} filled>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Glyph>
  );
}

export function VoiceInputButton({ voice }: { voice: VoiceInput }) {
  if (!voice.supported) return null;
  const label = voice.listening ? VOICE_STOP_LABEL : VOICE_START_LABEL;
  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          data-voice-input=""
          aria-label={label}
          aria-pressed={voice.listening}
          disabled={voice.disabled}
          onClick={voice.toggle}
          className={`${BASE} ${voice.listening ? LISTENING : IDLE}`}
        >
          {voice.listening ? <StopSquare /> : <MicGlyph aria-hidden />}
        </button>
      </Tooltip>
      <span role="status" aria-live="polite" className="sr-only">
        {voice.status}
      </span>
    </>
  );
}

/** Why it could not listen, in one short line under the field; nothing otherwise. */
export function VoiceInputNote({
  voice,
  className = '',
}: {
  voice: VoiceInput;
  className?: string;
}) {
  if (!voice.supported || !voice.note) return null;
  return (
    <p
      role="alert"
      data-voice-input-note={voice.note}
      className={`text-[12px] leading-4 text-amber-800 dark:text-amber-200 ${className}`}
    >
      {VOICE_NOTE_WORDS[voice.note]}
    </p>
  );
}
