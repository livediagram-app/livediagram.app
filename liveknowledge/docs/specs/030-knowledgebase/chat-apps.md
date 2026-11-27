# Slack and Teams

Status: **built, not yet seen in a real Slack workspace or Teams tenant** (Work Tracker 1342; owner 2026-11-21 picked it
from the lead's suggestions). The connect dialog and the account link page were seen locally; the messages were
rendered from their builders. The apps' registration, review and listing are the owner's. The engineering detail is
[blueprints/chat-apps.md](blueprints/chat-apps.md); what every app's chat app holds to is the platform's
[chat-apps.md](../../../../liveworkspace/docs/specs/023-chat-apps/chat-apps.md).

Most team questions are asked in Slack or Teams, not in the wiki. A knowledgebase can be connected to a Slack
workspace and to a Microsoft Teams tenant, so a question asked there is answered from its pages, with its sources
and their trust, the same Ask the editor runs ([Search and Ask](search-and-ask.md) "Ask"), and a page's link pasted
there shows what the page is.

## Connecting

- **Where.** **Slack and Teams** in the knowledgebase's menu ([Knowledgebases and pages](knowledgebases-and-pages.md)
  "The knowledgebase's menu"), after AI Editing: a centred dialog (a sheet on a phone) under the shared illustrated
  header, "Slack and Teams", "Ask this knowledgebase from chat. Answers use each person's own access." Two rows,
  **Slack** and **Microsoft Teams**, each a generic mark (no company's logo), its name, its state and its action.
- **Slack.** **Connect Slack** opens Slack's own install page ("Add to Slack") in the same tab; choosing a workspace
  there and allowing it comes back to the knowledgebase with the dialog open and the row reading "Connected to
  <workspace>". Refused or cancelled at Slack, the dialog says so ("Slack was not connected.").
- **Microsoft Teams.** Teams has no install page to come back from, so **Connect Teams** shows a one-time code
  (`K7Q4-MZP2`, ten letters and digits, good for 15 minutes) with **Copy** and three steps: add the liveknowledge app
  in Teams (**Open Teams**), open a chat with it, and send `connect K7Q4-MZP2`. The app answers in Teams, and the
  row reads "Connected to <tenant>" the next time the dialog opens, or at once while it is open (it looks again every
  5 seconds while a code is showing, for the code's 15 minutes, only while the browser tab shows).
- **One knowledgebase a workspace.** A workspace or tenant already connected to another knowledgebase is refused
  ("This Slack workspace is already connected to another knowledgebase. Disconnect it there first."), without naming
  it. Connecting the same one again replaces its token and keeps its linked people.
- **Disconnect.** Each connected row has **Disconnect**, asked first ("Disconnect Slack?", "People in <workspace> can
  no longer ask this knowledgebase. Everyone will need to connect their account again."). It removes the connection,
  revokes the token at Slack, forgets every linked account and anything waiting. Uninstalling the app in Slack does
  the same.
- **Not configured.** On a server without the app's settings (self-hosted, or before the owner registers it), the
  row says "Not set up on this server" and has no action.
- **Not offered**: Offline, signed out, in an embed, a workbench, to a Community visitor, or through a link
  confined to one page.

## Asking

- **Slack**: `/ask <question>`, a mention (`@liveknowledge <question>`) in a channel the app is in, or a direct
  message to the app. **Teams**: a mention in a channel or group chat, or a message in the app's personal chat.
- **Help**: `/ask` alone or `/ask help` (or `help` in Teams) answers how to ask, which knowledgebase is connected,
  and whether the asker's account is linked. `/ask unlink` (`unlink` in Teams) forgets the asker's link.
- **Linking an account** (owner's answer 2026-11-27, A: each chat user links their liveworkspace account once). The
  first question from someone not linked is not answered: they get, privately, "Connect your liveworkspace account
  to ask <knowledgebase>. Answers use what you can open." with **Connect Your Account**. Its link opens
  `/chat/link` in liveknowledge, good for 30 minutes and once only: signed out, it asks to sign in and comes back;
  signed in, it shows the chat account (the workspace's name and the person's chat name) and **Connect** (and
  **Not Now**). Connected, the page says to go back to Slack (or Teams) and ask again. A new prompt replaces an
  unused one. An expired or used link says so ("This link has expired. Ask in Slack again for a new one.").
- **Whose access.** Each answer reads only the pages the linked account can open in this knowledgebase, worked out
  from the index for each question. Someone who can no longer open it is told so ("You can't open <knowledgebase>
  with your liveworkspace account.") and given nothing from it. An answer is from the knowledgebase's pages alone:
  Connected Items and the team folder ([Search and Ask](search-and-ask.md) "Sources") need the person's own signed-in
  request, as a team's or a person's AI key does.
- **Private.** In Slack every answer is ephemeral, seen only by the asker, in the thread they asked in; in Teams an
  answer from a channel or a group chat goes to the asker's personal chat with the app, and the channel gets "I sent
  you the answer in a private chat." A direct message is answered there.
- **Share in Channel** (Slack, an answer asked in a channel): posts the same answer where it was asked, for
  everyone, headed "Shared by @<asker>". The asker chose to show it, as they could copy it. Kept 30 minutes; past
  that the button says the answer has expired.
- **Acknowledged at once.** Slack: "Looking in <knowledgebase>…", privately; Teams: a typing indicator. The answer
  follows when it is ready (seconds, at most the model's 60).

## What an answer shows

The same answer Ask gives, drawn in the chat's own blocks:

- the question, quoted;
- the answer, its citation numbers linking to each cited page (`[1]`), as text: no Markdown, no mention and no
  address in it becomes a link ([Search and Ask](search-and-ask.md) "No outside links in an answer");
- **Sources**: each cited page by number, its title linking to the page in liveknowledge, its trust (Verified with
  the date and who, Review Due with when it was last verified, Never Verified; none under a Review Period of Never)
  and its Health Score and word; the first 5, then "and 2 more";
- the trust line ("Answered from 3 verified pages");
- each part the pages did not cover ("Not covered: <gap>"), and that it went to AI Knowledge's Unanswered Questions;
- the footer: the knowledgebase's name, which AI answered (Built-In AI or the model), and **Open in liveknowledge**,
  which opens the knowledgebase's Ask view.
- A refusal or failure is the words Ask says ([Search and Ask](search-and-ask.md) "Bounds", "Built-in AI"), never a
  code.

## Unanswered questions

A chat question is a question Ask answers, so a part it could not answer is recorded as Ask records it
([Insights](insights.md)): it reaches AI Knowledge's **Unanswered Questions**, a first question answered in full
settles it, and a new one fires the "a question nobody could answer" trigger as Ask's do.

## Cost

A chat question is the linked person's question, under the [Which key answers](search-and-ask.md#which-key-answers)
rules for a request made without the person's own sign-in token: the knowledgebase's own key when it has one, else
built-in AI, never a team's or a person's shared key. Every limit holds: 20 questions a person an hour and 200 a
knowledgebase a day, and on built-in AI 30 a person a day and 100 a knowledgebase a day, with Pro's AI credits on top.
A question in chat spends no more than one asked in the editor.

## Link previews

- Pasting a link to a page of the connected knowledgebase (`/document/<id>#t=<page>`) in Slack, or in Teams' message
  box, shows a preview: the page's title (a link), an excerpt of its first words (at most 300 characters, as text),
  its **Owner**, and its trust ("Verified 21 Nov by Roger Blake", "Review Due, last verified 8 Nov", "Never
  Verified").
- It is drawn with the access of whoever pasted it, when they are linked and can open the page; anyone else's paste
  shows no preview (Slack's own plain link). A link to the knowledgebase itself shows its name and page count. A link
  to any other knowledgebase is not previewed: its install is this knowledgebase's alone.
- The preview is seen by everyone in the conversation: the one who pasted the link chose to share it.

## Share roles

| Action                                            | Editor | Participant | Viewer |
| ------------------------------------------------- | ------ | ----------- | ------ |
| See Slack and Teams in the menu, connect, disconnect | yes | no          | no     |
| Ask from chat, once linked                         | yes    | yes         | yes    |
| Answers and previews from pages they can open      | yes    | yes         | yes    |

Only an Editor of the whole knowledgebase, signed in, connects or disconnects; the Editor's own access is checked
again when Slack sends them back. Every chat user asks with their own role: a linked Viewer is answered from the pages
a Viewer reads, exactly as in the editor; someone with no access gets nothing. A guest and a share link's visitor
cannot link (the page asks them to sign in to an account).

## Telemetry

`UI·Opened·ChatApps`, `UI·Used·ChatConnectSlack`, `UI·Used·ChatConnectTeams`, `UI·Used·ChatDisconnect` and
`UI·Used·ChatAccountLinked`; the api counts chat questions in its `[chat] ask` log line, by platform. Never a name,
an id or a word.
