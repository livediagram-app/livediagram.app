import { describe, expect, it } from 'vitest';
import {
  VOICE_NOTE_WORDS,
  listensContinuously,
  noteForError,
  speechBase,
  speechLanguage,
  speechRecognitionCtor,
  withSpeech,
} from './speech-recognition';

describe('speech recognition helpers', () => {
  it('has no recognizer or language on a server render', () => {
    expect(speechRecognitionCtor()).toBeNull();
    expect(speechLanguage()).toBe('');
  });

  it('listens across pauses except on Android', () => {
    expect(listensContinuously('Mozilla/5.0 (Macintosh) Chrome/140')).toBe(true);
    expect(listensContinuously('Mozilla/5.0 (Linux; Android 15) Chrome/140')).toBe(false);
  });

  it('puts speech a space after the words already written', () => {
    expect(speechBase('')).toBe('');
    expect(speechBase('Plan')).toBe('Plan ');
    expect(speechBase('Plan ')).toBe('Plan ');
    expect(withSpeech('Plan ', 'a launch', undefined)).toBe('Plan a launch');
    expect(withSpeech('Plan ', 'a launch', 6)).toBe('Plan a');
  });

  it('turns each recognizer error into its note', () => {
    expect(noteForError('aborted')).toBeNull();
    expect(noteForError('not-allowed')).toBe('denied');
    expect(noteForError('service-not-allowed')).toBe('denied');
    expect(noteForError('audio-capture')).toBe('no-microphone');
    expect(noteForError('no-speech')).toBe('no-speech');
    expect(noteForError('network')).toBe('offline');
    expect(noteForError('language-not-supported')).toBe('language');
    expect(noteForError('bad-grammar')).toBe('failed');
  });

  it('says each note in a short line with no dashes', () => {
    for (const words of Object.values(VOICE_NOTE_WORDS)) {
      expect(words.length).toBeLessThan(100);
      expect(words).not.toMatch(/—/);
    }
  });
});
