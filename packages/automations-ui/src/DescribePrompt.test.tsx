// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOICE_START_LABEL, VOICE_STOP_LABEL } from '@liveworkspace/ui/voice-input';
import {
  installFakeSpeech,
  lastSpeech,
  removeFakeSpeech,
} from '@liveworkspace/ui/voice-input-testing';
import { DescribePrompt } from './DescribePrompt';

// The words step every Describe with AI dialog shares, spoken into (liveworkspace/docs/specs/022-interface-design/
// voice-input.md "Where it shows"): the mic under the box fills it, after what is typed, within the limit, and never
// drafts.
function Prompt({
  busy = false,
  onSubmit,
  said = null,
  saidOnSource = false,
}: {
  busy?: boolean;
  onSubmit: () => void;
  said?: string | null;
  saidOnSource?: boolean;
}) {
  const [text, setText] = useState('A launch');
  const box = useRef<HTMLTextAreaElement>(null);
  return (
    <DescribePrompt
      ref={box}
      label="Describe the plan"
      text={text}
      onText={setText}
      max={20}
      placeholder="Describe it"
      examples={[{ label: 'Launch', text: 'A product launch' }]}
      busy={busy}
      said={said}
      saidOnSource={saidOnSource}
      source={(id) => <p id={id}>Built-in AI</p>}
      onSubmit={onSubmit}
      dataAttr="data-describe-test"
    />
  );
}

afterEach(() => removeFakeSpeech());

describe('DescribePrompt voice input', () => {
  it('has no microphone where the browser cannot hear speech', () => {
    render(<Prompt onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: VOICE_START_LABEL })).toBeNull();
  });

  it('writes speech after the words, held to the limit, and never drafts', async () => {
    installFakeSpeech('webkitSpeechRecognition');
    const onSubmit = vi.fn();
    render(<Prompt onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: VOICE_START_LABEL }));
    await screen.findByRole('button', { name: VOICE_STOP_LABEL });
    act(() => lastSpeech().hear(['with design and build lanes', false]));
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Describe the plan' });
    expect(field.value).toBe('A launch with design');
    expect(screen.getByText('20 / 20').getAttribute('aria-live')).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: VOICE_STOP_LABEL }));
    act(() => lastSpeech().end());
    expect(document.activeElement).toBe(field);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('fills from an example, drafts on Ctrl or Cmd and Enter, and says a refusal once', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Prompt onSubmit={onSubmit} said="Too short" />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Describe the plan' });
    expect(field.value).toBe('A product launch');
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alert').textContent).toBe('Too short');
    rerender(<Prompt onSubmit={onSubmit} said="Too short" saidOnSource />);
    expect(screen.getByRole('alert').className).toContain('sr-only');
  });

  it('is disabled while a draft runs', () => {
    installFakeSpeech('webkitSpeechRecognition');
    render(<Prompt busy onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: VOICE_START_LABEL }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
