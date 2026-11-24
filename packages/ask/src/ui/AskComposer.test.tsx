// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASK_MAX_QUESTION_CHARS } from '../limits';
import { AnswerWith } from './AnswerWith';
import { ASK_COUNT_FROM, AskComposer } from './AskComposer';
import { askAiView } from './ask-words';

// The question box every Ask shares (liveworkspace/docs/specs/020-ask/ask.md "The tool"): it knows no app, so each
// host's words, pill and handlers are its own.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Props = Parameters<typeof AskComposer>[0];
const box = (over: Partial<Props> = {}) => {
  const props: Props = {
    label: 'Ask this knowledgebase a question',
    followUp: false,
    streaming: false,
    onAsk: vi.fn(() => true),
    onStop: vi.fn(),
    pill: <span data-testid="pill">Built-In AI</span>,
    autoFocus: false,
    ...over,
  };
  const utils = render(<AskComposer {...props} />);
  return { ...utils, props, field: () => screen.getByRole<HTMLTextAreaElement>('textbox') };
};

describe('the question box', () => {
  it("uses the host's own words, and asks for a follow-up once a turn is there", () => {
    const { rerender, props } = box();
    expect(screen.getByRole('textbox', { name: 'Ask this knowledgebase a question' })).toBeTruthy();
    rerender(<AskComposer {...props} followUp />);
    expect(screen.getByRole('textbox', { name: 'Ask a follow-up' })).toBeTruthy();
    rerender(<AskComposer {...props} followUp followUpLabel="Ask again" />);
    expect(screen.getByRole('textbox', { name: 'Ask again' }).getAttribute('placeholder')).toBe(
      'Ask again',
    );
  });

  it('holds the pill inside the box, before Send', () => {
    const { container } = box();
    const form = container.querySelector('[data-ask-composer]')!;
    expect(within(form as HTMLElement).getByTestId('pill')).toBeTruthy();
    const send = within(form as HTMLElement).getByRole('button', { name: 'Send' });
    expect(
      screen.getByTestId('pill').compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sends on Enter and clears, keeps a new line on Shift and Enter, and waits while composing', () => {
    const { props, field } = box();
    const send = screen.getByRole<HTMLButtonElement>('button', { name: 'Send' });
    expect(send.disabled).toBe(true);
    fireEvent.change(field(), { target: { value: 'When do we release?' } });
    expect(send.disabled).toBe(false);
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
    expect(props.onAsk).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(props.onAsk).toHaveBeenCalledWith('When do we release?');
    expect(field().value).toBe('');
  });

  it('keeps the question when it was not taken, and sends nothing blank', () => {
    const onAsk = vi.fn(() => false);
    const { field } = box({ onAsk });
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.submit(field().form!);
    expect(onAsk).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: 'Q?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onAsk).toHaveBeenCalledWith('Q?');
    expect(field().value).toBe('Q?');
  });

  it('counts from the last hundred characters, and marks the limit', () => {
    const { field } = box();
    fireEvent.change(field(), { target: { value: 'x'.repeat(ASK_COUNT_FROM - 1) } });
    expect(document.querySelector('[data-ask-count]')).toBeNull();
    fireEvent.change(field(), { target: { value: 'x'.repeat(ASK_COUNT_FROM) } });
    const count = document.querySelector('[data-ask-count]')!;
    expect(count.textContent).toBe('900 / 1,000');
    expect(field().getAttribute('aria-describedby')).toBe(count.id);
    fireEvent.change(field(), { target: { value: 'x'.repeat(ASK_MAX_QUESTION_CHARS) } });
    expect(document.querySelector('[data-ask-count]')!.className).toContain('font-semibold');
  });

  it('is Stop while an answer streams, with the field waiting', () => {
    const { props, field } = box({ streaming: true });
    expect(field().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(props.onStop).toHaveBeenCalled();
  });

  it('offers New Chat and the cost only when handed them', () => {
    const { rerender, props } = box();
    expect(screen.queryByRole('button', { name: 'New Chat' })).toBeNull();
    expect(document.querySelector('[data-ask-credits]')).toBeNull();
    const onNewChat = vi.fn();
    rerender(<AskComposer {...props} onNewChat={onNewChat} cost="Uses 1 AI credit" />);
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
    expect(onNewChat).toHaveBeenCalled();
    expect(document.querySelector('[data-ask-credits]')!.textContent).toBe('Uses 1 AI credit');
  });

  it('grows with its writing up to the cap', () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
    const { field } = box({ maxFieldHeight: 160 });
    fireEvent.change(field(), { target: { value: 'a\nb\nc' } });
    expect(field().style.height).toBe('160px');
    vi.restoreAllMocks();
  });

  it('puts the caret in the field on its first frame, unless the host says not to', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => frames.push(run));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { field, unmount } = box();
    act(() => frames.splice(0).forEach((run) => run(0)));
    expect(document.activeElement).not.toBe(field());
    unmount();
    box({ autoFocus: true });
    act(() => frames.splice(0).forEach((run) => run(0)));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});

describe('the AI pill for an app of its own', () => {
  const key = {
    kind: 'key',
    owner: 'item',
    provider: 'anthropic',
    model: 'Claude Fable 5.2',
    canChange: true,
  } as const;

  it("names the item's key in the app's own words", () => {
    expect(askAiView(key, 'key', 'This Knowledgebase’s Key')).toEqual({
      using: 'key',
      label: 'Claude Fable 5.2 (This Knowledgebase’s Key)',
      key: {
        label: 'This Knowledgebase’s Key',
        detail: 'Anthropic · Claude Fable 5.2 · No daily limits',
      },
    });
    // Unnamed, it is the item's own key, as every other app says.
    expect(askAiView(key, 'key').label).toBe('Claude Fable 5.2 (Its Own Key)');
  });

  it('holds the key alone where the server has no built-in AI, with its own built-in words', async () => {
    const view = askAiView(key, 'key');
    const { rerender } = render(
      <AnswerWith app="liveknowledge" view={view} manage={null} onPick={vi.fn()} builtIn={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Answer With/ }));
    let menu = await screen.findByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getAllByRole('radio')).toHaveLength(1);
    rerender(
      <AnswerWith
        app="liveknowledge"
        view={view}
        manage={null}
        onPick={vi.fn()}
        builtInDetail="Included with liveknowledge, 30 questions a person a day"
      />,
    );
    menu = await screen.findByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getAllByRole('radio')).toHaveLength(2);
    expect(
      within(menu).getByText('Included with liveknowledge, 30 questions a person a day'),
    ).toBeTruthy();
  });

  it('keeps built-in AI where no key applies, even with built-in AI said to be missing', async () => {
    render(
      <AnswerWith
        app="liveknowledge"
        view={askAiView({ kind: 'built-in', canChange: true }, 'key')}
        manage={null}
        onPick={vi.fn()}
        builtIn={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Answer With: Built-In AI' }));
    const menu = await screen.findByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getAllByRole('radio')).toHaveLength(1);
  });
});
