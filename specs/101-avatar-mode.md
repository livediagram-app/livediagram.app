# 101 — Avatar mode

Status: **implemented**.

A canvas tool (a "selection mode", the group the picker at the top of the palette holds) called **Avatar**: a small Habbo-Hotel-style pixel character stands in the diagram, walks to wherever you click, steps in whatever direction you press the arrow keys, and hops with a waved flag on Space. While the mode is active the diagram is **read-only for you**, so a walk gesture can never select, move, or edit anything. Everyone in the room sees everyone else's character.

## Why

Narrating a diagram on a call today means waving a cursor around, or reaching for Laser / Spotlight ([spec/09](09-canvas-and-palette.md)) — both of which point AT things from outside. Walking a character to the box you are talking about puts the presenter _inside_ the diagram: the audience follows a body moving between places, which reads as a tour rather than a slideshow. It is also the cheapest possible "presentation mode": no authored steps, no reveal order, no schema (contrast [spec/31](31-presentation-mode.md), still draft).

## Where it lives

- New `CanvasTool` id `'avatar'`, offered in the canvas-tool picker's **presenter group** next to Laser and Spotlight.
- Keyboard shortcut **`W`** (walk). `A` is Arrow, `V` / `H` / `K` / `I` / `E` / `Z` are taken.
- **Disabled on an empty canvas**, like every tool below Select / Hand: with nothing drawn there is nowhere to walk.
- Available on **every viewport** (unlike Spotlight): tap-to-walk works fine on touch, it just loses the arrow keys.
- Available to **view-role** visitors — it is a pure view aid and mutates nothing.
- **Entering the mode clears the current selection** (an element left selected would keep its handles and reappear on exit, the same reason Spotlight clears it).
- The picker label is **Avatar**, deliberately the same word the user asked for. It is NOT the palette's **Avatar element tile** (a circular photo, spec/09 Components); the two never appear on the same surface, and telemetry keeps them apart via a distinct type token (below).

## The character

- Drawn in **diagram coordinates** inside the canvas's transformed wrapper, so the avatar pans and zooms with the content. Standing next to a shape therefore means something, unlike the screen-space spotlight beam.
- **Habbo style**: a chunky, flat-coloured pixel figure with hard edges, no gradients and no anti-aliased curves — inline SVG on a coarse pixel grid, ~40x56 canvas px, big head, small body, two-tone shading for depth.
- Its **position is its feet**, not its centre, so it stands _on_ the point you clicked. A soft elliptical contact shadow sits under the feet.
- **Four facings** (down / up / left / right; right mirrors left), picked from the direction of travel and held when it stops.
- **Customisable** via the Avatar Panel (below): gender, clothing, hair, and size, all costumes on the SAME skeleton so the walk / hop / flag animations are shared across every combination. **Right-clicking the character toggles gender** — the one choice reachable without the panel (a right-click anywhere else on the canvas does nothing; the context menu stays shut in this mode). None of it carries meaning beyond which sprite is drawn.
- **The shirt is the participant's presence colour** — the same colour as your cursor, your name chip, and your tab-bar dot — so on a shared diagram you can tell at a glance which character is whose. Falls back to the brand cyan when there is no participant colour. **Colour is deliberately not customisable**: it is the one thing on the character that carries information.
- **Walk animation**: a two-frame leg swing plus a one-pixel body bob, advanced by **distance travelled** rather than wall-clock, so the step cadence matches the speed at any zoom.
- Renders **above the element layer** (it is standing in front of the diagram, not behind it) and below the palette / chrome, which stay clickable so you can leave the mode.
- Spawns at the **centre of the current viewport** on entry, keeps its spot across a detour to another tool (the canvas stays mounted), and resets on the next entry after a tab change — it is transient view state that belongs to nobody.

## The Avatar Panel

While the mode is active, a small **Avatar** panel is present — the character sheet. It is a normal floating panel ([spec/63](63-panel-docking.md)): draggable, dockable to any corner, and homed **top-right under the Palette**, where the mode picker that opened it lives. Like the Poll / Vote panels it exists only while its mode does, so it joins and leaves its corner stack rather than sitting there, and its position is remembered for the session but never minimised (leaving the mode dismisses it outright). In the **minimal panel layout and on mobile** it is one of the dock buttons, opening as a popover under its own button exactly like Layers. View-role visitors get it too — the mode is theirs as well.

Contents, top to bottom:

- A **live preview** of the character, drawn by the same sprite component the canvas uses (standing, front-on, at a fixed scale so switching to Small / Tall doesn't resize the panel).
- **Gender** — Male / Female.
- **Clothing** — T-shirt / Hoodie / Suit / Dress. Each is a silhouette change on the same body: the hoodie adds a hood behind the head and a kangaroo pocket, the suit an open jacket over a white shirt with a tie, the dress a flared skirt over bare legs.
- **Hair** — Short / Long / Ponytail / Bald.
- **Size** — Small / Regular / Tall, a scale on the whole sprite (0.75 / 1 / 1.3). It scales the right-click hit box and the name chip's offset with it, so a small character isn't clickable well outside itself.
- A one-line note that the shirt takes your participant colour and the character is remembered in this browser.

**No colour picker**, deliberately — see above.

## Persistence

The four choices are **remembered per browser** under `livediagram:v2:avatar-config`, so the character you built is the one waiting next time you enter the mode. Device-local by design, like the panel layout ([spec/63](63-panel-docking.md)) and the palette favourites ([spec/78](78-palette-favourites.md)): which character you walk around as is a personal / ergonomic choice, not diagram data, so it never reaches the api, D1, or the synced preferences blob — and guests get it for free.

Parsing is **field by field with per-field fallbacks**: a value this build doesn't recognise (an option retired in a later release, a hand-edited key) costs only that one choice rather than resetting the whole character, and a config written by an older build loads with the new fields defaulted. Position of the avatar itself is still never persisted — only the costume.

## Walking

- **Click / tap anywhere** on the canvas: the avatar walks there in a straight line at a constant **260 canvas px/s**, facing its direction of travel. A click mid-walk retargets immediately. It arrives and stops; there is no easing, deliberately — a constant-speed walk reads as a character, an eased glide reads as a camera.
- **Arrow keys**: while held, the avatar walks that way, mirroring the direction pressed. Two held keys compose a diagonal (normalised, so diagonal walking isn't faster). Any arrow press cancels a click-walk in progress; releasing every arrow stops the avatar where it stands.
- **No collision**: elements are scenery in v1, so the avatar walks over anything. The element it is standing on gets a soft brand-tinted "you are here" ring, which is what makes the mode useful for narration — the audience can see what the character has arrived at.
- **Space hops**, and the character waves a small flag through the hop plus a short tail so it reads as a celebration rather than stopping dead on landing. The hop peaks around 70 canvas px and lands in a bit over half a second; the contact shadow shrinks as it rises, which is what sells leaving the floor. Autorepeat is ignored (one press, one hop) and a second press mid-flight does nothing. Space is the hold-to-pan modifier everywhere else, which this mode can afford to reclaim: it is read-only, so there is no selection to tap-edit, and panning stays on middle-mouse drag, the trackpad, and the zoom controls.
- **The camera follows**: when the avatar comes within ~120 screen px of a viewport edge, the viewport pans just enough to keep it in view. Zoom is never touched (a mode that zoomed for you would fight the presenter).
- Right-click never walks, and the canvas / element context menus stay suppressed while the mode is active (a menu opening mid-walk would interrupt the tour).
- Panning by hand still works: middle-mouse drag, held-Space drag, two-finger trackpad, and the zoom controls all behave as usual.

## Read-only while active

"Read-only for me" is enforced the same way Spotlight and Isometric ([spec/45](45-isometric-view.md)) do it, plus a keyboard gate:

- The whole diagram layer goes **pointer-inert** (`pointer-events: none`), so no click can select, drag, resize, or double-click-edit any element kind. A per-element guard cannot cover every path (boxed elements, arrow hit-bands, labels), which is why the layer-level switch is the mechanism.
- The **arrow keys belong to the avatar**, so they never nudge a selection.
- The **mutating plain-key shortcuts are suppressed** (element adds, Eraser, Pencil). The non-mutating view tools (`V` / `H` / `K` / `I` / `Z`) keep working so you can always leave, and `Escape` exits the mode to Select (Hand on touch), matching Isometric.
- Nothing is persisted or written to the change log. The one thing that leaves the browser is the ephemeral presence snapshot peers need to draw the character (below).
- **Reaching for the palette leaves the mode.** Picking any palette tile — or dragging one onto the canvas — exits Avatar mode back to **whichever tool was active before it** (not a hardcoded Select) and then performs the add, so a click on the palette mid-walk drops the element instead of being swallowed by a read-only canvas. Implemented as one wrapper over the whole tile-action bundle, so tiles added later inherit it.

## Realtime

**Everyone sees everyone.** The character rides the presence channel as an `avatar` `RoomOp` (alongside `cursor` / `select` / `laser` / `tab-focus` in `@livediagram/api-schema`), so a whole room can walk around one diagram at once.

- The packet is deliberately tiny — feet position, facing, the four costume tokens, walking flag, step frame, hop height, wave frame — and goes out at the **same ~30 Hz throttle as the cursor**, from the same gates (hydrated, a diagram id, and either a share link or a team diagram). The costume is **optional on the wire**, so a packet from an older client still parses; the receiver runs it through the same field-by-field parser as storage and falls back to the default character.
- It is **ephemeral presence, not a mutation**: `avatar` is in the room's `PRESENCE_OP_KINDS`, so it relays unordered, from any role (**including view-role** — an audience member walking a diagram someone linked them to is as harmless as their cursor), is never written to the change log, and is never replayed to a reconnecting client.
- **Leaving the mode publishes `avatar: null`**, which deletes the entry on every peer, and a peer who disconnects is pruned with the rest of their presence — so nobody is left standing on a canvas after they've gone.
- Peers' characters are **scoped to the tab** they were published on and are drawn with **their own presence colour on the shirt plus a small name chip** above the head, so a room of walkers stays legible. Your own character has no chip (you know who you are).
- Peer characters render **whether or not you are in Avatar mode yourself**: someone else walking you through their diagram is worth seeing from the Select tool.
- A **hide-cursors vote ([spec/39](39-session-tools.md)) hides avatars too**, on both the outbound and render halves. A walking character is a position on the canvas, so showing it while cursors are hidden would leak exactly what the vote exists to hide.

## Implementation shape

Per the no-god-files rule:

- **`apps/live/lib/avatar-walk.ts`** — the pure geometry: one frame's step toward a target, the arrow-key direction vector, the facing from a delta, the camera-follow correction, and the element-under-the-feet lookup. Unit-tested (`avatar-walk.test.ts`); no React, no DOM.
- **`apps/live/lib/avatar-walk.ts`** also holds the jump integration (`jumpStep`), the flag-wave frame clock (`waveFrame`), and the sprite hit-test (`hitTestAvatar`) the right-click look toggle uses.
- **`apps/live/lib/avatar-config.ts`** — the four choices, their option catalogues (one source for the panel's rows AND the parser's validation), the size scale, the field-by-field parser, and the localStorage read / write. Unit-tested; no React.
- **`apps/live/hooks/canvas/useAvatarConfig.ts`** — the costume state slice: load on mount, persist + report telemetry on each pick, and the gender toggle the right-click uses.
- **`apps/live/components/panels/AvatarPanel.tsx`** — the panel: the preview plus four radiogroups, on the shared `MovablePanel` like every other panel.
- **`apps/live/hooks/canvas/useAvatarWalk.ts`** — the state slice: position / target / facing / hop / wave, the `requestAnimationFrame` loop, the camera nudge, and the presence publisher.
- **`apps/live/hooks/canvas/useAvatarKeys.ts`** — the keyboard slice (held arrows + the Space jump), split out so the hook above keeps to state + loop.
- **`apps/live/components/canvas/AvatarWalker.tsx`** — placement: the canvas-coords box, the standing-on ring, the peer name chip. **`avatar-sprite.tsx`** — the pixel art itself (both looks, the walk cycle, the hop, the flag).
- **Realtime**: `AvatarPresence` + the `avatar` `RoomOp` in `@livediagram/api-schema`; `'avatar'` added to `PRESENCE_OP_KINDS` in `apps/api/src/diagram-room.ts`; `broadcastAvatar` in `useEditorBroadcast`; the inbound coalescing buffer in `useRoomConnection`; `remoteAvatars` in `usePresenceState`; `buildRemoteAvatarRows` in `lib/presence-rows.ts` (unit-tested).
- Wiring, one small edit each: `canvas-tool-options.tsx` + `palette-icons.tsx` (picker entry), `useCanvasSurfaceGestures.ts` (the click-to-walk + right-click-gender capture intercept, next to the spotlight one), `canvas-chrome.ts` (cursor), `editor-shortcut-keys.ts` + `useEditorKeyboardShortcuts.ts` (`W`, the read-only gate, the arrow-key handover), `useCanvasTool.ts` (telemetry + the remembered pre-avatar tool), `palette-tile-actions.ts` (the leave-on-add wrapper, unit-tested), `panel-layout.ts` + `usePanelLayout.ts` + `useCanvasMobileDock.ts` + `CanvasMobileDock.tsx` + `useCanvasChromePanels.tsx` + `CanvasChrome.tsx` (the panel's id, position, dock button, and both render paths — the docked corner stacks AND the inline minimal / mobile list).

## Telemetry

Per [spec/22](22-telemetry.md): `track('Canvas', 'Used', 'AvatarMode')` on entry, emitted from `selectCanvasTool` beside the Laser / Spotlight / Eraser lines. `AvatarMode` (not `Avatar`) keeps the mode distinct from the `Element·Added·Avatar` token the palette's photo tile already emits. Each customisation fires `track('UI', 'Changed', 'AvatarGender' | 'AvatarClothing' | 'AvatarHair' | 'AvatarSize')` — which KIND of choice was made, never the value, so the signal is "do people dress their character" without recording what they picked. No per-step or per-click walk events (chatty, no signal).

## Out of scope (v1)

- Collision or pathfinding around elements (walk-around-the-box, walkable frames).
- Avatar customisation beyond the four choices and the presence-coloured shirt (hats, accessories, skin tones, a picked photo, a colour picker — the shirt colour is load-bearing).
- Emotes beyond the flag wave; sitting, dancing, speech bubbles.
- A mobile on-screen direction pad (touch gets tap-to-walk only — no arrow keys, no Space).
- Any persistence of where the avatar was left (only the costume persists), or syncing the costume to an account across devices.
