# Embeds: blueprint

Derived from [YouTube video element](../youtube-video.md), extended by
[More than YouTube](../embed-providers.md) and [The Website embed](../website-embed.md). The spec
decides; this file only adds engineering precision. Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                     | Role                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/diagram/src/youtube.ts`                        | `youtubeVideoId`, the URL builders, `embedTargetFor`, provider tables      |
| `packages/diagram/src/element-types.ts`                  | `VideoElement`                                                             |
| `packages/diagram/src/factories.ts`                      | `createVideo`: 480×270, `aspectLocked`, optional `embedProvider`           |
| `packages/diagram/src/index.ts`                          | `isBoxed` includes `video`                                                 |
| `packages/diagram/src/colors.ts`                         | Default fill / stroke / text, `supportsColours`, paper-independent ink     |
| `packages/diagram/src/themes.ts`                         | `THEME_COLOUR_FIELDS.video` is empty                                       |
| `packages/diagram/src/shadow.ts`                         | `supportsShadow` includes `video`                                          |
| `packages/diagram/src/validate.ts`                       | `ELEMENT_TYPES` has `video`; `embedProvider` must be in `EMBED_PROVIDERS`  |
| `packages/diagram/src/element-kind-label.ts`             | `elementKindLabel`: `video` reads "Embed"                                  |
| `packages/diagram/src/svg-render-describe.ts`            | Headless export: the generic rect branch [Q2]                              |
| `apps/live/components/canvas/VideoView.tsx`              | The face: empty state, poster, load card, player, controls, no-load notice |
| `apps/live/components/canvas/use-frame-blocked.ts`       | `useFrameBlocked`: the no-load watch                                       |
| `apps/live/components/canvas/element-variant.ts`         | The dark rounded frame (`case 'video'`)                                    |
| `apps/live/components/canvas/ElementFaceRouter.tsx`      | Routes `video` to `VideoView`                                              |
| `apps/live/components/canvas/useBoxedElementGestures.ts` | Double-click opens the link picker                                         |
| `apps/live/components/canvas/BoxedElementView.tsx`       | The link badge (`linked`) applies to `video`                               |
| `apps/live/components/dialogs/EditorElementDialogs.tsx`  | Builds the `urlOnly` config for a `video` target                           |
| `apps/live/components/dialogs/LinkPickerDialog.tsx`      | `UrlOnlyConfig`: URL mode only, validate as you type and at commit         |
| `apps/live/lib/url-safety.ts`                            | `normaliseUrl`, `isSafeFollowUrl`                                          |
| `apps/live/components/palette/palette-tile-defs.tsx`     | Six `media:embed-*` tiles, `tileGroup: 'embed'`                            |
| `apps/live/components/palette/palette-create-tabs.tsx`   | `PaletteMediaTab`: the Embed group under Image and Avatar                  |
| `apps/live/components/palette/PaletteTileGroup.tsx`      | The collapsible group row                                                  |
| `apps/live/components/palette/palette-group-state.tsx`   | `PaletteGroupProvider`, `usePaletteGroup` [Q11]                            |
| `apps/live/app/diagram/[id]/useElementCreation.ts`       | `addVideo(provider?)` arms the draw                                        |
| `apps/live/lib/draw-mode.ts`                             | `PendingDraw` `video` intent, banner copy, cursor glyph                    |
| `apps/live/lib/draw-commit.ts`                           | `drawnDragBox` 16:9 fit, `buildDrawnBoxed`                                 |
| `apps/live/hooks/canvas/useShapeDrawing.ts`              | `Element·Added·Video` on a drawn embed                                     |
| `apps/live/lib/element-telemetry.ts`                     | `elementTelemetryType`: `video` → `Video` for copy paths                   |
| `apps/live/lib/element-names.ts`                         | `kindLabel`: `video` reads "Embed"                                         |
| `apps/live/lib/excalidraw-export.ts`                     | Rectangle labelled with the URL (DC12) [Q2]                                |

## Domain and naming

| Term            | Identifier                                             | Meaning                                                         |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Embed           | `VideoElement`, `type: 'video'`                        | The element; the persisted kind stays `video`, the name "Embed" |
| Embed link      | `element.link` with `kind: 'url'`                      | The one source of truth for what the embed shows                |
| Provider        | `EmbedProvider` (`EMBED_PROVIDERS`)                    | `youtube`, `vimeo`, `loom`, `figma`, `gdocs`, `website`         |
| Provider hint   | `VideoElement.embedProvider`                           | The tile the embed was created from; names copy only            |
| Embed target    | `EmbedTarget`                                          | `embedTargetFor(url)`: provider, iframe URL, poster, label      |
| Video id        | `youtubeVideoId(url)`                                  | 11 chars of `[A-Za-z0-9_-]`; derived, never stored              |
| Poster          | `EmbedTarget.posterUrl`, `youtubePosterUrl(id)`        | YouTube's `hqdefault.jpg`; no other provider has one            |
| Load card       | `LoadCard` (in `VideoView.tsx`)                        | Provider label plus **Load embed**, for a target with no poster |
| Player          | the `<iframe>` in `VideoView`                          | Mounted only while `playing`                                    |
| Player controls | `PlayerControls`, `controls` state                     | Use the player, Stop, and (website) Open in a new tab           |
| No-load notice  | `BlockedNotice`, `useFrameBlocked().failed`            | No `load` event within `LOAD_TIMEOUT_MS`                        |
| Website label   | `EmbedTarget.label` when `provider === 'website'`      | The host with `www.` stripped                                   |
| Embed group     | `tileGroup: 'embed'`, `PaletteTileGroup title="Embed"` | The Media row that opens in place                               |

Banned synonyms: "video" for the element in user-facing copy (say embed; `video` is the persisted
kind and the telemetry token only), "iframe element", "frame" for the element (a frame is a shape
kind), "thumbnail" for the poster, "provider field" (there is only the hint).

## Behaviour and state

### Resolving a link: `embedTargetFor(url)`

1. **YouTube first.** `youtubeVideoId(url)`; an id returns `provider: 'youtube'`,
   `embedUrl = youtubeEmbedUrl(id)`, `posterUrl = youtubePosterUrl(id)`, `label: 'YouTube'`.
2. **Parse.** Empty or unparseable (`new URL(url.trim())` throws) returns `null`.
3. **Scheme.** Protocol other than `http:` / `https:` returns `null`, before any host check.
4. **Host.** `hostname`, lower-cased, one leading `www.` stripped. Exact comparison only.
5. **YouTube host without an id** returns `null` [Q1].
6. **Vimeo** (`vimeo.com`, `player.vimeo.com`): path matches `VIMEO_ID` →
   `https://player.vimeo.com/video/<id>`; otherwise `null` [Q8].
7. **Loom** (`loom.com`): path matches `LOOM_ID` → `https://www.loom.com/embed/<id>`; otherwise
   `null` [Q8].
8. **Figma** (`figma.com`, `figma.site`): always →
   `https://www.figma.com/embed?embed_host=livediagram&url=<encodeURIComponent(parsed)>` [Q8].
9. **Google** (`docs.google.com`): path must start `/document/`, `/spreadsheets/` or
   `/presentation/`, else `null`. A trailing `/edit` or `/view` with anything after it becomes
   `/preview`; a URL with neither passes through unchanged (DC11) [Q8].
10. **Website.** Any other host returns `provider: 'website'`, `embedUrl = parsed.toString()` (the
    WHATWG serialisation) and `label = host || 'Website'` (DC10) [Q8] [Q10].

### `youtubeVideoId(url)`

1. Empty, unparseable or non-`http(s)` → `null`.
2. Host in `SHORT_HOSTS` → the first path segment if it matches `VIDEO_ID`.
3. Host not in `YOUTUBE_HOSTS` → `null`.
4. `?v=` present → that value if it matches `VIDEO_ID` (checked before the path).
5. First path segment (case-insensitive) in `ID_BEARING_PREFIXES` → the second segment if valid.
6. Otherwise `null`. The id keeps its case.

### Element states (per viewer)

`VideoView` holds `playing: boolean` and `controls: boolean` in React state, local to the viewer
and never persisted or broadcast (DC1).

| State          | Condition                               | Renders                                                     |
| -------------- | --------------------------------------- | ----------------------------------------------------------- |
| `empty`        | no URL link                             | `EmptyState` prompt, named by `embedProvider` when set      |
| `unembeddable` | URL link, `embedTargetFor` is `null`    | `EmptyState` "Can't embed that link" plus the URL           |
| `poster`       | target with `posterUrl`, not playing    | Poster image and the play badge                             |
| `load-card`    | target without `posterUrl`, not playing | `LoadCard`: the label chip and **Load embed**               |
| `playing`      | `playing === true`                      | The iframe, `PlayerControls`, and `BlockedNotice` if failed |

Transitions:

- `poster` → `playing`: play badge click; `stopPropagation`, `track('Element', 'Used', 'Video')`.
- `load-card` → `playing`: **Load embed** click; same telemetry.
- `playing` → `poster` / `load-card`: **Stop**, which also clears `controls` and calls
  `frame.reset()`. The iframe unmounts.
- `controls` toggles with **Use the player** / **Lock the player**; only meaningful while playing.
- Any change of `target?.embedUrl` resets `playing` and `controls` to `false` (DC2).
- Unmount (tab switch, element deleted) discards both.

Guards and invariants:

- **I1** No `<iframe>` exists unless `playing` is true.
- **I2** The iframe has `pointer-events: none` unless `controls` is true.
- **I3** The poster, the load card and the no-load overlay are `pointer-events-none`; only the play
  badge, **Load embed**, the control buttons and the two new-tab links opt back in, and each stops
  propagation of `click` (the links also of `pointerdown`).
- **I4** An iframe `src` is only ever an `EmbedTarget.embedUrl`, so always `http(s)`.
- **I5** `sandbox` is set exactly when `provider === 'website'` [Q4].
- **I6** Nothing third-party is fetched on open except the YouTube poster image.

### No-load watch: `useFrameBlocked(src)`

`VideoView` passes `playing ? target.embedUrl : undefined`, for every provider (DC5) [Q6].

1. A new `src` clears `failed`.
2. With a `src`, a `LOAD_TIMEOUT_MS` timer starts; its expiry sets `failed = true`.
3. The iframe's `onLoad` clears the timer and sets `failed = false`.
4. `reset()` sets `failed = false`; unmount or a `src` change clears the timer.

`failed` means "no `load` event", never "the site refused framing".

### Creation

1. A `media:embed-*` tile calls `addVideo(provider)`; `editsBlocked` returns early.
2. `beginDraw({ type: 'video', provider })` arms the tap-or-drag gesture.
3. A drag: `drawnDragBox` fits `EMBED_ASPECT` inside the drawn box (each side floored at
   `TAP_TRAVEL_PX`) and centres the slack on both axes.
4. A tap: `createVideo` placed centred on the tap at `inheritedSizeFor(base, selection)`, which
   takes a selected non-container's size, so a tap-drop is 16:9 only with no donor [Q3].
5. `buildDrawnBoxed` writes `embedProvider` from the intent and `deriveNewBoxedColours`.
6. `useShapeDrawing` tracks `Element·Added·Video`.

The element starts with `aspectLocked: true`; the lock is a user-toggleable flag
(`toggleAspectLockSelected`) and the format painter copies `width`, `height` and `aspectLocked`
[Q3].

### Link editing

1. Double-click (or the context menu's Link section) calls `onEditLink(id)`.
2. `EditorElementDialogs` opens `LinkPickerDialog` with `urlOnly`, unless read-only.
3. As you type: `urlOnly.validate(normaliseUrl(typed) ?? typed)`; an error disables **Save link**.
4. At commit: `normaliseUrl(urlInput)`; `null` returns silently; a validator message returns
   without committing; otherwise `applyElementLink({ kind: 'url', url })`.
5. The validator is `embedTargetFor(url) ? null : <message>`. It accepts any provider, whatever
   `embedProvider` says.

### Palette group

`PaletteMediaTab` renders the ungrouped Media tiles, then one `PaletteTileGroup` titled "Embed"
holding the six `tileGroup: 'embed'` tiles. `usePaletteGroup(title)` reads the shared `openId`
under a `PaletteGroupProvider` (one open at a time; the toggle closes an open group); without a
provider it keeps local state. Closed by default (DC17) [Q11].

## Interfaces and contracts

```ts
export const EMBED_PROVIDERS = ['youtube', 'vimeo', 'loom', 'figma', 'gdocs', 'website'] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];
export const EMBED_PROVIDER_LABEL: Record<EmbedProvider, string>;
export const EMBED_PROVIDER_HINT: Record<EmbedProvider, string>;
export type EmbedTarget = {
  provider: EmbedProvider;
  embedUrl: string; // the iframe src once the user presses play / load
  posterUrl?: string; // YouTube only
  label: string; // chip / iframe title; the host for a website
};
export function youtubeVideoId(url: string | undefined | null): string | null;
export function youtubePosterUrl(videoId: string): string;
export function youtubeEmbedUrl(videoId: string): string;
export function embedTargetFor(url: string | undefined | null): EmbedTarget | null;
export function createVideo(x: number, y: number, provider?: EmbedProvider): VideoElement;

// apps/live/components/dialogs/LinkPickerDialog.tsx
export type UrlOnlyConfig = {
  subtitle: string;
  fieldLabel: string;
  placeholder: string;
  hint: string;
  validate: (url: string) => string | null; // runs on the normalised URL
};

// apps/live/components/canvas/use-frame-blocked.ts
export function useFrameBlocked(src: string | undefined): {
  ref: React.RefObject<HTMLIFrameElement | null>;
  failed: boolean;
  onLoad: () => void;
  reset: () => void;
};

// apps/live/components/palette/palette-group-state.tsx
export function PaletteGroupProvider(props: { children: React.ReactNode }): JSX.Element;
export function usePaletteGroup(id: string): [boolean, () => void];
```

The parser functions never throw; every rejection is `null`. `validate.ts` rejects an element whose
`embedProvider` is present and not in `EMBED_PROVIDERS` (the whole element fails validation). The
link itself is not validated there; `embedTargetFor` is the gate before any iframe.

The iframe contract:

| Attribute         | Value                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src`             | `target.embedUrl`                                                                                                       |
| `title`           | `` `${target.label} embed` ``                                                                                           |
| `allow`           | `accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share` (DC6) [Q5]        |
| `allowFullScreen` | set                                                                                                                     |
| `sandbox`         | website: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`; others: absent [Q4] |
| `referrerPolicy`  | unset, the browser default (DC7)                                                                                        |

## Data and persistence

| Field                                                                                          | Class                    | Notes                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `link`                                                                                         | persisted, authoritative | `{ kind: 'url', url }`; stored as `normaliseUrl` returns it |
| `embedProvider`                                                                                | persisted, hint          | Optional; closed set; never read by `embedTargetFor`        |
| `aspectLocked`                                                                                 | persisted                | `true` from `createVideo`; user-toggleable [Q3]             |
| geometry, colours, `shadow`, `opacity`, `rotation`, `label`, `note`, `commentThread`, `action` | persisted                | Everyday boxed fields                                       |
| video id, provider, `EmbedTarget`                                                              | derived                  | Recomputed each render from `link`; never stored            |
| `playing`, `controls`, `failed`                                                                | ephemeral                | Per viewer, per mount; never persisted or synced (DC1)      |

No migration: the kind `video` and every field are unchanged; a diagram with no `embedProvider`
renders the generic empty-state copy. JSON export round-trips through `validate.ts`.

## Errors and edge cases

| #   | Case                                                 | Handling                                                                      |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| E1  | No link                                              | `empty` state                                                                 |
| E2  | Non-`http(s)` link (import, API, MCP)                | `embedTargetFor` → `null`; `unembeddable`; never reaches an iframe            |
| E3  | Known provider host, malformed path                  | `null` (Vimeo, Loom, Google non-doc paths) → `unembeddable`                   |
| E4  | YouTube host that is not a video (playlist, channel) | Resolves as a `website` today; `null` under [Q1]                              |
| E5  | Lookalike host (`evil-vimeo.com`)                    | `website`, labelled with its own host                                         |
| E6  | Link changed while playing                           | Player torn down (DC2)                                                        |
| E7  | Link removed                                         | `empty` state                                                                 |
| E8  | Frame never fires `load`                             | After `LOAD_TIMEOUT_MS`, `BlockedNotice` over the frame [Q6]                  |
| E9  | Site refuses framing (XFO / `frame-ancestors`)       | Undetectable; a website embed always offers **Open in a new tab**             |
| E10 | `http:` website on an `https:` editor                | Browser blocks mixed content; the no-load notice and new-tab link apply [Q10] |
| E11 | Website pointing at the editor's own origin          | Framed with `allow-scripts allow-same-origin` [Q4]                            |
| E12 | Tap-drop with a selected element                     | Takes the selection's size, not 16:9 [Q3]                                     |
| E13 | Aspect lock toggled off, or format-painted size      | Ratio can leave 16:9 [Q3]                                                     |
| E14 | Unknown `embedProvider` on import                    | Element rejected by `validate.ts`                                             |
| E15 | Google URL without `/edit` or `/view`                | Passed through unchanged (DC11)                                               |
| E16 | Poster 404 or offline                                | Broken image under the play badge; no fallback (DC8)                          |
| E17 | Touch device, playing                                | Controls show via emulated hover or focus only (DC4)                          |
| E18 | Read-only viewer                                     | Can play and load (DC3); the link dialog does not open                        |

## Security and trust

- **Trust boundary.** The link arrives from any writer: the editor, JSON import, the API, MCP.
  `validate.ts` does not check it; `embedTargetFor` is the gate (I4), refusing every non-`http(s)`
  scheme before any host logic, so `javascript:` and `data:` never reach an iframe.
- **Host spoofing.** Providers match exact hosts after one `www.` strip; a lookalike can only ever
  be a `website`, never wear a provider's name or skip the sandbox.
- **Sandbox.** A website iframe lacks `allow-top-navigation`, so it cannot navigate the editor tab.
  `allow-same-origin` is safe only while the framed origin differs from the editor's [Q4].
- **Named providers** carry no sandbox; their `embedUrl` is always built from a fixed host plus a
  pattern-checked id (YouTube, Vimeo, Loom), the encoded original (Figma), or the original on
  `docs.google.com` (Google).
- **Feature policy.** The `allow` list is shared by every provider, websites included [Q5].
- **Following links.** The link badge follows through the shared follow path, which re-checks
  `isSafeFollowUrl`. The new-tab anchors carry `rel="noreferrer noopener"`.
- **Privacy.** On open, only the YouTube poster is fetched (`i.ytimg.com`, cookieless). The player
  uses `youtube-nocookie.com`. Self-hosters ship no third-party request beyond that until a press.

## Performance and limits

- `embedTargetFor` is a pure parse, `O(length of URL)`, run once per `VideoView` render; no
  memoisation needed.
- Per embed on open: at most one image request (YouTube `hqdefault`, 480×360), eager (DC8).
- A loaded player costs a full third-party page (a YouTube player pulls over 1 MB of script). No
  cap on concurrently playing embeds (DC9).
- One `setTimeout` per playing embed, cleared on load, stop, `src` change or unmount.

## Presentation and UX

- **Frame.** `element-variant.ts` (DC15): `border-radius: 10px`, 1 px solid border, `overflow-hidden`,
  `shadow-sm`, fill `#0f172a` (slate-900), stroke `#1e293b` (slate-800), text default `#e2e8f0`
  (slate-200), on light and dark paper alike. `THEME_COLOUR_FIELDS.video` is `[]`.
- **Colours.** `supportsColours` exposes Text, Background and Border rows; `VideoView` ignores
  `textColor` [Q7].
- **Empty state.** `EmbedGlyph`, then:
  - no provider: "Add a link — double-click", hint "YouTube, Vimeo, Loom, Figma, Google Docs, or any
    website";
  - `website`: "Add a web address — double-click", hint `EMBED_PROVIDER_HINT.website`;
  - named: "Add a <Label> link — double-click", hint `EMBED_PROVIDER_HINT[provider]` [Q9].
- **Unembeddable.** "Can't embed that link" and the URL, truncated [Q9].
- **Poster.** `object-cover`, a 68:48 red play badge at 24 % of the card height (min 26 px),
  `hover:scale-110`.
- **Load card.** Upper-case label chip over a **Load embed** button.
- **Controls.** Top-left, `left-1.5 top-1.5`, 24 px buttons, hidden until hover or focus-within:
  **Use the player controls** / **Lock the player (drag the video)** (pressed state brand-500),
  **Stop video**, and for a website an **Open this page in a new tab** anchor (title "Blank? Open
  this page in a new tab").
- **No-load notice.** "<label> isn't loading", "Many sites refuse to be shown inside another page,
  and some are just slow. Either way the site decides, not the canvas.", and **Open in a new tab**
  to `target.embedUrl` [Q6].
- **Link dialog.** Title "Link embed". Subtitle, field label, placeholder and hint per provider as
  built in `EditorElementDialogs`; error "That isn't a link we can embed. Check it starts with
  https:// — or, for a named service, that it is a link to a real file." [Q9]. Help link:
  `embedElements` (DC14).
- **Draw banner.** "Tap to drop or drag to draw <Label> (stays 16:9)", without the parenthesis on
  mobile; no provider reads as Website (DC13).
- **Palette.** Group row "Embed", blurb "Load a page on the canvas", count badge; six tiles with
  captions YouTube, Vimeo, Loom, Figma, Google Docs, Website [Q9].
- **Names.** `elementKindLabel` and `kindLabel` both read "Embed" (DC16).

There is no loading state beyond the iframe's own; the empty and unembeddable states are the error
states.

## Accessibility

- Play badge: `<button aria-label="Play video">`; **Load embed** has visible text.
- Control buttons: `aria-label` and `title` equal, `aria-pressed` on the player toggle; the new-tab
  anchors carry `aria-label`. Keyboard focus reveals the controls through `focus-within`.
- The iframe has `title="<label> embed"`. Poster `alt=""` with `aria-hidden`; every glyph SVG is
  `aria-hidden`.
- Link dialog: the field carries `aria-invalid` and `aria-describedby="link-picker-url-error"` when
  the validator fails. Enter commits through the same validator.
- Palette group: `<button aria-expanded>`.
- Contrast on the default fill `#0f172a`: slate-200 copy 14.6:1, slate-400 hint 7.0:1. A user fill
  can break this [Q7].
- Motion: the badge's `hover:scale-110` and control fades are pointer or focus driven, not
  autoplaying; they are not gated by `motion-reduce`.

## Web experience

- **LCP.** Posters are ordinary `<img>`s inside the canvas; nothing blocks first paint on them.
- **CLS.** Every layer (poster, load card, player, controls, notice) is absolutely positioned inside
  the element's fixed box; playing, stopping and the notice never move surrounding layout.
- **INP.** Play, load, stop and the toggle are single state flips; the iframe mounts after the
  interaction's paint.

## Observability

No log exists at any decision point today (G1). Proposed fingerprints, prefix `[embed]`:

| #   | Where                                    | Level           | Fingerprint                                                |
| --- | ---------------------------------------- | --------------- | ---------------------------------------------------------- |
| O1  | `VideoView`, target is `null` with a URL | `console.debug` | `[embed] unembeddable id=<id> reason=<scheme\|host\|path>` |
| O2  | play / load pressed                      | `console.info`  | `[embed] load id=<id> provider=<provider>`                 |
| O3  | `useFrameBlocked` timer fires            | `console.warn`  | `[embed] no-load provider=<provider> after=<ms>`           |

Telemetry (not logs): `Element·Added·Video` on creation (draw path in `useShapeDrawing`, copy paths
through `elementTelemetryType`), `Element·Used·Video` on play or load.

## Testing

| Rule                                                                                                | Test                                                                | File                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Every YouTube URL form and host                                                                     | watch, other params, youtu.be, embed/shorts/live/v, alternate hosts | `packages/diagram/src/youtube.test.ts`                    |
| Host case-insensitive, id case-sensitive                                                            | `is case-insensitive about the host but not the id`                 | `youtube.test.ts`                                         |
| `?v=` only on a YouTube host; lookalikes refused                                                    | two `returns null` cases                                            | `youtube.test.ts`                                         |
| Id is exactly 11 URL-safe chars                                                                     | wrong length or alphabet                                            | `youtube.test.ts`                                         |
| Dangerous schemes refused                                                                           | `javascript:` / `data:` for both parsers                            | `youtube.test.ts`                                         |
| Poster on `i.ytimg.com`, player on no-cookie with autoplay                                          | `url builders`                                                      | `youtube.test.ts`                                         |
| Vimeo, Loom, Figma, Google resolution                                                               | one test each                                                       | `youtube.test.ts`                                         |
| Google Form is not a document                                                                       | `returns null for a Google host that is not an embeddable doc`      | `youtube.test.ts`                                         |
| Website catch-all, host label, no poster                                                            | `treats any other http(s) host as a plain website embed`            | `youtube.test.ts`                                         |
| Lookalike is a website, never the provider                                                          | `does not mistake a lookalike host ...`                             | `youtube.test.ts`                                         |
| Malformed known-provider link is `null`                                                             | `still refuses a malformed link ...` (Vimeo, Google only) [Q1]      | `youtube.test.ts`                                         |
| Drag fits 16:9 and centres                                                                          | two `buildDrawnBoxed` tests                                         | `apps/live/lib/draw-commit.test.ts`                       |
| Tile provider lands on the element                                                                  | `carries the embed provider through the gesture ...`                | `draw-commit.test.ts`                                     |
| Banner names the provider, 16:9 note off on mobile                                                  | two `drawBannerMessage` tests                                       | `apps/live/lib/draw-mode.test.ts`                         |
| `Video` has a telemetry bucket                                                                      | `gives every NON-shape element kind a bucket too`                   | `apps/live/lib/palette-telemetry-coverage.test.ts`        |
| Embed group has tiles and a renderer                                                                | tile-group coverage                                                 | `apps/live/components/palette/palette-tile-defs.test.tsx` |
| `video` is in the element vocabulary                                                                | vocabulary fixture                                                  | `packages/diagram/src/element-type-vocabulary.test.ts`    |
| No iframe until play; pointer-inert iframe; sandbox on website only; controls; reset on link change | none (G2)                                                           | none                                                      |
| No-load watch timing and reset                                                                      | none (G3)                                                           | none                                                      |
| Picker: URL only, validated as typed and at commit, on normalised URL                               | none (G4)                                                           | none                                                      |
| One palette group open at a time; local fallback                                                    | none (G5)                                                           | none                                                      |
| `createVideo` 480×270 locked; `embedProvider` closed set                                            | none (G6)                                                           | none                                                      |
| Export representation                                                                               | none [Q2] (G10)                                                     | none                                                      |
| End to end: place, link, play, drag still works                                                     | none (G9)                                                           | none                                                      |

## Constants and configuration

| Name                  | Value                                                                                     | Provenance / safe range                                  |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `VIDEO_ID`            | `/^[A-Za-z0-9_-]{11}$/`                                                                   | YouTube id format; fixed                                 |
| `YOUTUBE_HOSTS`       | `youtube.com`, `www.`, `m.`, `music.`, `youtube-nocookie.com`, `www.youtube-nocookie.com` | Hosts people paste; extend only with YouTube-owned hosts |
| `SHORT_HOSTS`         | `youtu.be`, `www.youtu.be`                                                                | Share links                                              |
| `ID_BEARING_PREFIXES` | `embed`, `shorts`, `live`, `v`                                                            | Path forms carrying the id next [Q8]                     |
| `VIMEO_ID`            | `/^\/(?:video\/)?(\d{6,})/`                                                               | Vimeo numeric ids; minimum 6 digits [Q8]                 |
| `LOOM_ID`             | `/^\/(?:share\|embed)\/([A-Za-z0-9]{16,})/`                                               | Loom share ids; minimum 16 chars [Q8]                    |
| `EMBED_PROVIDERS`     | `youtube`, `vimeo`, `loom`, `figma`, `gdocs`, `website`                                   | Closed set; validated on write                           |
| `LOAD_TIMEOUT_MS`     | `8000`                                                                                    | `use-frame-blocked.ts`; 5 000 to 15 000                  |
| `EMBED_ASPECT`        | `16 / 9`                                                                                  | `draw-commit.ts`; matches `createVideo` 480×270          |
| `createVideo` size    | 480 × 270 (inline literals)                                                               | A true 16:9; any 16:9 pair                               |
| `TAP_TRAVEL_PX`       | `16`                                                                                      | `draw-commit.ts`; tap versus drag, canvas px             |
| Poster variant        | `hqdefault.jpg`                                                                           | Exists for every video, unlike `maxresdefault`           |
| Player query          | `autoplay=1&rel=0`                                                                        | `youtubeEmbedUrl` [Q8]                                   |
| Figma `embed_host`    | `livediagram`                                                                             | `embedTargetFor` [Q8]                                    |
| Website sandbox       | see the iframe contract                                                                   | Never add `allow-top-navigation`                         |
| Frame radius          | `10px`                                                                                    | `element-variant.ts`                                     |

## Assets and external resources

| Resource                              | Source                                                                 | Licence / terms             | Loaded                       |
| ------------------------------------- | ---------------------------------------------------------------------- | --------------------------- | ---------------------------- |
| YouTube poster                        | `https://i.ytimg.com/vi/<id>/hqdefault.jpg`                            | YouTube Terms of Service    | On render of a YouTube embed |
| YouTube player                        | `https://www.youtube-nocookie.com/embed/<id>`                          | YouTube API Terms           | On play                      |
| Vimeo / Loom / Figma / Google players | provider embed URLs above                                              | Each provider's embed terms | On **Load embed**            |
| Play badge, glyphs, tile icons        | inline SVG in `VideoView.tsx`, `palette-tile-defs.tsx`, `draw-mode.ts` | Repository MIT              | Bundled                      |
