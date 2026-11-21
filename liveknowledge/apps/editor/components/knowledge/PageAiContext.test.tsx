// @vitest-environment jsdom

// AI Context in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"), from plain
// props, a share role at a time; and the words Ask About This Page leaves for Ask's field.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeRights } from '@/lib/knowledge/knowledge-rights';
import {
  ASK_DRAFT_TTL_MS,
  askAboutPageText,
  setAskDraft,
  takeAskDraft,
} from '@/lib/knowledge-ask/ask-draft';
import { AskComposer } from '@/components/ask/AskComposer';
import { PageAiContext, aboutTokens, askedTimes, type PageAiContextProps } from './PageAiContext';

afterEach(cleanup);

const ANSWERED = [
  { question: 'How do we roll back a deploy?', asked: 6 },
  { question: 'Who approves a release?', asked: 1 },
];
const AGENTS = [
  { agent: 'Coding Agent', reads: 12 },
  { agent: 'Support Bot', reads: 1 },
];

const view = (props: Partial<PageAiContextProps> = {}) =>
  render(
    <PageAiContext
      inContext={false}
      tokens={1200}
      answered={ANSWERED}
      agents={AGENTS}
      onSetContext={undefined}
      onAskAboutPage={() => {}}
      {...props}
    />,
  );
const section = () => screen.getByRole('region', { name: 'AI Context' });

describe('AI Context', () => {
  it('quotes the questions answered from the page, most asked first, with how many times', () => {
    view();
    const items = within(section()).getAllByRole('listitem');
    expect(items.slice(0, 2).map((li) => li.textContent)).toEqual([
      '“How do we roll back a deploy?Asked 6 times',
      '“Who approves a release?Asked once',
    ]);
    expect(screen.getByRole('heading', { name: 'AI Context' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Answered From This Page' })).toBeTruthy();
  });

  it('names the agents that read it this week, with their reads', () => {
    view();
    const agents = section().querySelectorAll('[data-page-agent]');
    expect([...agents].map((a) => a.textContent)).toEqual([
      'Coding Agent12 reads',
      'Support Bot1 read',
    ]);
  });

  it('says so when nothing was answered from the page and no agent read it', () => {
    view({ answered: [], agents: [] });
    expect(screen.getByText('No questions answered from this page yet.')).toBeTruthy();
    expect(screen.getByText('No agent has read this page this week.')).toBeTruthy();
  });

  it('holds quiet placeholders before Page Health is read, and no size', () => {
    view({ answered: undefined, agents: undefined, tokens: undefined });
    expect(section().querySelector('[data-ai-context-placeholder]')).not.toBeNull();
    expect(section().querySelector('[data-context-size]')).toBeNull();
    expect(screen.queryByText('No questions answered from this page yet.')).toBeNull();
  });

  it("draws other people's words as text, never as markup", () => {
    view({ answered: [{ question: '<img src=x onerror=alert(1)> deploys?', asked: 2 }] });
    expect(section().querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)> deploys?')).toBeTruthy();
  });

  it('opens Ask about the page for every role', () => {
    const ask = vi.fn();
    view({ onAskAboutPage: ask });
    fireEvent.click(screen.getByRole('button', { name: 'Ask About This Page' }));
    expect(ask).toHaveBeenCalledOnce();
  });
});

describe('Always in Context, a share role at a time', () => {
  const rightsOf = (editPages: boolean, offline = false) =>
    knowledgeRights({
      can: { editPages },
      isStructureReadOnly: false,
      accountUserId: 'u1',
      offline,
    });

  it('as edit: a switch named Always in Context, described by the size, that sets it', () => {
    const set = vi.fn();
    expect(rightsOf(true).editFields).toBe(true);
    view({ onSetContext: set });
    const toggle = screen.getByRole('switch', { name: 'Always in Context' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('aria-describedby')).toBe(
      section().querySelector('[data-context-size]')!.id,
    );
    expect(screen.getByText('About 1,200 tokens')).toBeTruthy();
    fireEvent.click(toggle);
    expect(set).toHaveBeenCalledWith(true);
    cleanup();
    view({ onSetContext: set, inContext: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Always in Context' }));
    expect(set).toHaveBeenLastCalledWith(false);
  });

  it.each([
    ['participate', false],
    ['view', false],
  ] as const)('as %s: words, no switch', (_role, editPages) => {
    expect(rightsOf(editPages).editFields).toBe(false);
    view({ onSetContext: undefined, inContext: true });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText('Handed to Every Agent First')).toBeTruthy();
    cleanup();
    view({ onSetContext: undefined, inContext: false });
    expect(screen.getByText('Not Handed to Agents First')).toBeTruthy();
  });

  it('Offline: no Editor may set it', () => {
    expect(rightsOf(true, true).editFields).toBe(false);
  });
});

describe('the words', () => {
  it('counts asks and tokens in words', () => {
    expect(askedTimes(1)).toBe('Asked once');
    expect(askedTimes(1234)).toBe('Asked 1,234 times');
    expect(aboutTokens(1)).toBe('About 1 token');
    expect(aboutTokens(8000)).toBe('About 8,000 tokens');
  });
});

describe('Ask About This Page', () => {
  it('leaves "About <title>: " for this knowledgebase, taken once, within a minute', () => {
    expect(askAboutPageText('  Release\n Process ')).toBe('About Release Process: ');
    expect(askAboutPageText('')).toBe('About This Page: ');
    setAskDraft('kb', 'About Deploys: ', 1000);
    expect(takeAskDraft('other', 1000)).toBeNull();
    expect(takeAskDraft('kb', 1000)).toBeNull();
    setAskDraft('kb', 'About Deploys: ', 1000);
    expect(takeAskDraft('kb', 1000 + ASK_DRAFT_TTL_MS)).toBeNull();
    setAskDraft('kb', 'About Deploys: ', 1000);
    expect(takeAskDraft('kb', 2000)).toBe('About Deploys: ');
    expect(takeAskDraft('kb', 2000)).toBeNull();
  });

  it("fills Ask's field, focused, the caret at the end, and sends nothing", () => {
    const onAsk = vi.fn(() => true);
    render(
      <AskComposer
        streaming={false}
        followUp={false}
        onAsk={onAsk}
        onStop={() => {}}
        initialValue="About Deploys: "
      />,
    );
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ask a question' });
    expect(field.value).toBe('About Deploys: ');
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe('About Deploys: '.length);
    expect(onAsk).not.toHaveBeenCalled();
  });
});
