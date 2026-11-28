// A stand-in for the browser's speech recognition in tests: each instance records what it was told and lets a test
// say what it heard, fail, or end.

import type {
  SpeechErrorEventLike,
  SpeechRecognitionLike,
  SpeechResultEventLike,
} from './speech-recognition';

export class FakeSpeech implements SpeechRecognitionLike {
  static made: FakeSpeech[] = [];
  static failStart = false;
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((event: SpeechResultEventLike) => void) | null = null;
  onerror: ((event: SpeechErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;

  constructor() {
    FakeSpeech.made.push(this);
  }
  start() {
    if (FakeSpeech.failStart) throw new Error('already started');
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
  /** Each piece is one result: `[words, isFinal]`. */
  hear(...pieces: [string, boolean][]) {
    const results = pieces.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } }));
    this.onresult?.({ results: Object.assign(results, { length: results.length }) });
  }
  fail(error: string) {
    this.onerror?.({ error });
  }
  end() {
    this.onend?.();
  }
}

export function installFakeSpeech(name: 'SpeechRecognition' | 'webkitSpeechRecognition') {
  FakeSpeech.made = [];
  FakeSpeech.failStart = false;
  (window as unknown as Record<string, unknown>)[name] = FakeSpeech;
}

export function removeFakeSpeech() {
  const w = window as unknown as Record<string, unknown>;
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
}

export const lastSpeech = () => FakeSpeech.made[FakeSpeech.made.length - 1]!;
