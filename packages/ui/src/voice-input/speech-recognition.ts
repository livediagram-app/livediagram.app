// The browser's speech recognition (the Web Speech API) as voice input uses it
// (liveworkspace/docs/specs/022-interface-design/voice-input.md "What hears it"): the slice of the API it calls, where to
// find the constructor (Chrome, Edge and Safari still prefix it), and the short line each failure says under the field.

/** One alternative of one result: the words heard. */
type SpeechAlternativeLike = { readonly transcript: string };
/** One stretch of speech; `isFinal` once the browser stops revising it. */
type SpeechResultLike = {
  readonly isFinal: boolean;
  readonly [index: number]: SpeechAlternativeLike;
};

export type SpeechResultEventLike = {
  readonly results: { readonly length: number; readonly [index: number]: SpeechResultLike };
};
export type SpeechErrorEventLike = { readonly error: string };

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

/** The browser's recognizer, or null where it has none (Firefox, a server render). */
export function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The page's language, else the browser's: what the recognizer listens for. */
export function speechLanguage(): string {
  if (typeof document === 'undefined') return '';
  return (
    document.documentElement.lang || (typeof navigator === 'undefined' ? '' : navigator.language)
  );
}

/**
 * Whether to keep listening across pauses. Android's Chrome repeats every earlier phrase in continuous mode, so there
 * it hears one request and stops at the pause; everywhere else it listens until stopped.
 */
export function listensContinuously(userAgent: string): boolean {
  return !/android/i.test(userAgent);
}

/** Every result heard so far, firm and still-revising, as one line of words. */
export function heardText(event: SpeechResultEventLike): string {
  let text = '';
  for (let i = 0; i < event.results.length; i += 1) {
    const piece = event.results[i]?.[0]?.transcript ?? '';
    if (piece === '') continue;
    const joins = text === '' || /\s$/.test(text) || /^\s/.test(piece);
    text += joins ? piece : ` ${piece}`;
  }
  return text.trimStart();
}

/** The field's words with the speech after them: a space between, held to the field's limit. */
export function withSpeech(base: string, heard: string, max: number | undefined): string {
  const next = base + heard;
  return max === undefined ? next : next.slice(0, max);
}

/** Where speech starts: after what is already written, a space apart. */
export function speechBase(value: string): string {
  return value === '' || /\s$/.test(value) ? value : `${value} `;
}

export type VoiceNote =
  'denied' | 'no-microphone' | 'no-speech' | 'offline' | 'language' | 'failed';

/** The note a recognizer error leaves, or null for one that says nothing (a stop the person asked for). */
export function noteForError(error: string): VoiceNote | null {
  switch (error) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'audio-capture':
      return 'no-microphone';
    case 'no-speech':
      return 'no-speech';
    case 'network':
      return 'offline';
    case 'language-not-supported':
      return 'language';
    default:
      return 'failed';
  }
}

export const VOICE_NOTE_WORDS: Record<VoiceNote, string> = {
  denied: "The microphone is blocked. Allow it in the browser's site settings to speak.",
  'no-microphone': 'No microphone was found. Connect one to speak.',
  'no-speech': 'Nothing was heard. Press the microphone and try again.',
  offline: "Speaking needs a connection to the browser's speech service. Check it and try again.",
  language: "This browser can't hear the page's language.",
  failed: 'Speaking stopped. Press the microphone to try again.',
};
