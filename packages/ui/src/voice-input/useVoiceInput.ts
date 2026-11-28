'use client';

// Speaking into an AI prompt field (liveworkspace/docs/specs/022-interface-design/voice-input.md): the browser's
// speech recognition writes what it hears into the field as it hears it, after the words already there; a second
// press, Escape, sending or typing stops it; nothing is ever sent. The host owns the field's value: the hook only
// hands it new words through `onText`. VoiceInputButton draws it; VoiceInputNote says why it could not listen.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { RefObject } from 'react';
import {
  heardText,
  listensContinuously,
  noteForError,
  speechBase,
  speechLanguage,
  speechRecognitionCtor,
  withSpeech,
  type SpeechRecognitionLike,
  type VoiceNote,
} from './speech-recognition';

export type VoiceInputOptions = {
  /** The field's words now. */
  value: string;
  /** New words for the field, as speech is heard. */
  onText: (text: string) => void;
  /** The field's limit: speech never writes past it. */
  max?: number;
  /** The field: the caret goes to its end when listening stops, ready to edit. */
  field?: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** The field is read-only or disabled (a draft running, an answer streaming): no listening. */
  disabled?: boolean;
};

export type VoiceInput = {
  /** The browser can hear speech: false hides the button. */
  supported: boolean;
  listening: boolean;
  disabled: boolean;
  /** Why the last try could not listen, or null. */
  note: VoiceNote | null;
  /** What a screen reader hears as listening starts and stops. */
  status: string;
  toggle: () => void;
  stop: () => void;
  /** The field's placeholder: "Listening…" while it listens to an empty field. */
  placeholder: (idle: string) => string;
};

const noSubscribe = () => () => {};
const serverCtor = () => null;

function placeCaret(field: VoiceInputOptions['field']) {
  const el = field?.current;
  if (!el) return;
  el.focus({ preventScroll: true });
  const end = el.value.length;
  el.setSelectionRange(end, end);
}

function detach(r: SpeechRecognitionLike) {
  r.onresult = null;
  r.onerror = null;
  r.onend = null;
}

export function useVoiceInput({
  value,
  onText,
  max,
  field,
  disabled = false,
}: VoiceInputOptions): VoiceInput {
  const Ctor = useSyncExternalStore(noSubscribe, speechRecognitionCtor, serverCtor);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<VoiceNote | null>(null);
  const [status, setStatus] = useState('');
  const recognizer = useRef<SpeechRecognitionLike | null>(null);
  // Where the speech goes after (the field's words when listening began), and the words it last wrote: the field
  // holding anything else means the person typed or sent, which stops it.
  const base = useRef('');
  const wrote = useRef('');
  const latest = useRef({ value, onText, max, field });
  useLayoutEffect(() => {
    latest.current = { value, onText, max, field };
  });

  // Stops without keeping what is still being heard: the field moved on without it.
  const cancel = useCallback(() => {
    const r = recognizer.current;
    if (!r) return;
    recognizer.current = null;
    detach(r);
    r.abort();
    setListening(false);
    setStatus('Stopped listening');
  }, []);

  // Stops and keeps the last words: the browser sends its final result, then ends.
  const stop = useCallback(() => {
    const r = recognizer.current;
    if (!r) return;
    setListening(false);
    setStatus('Stopped listening');
    r.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = speechLanguage();
    r.interimResults = true;
    r.continuous = listensContinuously(navigator.userAgent);
    r.maxAlternatives = 1;
    const now = latest.current.value;
    base.current = speechBase(now);
    wrote.current = now;
    r.onresult = (event) => {
      const { value: shown, onText: write, max: limit } = latest.current;
      if (shown !== wrote.current) {
        cancel();
        return;
      }
      const next = withSpeech(base.current, heardText(event), limit);
      wrote.current = next;
      write(next);
    };
    r.onerror = (event) => {
      const said = noteForError(event.error);
      if (said) setNote(said);
    };
    r.onend = () => {
      if (recognizer.current !== r) return;
      recognizer.current = null;
      detach(r);
      setListening(false);
      setStatus('Stopped listening');
      placeCaret(latest.current.field);
    };
    setNote(null);
    recognizer.current = r;
    try {
      r.start();
    } catch {
      recognizer.current = null;
      detach(r);
      setNote('failed');
      return;
    }
    setListening(true);
    setStatus('Listening');
  }, [Ctor, cancel]);

  // A press while still ending the last session drops its tail and listens again.
  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const ending = recognizer.current;
    if (ending) {
      recognizer.current = null;
      detach(ending);
      ending.abort();
    }
    start();
  }, [listening, start, stop]);

  // Typing or sending (the field no longer holds what speech wrote) stops it, and so does a busy field.
  useEffect(() => {
    if (recognizer.current && value !== wrote.current) cancel();
  }, [value, cancel]);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);
  // Leaving the page or closing the dialog lets the microphone go.
  useEffect(
    () => () => {
      const r = recognizer.current;
      if (!r) return;
      recognizer.current = null;
      detach(r);
      r.abort();
    },
    [],
  );

  // Escape stops listening and does only that: caught on the window before the dialog or panel around the field
  // (which listen on the document) can close.
  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      stop();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, stop]);

  const placeholder = useCallback(
    (idle: string) => (listening && value === '' ? 'Listening…' : idle),
    [listening, value],
  );

  return {
    supported: Ctor !== null,
    listening,
    disabled,
    note,
    status,
    toggle,
    stop,
    placeholder,
  };
}
