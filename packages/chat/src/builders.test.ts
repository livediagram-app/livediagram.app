import { describe, expect, it } from 'vitest';
import { dayMonth, sourceLine, trustWords, type ChatAnswer, type ChatPreview } from './answer';
import { SLACK_BLOCKS_MAX, SLACK_SECTION_MAX, TEAMS_TEXT_MAX } from './limits';
import { slackAnswer, slackConnectPrompt, slackNotice, slackPreview } from './slack-blocks';
import { plainCut, slackCut, slackEscape } from './slack-text';
import {
  teamsAnswer,
  teamsConnectPrompt,
  teamsLinkResult,
  teamsMessage,
  teamsNotice,
  teamsPreview,
} from './teams-cards';

const VERIFIED = Date.UTC(2026, 10, 21);

const answer = (over: Partial<ChatAnswer> = {}): ChatAnswer => ({
  question: 'When do we deploy?',
  parts: [
    { kind: 'text', text: 'Deploys go out on Tuesdays' },
    { kind: 'cite', number: 1 },
    { kind: 'text', text: '. Ping <!channel> & see https://evil.example.' },
    { kind: 'cite', number: 9 },
  ],
  sources: [
    {
      number: 1,
      title: 'Deploys <b>',
      url: 'https://www.liveknowledge.app/document/kb#t=deploys',
      trust: { state: 'verified', verifiedAt: VERIFIED, verifiedBy: 'Roger Blake' },
      health: { score: 82, label: 'Good' },
    },
  ],
  trustLine: 'Answered from 1 verified page',
  gaps: ['Who approves a hotfix?'],
  gapsNote: 'Sent to AI Knowledge as an unanswered question.',
  footer: 'Engineering · Built-In AI',
  open: {
    label: 'Open in liveknowledge',
    url: 'https://www.liveknowledge.app/document/kb?view=ask',
  },
  share: { label: 'Share in Channel', value: 'answer-1' },
  ...over,
});

const preview: ChatPreview = {
  title: 'Deploys',
  url: 'https://www.liveknowledge.app/document/kb#t=deploys',
  excerpt: 'We deploy on Tuesdays & Thursdays <always>.',
  owner: 'Ana Ruiz',
  trust: { state: 'due', verifiedAt: VERIFIED },
  footer: 'liveknowledge · Engineering',
};

describe('words', () => {
  it('says trust as the page does', () => {
    expect(dayMonth(VERIFIED)).toBe('21 Nov');
    expect(trustWords({ state: 'verified', verifiedAt: VERIFIED })).toBe('Verified 21 Nov');
    expect(trustWords({ state: 'due' })).toBe('Review Due');
    expect(trustWords({ state: 'due', verifiedAt: VERIFIED })).toBe(
      'Review Due, last verified 21 Nov',
    );
    expect(trustWords({ state: 'never' })).toBe('Never Verified');
    expect(trustWords({ state: 'off' })).toBe('');
    expect(sourceLine({ trust: { state: 'off' } })).toBe('');
    expect(
      sourceLine({ trust: { state: 'never' }, health: { score: 3, label: 'Needs Work' } }),
    ).toBe('Never Verified · Health 3, Needs Work');
  });
  it('escapes and cuts', () => {
    expect(slackEscape('<!channel> & >')).toBe('&lt;!channel&gt; &amp; &gt;');
    expect(slackCut('a &amp; b', 20)).toBe('a &amp; b');
    expect(slackCut('ab &amp; c', 7)).toBe('ab …');
    expect(slackCut('ab😀cd', 4)).toBe('ab…');
    expect(plainCut('abc', 5)).toBe('abc');
    expect(plainCut('ab cd', 4)).toBe('ab…');
    expect(plainCut('ab😀cd', 4)).toBe('ab…');
  });
});

describe('Slack blocks', () => {
  it('draws the answer with linked citations, sources, trust, gaps and its buttons', () => {
    const message = slackAnswer(answer());
    const json = JSON.stringify(message);
    expect(json).toContain('<https://www.liveknowledge.app/document/kb#t=deploys|[1]>');
    expect(json).toContain('&lt;!channel&gt; &amp;');
    expect(json).not.toContain('<!channel>');
    // A model's address stays text: escaped, never wrapped as a link, and verbatim so Slack does not link it.
    expect(json).not.toContain('<https://evil.example');
    expect(json).toContain(' [9]');
    expect(json).toContain('Verified 21 Nov by Roger Blake · Health 82, Good');
    expect(json).toContain('Deploys &lt;b&gt;');
    expect(json).toContain('*Not covered:* Who approves a hotfix?');
    expect(json).toContain('share_answer');
    expect(json).toContain('Engineering · Built-In AI');
    for (const block of message.blocks) {
      const text = (block.text as { verbatim?: boolean } | undefined)?.verbatim;
      if (block.type === 'section') expect(text).toBe(true);
    }
    expect(message.text).toContain('Deploys go out on Tuesdays[1]');
  });
  it('heads a shared answer, and leaves out what an answer does not have', () => {
    const message = slackAnswer(
      answer({
        sharedBy: 'Shared by <@U1>',
        sources: [],
        trustLine: null,
        gaps: [],
        share: null,
        parts: [],
      }),
    );
    const json = JSON.stringify(message);
    expect(json).toContain('Shared by <@U1>');
    expect(json).not.toContain('Sources');
    expect(json).not.toContain('share_answer');
    expect(json).toContain('"text":"…"');
  });
  it('draws a source with no trust and no health as its title alone', () => {
    const json = JSON.stringify(
      slackAnswer(
        answer({
          sources: [{ number: 1, title: 'Bare', url: 'https://x/1', trust: { state: 'off' } }],
        }),
      ),
    );
    expect(json).toContain('*[1]* <https://x/1|Bare>"');
  });
  it('drops a Share button whose value would not fit', () => {
    const json = JSON.stringify(
      slackAnswer(answer({ share: { label: 'Share', value: 'x'.repeat(2001) } })),
    );
    expect(json).not.toContain('share_answer');
  });
  it('holds Slack limits on a worst case: 60 sources, a huge answer of escapes and many gaps', () => {
    const sources = Array.from({ length: 60 }, (_, i) => ({
      number: i + 1,
      title: `Page ${i}`.repeat(50),
      url: `https://www.liveknowledge.app/document/kb#t=p${i}`,
      trust: { state: 'never' as const },
    }));
    const parts = Array.from({ length: 400 }, (_, i) =>
      i % 2
        ? { kind: 'cite' as const, number: (i % 60) + 1 }
        : { kind: 'text' as const, text: '&<>'.repeat(30) },
    );
    const start = process.cpuUsage();
    const message = slackAnswer(answer({ sources, parts, gaps: Array(20).fill('gap') }));
    const cpu = process.cpuUsage(start);
    expect((cpu.user + cpu.system) / 1000).toBeLessThan(200);
    expect(message.blocks.length).toBeLessThanOrEqual(SLACK_BLOCKS_MAX);
    for (const block of message.blocks) {
      const text = (block.text as { text?: string } | undefined)?.text ?? '';
      expect(text.length).toBeLessThanOrEqual(SLACK_SECTION_MAX);
    }
    expect(JSON.stringify(message)).toContain('and 55 more');
    expect(JSON.stringify(message)).toContain('|Page 0Page 0');
    expect(message.text.length).toBeLessThanOrEqual(SLACK_SECTION_MAX);
  });
  it('stops at a citation that does not fit, without cutting its link', () => {
    const parts = [
      { kind: 'text' as const, text: 'a'.repeat(SLACK_SECTION_MAX - 5) },
      { kind: 'cite' as const, number: 1 },
    ];
    const section = slackAnswer(answer({ parts })).blocks[1] as { text: { text: string } };
    expect(section.text.text.endsWith('…')).toBe(true);
    expect(section.text.text).not.toContain('<https');
    const full = [
      { kind: 'text' as const, text: 'a'.repeat(SLACK_SECTION_MAX) },
      ...parts.slice(1),
    ];
    const same = slackAnswer(answer({ parts: full })).blocks[1] as { text: { text: string } };
    expect(same.text.text.length).toBe(SLACK_SECTION_MAX);
  });
  it('draws a preview, a notice and the connect prompt', () => {
    const json = JSON.stringify(slackPreview(preview));
    expect(json).toContain('*<https://www.liveknowledge.app/document/kb#t=deploys|Deploys>*');
    expect(json).toContain('&amp; Thursdays &lt;always&gt;');
    expect(json).toContain('Owner: Ana Ruiz · Review Due, last verified 21 Nov');
    const bare = JSON.stringify(
      slackPreview({ ...preview, excerpt: '', owner: null, trust: { state: 'off' } }),
    );
    expect(bare).not.toContain('Owner');
    expect(slackNotice('Hi <you>').text).toBe('Hi &lt;you&gt;');
    const prompt = slackConnectPrompt({
      text: 'Connect',
      button: 'Connect Your Account',
      url: 'https://x/l',
    });
    expect(JSON.stringify(prompt)).toContain('"url":"https://x/l"');
  });
});

describe('Teams cards', () => {
  it('draws the answer as text runs, citations opening their pages', () => {
    const card = teamsAnswer(answer());
    const json = JSON.stringify(card);
    expect(json).toContain('"text":". Ping <!channel> & see https://evil.example."');
    expect(json).toContain('"url":"https://www.liveknowledge.app/document/kb#t=deploys"');
    expect(json).toContain('Verified 21 Nov by Roger Blake');
    expect(json).toContain('Not covered: ');
    expect(json).not.toContain('"type":"TextBlock"');
    expect(JSON.stringify(teamsMessage(card))).toContain('application/vnd.microsoft.card.adaptive');
  });
  it('caps a huge answer and lists the rest of its sources', () => {
    const sources = Array.from({ length: 8 }, (_, i) => ({
      number: i + 1,
      title: `P${i}`,
      url: `https://x/${i}`,
      trust: { state: 'off' as const },
    }));
    const parts = [
      { kind: 'text' as const, text: 'x'.repeat(TEAMS_TEXT_MAX + 10) },
      { kind: 'cite' as const, number: 1 },
    ];
    const json = JSON.stringify(teamsAnswer(answer({ parts, sources, trustLine: null, gaps: [] })));
    expect(json).toContain('and 3 more');
    expect(json.length).toBeLessThan(28_000);
    const empty = JSON.stringify(teamsAnswer(answer({ parts: [], sources: [] })));
    expect(empty).toContain('"text":"…"');
  });
  it('draws a preview, its link result, a notice and the connect prompt', () => {
    expect(JSON.stringify(teamsPreview(preview))).toContain('Owner: Ana Ruiz');
    const bare = JSON.stringify(
      teamsPreview({ ...preview, excerpt: '', owner: null, trust: { state: 'off' } }),
    );
    expect(bare).not.toContain('Owner');
    expect(teamsLinkResult(preview).composeExtension.attachments[0]!.preview.content.title).toBe(
      'Deploys',
    );
    expect(JSON.stringify(teamsNotice('Hi'))).toContain('"text":"Hi"');
    expect(
      JSON.stringify(teamsConnectPrompt({ text: 't', button: 'b', url: 'https://x' })),
    ).toContain('Action.OpenUrl');
  });
});
