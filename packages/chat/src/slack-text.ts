// Text as Slack reads it (liveworkspace/docs/specs/023-chat-apps/chat-apps.md "Escaping"): its three control
// characters escaped in everything Slack reads as markup, so a name like `<!channel>` pings no one and can't hide a
// link, and text cut at a whole character, never inside an escape. The index's connections use them too.
import { SLACK_SECTION_MAX } from './limits';

export { SLACK_SECTION_MAX };

/** Slack's mrkdwn treats these three as control characters. */
export const slackEscape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Escaped text cut to `max` characters with an ellipsis: never inside an escape (`&am`) or a surrogate pair. */
export function slackCut(escaped: string, max: number): string {
  if (escaped.length <= max) return escaped;
  let head = escaped.slice(0, Math.max(0, max - 1));
  const amp = head.lastIndexOf('&');
  if (amp >= 0 && !head.includes(';', amp)) head = head.slice(0, amp);
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return `${head}…`;
}

/** Plain text cut to `max` characters with an ellipsis, never inside a surrogate pair (a Teams text, an excerpt). */
export function plainCut(text: string, max: number): string {
  if (text.length <= max) return text;
  let head = text.slice(0, Math.max(0, max - 1));
  const last = head.charCodeAt(head.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) head = head.slice(0, -1);
  return `${head.trimEnd()}…`;
}
