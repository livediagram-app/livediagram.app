# Build with AI

Status: shipped

`/ai` is the marketing page that gets a visitor from "I use an AI tool" to "my AI just made a diagram in livediagram" in the fewest possible steps. It is the front door to the [MCP server](../015-api/mcp-server.md): one address, one approval, then a prompt. The [help article](../../../apps/help/app/account-and-data/connect-ai-mcp/ai-clients/page.mdx) stays the reference; this page is the guided path, and links to it for everything past the first connection.

## Entry points

- **The site header's Build with AI link** (`BuildWithAiLink` in `packages/ui`, shown by `SiteHeader` when a surface passes `buildWithAi`). Every marketing page's header (`components/Header.tsx`) shows it, to the left of Start Blank. It is a quiet ghost link with a sparkles glyph, so the CTA pair stays the loudest thing in the bar. Desktop only (from `lg`): below that the bar is already full with Brand, the apps menu and the CTA pair. On `/ai` itself it carries `aria-current="page"` and a brand tint. The help centre, telemetry and Community headers do not show it.
- **The footer's AI & MCP link** (`SiteFooter`) opens `/ai`.
- **The FAQ's** "Can I connect my own AI assistant" answer links to `/ai` for setup. (Feature cards stay links to their help article, as every feature card is.)

## The page, top to bottom

1. **Hero.** Eyebrow "Build with AI", headline "Your AI, building in livediagram", a lede saying it works with the AI tool you already use, then the **address card**: `https://mcp.livediagram.app/mcp` in a monospace field with a Copy button (the one thing every tool needs). Beside it on wide screens, a chat illustration (`AiChatArt`): a request bubble, a tool-call chip naming the livediagram tool, and the shared `DiagramBuildAnimation` drawing the result with its cursor labelled "AI". Reduced motion shows the finished picture.
2. **Three steps** (`#how-it-works`), one row: **Add livediagram** (paste the address into your tool), **Approve** (a livediagram page opens: sign in or create a free account, check where access goes, Connect), **Ask** (request a diagram, board, sheet or deck; it lands in your account).
3. **Pick your tool** (`#connect`): a tab list of clients, grouped Chat apps, Coding agents, Editors, Anything else. Selecting one shows its steps. The choice is mirrored into the URL hash (`/ai#cursor`) with `history.replaceState`, and a hash on arrival selects that client, so a link can open straight onto one tool. Every panel is in the HTML (inactive ones `hidden`), so the instructions are indexable and work before hydration (the first client shows until then).
4. **Try it** (`#prompts`): starter prompts, each a card with a Copy button, each mapped to a shipped MCP tool.
5. **What it can do**: a grid of the MCP's capabilities in plain words (diagrams from a description or Mermaid, templates and Plan boards, Sheets, slides, articles and logos, find and read with a picture, share links, live changes on an open canvas with Undo).
6. **In your control**: account needed (free), the approval page shows where access goes, Read-only access, revoke from Settings › Account › API Tokens, six-month tokens, livediagram runs no AI model of its own.
7. **If it doesn't connect**: the three failure lines from the help article (expired request, token limit, keeps asking to sign in) plus self-hosting (use your own MCP host), and a link to the full help article.

## The clients

`lib/ai-clients.ts` holds the clients as data: an `id` (the URL hash), a `name`, a `group`, a one-line `blurb`, and `steps`, each step a sentence with optional code (`{ lang, code }`) or a link button (`{ href, label }`). One address constant, `MCP_URL`, feeds every snippet: this deployment's MCP worker, read from `NEXT_PUBLIC_MCP_ORIGIN` through the resolver the live app's consent pages use (`resolveMcpOrigin`, `@livediagram/api-schema`), so a self-hosted build shows its own address and the hosted one shows `https://mcp.livediagram.app/mcp`.

| id            | Name        | Group         | The way in                                                                                                                                                                                                       |
| ------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude`      | Claude      | Chat apps     | Open claude.ai Settings › Connectors (button), Add custom connector, name and URL, Connect. Same connectors in Claude Desktop. Team or Enterprise: an owner may need to add it.                                  |
| `chatgpt`     | ChatGPT     | Chat apps     | Settings › Apps & Connectors › Advanced: Developer mode on, Create, name, URL, OAuth, then pick it in a chat. Availability depends on the plan.                                                                  |
| `claude-code` | Claude Code | Coding agents | `claude mcp add --transport http --scope user livediagram <url>`, then `/mcp` › livediagram › Authenticate.                                                                                                      |
| `codex`       | Codex       | Coding agents | `codex mcp add livediagram --url <url>`, then `codex mcp login livediagram`. The `~/.codex/config.toml` form beside it.                                                                                          |
| `gemini`      | Gemini CLI  | Coding agents | `gemini mcp add --transport http livediagram <url>`, then `/mcp auth livediagram`.                                                                                                                               |
| `cursor`      | Cursor      | Editors       | One-click **Add to Cursor** (`cursor://anysphere.cursor-deeplink/mcp/install?name=livediagram&config=<base64 {"url": <url>}>`), or the `~/.cursor/mcp.json` entry; then sign in from Cursor's MCP settings.      |
| `vscode`      | VS Code     | Editors       | One-click **Add to VS Code** (`vscode:mcp/install?<encoded {"name","type":"http","url"}>`), or `.vscode/mcp.json` (`servers`, `type: "http"`); start it and allow the sign-in; use it from Copilot's agent mode. |
| `windsurf`    | Windsurf    | Editors       | Cascade's MCP settings › raw config (`mcp_config.json`), an entry with `serverUrl`; refresh, then sign in.                                                                                                       |
| `other`       | Any client  | Anything else | Add a remote (Streamable HTTP) server with the address; OAuth is discovered, no client id or secret. Without OAuth: an API token as `Authorization: Bearer lvd_…`.                                               |

Third-party menu names drift, so each client's last line says where to look if a label has moved, and the page never shows third-party logos: each tab wears a generic glyph for its group (chat, terminal, editor, plug).

## Behaviour

- **Copy** buttons use `navigator.clipboard.writeText` and `useCopiedFlash`: the label turns to "Copied" with a check for two seconds and a polite live region announces it. A blocked clipboard leaves the button as it was; the text is always selectable.
- **Tabs** follow the WAI-ARIA tabs pattern: `role="tablist"`, roving `tabIndex`, Left/Right/Home/End move and select, each tab `aria-controls` its panel.
- **One-click links** (`cursor:`, `vscode:`) open the editor app when it is installed; the manual config sits right under each, so nothing depends on the link.

## Share roles

The page is public marketing, outside any document, so Editor, Participant and Viewer do not apply. What the connected AI may do is the token's business ([MCP server §4.11](../015-api/mcp-server.md#411-read-only-tokens-the-one-scope)).

## Funnel and telemetry

`/ai` is its own [landing-funnel](landing-funnel.md) surface, `Ai`, with the shared header slots, so the dashboard counts its page views and any header CTA a visitor takes from it. The Build with AI link and the page's buttons lead to `/ai`, a third-party tool or `/get-started/`, never `/new`, so they carry no `via` source. As on every marketing page, nothing else is tracked (copies included).

## Metadata

`pageMetadata` with path `/ai`, a 50 to 160 character description, a `BreadcrumbList` (Home → Build with AI), and an `/ai` entry in `app/sitemap.ts`.

## Performance

The page ships one client island for the picker, the copy buttons and the prompts; the rest is static. No new dependency. The chat art reuses `DiagramBuildAnimation` (CSS keyframes, no JS tick).
