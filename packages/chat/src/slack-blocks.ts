// An answer, a preview, a notice and the prompt to connect an account, as Slack blocks
// (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "The builders", "No outside links"). Every text is escaped and
// sent `verbatim`, so nothing in it becomes a mention or a link; the only links are the ones built here from the
// app's own addresses. Slack's limits hold whatever the input: at most 50 blocks, a section at most 3,000
// characters, a button's value at most 2,000.
import { sourceLine, trustWords, type ChatAnswer, type ChatPreview } from './answer';
import {
  CHAT_GAPS_SHOWN,
  CHAT_PREVIEW_EXCERPT_MAX,
  CHAT_SOURCES_SHOWN,
  SLACK_BLOCKS_MAX,
  SLACK_BUTTON_VALUE_MAX,
  SLACK_SECTION_MAX,
} from './limits';
import { plainCut, slackCut, slackEscape } from './slack-text';

export type SlackBlock = Record<string, unknown>;
export type SlackMessage = { text: string; blocks: SlackBlock[] };

const mrkdwn = (text: string) => ({ type: 'mrkdwn', text, verbatim: true });
const section = (text: string): SlackBlock => ({
  type: 'section',
  text: mrkdwn(slackCut(text, SLACK_SECTION_MAX)),
});
const context = (text: string): SlackBlock => ({
  type: 'context',
  elements: [mrkdwn(slackCut(text, SLACK_SECTION_MAX))],
});
/** A link as Slack writes it. The address is the app's own; its text is escaped. */
const link = (url: string, text: string) => `<${url}|${slackEscape(text)}>`;

/** The answer's text with each citation a link to its source, cut to fit one section. */
function answerText(answer: ChatAnswer): string {
  const byNumber = new Map(answer.sources.map((s) => [s.number, s]));
  let out = '';
  for (const part of answer.parts) {
    const source = part.kind === 'cite' ? byNumber.get(part.number) : undefined;
    const piece =
      part.kind === 'text'
        ? slackEscape(part.text)
        : source
          ? ` ${link(source.url, `[${part.number}]`)}`
          : ` [${part.number}]`;
    if (out.length + piece.length > SLACK_SECTION_MAX) {
      // A link is never cut in two: only text is shortened to fit what is left.
      if (part.kind === 'text') out += slackCut(piece, SLACK_SECTION_MAX - out.length);
      else if (out.length < SLACK_SECTION_MAX) out += '…';
      break;
    }
    out += piece;
  }
  return out.trim() || '…';
}

/** The answer's words alone, for the notification and a screen reader's preview. */
const plainAnswer = (answer: ChatAnswer) =>
  answer.parts
    .map((p) => (p.kind === 'text' ? p.text : `[${p.number}]`))
    .join('')
    .trim();

export function slackAnswer(answer: ChatAnswer): SlackMessage {
  const blocks: SlackBlock[] = [];
  if (answer.sharedBy) blocks.push(context(answer.sharedBy));
  blocks.push(context(`*Asked:* ${slackEscape(plainCut(answer.question, 1000))}`));
  blocks.push(section(answerText(answer)));
  const shown = answer.sources.slice(0, CHAT_SOURCES_SHOWN);
  if (shown.length > 0) {
    blocks.push(context('*Sources*'));
    for (const source of shown) {
      const line = sourceLine(source);
      blocks.push(
        context(
          `*[${source.number}]* ${link(source.url, plainCut(source.title, 200))}${line ? ` · ${slackEscape(line)}` : ''}`,
        ),
      );
    }
    const more = answer.sources.length - shown.length;
    if (more > 0) blocks.push(context(`and ${more} more`));
  }
  if (answer.trustLine) blocks.push(context(slackEscape(answer.trustLine)));
  for (const gap of answer.gaps.slice(0, CHAT_GAPS_SHOWN))
    blocks.push(section(`*Not covered:* ${slackEscape(plainCut(gap, 500))}`));
  if (answer.gaps.length > 0 && answer.gapsNote) blocks.push(context(slackEscape(answer.gapsNote)));
  const buttons: SlackBlock[] = [
    {
      type: 'button',
      action_id: 'open_answer',
      text: { type: 'plain_text', text: answer.open.label },
      url: answer.open.url,
    },
  ];
  if (answer.share && answer.share.value.length <= SLACK_BUTTON_VALUE_MAX)
    buttons.push({
      type: 'button',
      action_id: 'share_answer',
      text: { type: 'plain_text', text: answer.share.label },
      value: answer.share.value,
    });
  blocks.push({ type: 'actions', elements: buttons });
  blocks.push(context(slackEscape(answer.footer)));
  return {
    text: slackCut(slackEscape(plainAnswer(answer)), SLACK_SECTION_MAX),
    blocks: blocks.slice(0, SLACK_BLOCKS_MAX),
  };
}

/** A link's preview, for `chat.unfurl`: the title as a link, the excerpt, the owner and the trust. */
export function slackPreview(preview: ChatPreview): SlackMessage {
  const excerpt = plainCut(preview.excerpt, CHAT_PREVIEW_EXCERPT_MAX);
  const facts = [preview.owner ? `Owner: ${preview.owner}` : '', trustWords(preview.trust)].filter(
    Boolean,
  );
  const blocks: SlackBlock[] = [
    section(
      `*${link(preview.url, plainCut(preview.title, 200))}*${excerpt ? `\n${slackEscape(excerpt)}` : ''}`,
    ),
  ];
  if (facts.length > 0) blocks.push(context(slackEscape(facts.join(' · '))));
  blocks.push(context(slackEscape(preview.footer)));
  return { text: slackEscape(preview.title), blocks };
}

/** One sentence. */
export function slackNotice(text: string): SlackMessage {
  return { text: slackEscape(text), blocks: [section(slackEscape(text))] };
}

/** The prompt to link an account: why, and a button that opens the app's link page. */
export function slackConnectPrompt(prompt: { text: string; button: string; url: string }) {
  return {
    text: slackEscape(prompt.text),
    blocks: [
      section(slackEscape(prompt.text)),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'connect_account',
            style: 'primary',
            text: { type: 'plain_text', text: prompt.button },
            url: prompt.url,
          },
        ],
      },
    ],
  } satisfies SlackMessage;
}
