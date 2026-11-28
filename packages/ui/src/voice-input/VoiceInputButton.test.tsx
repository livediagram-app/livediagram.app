// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installFakeSpeech, lastSpeech, removeFakeSpeech } from './fake-speech';
import { useVoiceInput } from './useVoiceInput';
import {
  VOICE_START_LABEL,
  VOICE_STOP_LABEL,
  VoiceInputButton,
  VoiceInputNote,
} from './VoiceInputButton';

// A prompt field as every host wires it (voice-input.md "Where it shows").
function Field({ busy = false }: { busy?: boolean }) {
  const [text, setText] = useState('');
  const voice = useVoiceInput({ value: text, onText: setText, disabled: busy });
  return (
    <div>
      <textarea
        aria-label="Describe the plan"
        value={text}
        placeholder={voice.placeholder('Describe the plan')}
        onChange={(e) => setText(e.target.value)}
      />
      <VoiceInputButton voice={voice} />
      <VoiceInputNote voice={voice} />
    </div>
  );
}

beforeEach(() => installFakeSpeech('webkitSpeechRecognition'));
afterEach(() => removeFakeSpeech());

describe('VoiceInputButton', () => {
  it('is hidden where the browser cannot hear speech', () => {
    removeFakeSpeech();
    render(<Field />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('starts and stops, pressed and named for what a press does, and fills the field live', async () => {
    render(<Field />);
    const mic = screen.getByRole('button', { name: VOICE_START_LABEL });
    expect(mic.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(mic);
    const stop = await screen.findByRole('button', { name: VOICE_STOP_LABEL });
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Listening');
    expect(screen.getByPlaceholderText('Listening…')).toBeTruthy();
    act(() => lastSpeech().hear(['three lanes', false]));
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('three lanes');
    fireEvent.click(stop);
    expect(await screen.findByRole('button', { name: VOICE_START_LABEL })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Stopped listening');
    // Nothing was sent: the words wait in the field to be edited.
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('three lanes');
  });

  it('says a blocked microphone under the field, never a dead button', async () => {
    render(<Field />);
    fireEvent.click(screen.getByRole('button', { name: VOICE_START_LABEL }));
    act(() => lastSpeech().fail('not-allowed'));
    act(() => lastSpeech().end());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The microphone is blocked');
    expect(screen.getByRole('button', { name: VOICE_START_LABEL }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('is disabled while the field is busy', () => {
    render(<Field busy />);
    expect(screen.getByRole('button', { name: VOICE_START_LABEL }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
