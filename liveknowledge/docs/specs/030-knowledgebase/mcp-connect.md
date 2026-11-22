# Connect

Status: **built, seen in a browser on 2026-11-21** (light and dark, 1440 and 390 wide; the status flip through a
scripted MCP client that registered, signed in on the consent page and read over the local MCP worker, not through a
real AI app). The [Connect UI blueprint](blueprints/mcp-connect-ui.md)
has the detail.

Owner, 2026-11-21: "I would also like a tab at the bottom for MCP Connect, which guides the user through connecting to
the MCP from the AI app so it can read and write to the knowledgebase".

The knowledgebase's fourth view, after AI Knowledge: a guided setup, step by step, that connects an AI app to this
knowledgebase over the MCP server, then shows it connected. It replaces the **Connect an Agent** dialog: AI
Knowledge's **Connect an Agent** buttons open this view.

## The tab

- **Connect MCP**, with a plug icon, the fourth tab in the footer: **Pages | Ask | AI Knowledge | Connect MCP**
  ([Search and Ask](search-and-ask.md) "The views"). Its address is `?view=connect`. Its hover card: "Connect an AI
  App", "Connect Claude, ChatGPT, Cursor or another AI app so it can read and write these pages."
- "Connect MCP" (owner 2026-11-22, was "Connect"): the tab and the view's heading say what it connects. On a phone
  it keeps "Connect" (the others are Pages, Ask, AI).
- **Signed out** (a share link's visitor included): a press opens a dialog over the knowledgebase, a sheet on a
  phone, as Ask's gate does: "Sign In to Connect an AI App", why (connecting makes a token for your account), and
  **Sign In**. The address followed from a link shows the same words in the view.
- **Offline**: the tab stays, quieter and going nowhere; its hover card says "Connect Needs Syncing", the one
  reason the other views give, and **Sync Knowledgebase**.
- Not offered where the views are not (an embed, zen mode, a workbench, the welcome flow, a Community visitor, a
  link confined to one page).

## The view

The header: "Connect" and its line, "Connect an AI app over MCP so it can read and write this knowledgebase." Under
it, the steps, numbered, in one column; beside them on a wide screen (one column below 1,024 px, after the steps)
**Already Connected** and **Other Ways In**.

1. **Pick Your AI App.** Six cards in a group a person picks one of: **Claude** (the web and the desktop app),
   **Claude Code**, **ChatGPT**, **Cursor**, **VS Code** and **Other App** (anything that speaks remote MCP). Each
   a generic icon for its kind (never a company's logo), its name and one line. Claude is picked at first; the
   choice is kept in this browser.
2. **Add liveknowledge to <App>.** The app's own steps, the ones the Build with AI page shows
   (`@liveworkspace/marketing-site` `aiClients`, one list for both): menu names in bold, a button that opens the
   app's settings where there is one (Claude's connectors, ChatGPT's settings, Cursor's and VS Code's one-click
   install), and the address, command or JSON to copy, each with **Copy** and "Copied" for two seconds. The address
   is this deployment's MCP server, `https://mcp.liveknowledge.app/mcp` when hosted. A closing line where the app's
   menus move or its plan matters.
3. **Approve and Choose Access.** Your app opens a liveknowledge page titled Connect and the app's name. Check the
   site it says the access is sent to, switch on **Read-only access** if the app should only read, and choose
   **Connect**. Approving makes an API token named for the app, revoked in Settings, API Tokens. Then what it may do
   here, three rows, each with what it means and whether this person's connection gets it:
   - **Reads**: search and read every page, with how far each can be trusted. Every role.
   - **Suggests Edits**: propose a change for a person to accept, start a page, ask for approval, comment. An
     Editor's or a Participant's connection, unless Read-only access was chosen. A Viewer's never.
   - **Writes**: replace a page's writing and move pages, directly, never on a page that is Verified or Review
     Due. Only an Editor's connection, once that Editor allows it with **Allow Writing** on its card in AI
     Knowledge ([Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md) "Share roles": a
     Participant's token suggests and never writes). An Editor reads "Choose Allow Writing on its card once it
     connects" with **Open Connected Agents**; anyone else reads that only an Editor's connection can write.
     And one line: the connection acts for you and reaches every knowledgebase you can open, so name this one
     (its name, in quotes) when you ask.
4. **Check It Worked.** A status that watches for the app, and a first prompt to try.
   - **Waiting for Your App**: "Ask it the prompt below. It shows here once it reads a page." While waiting it checks
     every 10 seconds, for 5 minutes from when the view opened or **Check Now** was pressed, and only while the
     browser tab is showing; then **Stopped Checking**, with **Check Again**.
   - **Connected: <App>**, its last-seen line and pages read this week, once a connection that was not there when
     the view opened reads here (or one that was, reads again). **Manage in AI Knowledge** opens AI Knowledge.
     Checking stops.
   - A check that fails says "Could Not Check" with **Try Again**; what is on show stays.
   - The prompt, to copy: `Search my liveknowledge knowledgebase "<name>" and tell me in five lines what it covers.
Name the pages you read.`

**Already Connected**: the connections seen here in the last 30 days, as AI Knowledge counts them, each its icon,
name, how it connects and its chips (**Reads**, **Suggests Edits**, **Writes**), at most five, and **Manage in AI
Knowledge**. None yet: "No Apps Connected Yet", "An app shows here once it reads a page of this knowledgebase."

**Other Ways In**: the command line (`liveknowledge auth login`, `context`, `search`, to copy) and **Open API
Tokens** (Settings' Tokens page), with "A read-only token only reads, whatever is allowed here."

## What it costs

One `GET .../knowledge` when the view opens and one each check: at most 31 in 5 minutes, none while the browser tab
is hidden, none once connected. Each is the read AI Knowledge makes on opening ([AI Knowledge](ai-knowledge.md) "The
view, as built"), measured in the blueprint.

## Share roles

| Action                                        | Editor | Participant | Viewer |
| --------------------------------------------- | ------ | ----------- | ------ |
| Open Connect, follow the steps, copy          | yes    | yes         | yes    |
| Connect an app that reads                     | yes    | yes         | yes    |
| Connect an app that suggests edits            | yes    | yes         | no     |
| Allow a connection to write (in AI Knowledge) | yes    | no          | no     |

Signed in only: a signed-out session gets the gate above. A knowledgebase kept Offline cannot be reached by any
app.

## Not built

- The status cannot see the sign-in itself: an app shows only once it reads a page here, so one that connected but
  was asked nothing stays "Waiting".
- ChatGPT's and the editors' flows are the Build with AI page's words, not checked against each app in this change.
