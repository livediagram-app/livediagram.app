// Every bound of a chat app (liveworkspace/docs/specs/023-chat-apps/blueprints/README.md "Constants").

/** How far a request's time may be from now, either way: Slack's own advice, and Teams' token skew. */
export const CHAT_REQUEST_WINDOW_S = 300;
/** How long a request's key is kept to refuse it a second time: twice the window. */
export const REPLAY_KEEP_MS = 2 * CHAT_REQUEST_WINDOW_S * 1000;
/** How long a call out to Slack or the Bot Framework may take. */
export const CHAT_CALL_TIMEOUT_MS = 10_000;
/** The most a Slack section's text may hold: past it Slack refuses the whole message (invalid_blocks). */
export const SLACK_SECTION_MAX = 3000;
/** The most blocks Slack takes in one message. */
export const SLACK_BLOCKS_MAX = 50;
/** The most a Slack button's value may hold. */
export const SLACK_BUTTON_VALUE_MAX = 2000;
/** An answer's sources drawn; past it, "and N more". */
export const CHAT_SOURCES_SHOWN = 5;
/** The gaps drawn under an answer. */
export const CHAT_GAPS_SHOWN = 3;
/** A link preview's excerpt. */
export const CHAT_PREVIEW_EXCERPT_MAX = 300;
/** A Teams answer's text: a card holds about 28 KB, the rest is its sources. */
export const TEAMS_TEXT_MAX = 8000;
/** Microsoft's advice: read the Bot Framework's keys at most once a day. */
export const BOT_KEYS_KEEP_MS = 86_400_000;
/** An unknown key fetches the keys again at most this often, so a stream of forged ids is one fetch. */
export const BOT_KEYS_RETRY_MS = 300_000;
/** A signed state or code is read at most this long. */
export const SIGNED_PAYLOAD_MAX = 2048;
