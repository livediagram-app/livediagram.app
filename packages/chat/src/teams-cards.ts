// An answer, a preview, a notice and the prompt to connect an account, as Teams Adaptive Cards
// (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "The builders", "Escaping"). Each text is a plain `TextRun`
// in a `RichTextBlock`, which Teams never reads as Markdown, so a title like `[Reset](https://…)` is those
// characters; the only links are the runs and buttons built here from the app's own addresses.
import { sourceLine, trustWords, type ChatAnswer, type ChatPreview } from './answer';
import {
  CHAT_GAPS_SHOWN,
  CHAT_PREVIEW_EXCERPT_MAX,
  CHAT_SOURCES_SHOWN,
  TEAMS_TEXT_MAX,
} from './limits';
import { plainCut } from './slack-text';

export type AdaptiveCard = Record<string, unknown>;

const run = (text: string, style: Record<string, unknown> = {}) => ({
  type: 'TextRun',
  text,
  ...style,
});
const rich = (inlines: unknown[], block: Record<string, unknown> = {}) => ({
  type: 'RichTextBlock',
  ...block,
  inlines,
});
const opens = (url: string) => ({ selectAction: { type: 'Action.OpenUrl', url } });
const subtle = { isSubtle: true, size: 'Small' };

const card = (body: unknown[], actions: unknown[] = []): AdaptiveCard => ({
  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  type: 'AdaptiveCard',
  version: '1.4',
  body,
  ...(actions.length ? { actions } : {}),
});

const openUrl = (title: string, url: string) => ({ type: 'Action.OpenUrl', title, url });

/** An activity holding one card. */
export const teamsMessage = (content: AdaptiveCard) => ({
  type: 'message',
  attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content }],
});

export function teamsAnswer(answer: ChatAnswer): AdaptiveCard {
  const byNumber = new Map(answer.sources.map((s) => [s.number, s]));
  const inlines: unknown[] = [];
  let length = 0;
  for (const part of answer.parts) {
    if (length >= TEAMS_TEXT_MAX) break;
    if (part.kind === 'text') {
      const text = plainCut(part.text, TEAMS_TEXT_MAX - length);
      length += text.length;
      inlines.push(run(text));
      continue;
    }
    const source = byNumber.get(part.number);
    inlines.push(run(` [${part.number}]`, source ? { color: 'Accent', ...opens(source.url) } : {}));
  }
  const body: unknown[] = [
    rich([run(`Asked: ${plainCut(answer.question, 1000)}`, subtle)]),
    rich(inlines.length ? inlines : [run('…')], { spacing: 'Small' }),
  ];
  const shown = answer.sources.slice(0, CHAT_SOURCES_SHOWN);
  if (shown.length > 0) {
    body.push(rich([run('Sources', { weight: 'Bolder' })], { spacing: 'Medium' }));
    for (const source of shown) {
      const line = sourceLine(source);
      body.push(
        rich(
          [
            run(`[${source.number}] `, { weight: 'Bolder' }),
            run(plainCut(source.title, 200), { color: 'Accent', ...opens(source.url) }),
            ...(line ? [run(` · ${line}`, subtle)] : []),
          ],
          { spacing: 'None' },
        ),
      );
    }
    const more = answer.sources.length - shown.length;
    if (more > 0) body.push(rich([run(`and ${more} more`, subtle)], { spacing: 'None' }));
  }
  if (answer.trustLine) body.push(rich([run(answer.trustLine, subtle)]));
  for (const gap of answer.gaps.slice(0, CHAT_GAPS_SHOWN))
    body.push(rich([run('Not covered: ', { weight: 'Bolder' }), run(plainCut(gap, 500))]));
  if (answer.gaps.length > 0 && answer.gapsNote) body.push(rich([run(answer.gapsNote, subtle)]));
  body.push(rich([run(answer.footer, subtle)], { spacing: 'Medium' }));
  return card(body, [openUrl(answer.open.label, answer.open.url)]);
}

export function teamsPreview(preview: ChatPreview): AdaptiveCard {
  const facts = [preview.owner ? `Owner: ${preview.owner}` : '', trustWords(preview.trust)].filter(
    Boolean,
  );
  const excerpt = plainCut(preview.excerpt, CHAT_PREVIEW_EXCERPT_MAX);
  return card(
    [
      rich([
        run(plainCut(preview.title, 200), {
          weight: 'Bolder',
          size: 'Medium',
          color: 'Accent',
          ...opens(preview.url),
        }),
      ]),
      ...(excerpt ? [rich([run(excerpt)], { spacing: 'Small' })] : []),
      ...(facts.length ? [rich([run(facts.join(' · '), subtle)])] : []),
      rich([run(preview.footer, subtle)], { spacing: 'None' }),
    ],
    [openUrl('Open', preview.url)],
  );
}

/** A link's preview as a message extension's answer to `composeExtension/queryLink`. */
export function teamsLinkResult(preview: ChatPreview) {
  return {
    composeExtension: {
      type: 'result',
      attachmentLayout: 'list',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: teamsPreview(preview),
          preview: {
            contentType: 'application/vnd.microsoft.card.thumbnail',
            content: { title: plainCut(preview.title, 200), text: trustWords(preview.trust) },
          },
        },
      ],
    },
  };
}

export const teamsNotice = (text: string): AdaptiveCard => card([rich([run(text)])]);

export const teamsConnectPrompt = (prompt: { text: string; button: string; url: string }) =>
  card([rich([run(prompt.text)])], [openUrl(prompt.button, prompt.url)]);
