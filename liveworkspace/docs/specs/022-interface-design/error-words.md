# Error words

Status: shipped (Work Tracker 1438)

## What

Every app says what went wrong in the same voice: **what happened**, then **what to do next**. A person who hits an
error is at the moment their trust is lowest; a line that only says "Something went wrong" tells them neither why nor
whether trying again will help. Being offline, signed out and lacking access looked the same before this; now each
reads as itself, in every app, from one shared helper.

## The voice

- **Two short sentences.** The first says what happened, in plain words ("You’re offline.", "You’ve been signed
  out."). The second says what to do ("Sign in again to carry on."). No codes, no status numbers, no blame.
- **Say what failed when the surface knows it.** An action's own line leads ("Couldn’t rename “Roadmap”.") and the
  reason follows it ("You’re offline. Reconnect, then try again."). A line with nothing to add keeps the plain ending
  "Try again.".
- **Offer a retry only where retrying can help.** Signed out, no access and gone never show Try Again: trying again
  could only fail the same way. Their next step is the action that fixes it (sign in, ask for access) or nothing.
- **Offline retries itself.** A read that failed because the browser is offline says so and runs again on its own
  when the connection comes back, with no Try Again (it could only fail again until then). An action the person took
  (a save, a rename) says to reconnect and try again: it is never sent behind their back.
- **No app nouns in shared words.** The shared lines say "that" and "it", so they read right in every app (the
  product naming guards hold); an app's own line may name its item.
- **The plain line is the last resort.** "Something went wrong. Try again." is only for an error none of the classes
  below explains.

## The classes

What the browser or the server answered, and the words for it. A code the server names wins over its status; a
surface's own words for a code (an account limit, a webhook address) win over these.

| Class        | When                                                                | Words                                                                            | Retry                   |
| ------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| Offline      | the browser says it is offline                                      | You’re offline. Reconnect, then try again.                                       | on reconnect            |
|              | (a read that runs again by itself)                                  | You’re offline. It tries again when you reconnect.                               | by itself, on reconnect |
| Unreachable  | the request never got an answer while the browser is online         | Couldn’t connect. Check your connection and try again.                           | Try Again               |
| Signed out   | 401, or the code `signed_out`, `unauthorized` or `unauthenticated`  | You’ve been signed out. Sign in again to carry on.                               | none (sign in)          |
| No access    | 403, or the code `forbidden` or `no_access`                         | You don’t have access to that. Ask its owner for access.                         | none (ask for access)   |
| Not found    | 404 or 410, or the code `not_found`                                 | That’s no longer there. It may have been moved or deleted.                       | none                    |
| Conflict     | 409, or the code `conflict`                                         | That changed somewhere else just now. Refresh to see the latest, then try again. | after a refresh         |
| Rate limited | 429, or the code `rate_limited`                                     | Too many tries just now. Wait a minute and try again.                            | after a wait            |
| Server       | 500 to 599, or the code `server_error`, `internal` or `unavailable` | Something went wrong on our side. Try again in a moment.                         | Try Again               |
| Unknown      | anything else                                                       | Something went wrong. Try again.                                                 | Try Again               |

## Where it shows

- **Account panels and Settings** (`@liveworkspace/settings-ui`): every refusal without words of its own takes the
  class's words, and a load that failed offline runs again on reconnect. Its Try Again shows only for a class that
  can retry.
- **The Explorer** (`@liveworkspace/explorer`): an action's toast keeps its own lead ("Couldn’t duplicate
  “Roadmap”.") and takes the class's words after it; Teams' refusals take the class's words.
- **Snapshots** (`@liveworkspace/snapshots`): a refusal with no message of the server's takes the class's words; the
  list that failed to load says why, runs again on reconnect when offline, and offers Try Again only where it helps.
- **A part of the editor that broke** (the area error boundary, `@liveworkspace/workbench`): an error with a class
  says "<Area> couldn’t load." and the class's words; a crash with none says "Something went wrong in <area>." with
  Try Again. Offline waits for the connection, as before.

Not here: the AI answers' own words (liveknowledge's Ask), the Community and Drive pages' own states, and the MCP
connector's answers keep their own, already specific, words.
