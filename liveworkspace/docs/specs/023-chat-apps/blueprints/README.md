# Chat apps blueprint

Implements [chat-apps.md](../chat-apps.md).

## Files

`packages/chat` (`@liveworkspace/chat`), pure, Web APIs only:

| File                     | Holds                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/limits.ts`          | every bound below, with its value                                                                  |
| `src/constant-time.ts`   | `constantTimeEqual(a, b)`: both sides hashed (SHA-256), then diffed without an early exit          |
| `src/slack-signature.ts` | `verifySlackRequest({ secret, timestamp, signature, body, now })`: `ok`, `stale`, `bad`, `missing` |
| `src/slack-text.ts`      | `slackEscape`, `slackCut`, `SLACK_SECTION_MAX` (the index's connections import them)               |
| `src/slack-blocks.ts`    | `slackAnswer`, `slackPreview`, `slackNotice`, `slackConnectPrompt`                                 |
| `src/slack-api.ts`       | `slackCall(method, token, body)`, `slackOAuthAccess`, `postToResponseUrl`                          |
| `src/teams-auth.ts`      | `verifyBotFrameworkRequest(...)`, `createBotFrameworkKeys()`: the JWT check and its key cache      |
| `src/teams-connector.ts` | `botToken(credentials)`, `replyToActivity`, `sendPersonal`                                         |
| `src/teams-cards.ts`     | `teamsAnswer`, `teamsPreview`, `teamsNotice`, `teamsConnectPrompt`                                 |
| `src/answer.ts`          | `ChatAnswer`, `ChatSource`, `ChatPreview`, `ChatTrust`: what an app hands the builders             |
| `src/signed.ts`          | `chatKeys(secret)` (HKDF: a seal key and a signing key), `signPayload`, `readSigned`               |
| `src/replay.ts`          | `REPLAY_KEEP_MS` and the key each kind of request is de-duplicated by                              |

## Constants

| Constant                   | Value      | Why                                           |
| -------------------------- | ---------- | --------------------------------------------- |
| `CHAT_REQUEST_WINDOW_S`    | 300        | Slack's own advice; Teams' token skew         |
| `REPLAY_KEEP_MS`           | 600,000    | twice the window                              |
| `CHAT_CALL_TIMEOUT_MS`     | 10,000     | the connections' delivery bound               |
| `SLACK_SECTION_MAX`        | 3,000      | Slack refuses a longer section                |
| `SLACK_BLOCKS_MAX`         | 50         | Slack refuses more blocks in a message        |
| `SLACK_BUTTON_VALUE_MAX`   | 2,000      | Slack's limit                                 |
| `CHAT_SOURCES_SHOWN`       | 5          | an answer's sources drawn; "and 3 more" after |
| `CHAT_PREVIEW_EXCERPT_MAX` | 300        | a preview's excerpt                           |
| `BOT_KEYS_KEEP_MS`         | 86,400,000 | Microsoft's advice: the keys once a day       |
| `SIGNED_PAYLOAD_MAX`       | 2,048      | a signed state or code is read at most so far |

## Tests

At 100% lines and branches (`vitest.config.ts`): a good signature, a wrong one, one a byte short, a stale and a
future timestamp, a missing header; a JWT signed by a test key accepted, and refused for the wrong issuer, audience,
service URL, expiry, an unknown key and `alg: none`; the escaping of `<!channel>` and `&` in every builder; a
model-written `https://` address that stays text (`verbatim`); a 60-source answer within 50 blocks; a signed payload
that is tampered, expired or too long refused; the builders on a worst-case input within a CPU budget.
