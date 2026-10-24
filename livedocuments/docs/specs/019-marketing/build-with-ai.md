# Build with AI

Status: shipped

`/ai` is the marketing page that gets a visitor from "I use an AI tool" to "my AI just made a deck in livedocuments" in the fewest possible steps. It is the front door to the [MCP server](../015-api/mcp-server.md): one address, one approval, then a prompt. The [help article](../../../apps/help/app/account-and-data/connect-ai-mcp/ai-clients/page.mdx) stays the reference; this page is the guided path, and links to it for everything past the first connection.

## Entry points

- **The site header's Build with AI link** (`BuildWithAiLink` in `packages/ui`, shown by `SiteHeader` when a surface passes `buildWithAi`). Every marketing page's header (`components/Header.tsx`, and `/licences`) shows it to everyone, signed in or not, first on the right of the bar, before Choose Template and Explorer ([Header](marketing-site.md)). It is a quiet ghost link with a sparkles glyph, so Choose Template stays the loudest thing in the bar. Below `lg` it is the sparkles alone in a 40px square, its name kept in the aria-label. On `/ai` itself it carries `aria-current="page"` and a brand tint. The help centre and telemetry headers do not show it.
- **The footer's AI & MCP link** (`SiteFooter`) opens `/ai`.
- **The FAQ's** "Can I connect my own AI assistant" answer links to `/ai` for setup. (Feature cards stay links to their help article, as every feature card is.)

## The page, top to bottom

1. **Hero.** Eyebrow "Build with AI", headline "Your AI, building in livedocuments", a lede saying it works with the AI tool you already use, then the **address card**: `https://mcp.livedocuments.app/mcp` in a monospace field with a Copy button (the one thing every tool needs). Beside it on wide screens, a chat illustration (`AiChatArt`): a request bubble, a tool-call chip naming the livedocuments tool, and the shared `DiagramBuildAnimation` drawing the result with its cursor labelled "AI". Reduced motion shows the finished picture.
2. **Three steps** (`#how-it-works`), one row: **Add livedocuments** (paste the address into your tool), **Approve** (a livedocuments page opens: sign in or create a free account, check where access goes, Connect), **Ask** (request a diagram, board, sheet or deck; it lands in your account).
3. **Pick your tool** (`#connect`): a tab list of clients, grouped Chat apps, Coding agents, Editors, Anything else. Selecting one shows its steps. The choice is mirrored into the URL hash (`/ai#cursor`) with `history.replaceState`, and a hash on arrival selects that client, so a link can open straight onto one tool. Every panel is in the HTML (inactive ones `hidden`), so the instructions are indexable and work before hydration (the first client shows until then).
4. **Try it** (`#prompts`): starter prompts, each a card with a Copy button, each mapped to a shipped MCP tool.
5. **What it can do**: a grid of the MCP's capabilities in plain words (articles written from Markdown, slide decks and infographics, templates, find and read with a picture, share links, live changes on an open document with Undo).
6. **In your control**: account needed (free), the approval page shows where access goes, Read-only access, revoke from Settings › Account › API Tokens, six-month tokens, livedocuments runs no AI model of its own.
7. **If it doesn't connect**: the three failure lines from the help article (expired request, token limit, keeps asking to sign in) plus self-hosting (use your own MCP host), and a link to the full help article.

## The clients

`lib/ai-clients.ts` holds the clients as data: an `id` (the URL hash), a `name`, a `group`, a one-line `blurb`, and `steps`, each step a sentence with optional code (`{ lang, code }`) or a link button (`{ href, label }`). One address constant, `MCP_URL`, feeds every snippet: this deployment's MCP worker, read from `NEXT_PUBLIC_MCP_ORIGIN` through the resolver the editor app's consent pages use (`resolveMcpOrigin`, `@livedocuments/api-schema`), so a self-hosted build shows its own address and the hosted one shows `https://mcp.livedocuments.app/mcp`.

| id            | Name        | Group         | The way in                                                                                                                                                                                                       |
| ------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`      | Claude      | Chat apps     | Open claude.ai Settings › Connectors (button), Add custom connector, name and URL, Connect. Same connectors in Claude Desktop. Team or Enterprise: an owner may need to add it.                                  |
| `chatgpt`     | ChatGPT     | Chat apps     | Settings › Apps & Connectors › Advanced: Developer mode on, Create, name, URL, OAuth, then pick it in a chat. Availability depends on the plan.                                                                  |
| `claude-code` | Claude Code | Coding agents | `claude mcp add --transport http --scope user livedocuments <url>`, then `/mcp` › livedocuments › Authenticate.                                                                                                  |
| `codex`       | Codex       | Coding agents | `codex mcp add livedocuments --url <url>`, then `codex mcp login livedocuments`. The `~/.codex/config.toml` form beside it.                                                                                      |
| `gemini`      | Gemini CLI  | Coding agents | `gemini mcp add --transport http livedocuments <url>`, then `/mcp auth livedocuments`.                                                                                                                           |
| `cursor`      | Cursor      | Editors       | One-click **Add to Cursor** (`cursor://anysphere.cursor-deeplink/mcp/install?name=livedocuments&config=<base64 {"url": <url>}>`), or the `~/.cursor/mcp.json` entry; then sign in from Cursor's MCP settings.    |
| `vscode`      | VS Code     | Editors       | One-click **Add to VS Code** (`vscode:mcp/install?<encoded {"name","type":"http","url"}>`), or `.vscode/mcp.json` (`servers`, `type: "http"`); start it and allow the sign-in; use it from Copilot's agent mode. |
| `windsurf`    | Windsurf    | Editors       | Cascade's MCP settings › raw config (`mcp_config.json`), an entry with `serverUrl`; refresh, then sign in.                                                                                                       |
| `other`       | Any client  | Anything else | Add a remote (Streamable HTTP) server with the address; OAuth is discovered, no client id or secret. Without OAuth: an API token as `Authorization: Bearer lwt_…`.                                               |

Third-party menu names drift, so a client whose menus are known to move (ChatGPT) says where to look if a label has moved, and the page never shows third-party logos: each tab wears a generic glyph for its group (a chat bubble, a code square, an app window, a link).

## Behaviour

- **Copy** buttons use `navigator.clipboard.writeText` and `useCopiedFlash`: the label turns to "Copied" with a check for two seconds and a polite live region beside the button (never inside it, where a button's children are not read as a region) announces it. A button's accessible name starts with the words it shows ("Copy prompt: Map a codebase"), so it can be named by voice. A blocked clipboard leaves the button as it was; the text is always selectable. A command's `$ ` prompt is drawn by CSS, so selecting and copying the block by hand never takes it along.
- **Tabs** follow the WAI-ARIA tabs pattern: `role="tablist"`, roving `tabIndex`, the arrow keys (either pair) and Home/End move and select, each tab `aria-controls` its panel. The list's `aria-orientation` follows its layout: vertical down the side from `lg`, horizontal across the top below it. Its group headings cannot sit in a tablist, so each tab is `aria-describedby` its group's heading. A link to `/ai#<client>` opens on that client in the hydrating render, before paint; the static HTML itself shows the first client until the page's script runs.
- **One-click links** (`cursor:`, `vscode:`) open the editor app when it is installed; the manual config sits right under each, so nothing depends on the link.

## Share roles

The page is public marketing, outside any document, so Editor, Participant and Viewer do not apply. What the connected AI may do is the token's business ([MCP server §4.11](../015-api/mcp-server.md#411-read-only-tokens-the-one-scope)).

## Funnel and telemetry

`/ai` is its own [landing-funnel](landing-funnel.md) surface, `Ai`, with the shared header slots, so the dashboard counts its page views and any header CTA a visitor takes from it. The Build with AI link and the page's buttons lead to `/ai`, a third-party tool or `/get-started/`, never `/new`, so they carry no `via` source. As on every marketing page, nothing else is tracked (copies included).

## Metadata

`pageMetadata` with path `/ai`, a 50 to 160 character description, a `BreadcrumbList` (Home → Build with AI), and an `/ai` entry in `app/sitemap.ts`.

## Performance

The page's script is its client components: the picker, and each copy button outside it (the address and the prompts); the rest is static. No new dependency. The chat art is `AiChatArt` (CSS keyframes, no JS tick).
