// What each telemetry event means, in plain words, for the public dashboard
// (docs/specs/017-telemetry/telemetry.md). Pure data behind `eventExplanation` (event-explanation.ts):
//
//  - EXACT: one sentence per `Category|Action|Type` (Type empty for an event
//    sent with no type). Checked first.
//  - BY_ACTION: one sentence per `Category|Action` that fits any type, for a
//    type with no exact entry and no pattern (a new one, or a computed one).
//  - API_OPERATIONS: the plain phrase for each operation an `Error·Api` type
//    names (`Http403.SaveTab` is "saving a tab's contents").
//
// Written for a curious reader, not an engineer: what the person did, in the
// words the product shows them, plus the counting rule when it is not simply
// once per action. `event-explanation.test.ts` checks every event the code
// can send gets a real sentence, free of code names and jargon.

export const EXACT: Readonly<Record<string, string>> = {
  'AI|Toggled|AiOff': 'Someone turned off the AI Assistant panel, in Settings under AI Tools.',
  'AI|Toggled|AiOn': 'Someone turned on the AI Assistant panel, in Settings under AI Tools.',
  'AI|Toggled|AiSuggestedPromptsOff': 'Someone turned off Suggested Prompts for the AI Assistant.',
  'AI|Toggled|AiSuggestedPromptsOn':
    "Someone turned on Suggested Prompts, the starter questions the AI Assistant offers before you've typed anything.",
  'AI|Used|Ask':
    'Someone asked the AI Assistant a question about the active tab and got an answer.',
  'AI|Used|Clean':
    "Someone used the AI Assistant's Clean mode to tidy up a tab's labels, sizes, and styles.",
  'AI|Used|PhotoNotes':
    'Someone imported the sticky notes from a photo of a real wall onto an event-storming board, a workshop-style diagram built as a timeline of business events.',
  'Action|Changed|Edited':
    "Someone edited the details of an action assigned to an element, without changing who it's assigned to.",
  'Action|Changed|Reassigned':
    'Someone changed who an action assigned to an element is assigned to.',
  'Action|Created|EmailOff':
    'Someone assigned an action to a teammate, or to themselves, on an element, without sending an email.',
  'Action|Created|EmailOn':
    'Someone assigned an action to a teammate on an element and chose to email them about it.',
  'Action|Deleted|': 'Someone removed an assigned action from an element.',
  'Action|Moved|DiagramToTeam':
    "While assigning an action to someone, the diagram was moved into that person's team so they'd have access to it.",
  'Action|Opened|': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Resolved|': 'Someone marked an assigned action as done.',
  'Action|Unresolved|': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Loaded|Retry':
    'Someone clicked "Try again" after the Explorer\'s Activity section failed to load, retrying the read.',
  'Activity|Opened|':
    "Someone opened the Explorer's Activity section, which lists open actions assigned to them, actions they assigned to others, and comment threads they're in. Counted once per visit, not on every re-fetch.",
  'Activity|Selected|Action':
    "Someone clicked an action row in the Explorer's Activity section, jumping to the element it's assigned on.",
  'Activity|Selected|Thread':
    "Someone clicked a comment-thread row in the Explorer's Activity section, jumping to the element it's on.",
  'Canvas|Used|AddNextNote':
    'Someone clicked a next-note button beside a note on an event-storming board and got the note type that notation places there next.',
  'Canvas|Used|AvatarMode':
    'Someone switched to Avatar mode, steering a small walking character around the canvas instead of the usual pointer.',
  'Canvas|Used|ChangeNoteKind':
    'Someone changed what kind of note a sticky is on an event-storming board, say from a domain event to a hotspot.',
  'Canvas|Used|Dock':
    'Someone dragged a note onto a compatible face on an event-storming board and it docked there. No longer recorded.',
  'Canvas|Used|DockAdd':
    "Someone clicked a note's anchor on an event-storming board and got the matching note already docked to it. No longer recorded.",
  'Canvas|Used|Eraser':
    "Someone picked up the Eraser tool, which deletes whatever it's dragged over.",
  'Canvas|Used|FollowMe':
    "Someone pinned their canvas to a peer's viewport, following their pan, zoom, and tab until they take it back.",
  'Canvas|Used|FormatPainter':
    "Someone picked up the Format tool, ready to copy one element's style onto others by tapping them.",
  'Canvas|Used|Highlighter':
    'Someone picked up the Highlighter, a see-through marker pen for annotating the canvas.',
  'Canvas|Used|InsertBetween':
    'Someone held Alt and dragged a note into the gap between two notes on an event-storming board (a workshop technique that maps a process as a timeline of sticky notes), and the board made room for it.',
  'Canvas|Used|Isometric':
    'Someone switched the canvas into Isometric view, which renders the board at an angle for a 3D-style look.',
  'Canvas|Used|Laser':
    "Someone switched on the Laser pointer, a trail visible to everyone that shows where they're pointing without leaving a mark.",
  'Canvas|Used|Spotlight':
    "Someone switched on Spotlight, which dims the rest of the canvas around wherever they're pointing.",
  'Canvas|Used|TimelineLanesOff':
    'Someone turned timeline lanes off for an event-storming board. No longer recorded: lanes are always on now.',
  'Canvas|Used|TimelineLanesOn':
    'Someone turned timeline lanes on for an event-storming board. No longer recorded: lanes are always on now.',
  'Canvas|Used|Undock':
    'Someone pulled a docked note away from its host on an event-storming board. No longer recorded.',
  'Canvas|Zoomed|Fit': 'Someone tapped "Fit to screen".',
  'Canvas|Zoomed|In': 'Someone tapped the zoom-in button.',
  'Canvas|Zoomed|Out': 'Someone tapped the zoom-out button.',
  'Canvas|Zoomed|Preset':
    'Someone jumped straight to a preset zoom level from the zoom-percentage popover.',
  'Comment|Added|': 'A comment was added to an element thread.',
  'Comment|Deleted|': 'A comment was removed from a thread.',
  'Comment|Opened|': 'Someone opened the comment popover on an element.',
  'Comment|Resolved|': 'A comment thread was marked resolved.',
  'Comment|Unresolved|': 'A resolved comment thread was reopened.',
  'Diagram|Created|Cloud': 'A brand-new diagram was created.',
  'Diagram|Created|Offline': 'A brand-new diagram was created.',
  'Diagram|Deleted|': 'A diagram was deleted.',
  'Diagram|Duplicated|': 'A diagram was duplicated into a new one.',
  'Diagram|Duplicated|Copy': 'A diagram was duplicated into a new one.',
  'Diagram|Joined|Edit':
    'Someone came into a diagram through an edit-role share link. Counted once per person per diagram, not on every revisit.',
  'Diagram|Loaded|':
    'A diagram was opened, counted on every open (including a page refresh and the first open of a diagram just created).',
  'Diagram|Moved|': 'A diagram was moved into (or out of) a folder.',
  'Diagram|Moved|SavedToCloud':
    'Someone synced an offline diagram to their account, turning it into a cloud diagram kept on the server.',
  'Diagram|Moved|TakenOffline':
    'Someone took a diagram offline, moving it out of their account into this browser only.',
  'Diagram|Redone|': 'Someone hit Redo on a diagram edit.',
  'Diagram|Removed|ShareLink':
    "Someone revoked a share link from a diagram's Share dialog, so it stops working.",
  'Diagram|Renamed|': 'A diagram was renamed.',
  'Diagram|Reverted|': 'Someone reverted a single change from the diagram activity log.',
  'Diagram|Shared|Edit': 'Someone generated an edit-role share link for a diagram.',
  'Diagram|Shared|ExpiryWeek': 'Someone set a share link to expire after a week, when creating it.',
  'Diagram|Shared|Extended':
    'Someone re-armed an expiring share link for another full round of its original lifetime.',
  'Diagram|Shared|PasswordCleared': "Someone removed the password from a diagram's share link.",
  'Diagram|Shared|PasswordSet': "Someone set a password on a diagram's share link.",
  'Diagram|Shared|View': 'Someone generated a view-role share link for a diagram.',
  'Diagram|Undone|': 'Someone hit Undo on a diagram edit.',
  'Diagram|Used|Multiplayer':
    'A diagram was open with at least one other person live in the room, counted once per diagram per visit. The one event that counts collaboration happening rather than being offered.',
  'Element|Changed|Agenda':
    'Someone pressed a segment on an Agenda element, starting its timer and marking it as the current item.',
  'Element|Changed|Animation':
    'Someone gave a selected element a looping animation, or turned it off.',
  'Element|Changed|AnimationRepeat':
    "Someone turned a selected element's animation loop on or off, so it either repeats or plays once and holds.",
  'Element|Changed|AnimationSpeed':
    "Someone changed how fast a selected element's animation plays.",
  'Element|Changed|ArrowEnds': 'Someone changed which ends of a selected arrow carry an arrowhead.',
  'Element|Changed|ArrowFlow':
    'Someone gave a selected arrow a flowing animation, such as marching dashes or a travelling dot, or turned it off.',
  'Element|Changed|ArrowLineStyle':
    "Someone changed a selected arrow's line pattern: solid, dashed, or dotted.",
  'Element|Changed|ArrowPreset':
    'Someone applied a one-click arrow style, setting its line pattern, thickness, and flow together.',
  'Element|Changed|ArrowRouteBehind':
    'Someone toggled whether a selected arrow routes behind the boxes it passes.',
  'Element|Changed|ArrowStyle':
    "Someone changed a selected arrow's shape, such as straight, curved, or elbowed.",
  'Element|Changed|ArrowThickness': "Someone changed a selected arrow's line thickness.",
  'Element|Changed|ArrowheadColor': "Someone changed a selected arrow's arrowhead colour.",
  'Element|Changed|ArrowheadShape': "Someone changed a selected arrow's arrowhead shape.",
  'Element|Changed|ArrowheadSize': "Someone changed a selected arrow's arrowhead size.",
  'Element|Changed|AspectRatioReset':
    'Someone reset a selected shape back to its default proportions.',
  'Element|Changed|BorderRadius': "Someone changed a selected element's corner rounding.",
  'Element|Changed|BorderStroke': "Someone changed a selected element's border weight.",
  'Element|Changed|BorderStyle':
    "Someone changed a selected element's border pattern: solid, dashed, or dotted.",
  'Element|Changed|Chair':
    'Someone changed which way a Chair element faces, on a meeting-room layout board.',
  'Element|Changed|ChartAnim':
    'Someone gave a selected chart a looping reveal animation, changed its speed, or turned it off.',
  'Element|Changed|ChartData': "Someone edited a chart element's underlying data.",
  'Element|Changed|ChartLegend':
    "Someone turned a chart's legend on or off, or moved it to a different side.",
  'Element|Changed|ChartPalette': 'Someone applied a colour palette to a selected chart.',
  'Element|Changed|Checklist': "Someone edited a checklist element's items.",
  'Element|Changed|CodeBlock':
    "Someone edited a code block element's snippet or its programming language.",
  'Element|Changed|CodeTheme': 'Someone applied a colour scheme to a selected code block.',
  'Element|Changed|CodeWrap': 'Someone toggled long-line wrapping on a selected code block.',
  'Element|Changed|Decision':
    'Someone edited a Decision element: its status, its date, or the factors driving it.',
  'Element|Changed|DoneCheck':
    'Someone pressed a done-check element to mark it done, or cleared it.',
  'Element|Changed|Entity':
    "Someone edited an Entity element's fields, on an entity-relationship diagram.",
  'Element|Changed|Estimate':
    'Someone submitted, revealed, or cleared a response on an Estimate card during a planning-poker round.',
  'Element|Changed|FillColor': "Someone changed a selected element's fill colour.",
  'Element|Changed|FlowRepeat': "Someone turned a selected arrow's flow animation loop on or off.",
  'Element|Changed|FlowSpeed': "Someone changed how fast a selected arrow's flow animation plays.",
  'Element|Changed|Font': "Someone changed the font used on a selected element's text.",
  'Element|Changed|FormatPainter':
    'Someone used the format painter to copy a style from one element onto another.',
  'Element|Changed|Header':
    "Someone edited a Header web component's lines, such as adding, removing, or retitling one.",
  'Element|Changed|HeaderFill':
    "Someone changed a table's header row colour, or a lane's title band colour.",
  'Element|Changed|Hero': "Someone turned a hero image's caption card on or off.",
  'Element|Changed|Icon': 'Someone placed or repositioned an inline icon on a selected element.',
  'Element|Changed|IconAnimation':
    'Someone gave a selected icon shape a looping animation, or turned it off.',
  'Element|Changed|IconSize': "Someone changed a selected Technology icon's tile size.",
  'Element|Changed|Idea-box':
    'Someone added an idea to an Idea Box element, revealed its cards, or cleared it for the next round.',
  'Element|Changed|LabelFill': "Someone changed the background colour of an arrow's label.",
  'Element|Changed|Legend': "Someone edited a Legend element's items.",
  'Element|Changed|LineData': "Someone edited a line chart element's categories and series data.",
  'Element|Changed|LinkUnfurled':
    'A link-card element automatically fetched a preview (title, image, and favicon) after someone gave it a web address.',
  'Element|Changed|Marker': "Someone added or removed a status marker next to a shape's label.",
  'Element|Changed|MarkerSize': "Someone changed the size of a shape's status marker.",
  'Element|Changed|MindFlow': "Someone changed a mind map's flow direction.",
  'Element|Changed|ModeButton':
    "Someone changed which selection mode a Mode Button element switches everyone into when it's pressed.",
  'Element|Changed|Nudge':
    'Someone nudged a selected element with the arrow keys. Counted once per burst of presses, not once per key press.',
  'Element|Changed|Padding': "Someone changed a selected element's internal padding.",
  'Element|Changed|Picker':
    'Someone rolled a Picker element, landing on a participant or option from its list, shared with everyone in the room.',
  'Element|Changed|Portal':
    'Someone linked a Portal element to another portal, on this tab or another, so stepping into one jumps to the other.',
  'Element|Changed|ProcessSteps':
    "Someone edited a Process web component's steps, such as adding, removing, or retitling one.",
  'Element|Changed|Progress': "Someone changed a progress-bar element's percentage.",
  'Element|Changed|ProgressAnim':
    'Someone gave a progress-bar element a looping fill animation, changed its speed, or turned it off.',
  'Element|Changed|Rating': "Someone changed a star-rating element's score.",
  'Element|Changed|RatingAnim':
    'Someone gave a star-rating element a looping animation, changed its speed, or turned it off.',
  'Element|Changed|ReactionPad':
    'Someone changed which reaction burst a Reaction Pad element throws.',
  'Element|Changed|Reveal':
    "Someone toggled a Reveal element's cover on or off for the whole room.",
  'Element|Changed|Roll-call':
    'Someone took a roll call on a Roll Call element, freezing the names of everyone currently in the room onto it.',
  'Element|Changed|Rotation': 'Someone rotated a selected element to a fixed angle.',
  'Element|Changed|SessionButton':
    'Someone configured what a Session Button element starts when pressed, such as a timer, a poll, or a vote.',
  'Element|Changed|Shadow': 'Someone applied a drop shadow to a selected element, or removed it.',
  'Element|Changed|ShapeMorph':
    'Someone changed a selected shape into a different kind of shape, keeping its size, label, and colours.',
  'Element|Changed|Size': 'Someone typed an exact width or height for a selected element.',
  'Element|Changed|StackBack':
    'Someone sent a selection to the back of the stack within its own layer.',
  'Element|Changed|StackFront':
    'Someone brought a selection to the front of the stack within its own layer.',
  'Element|Changed|StatRow':
    "Someone edited a Stat Row web component's stats, such as adding, removing, or retitling one.",
  'Element|Changed|StrokeColor': "Someone changed a selected element's border colour.",
  'Element|Changed|StylePreset':
    'Someone applied a one-click colour and border style to a selected shape.',
  'Element|Changed|StyleReset':
    "Someone reset a selected element's colours and border back to the theme's defaults.",
  'Element|Changed|TableCell':
    'Someone styled one or more selected table cells, such as their fill colour, borders, or text alignment.',
  'Element|Changed|TablePreset':
    'Someone applied a one-click look to a table: its fill, borders, and row banding together.',
  'Element|Changed|Temperature':
    'Someone submitted, revealed, or cleared a response on a temperature-check element.',
  'Element|Changed|TextAlign': "Someone changed a selected element's text alignment.",
  'Element|Changed|TextColor': "Someone changed a selected element's text colour.",
  'Element|Changed|TextFormat':
    "Someone applied rich-text formatting, such as bold, a colour, a list, a heading, or a link, to part of an element's label.",
  'Element|Changed|TextSize': "Someone changed a selected element's text size.",
  'Element|Changed|TimelineRail': "Someone changed a Timeline Rail element's number of points.",
  'Element|Copied|': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted|': 'An element was removed from the canvas.',
  'Element|Deleted|Eraser': 'An element was removed from the canvas.',
  'Element|Deleted|TableColumn': 'Someone removed a column from a table.',
  'Element|Deleted|TableRow': 'Someone removed a row from a table.',
  'Element|Duplicated|': 'An element was duplicated.',
  'Element|Grouped|': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked|ArrowPoint':
    "Someone dragged an arrow's end onto another element, pinning that end to it so the arrow follows if the element moves.",
  'Element|Linked|Diagram': 'Someone linked an element to another diagram.',
  'Element|Linked|Tab': 'Someone linked an element to another tab.',
  'Element|Linked|Url': 'Someone linked an element to a web address.',
  'Element|Locked|': "An element's lock was turned on (no edits allowed).",
  'Element|Removed|Vote':
    'Someone retracted one of their dots from a dot vote. Counted only when a dot actually came off.',
  'Element|Reordered|Back': 'Someone sent an element to the back of the stack.',
  'Element|Reordered|Front': 'Someone sent an element to the front of the stack.',
  'Element|Reordered|TableColumn': 'Someone dragged a table column to a new position.',
  'Element|Reordered|TableRow': 'Someone dragged a table row to a new position.',
  'Element|Selected|Filter':
    "Someone narrowed a multi-selection down to just one kind of element, from the right-click menu's Filter Selection.",
  'Element|Selected|Keyboard':
    'Someone moved the selection to the next element using the keyboard.',
  'Element|Toggled|AspectLock':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Toggled|Strikethrough':
    'An on/off property was flipped on an element: a text style (Bold, Italic, Underline, Strikethrough), the aspect-ratio lock, or a table option (header row, header column, zebra striping).',
  'Element|Toggled|TableHeaderColumn':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Toggled|TableHeaderRow':
    'An on/off property was flipped on an element: a text style (Bold, Italic, Underline, Strikethrough), the aspect-ratio lock, or a table option (header row, header column, zebra striping).',
  'Element|Toggled|TableZebra':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Ungrouped|':
    'A group was disbanded back into individual elements (before groups were removed).',
  'Element|Unlinked|': 'Someone cleared the link off an element.',
  'Element|Unlocked|': "An element's lock was turned off (edits resume).",
  'Element|Used|BringFocus':
    "Someone asked everyone else in the room to jump to this element's spot on the canvas.",
  'Element|Used|ReactionPad':
    'Someone pressed a Reaction Pad element and played its burst for everyone.',
  'Element|Used|Video': 'Someone pressed play on a video element.',
  'Element|Voted|': 'Someone cast a dot in a dot vote.',
  'Email|Sent|DiagramJoined':
    "An email went out to a diagram's owner after someone opened it for the first time through a share link.",
  'Email|Sent|FirstShare': "An email went out marking someone's first time sharing a diagram.",
  'Email|Sent|Milestone':
    'An email went out congratulating someone on reaching a diagram-count milestone.',
  'Email|Sent|Week1': 'The one-week onboarding email went out.',
  'Email|Sent|Week2': 'The two-week onboarding email went out.',
  'Email|Sent|Welcome': 'The welcome email went out just after someone signed up.',
  'Error|Api|Internal':
    'A livediagram server crashed while handling a request. No longer recorded in this bare form; a crash like this now also records which endpoint or tool broke.',
  'Error|Api|Network.SendEmail':
    "An email (a welcome message, an invite, a notification) couldn't be sent, because the email provider couldn't be reached at all.",
  'Error|Client|RealtimeResync':
    'The editor noticed it had missed updates during a live session and refetched the diagram to catch back up. This is the editor recovering on its own, not a crash.',
  'Error|Client|Uncaught':
    'A part of the editor or help centre crashed with an error nothing in the code caught. No longer recorded in this bare form; a crash like this now also records which page it happened on and what kind of error it was.',
  'Error|Client|UnhandledRejection':
    'A background task failed and nothing in the code handled the failure. No longer recorded in this bare form; a failure like this now also records which page it happened on and what kind of error it was.',
  'Error|Warning|AiQuota.BrowserReader':
    "Someone imported sticky notes from a photo of a wall, and livediagram's free hosted quota for reading the handwriting had run out, so it fell back to the slower job of reading it in the visitor's own browser.",
  'Facilitator|Changed|Granted':
    'The facilitator of a live session handed the role to someone else.',
  'Facilitator|Changed|Unlocked':
    'The facilitator freed an element a peer had locked by selecting it, so someone else could work on it.',
  'Facilitator|Ended|Released':
    'The facilitator of a live session stepped down, leaving nobody in charge of its shared tools.',
  'Facilitator|Started|Claimed':
    'Someone took the facilitator role in a live session, becoming the one in charge of its shared tools: the timer, votes, and polls.',
  'Folder|Created|': 'A new folder was created in the diagram explorer.',
  'Folder|Created|Tab':
    'A new tab folder was created inside a diagram, by typing a name the diagram had not used before.',
  'Folder|Created|Team': 'A new folder was created in the diagram explorer.',
  'Folder|Deleted|': 'A folder was deleted (contained diagrams move to Unsorted).',
  'Folder|Deleted|Team': 'A folder was deleted (contained diagrams move to Unsorted).',
  'Folder|Moved|': 'A folder was re-parented under another folder (or the root).',
  'Folder|Moved|Team': 'A folder was re-parented under another folder (or the root).',
  'Folder|Renamed|': 'A folder was renamed.',
  'Folder|Renamed|Tab': 'A tab folder was renamed.',
  'Folder|Renamed|Team': 'A folder was renamed.',
  'Help|Searched|NoResults':
    'Someone searched the help centre and found no matching article: a direct list of articles worth writing. The search words are never recorded.',
  'Help|Searched|Results':
    'Someone searched the help centre and got at least one matching article. Counted once per finished search; the search words are never recorded.',
  'Layer|Added|': 'A new layer was added in the Layers panel.',
  'Layer|Changed|Opacity': "A layer's opacity was adjusted.",
  'Layer|Cleared|': 'A layer was emptied (its elements deleted, the layer kept).',
  'Layer|Deleted|': 'A layer (and everything on it) was deleted.',
  'Layer|Moved|': 'A selection was moved onto another layer.',
  'Layer|Opened|Panel': 'Someone expanded the Layers panel.',
  'Layer|Removed|MergedDown': 'A layer was merged into the one below it.',
  'Layer|Removed|MergedUp': 'A layer was merged into the one above it.',
  'Layer|Renamed|Adopted': "A layer auto-named itself from an element's label (smart naming).",
  'Layer|Renamed|Manual': 'A layer was renamed by hand.',
  'Layer|Reordered|': 'Someone dragged a layer to restack it.',
  'Layer|Selected|': 'Someone switched which layer is active.',
  'Layer|Toggled|Hidden': 'A layer was hidden.',
  'Layer|Toggled|Locked': 'A layer was locked (its elements become read-only).',
  'Layer|Toggled|OthersHidden': 'Someone hid every layer except one.',
  'Layer|Toggled|Shown': 'A hidden layer was shown again.',
  'Layer|Toggled|Unlocked': 'A locked layer was unlocked.',
  'Mcp|Used|AddTab': 'An AI tool connected over MCP added a new tab to a diagram.',
  'Mcp|Used|CreateDiagram': 'An AI tool connected over MCP created a new diagram.',
  'Mcp|Used|FindDiagrams': "An AI tool connected over MCP searched for one of the user's diagrams.",
  'Mcp|Used|ReadDiagram': "An AI tool connected over MCP read a diagram's contents.",
  'Mcp|Used|RenameDiagram': 'An AI tool connected over MCP renamed a diagram.',
  'Mcp|Used|ShareDiagram': 'An AI tool connected over MCP generated a share link for a diagram.',
  'Mcp|Used|UpdateDiagram': "An AI tool connected over MCP updated a tab's content in a diagram.",
  'Note|Added|': 'A note was added to an element (first non-empty save).',
  'Note|Changed|': "An existing note's text was edited.",
  'Note|Deleted|': 'A note was cleared from an element.',
  'Note|Opened|': 'Someone opened the note popover on an element.',
  'Page|View|/': 'Someone visited the marketing homepage.',
  'Page|View|/diagram':
    "Someone opened a diagram in the editor. Every diagram's page counts under this same path, with no diagram-specific detail recorded.",
  'Page|View|/explorer': 'Someone opened the Explorer, landing on its default section.',
  'Page|View|/explorer/activity': "Someone navigated to the Explorer's Activity section.",
  'Page|View|/explorer/shared': "Someone navigated to the Explorer's Shared with You section.",
  'Page|View|/explorer/timeline': "Someone navigated to the Explorer's Timeline section.",
  'Page|View|/features/foundations':
    "Someone visited the marketing site's Foundations features page.",
  'Page|View|/features/simple': "Someone visited the marketing site's Simple features page.",
  'Page|View|/help/canvas/links': 'Someone opened the help centre\'s "Learn about links" article.',
  'Page|View|/new': 'Someone opened the New Diagram wizard.',
  'Page|View|/sign-in': 'Someone opened the sign-in page.',
  'Page|View|/sso-callback':
    'Someone was redirected through the sign-in callback page after completing Google sign-in.',
  'Page|View|/telemetry': 'Someone opened the public telemetry dashboard.',
  'Participant|Created|':
    'Someone visited livediagram for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
  'Participant|Returned|Anonymous':
    'A returning guest (not signed in) reopened the app on a later day, counted once per day.',
  'Participant|Returned|Authenticated':
    'A returning signed-in user reopened the app on a later day, counted once per day.',
  'Search|Opened|': 'The global search panel was opened.',
  'Search|Searched|':
    'A query was typed into search. Counted once per session, not on every keystroke.',
  'Search|Selected|Element': 'Someone picked an element match from the global search results.',
  'Session|Deleted|Account':
    'Someone permanently deleted their account and its data, after typing their email address to confirm.',
  'Session|Opened|Embed':
    'A read-only embedded copy of a diagram was loaded on an outside page (for example an iframe in a wiki or a doc). Counted once per rendered embed.',
  'Session|SignedIn|': 'A visitor just signed in to their account.',
  'Session|SignedOut|': 'A visitor just signed out.',
  'Session|SignedUp|': 'A visitor just created an account.',
  'Tab|Aligned|': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartDown': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartRight': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|Mindmap': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|Tree': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Changed|DefaultTextSize':
    "Someone changed a tab's default text size, used for new elements added to it.",
  'Tab|Changed|Font':
    "Someone changed a tab's default font, or applied the tab's font and size to every element on it.",
  'Tab|Changed|TimerExtended':
    "Someone gave a tab's running or paused countdown timer more time, from the timer element's menu.",
  'Tab|Changed|TimerReset': "Someone reset a tab's timer back to its starting length.",
  'Tab|Cleared|': "A tab's content was wiped.",
  'Tab|Cleared|Vote': "A tab's content was wiped.",
  'Tab|Created|': 'A new tab was added to a diagram.',
  'Tab|Deleted|': 'A tab was removed from a diagram.',
  'Tab|Duplicated|': 'A tab was duplicated.',
  'Tab|Ended|CountdownTimer':
    "Someone cleared a tab's countdown timer, whether it had run out or was dismissed early.",
  'Tab|Ended|Poll': 'Someone ended a live poll on a tab.',
  'Tab|Ended|StopwatchTimer': 'Someone cleared a running stopwatch on a tab.',
  'Tab|Ended|Vote': 'Someone ended a dot vote on a tab.',
  'Tab|Ended|VoteReview':
    "Someone finished reviewing a dot vote's ranked results, closing out the vote for everyone.",
  'Tab|Imported|Excalidraw': 'Someone imported a tab from an Excalidraw file.',
  'Tab|Linked|': 'A tab was linked into another diagram.',
  'Tab|Loaded|':
    "A tab's content was fetched for viewing (the first tab when a diagram opens, then each tab switched to).",
  'Tab|Locked|': 'A tab was locked (read-only).',
  'Tab|Moved|Folder': 'A tab was filed into a tab folder.',
  'Tab|Removed|Folder':
    "Someone took a tab out of its tab folder, making it a loose tab again, whether by dragging it out or from the tab's menu.",
  'Tab|Renamed|': 'A tab was renamed.',
  'Tab|Reordered|': 'Someone dragged a tab to a new position.',
  'Tab|Revealed|Vote': "Someone revealed a dot vote's results to everyone in the room.",
  'Tab|Started|CountdownTimer': 'Someone started a countdown timer on a tab.',
  'Tab|Started|Poll': 'Someone started a live poll on a tab.',
  'Tab|Started|PrivateVote':
    'Someone started a dot vote with cursors or counts hidden from other participants.',
  'Tab|Started|StopwatchTimer': 'Someone started a stopwatch on a tab.',
  'Tab|Started|Vote': 'Someone started a dot vote on a tab.',
  'Tab|Toggled|TimerPaused': 'Someone paused a running timer on a tab.',
  'Tab|Toggled|TimerResumed': 'Someone resumed a paused timer on a tab.',
  'Tab|Unlocked|': 'A tab was unlocked (edits resume).',
  'Tab|Voted|Poll':
    'Someone answered a live poll. Counted once per person per poll, even if they change their answer.',
  'Team|Added|Diagram': "A diagram was added to a team's shared library.",
  'Team|Added|Member':
    'An admin invited someone to a team by email. This counts invitations sent, not accepted: that is Joined.',
  'Team|Changed|': "Someone updated a team's name or organisation in its settings.",
  'Team|Changed|Role': "An admin changed a team member's role between Admin and Member.",
  'Team|Created|': 'Someone created a new team.',
  'Team|Declined|Invite':
    'Someone turned down a team invite. Read against Joined: the two are the accept rate on an invitation.',
  'Team|Deleted|': 'An admin deleted a team.',
  'Team|Joined|': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved|Diagram':
    "A diagram already in a team's shared library was moved: re-foldered within the team, moved to a different team, or taken back to the owner's personal space.",
  'Team|Removed|Diagram': 'An admin removed a member who had joined the team.',
  'Team|Removed|Link': "A team's shareable invite link was turned off.",
  'Team|Removed|Self': 'Someone left a team they had joined.',
  'Team|Shared|Link':
    "An admin turned on a team's shareable invite link, so anyone who has it can ask to join.",
  'Theme|Created|Custom': 'Someone created a custom theme with their own colours.',
  'Theme|Deleted|Custom': 'Someone deleted a custom theme they had created.',
  'Timeline|Changed|Calendar':
    "Someone switched the Explorer's Timeline from list view to calendar view.",
  'Timeline|Changed|List':
    "Someone switched the Explorer's Timeline from calendar view to list view.",
  'Timeline|Loaded|More':
    'Someone clicked "Show more" at the bottom of the Timeline, loading the next page of history.',
  'Timeline|Loaded|Retry':
    'Someone clicked "Try again" after the Timeline failed to load, retrying the read.',
  'Timeline|Opened|Landing':
    'Someone arrived at the Explorer with the Timeline as the very section that loaded, rather than switching to it from elsewhere.',
  'Timeline|Opened|Menu':
    'Someone opened the ⋯ menu on a Timeline card or on a collapsed run of cards.',
  'Timeline|Opened|Nav': 'Someone switched to the Timeline from another section of the Explorer.',
  'Timeline|Opened|Stack':
    'Someone expanded a collapsed run of similar Timeline entries (like "12 diagrams renamed") into its individual cards.',
  'Timeline|Removed|Entry': 'Someone removed a single entry from their Timeline feed.',
  'Timeline|Removed|Stack':
    'Someone removed every entry in a collapsed run from their Timeline feed at once, from its ⋯ menu.',
  'Timeline|Selected|Everyone':
    "Someone switched the Timeline's filter to show everyone's activity, not just their own.",
  'Timeline|Selected|Others':
    "Someone switched the Timeline's filter to show only other people's activity, hiding their own.",
  'Token|Created|MCP':
    'An AI tool was connected to the account over MCP, which creates an API token for it to use.',
  'Token|Created|Manual':
    "Someone created a new personal API token by hand, from Settings or the Explorer's API Tokens page.",
  'Token|Removed|': 'Someone revoked an API token.',
  'UI|Added|PaletteFavourite': 'Someone added a tile to their Favourites in the shape palette.',
  'UI|Added|Slide':
    'Someone added a slide to the Slide Deck: either a fresh slide built from the current selection, or a duplicate of an existing one.',
  'UI|Changed|AvatarClothing':
    "Someone changed the Avatar-mode character's clothing, in the Avatar panel.",
  'UI|Changed|AvatarGender':
    "Someone changed the Avatar-mode character's gender, in the Avatar panel.",
  'UI|Changed|AvatarHair': "Someone changed the Avatar-mode character's hair, in the Avatar panel.",
  'UI|Changed|AvatarRandomised':
    'Someone clicked the dice button in the Avatar panel to roll a new random character, keeping their chosen size.',
  'UI|Changed|AvatarSize': "Someone changed the Avatar-mode character's size, in the Avatar panel.",
  'UI|Changed|EraserMode': "Someone changed the eraser's mode, in the Eraser panel.",
  'UI|Changed|EraserSize': "Someone changed the eraser's size, in the Eraser panel.",
  'UI|Changed|EraserTarget':
    'Someone changed what the eraser is allowed to erase, in the Eraser panel.',
  'UI|Changed|FormatCopies':
    'Someone toggled which style properties the format painter copies (fill, border, text, effects, or size), in the Format panel.',
  'UI|Changed|FormatMode':
    'Someone changed whether the format painter keeps applying after each use or turns off after one copy, in the Format panel.',
  'UI|Changed|LaserColour': "Someone changed the laser pointer's colour, in the Laser panel.",
  'UI|Changed|LaserEffect': "Someone changed the laser pointer's trail effect, in the Laser panel.",
  'UI|Changed|LaserTrail':
    "Someone changed how long the laser pointer's trail lingers, in the Laser panel.",
  'UI|Changed|LaserWidth': "Someone changed the laser pointer's width, in the Laser panel.",
  'UI|Changed|MapSize':
    'Someone resized the minimap, in Settings > Editor. An earlier version of this event, before it recorded which size was chosen. No longer recorded.',
  'UI|Changed|MapSizeMedium': 'Someone set the minimap to its medium size, in Settings > Editor.',
  'UI|Changed|MapSizeShort': 'Someone set the minimap to its short size, in Settings > Editor.',
  'UI|Changed|MapSizeTall': 'Someone set the minimap to its tall size, in Settings > Editor.',
  'UI|Changed|PaletteFavourite':
    'Someone reordered their palette Favourites by dragging, or reset the list back to its default tiles.',
  'UI|Changed|PanelLayout':
    "Someone changed the editor's panel layout, in Settings > Editor. An earlier version of this event, before it recorded which layout was chosen. No longer recorded.",
  'UI|Changed|PanelLayoutFloating':
    "Someone switched the editor's panel layout to Floating, in Settings > Editor.",
  'UI|Changed|PanelLayoutMinimal':
    "Someone switched the editor's panel layout to Minimal, in Settings > Editor.",
  'UI|Changed|PanelLayoutToolbar':
    "Someone switched the editor's panel layout to Toolbar, in Settings > Editor.",
  'UI|Changed|PanelOpacity':
    'Someone adjusted how see-through the floating panels are, on the Panel Opacity slider in Settings > Editor.',
  'UI|Changed|SlideNotes':
    'Someone typed presenter notes for a slide, in the Slide Deck panel. Counted once per slide edited, not per keystroke.',
  'UI|Changed|SpotlightDim':
    'Someone changed how dark the area outside the Spotlight is, in the Spotlight panel.',
  'UI|Changed|SpotlightEdge':
    "Someone changed the Spotlight's edge softness, in the Spotlight panel.",
  'UI|Changed|SpotlightShape': "Someone changed the Spotlight's shape, in the Spotlight panel.",
  'UI|Changed|SpotlightSize': "Someone changed the Spotlight's size, in the Spotlight panel.",
  'UI|Changed|ToolbarCategory':
    "Someone switched category in the Toolbar layout's palette strip across the top of the canvas.",
  'UI|Closed|Presentation': 'Someone exited presentation mode.',
  'UI|Closed|SignInBanner':
    'Someone dismissed the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Closed|SignInBannerEditor': 'Someone dismissed the guest sign-in banner shown in the editor.',
  'UI|Closed|SignInBannerExplorer':
    'Someone dismissed the guest sign-in banner shown in the Explorer.',
  'UI|Closed|TourOffer': "Someone dismissed the welcome tour's offer card without starting it.",
  'UI|Closed|Welcome': 'Someone dismissed the first-run welcome modal.',
  'UI|Copied|EmbedCode':
    "Someone copied an embed URL or an iframe snippet from the Share dialog's Embed menu.",
  'UI|Copied|LiveImage':
    "Someone copied a live-updating image URL from the Share dialog's Live Image menu.",
  'UI|Copied|ShareLink': 'Someone copied a share link to the clipboard.',
  'UI|Copied|TeamInviteLink': "Someone copied a team's shareable invite link to their clipboard.",
  'UI|Ended|TourCompleted':
    "Someone reached the end of the welcome tour, or a step's target never appeared on screen and the tour finished early.",
  'UI|Ended|TourDeclined':
    'This exact combination is never actually sent: declining the welcome tour on its very first card is recorded as the tour offer closing, not as an ended tour.',
  'UI|Ended|TourSkipped':
    'Someone skipped out of the welcome tour after it had already started (not on the very first card).',
  'UI|Moved|PanelDock':
    'Someone dragged a floating panel, such as the Palette or the Explorer, to a different corner of the screen, or let it go free.',
  'UI|Moved|Slide':
    'Someone dragged a slide to a new position in the Slide Deck. Counted once per completed drag, not per position crossed.',
  'UI|Opened|ActionSignInNudge':
    'A signed-out visitor opened the "Assign action" dialog and saw the sign-in nudge, since a guest can only assign work to themself. Counted once per dialog open.',
  'UI|Opened|Activity': 'Someone expanded the Activity panel.',
  'UI|Opened|BehaviourGroup':
    "Someone opened a category inside the palette's Behaviours tab (session tools like polls, votes, and record-keeping elements).",
  'UI|Opened|CanvasStyle':
    "Someone opened the tab's look-and-feel dialog on its Canvas tab, to change the background.",
  'UI|Opened|CollabGroup':
    "Someone opened a category inside the palette's old Collaborate tab (session tools like polls and votes). That tab was merged into Behaviours. No longer recorded.",
  'UI|Opened|Collaborators':
    "Someone opened the Collaborators dialog, either from a tab's presence stack or from a command.",
  'UI|Opened|IconGroup': "Someone opened a category inside the palette's Icons tab.",
  'UI|Opened|PresentationSettings':
    "Someone opened the settings popover on the presentation's on-screen controls, while presenting.",
  'UI|Opened|PresenterNotes': 'Someone opened the speaker-notes card while presenting.',
  'UI|Opened|Settings': 'Someone opened the Settings dialog.',
  'UI|Opened|SettingsAccessibility':
    'Someone opened the Accessibility category in the Settings dialog.',
  'UI|Opened|SettingsAccount': 'Someone opened the Account category in the Settings dialog.',
  'UI|Opened|SettingsAi': 'Someone opened the AI Tools category in the Settings dialog.',
  'UI|Opened|SettingsAppearance': 'Someone opened the Appearance category in the Settings dialog.',
  'UI|Opened|SettingsControls': 'Someone opened the Controls category in the Settings dialog.',
  'UI|Opened|SettingsEditor': 'Someone opened the Editor category in the Settings dialog.',
  'UI|Opened|SettingsKeyboard': 'Someone opened the Keyboard category in the Settings dialog.',
  'UI|Opened|SettingsNotifications':
    'Someone opened the Notifications category in the Settings dialog.',
  'UI|Opened|SettingsPanels': 'Someone opened the Panels category in the Settings dialog.',
  'UI|Opened|SettingsPrivacy': 'Someone opened the Privacy category in the Settings dialog.',
  'UI|Opened|Share': 'Someone opened the Share dialog.',
  'UI|Opened|Shortcuts': 'Someone opened the keyboard-shortcuts dialog.',
  'UI|Opened|SignInReasons':
    'Someone clicked "Learn more" on the guest sign-in banner to read why they should sign in. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Opened|SignInReasonsEditor':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the editor, opening the reasons-to-sign-in card.',
  'UI|Opened|SignInReasonsExplorer':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the Explorer, opening the reasons-to-sign-in card.',
  'UI|Opened|SlideDeck': 'Someone picked the Slide Deck tool, opening the deck-building panel.',
  'UI|Opened|SlideElementDetail':
    'While presenting, someone clicked an element on the slide to read its detail, such as a note or comment, without leaving presentation mode.',
  'UI|Opened|TechGroup': "Someone opened a category inside the palette's Technology tab.",
  'UI|Opened|ThemePicker': "Someone opened the tab's look-and-feel dialog on its Theme tab.",
  'UI|Opened|ToolbarExplorer':
    'In the Toolbar panel layout, someone clicked the top-left menu button to open the Explorer as a popover.',
  'UI|Opened|ToolbarMore':
    'In the Toolbar panel layout, someone clicked "More" to see every tile in the current palette category.',
  'UI|Opened|TourOffer':
    'The welcome tour\'s offer card was shown, either automatically on a first visit or replayed from Settings\' "Show Welcome Tour".',
  'UI|Opened|activity':
    "Someone opened the help article about the Explorer's Activity section, from a help link or a search result.",
  'UI|Opened|api-tokens':
    'Someone opened the help article about API tokens, from a help link or a search result.',
  'UI|Opened|changing-theme':
    "Someone opened the help article about changing a tab's theme, from the Theme tab of the look-and-feel dialog or a search result.",
  'UI|Opened|choosing-fonts':
    'Someone opened the help article about choosing fonts, from the Font tab of the look-and-feel dialog or a search result.',
  'UI|Opened|connect-ai-mcp':
    'Someone opened the help article about connecting AI tools to the editor, from the AI panel or a search result.',
  'UI|Opened|image-gallery':
    'Someone opened the help article about the Image Gallery, from a help link or a search result.',
  'UI|Opened|import-tabs':
    'Someone opened the help article about importing tabs, from the Import Tab dialog or a search result.',
  'UI|Opened|minimap':
    'Someone opened the help article about the minimap, from a help link or a search result.',
  'UI|Opened|palette':
    'Someone opened the help article about the Palette, from a help link or a search result.',
  'UI|Opened|recent':
    "Someone opened the help article about the Explorer's Recent section, from a help link or a search result.",
  'UI|Opened|what-it-is':
    "Someone opened the help article explaining the editor's Activity panel (the change-log panel, not the Explorer section), from a help link or a search result.",
  'UI|Opened|your-first-diagram':
    'Someone opened the help article about building their first diagram, from the empty-canvas banner or a search result.',
  'UI|Removed|PaletteFavourite':
    'Someone removed a tile from their Favourites in the shape palette.',
  'UI|Removed|Slide': 'Someone deleted a slide from the Slide Deck.',
  'UI|Searched|BehaviourSearch': "Someone searched within the palette's Behaviours tab.",
  'UI|Searched|IconSearch': "Someone searched within the palette's Icons tab.",
  'UI|Searched|PaletteSearch': 'Someone searched within their Favourites in the palette.',
  'UI|Selected|LiveImageTab':
    "Someone picked a specific tab from the dropdown in the Share dialog's Live Image menu, pointing the live-updating image at that tab instead of the default.",
  'UI|Selected|SignInBanner':
    'Someone clicked "Sign in" on the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Selected|SignInBannerEditor':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the editor.',
  'UI|Selected|SignInBannerExplorer':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the Explorer.',
  'UI|Started|Presentation': 'Someone started presenting: entering full-screen slideshow mode.',
  'UI|Started|Tour':
    "Someone clicked past the welcome tour's first card, beginning the step-by-step walkthrough.",
  'UI|Toggled|ActivityRevertPreviewOff':
    'Someone turned off the hover preview that shows what a change would look like before reverting it, in Settings > Panels.',
  'UI|Toggled|ActivityRevertPreviewOn':
    'Someone turned on the hover preview that shows what a change would look like before reverting it, in Settings > Panels.',
  'UI|Toggled|AlignmentGuidesOff':
    'Someone turned off the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AlignmentGuidesOn':
    'Someone turned on the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AutoRebindOff': 'Someone turned off auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|AutoRebindOn': 'Someone turned on auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|Dark': "Someone set the editor's appearance to Dark.",
  'UI|Toggled|ExplorerViewCard':
    'Someone switched the Explorer to Card view, showing a large preview of each diagram.',
  'UI|Toggled|ExplorerViewList':
    'Someone switched the Explorer to List view, showing diagrams as compact rows.',
  'UI|Toggled|HiddenLayersExport':
    'Someone turned on including hidden layers when exporting an image.',
  'UI|Toggled|IsometricExport':
    'Someone turned on tilting an exported image into the isometric projection.',
  'UI|Toggled|LayerCountOff':
    'Someone turned off the element-count badge on each layer, in Settings > Panels.',
  'UI|Toggled|LayerCountOn':
    'Someone turned on the element-count badge on each layer, in Settings > Panels.',
  'UI|Toggled|LayerHoverPreviewOff':
    "Someone turned off previewing a layer's contents on hover, in Settings > Panels.",
  'UI|Toggled|LayerHoverPreviewOn':
    "Someone turned on previewing a layer's contents on hover, in Settings > Panels.",
  'UI|Toggled|LayerPreviewOff':
    'Someone turned off layer thumbnails in the Layers panel, in Settings > Panels.',
  'UI|Toggled|LayerPreviewOn':
    'Someone turned on layer thumbnails in the Layers panel, in Settings > Panels.',
  'UI|Toggled|Light': "Someone set the editor's appearance to Light.",
  'UI|Toggled|MapDimOff':
    'Someone turned off dimming the part of the minimap outside the current view.',
  'UI|Toggled|MapDimOn':
    'Someone turned on dimming the part of the minimap outside the current view.',
  'UI|Toggled|MiddleMousePanOff':
    'Someone turned off panning the canvas by holding the middle mouse button, in Settings > Controls.',
  'UI|Toggled|MiddleMousePanOn':
    'Someone turned on panning the canvas by holding the middle mouse button, in Settings > Controls.',
  'UI|Toggled|MinimalPanelsOff':
    'Someone switched the panel layout back to Floating, from the quick toggle rather than the Settings dialog.',
  'UI|Toggled|MinimalPanelsOn':
    'Someone switched the panel layout to Minimal, from the quick toggle rather than the Settings dialog.',
  'UI|Toggled|MinimapOff': 'Someone turned off the minimap, in Settings > Editor.',
  'UI|Toggled|MinimapOn': 'Someone turned on the minimap, in Settings > Editor.',
  'UI|Toggled|NotificationsOff':
    'Someone turned off in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotificationsOn':
    'Someone turned on in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOff':
    'Someone turned off the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOn':
    'Someone turned on the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOff':
    'Someone turned off the email that arrives when someone comments on a diagram they own, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOn':
    'Someone turned on the email that arrives when someone comments on a diagram they own, in Settings > Notifications.',
  'UI|Toggled|NotifyDiagramJoinOff':
    'Someone turned off the email that arrives when a new person opens one of their shared diagrams, in Settings > Notifications.',
  'UI|Toggled|NotifyDiagramJoinOn':
    'Someone turned on the email that arrives when a new person opens one of their shared diagrams, in Settings > Notifications.',
  'UI|Toggled|NotifyInviteResponseOff':
    'Someone turned off the email that arrives when a team invite they sent is accepted or declined, in Settings > Notifications.',
  'UI|Toggled|NotifyInviteResponseOn':
    'Someone turned on the email that arrives when a team invite they sent is accepted or declined, in Settings > Notifications.',
  'UI|Toggled|NotifyMilestonesOff':
    'Someone turned off milestone emails, in Settings > Notifications.',
  'UI|Toggled|NotifyMilestonesOn':
    'Someone turned on milestone emails, in Settings > Notifications.',
  'UI|Toggled|NotifyTipsOff':
    'Someone turned off the occasional tips-and-check-in emails, in Settings > Notifications.',
  'UI|Toggled|NotifyTipsOn':
    'Someone turned on the occasional tips-and-check-in emails, in Settings > Notifications.',
  'UI|Toggled|PaletteFavouritesEdit':
    'Someone entered reordering or editing mode for their palette Favourites.',
  'UI|Toggled|PatternExport':
    "Someone turned on painting the tab's background pattern into an exported image.",
  'UI|Toggled|QuickAddHoverOff':
    'Someone turned off quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|QuickAddHoverOn':
    'Someone turned on quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|ReduceMotionOff': 'Someone turned off reduced motion, in Settings > Accessibility.',
  'UI|Toggled|ReduceMotionOn': 'Someone turned on reduced motion, in Settings > Accessibility.',
  'UI|Toggled|ShortcutsOff': 'Someone turned off keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|ShortcutsOn': 'Someone turned on keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|SlideHidden':
    'Someone hid a slide from the presentation run, without deleting it, in the Slide Deck panel.',
  'UI|Toggled|SlideShown':
    'Someone unhid a slide, putting it back into the presentation run, in the Slide Deck panel.',
  'UI|Toggled|System': "Someone set the editor's appearance to follow the system.",
  'UI|Toggled|TelemetryOff':
    'Someone opted out of sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|TelemetryOn':
    'Someone opted in to sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|TourSeenOff':
    'Someone switched on "Show Welcome Tour" in Settings, marking the tour as not yet seen and relaunching it immediately.',
  'UI|Toggled|TourSeenOn':
    'Someone switched off "Show Welcome Tour" in Settings, or the tour resolved on its own, marking it as seen so it won\'t be offered again.',
  'UI|Toggled|ZenModeOff': "Someone turned off zen mode, restoring the editor's chrome.",
  'UI|Toggled|ZenModeOn':
    "Someone turned on zen mode, hiding the editor's chrome for a distraction-free canvas.",
  'UI|Used|JustDraw':
    'Someone landed on the New Diagram page through a link that skips the wizard and goes straight into a blank diagram.',
  'UI|Used|TemplateLink':
    'Someone landed on the New Diagram page through a link that skips the wizard and goes straight into a specific template.',
  'UI|View|TourStepCategories':
    'The welcome tour reached its "Shape categories" step, pointing out the palette\'s category tabs.',
  'UI|View|TourStepContextMenu':
    'The welcome tour reached its "The element menu" step, showing the right-click menu on an element.',
  'UI|View|TourStepExplorer': 'The welcome tour reached its "The Explorer" step.',
  'UI|View|TourStepOutro': 'The welcome tour reached its closing "You\'re ready to go" card.',
  'UI|View|TourStepPalette': 'The welcome tour reached its "The Palette" step.',
  'UI|View|TourStepSearch':
    'The welcome tour reached its "Search everything" step, showing the search panel.',
  'UI|View|TourStepSelectionModes':
    'The welcome tour reached its "Selection modes" step, showing the pointer-tool dropdown.',
  'UI|View|TourStepTabs': 'The welcome tour reached its "Tabs" step.',
  'UI|View|TourStepThemeCanvas':
    'The welcome tour reached its "Theme & canvas" step, showing the paintbrush that restyles a tab.',
};

export const BY_ACTION: Readonly<Record<string, string>> = {
  'Cta|Opened':
    'Someone followed a call to action on a public page (the landing page, a feature or comparison page, the help centre) and reached the New Diagram page.',
  'Cta|Created':
    'Someone who arrived from a call to action on a public page went on to create a diagram. Counted once per arrival.',
  'AI|Toggled': 'Someone turned an AI setting on or off in Settings under AI Tools.',
  'AI|Used':
    'Someone used a feature of the AI Assistant panel, or another AI-powered tool in the editor.',
  'Action|Changed': 'Someone changed something about an action assigned to an element.',
  'Action|Created': 'Someone assigned an action to a teammate, or to themselves, on an element.',
  'Action|Deleted': 'Someone removed an assigned action from an element.',
  'Action|Moved': "A diagram was moved into a teammate's team while assigning them an action.",
  'Action|Opened': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Resolved': 'Someone marked an assigned action as done.',
  'Action|Unresolved': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Loaded':
    "Something happened while loading the Explorer's Activity section (the list of outstanding actions and comment threads).",
  'Activity|Opened': "Someone opened or interacted with the Explorer's Activity section.",
  'Activity|Selected':
    "Someone clicked a row in the Explorer's Activity section, jumping to what it's about.",
  'Canvas|Used': 'Someone picked up one of the canvas tools or modes, or used a canvas feature.',
  'Canvas|Zoomed': 'Someone changed the zoom from the zoom controls.',
  'Comment|Added': 'A comment was added to an element thread.',
  'Comment|Deleted': 'A comment was removed from a thread.',
  'Comment|Opened': 'Someone opened the comment popover on an element.',
  'Comment|Resolved': 'A comment thread was marked resolved.',
  'Comment|Unresolved': 'A resolved comment thread was reopened.',
  'Diagram|Created': 'A brand-new diagram was created.',
  'Diagram|Deleted': 'A diagram was deleted.',
  'Diagram|Duplicated': 'A diagram was duplicated into a new one.',
  'Diagram|Joined':
    'Someone came into a diagram through a share link. Counted once per person per diagram, not on every revisit.',
  'Diagram|Loaded':
    'A diagram was opened, counted on every open (including a page refresh and the first open of a diagram just created).',
  'Diagram|Moved': 'A diagram was moved into (or out of) a folder.',
  'Diagram|Redone': 'Someone hit Redo on a diagram edit.',
  'Diagram|Removed':
    "Someone removed something from a diagram's sharing, such as revoking a share link.",
  'Diagram|Renamed': 'A diagram was renamed.',
  'Diagram|Reverted': 'Someone reverted a single change from the diagram activity log.',
  'Diagram|Shared':
    "Someone created or changed a diagram's share link: its role, how long it lasts, or its password.",
  'Diagram|Undone': 'Someone hit Undo on a diagram edit.',
  'Diagram|Used': 'A diagram was used in a particular way, such as with other people live in it.',
  'Element|Changed':
    "Someone changed a property of one or more selected elements, from a style panel, the right-click menu, or an element's own controls.",
  'Element|Copied': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted': 'An element was removed from the canvas.',
  'Element|Duplicated': 'Someone duplicated one or more elements on the canvas.',
  'Element|Grouped': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked':
    'Someone linked an element to something: another element, a web address, a diagram or a tab.',
  'Element|Locked': "An element's lock was turned on (no edits allowed).",
  'Element|Removed':
    'Someone took something off an element, such as one of their dots in a dot vote.',
  'Element|Reordered':
    'Someone changed the order of something on the canvas, such as the stacking of elements or a table row or column.',
  'Element|Selected':
    'Someone changed what is selected on the canvas in a particular way, such as with the keyboard or a filter.',
  'Element|Toggled':
    'Someone toggled a formatting option on an element or table: a text style (bold, italic, underline, or strikethrough), the aspect-ratio lock, or a table option (header row, header column, or zebra striping).',
  'Element|Ungrouped':
    'A group was disbanded back into individual elements (before groups were removed).',
  'Element|Unlinked': 'Someone cleared the link off an element.',
  'Element|Unlocked': "An element's lock was turned off (edits resume).",
  'Element|Used': 'Someone used an interactive element on the canvas, such as a Reaction Pad.',
  'Element|Voted': 'Someone cast a dot in a dot vote.',
  'Email|Sent':
    'An automatic email went out: a welcome message, an onboarding nudge, a team invite, or a notification about activity on a diagram. The type names which one; it never says who received it.',
  'Error|Api':
    "A request to livediagram's servers failed, or a server itself hit an error while handling one. The type says what kind of failure it was and which operation was being attempted; see the accompanying pattern for how to read it.",
  'Error|Client':
    "Something failed in a visitor's browser: a part of the editor or help centre crashed, or recovered on its own from a hiccup in live sync. The type says what happened and where; see the accompanying pattern for how to read it.",
  'Error|Warning':
    'A feature hit a soft limit and quietly fell back to a slower or more limited way of working, rather than failing outright.',
  'Facilitator|Changed':
    'Something changed about who is facilitating a live session, or an element lock the facilitator freed.',
  'Facilitator|Ended': 'The facilitator role in a live session ended.',
  'Facilitator|Started': 'Someone became the facilitator of a live session.',
  'Folder|Created': 'A new folder was created in the diagram explorer.',
  'Folder|Deleted': 'A folder was deleted (contained diagrams move to Unsorted).',
  'Folder|Moved': 'A folder was re-parented under another folder (or the root).',
  'Folder|Renamed': 'A folder was renamed.',
  'Help|Helpful':
    'Someone said a help-centre article was helpful, using the "Was this helpful?" control at the end of the article. The type is the article. Counted once per article per visit, using whichever answer the reader leaves the page on.',
  'Help|Searched':
    'Someone searched the help centre. Counted once per finished search; the search words are never recorded.',
  'Help|Unhelpful':
    'Someone said a help-centre article was not helpful, using the "Was this helpful?" control at the end of the article. Counted once per article per visit, using whichever answer the reader leaves the page on.',
  'Layer|Added': 'A new layer was added in the Layers panel.',
  'Layer|Changed': 'Someone adjusted a setting on a layer, such as its opacity.',
  'Layer|Cleared': 'A layer was emptied (its elements deleted, the layer kept).',
  'Layer|Deleted': 'A layer (and everything on it) was deleted.',
  'Layer|Moved': 'A selection was moved onto another layer.',
  'Layer|Opened': 'Someone opened the Layers panel.',
  'Layer|Removed': 'A layer was merged into a neighbouring layer.',
  'Layer|Renamed': 'A layer was renamed.',
  'Layer|Reordered': 'Someone dragged a layer to restack it.',
  'Layer|Selected': 'Someone switched which layer is active.',
  'Layer|Toggled': 'Someone switched something on a layer on or off, such as hiding or locking it.',
  'Mcp|Used': 'An AI tool connected to livediagram over MCP used one of its actions on a diagram.',
  'Note|Added': 'A note was added to an element (first non-empty save).',
  'Note|Changed': "An existing note's text was edited.",
  'Note|Deleted': 'A note was cleared from an element.',
  'Note|Opened': 'Someone opened the note popover on an element.',
  'Note|Used':
    "Someone applied rich-text formatting, such as bold, a colour, a bullet or numbered list, a heading, or a link, to part of a note's text.",
  'Page|View':
    'Someone loaded or navigated to a page on the site. Counted once per distinct page, not on every scroll or in-page action.',
  'Participant|Created':
    'Someone visited livediagram for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
  'Participant|Returned':
    'A returning visitor reopened the app on a later day than their first visit, counted once per day.',
  'Search|Opened': 'The global search panel was opened.',
  'Search|Searched':
    'A query was typed into search. Counted once per session, not on every keystroke.',
  'Search|Selected': "Someone picked a result from the editor's search.",
  'Session|Deleted': "Someone permanently deleted part of their account's data.",
  'Session|Opened': 'Someone opened a session-related surface in livediagram.',
  'Session|SignedIn': 'A visitor just signed in to their account.',
  'Session|SignedOut': 'A visitor just signed out.',
  'Session|SignedUp': 'A visitor just created an account.',
  'Tab|Aligned':
    "Someone tidied a tab's layout with Auto Layout, arranging its elements automatically.",
  'Tab|Changed': "Someone changed a tab-wide setting, such as the tab's default font or text size.",
  'Tab|Cleared': "A tab's content was wiped.",
  'Tab|Created': 'A new tab was added to a diagram.',
  'Tab|Deleted': 'A tab was removed from a diagram.',
  'Tab|Duplicated': 'A tab was duplicated.',
  'Tab|Ended': 'Someone ended a live activity on a tab, such as a poll or a timer.',
  'Tab|Imported': 'Someone imported a tab from a file.',
  'Tab|Linked': 'A tab was linked into another diagram.',
  'Tab|Loaded':
    "A tab's content was fetched for viewing (the first tab when a diagram opens, then each tab switched to).",
  'Tab|Locked': 'A tab was locked (read-only).',
  'Tab|Moved': 'A tab was filed into a tab folder.',
  'Tab|Removed': 'Someone took a tab out of its tab folder, making it a loose tab again.',
  'Tab|Renamed': 'A tab was renamed.',
  'Tab|Reordered': 'Someone dragged a tab to a new position.',
  'Tab|Revealed':
    "Someone revealed a tab's hidden results to everyone in the room, such as a dot vote's.",
  'Tab|Started': 'Someone started a live activity on a tab, such as a poll or a timer.',
  'Tab|Toggled':
    'Someone switched something on a tab on or off, such as pausing or resuming its timer.',
  'Tab|Unlocked': 'A tab was unlocked (edits resume).',
  'Tab|Voted': 'Someone answered a live vote or poll on a tab. Counted once per person per poll.',
  'Team|Added':
    'Something was added to a team: an invitation sent, or a diagram added to its shared library.',
  'Team|Changed': "Something about a team's settings, or a member's role, was changed.",
  'Team|Created': 'Someone created a new team.',
  'Team|Declined': 'Someone turned down a team invite.',
  'Team|Deleted': 'An admin deleted a team.',
  'Team|Joined': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved': "A diagram already in a team's shared library was moved somewhere else.",
  'Team|Removed':
    'Someone was taken off a team, left one, or had a pending invite or the invite link withdrawn.',
  'Team|Shared': 'A team turned on a way for people to ask to join it.',
  'Theme|Created': 'Someone created a custom theme with their own colours.',
  'Theme|Deleted': 'Someone deleted a custom theme they had created.',
  'Timeline|Changed': "Someone switched how the Explorer's Timeline displays its history.",
  'Timeline|Loaded':
    'The Timeline loaded more of its history, either the next page or a retry after a failed read.',
  'Timeline|Opened': 'Someone opened the Timeline, or a menu or collapsed group within it.',
  'Timeline|Removed': 'Someone removed one or more entries from their Timeline feed.',
  'Timeline|Selected':
    "Someone changed a Timeline filter: turned a category chip (such as Comments, Renames, or Sharing) off, or switched between seeing everyone's activity and just their own.",
  'Token|Created':
    'A new API token was created, either by hand or for an AI tool connected over MCP.',
  'Token|Removed': 'Someone revoked an API token.',
  'UI|Added': 'Someone added something in the editor, such as a palette favourite or a slide.',
  'UI|Changed':
    "Someone changed a setting or a control's value somewhere in the editor: a tool panel's option (Avatar, Eraser, Laser, Spotlight, Format Painter), a Settings dialog row, or a palette/toolbar choice.",
  'UI|Closed':
    'Someone closed or dismissed a banner, card, or presentation somewhere in the editor.',
  'UI|Copied':
    'Someone copied something to their clipboard from a Share or invite control, such as a share link, an embed snippet, a live image URL, or a team invite link.',
  'UI|Ended': 'The welcome tour finished, either completed in full or skipped partway through.',
  'UI|Moved': "Someone dragged something to a new position in the editor's interface.",
  'UI|Opened':
    "Someone opened a dialog, panel, popover, or menu somewhere in the editor. A lowercase, hyphenated type is a help-centre article's address: someone clicked a help link, or a Help result in search, to read it.",
  'UI|Removed': 'Someone removed something in the editor, such as a palette favourite or a slide.',
  'UI|Searched':
    'Someone typed into a search box inside a palette tab (Behaviours, Icons, or Technology), narrowing it to matching tiles. Counted once per tab visit, on the first keystroke.',
  'UI|Selected':
    'Someone picked an option from a dropdown, or clicked through on a banner, somewhere in the editor.',
  'UI|Started': 'Someone started a presentation or the welcome tour.',
  'UI|Toggled': 'Someone turned an editor setting on or off.',
  'UI|Used': 'Someone used a wizard-skipping entry point into a new diagram.',
  'UI|View': 'The welcome tour advanced to (or back to) a particular stage.',
};

export const API_OPERATIONS: Readonly<Record<string, string>> = {
  AcceptTeamInvite: 'accepting a team invite',
  AddTab: 'adding a tab to a diagram, from an AI tool connected over MCP',
  AppendChangeLog: "recording an entry in a diagram's change history",
  CopyDiagram: 'duplicating a diagram',
  CreateCustomTheme: 'saving a new custom theme',
  CreateDiagram: 'creating a new diagram',
  CreateFolder: 'creating a folder',
  CreateShareLink: 'generating a share link',
  CreateTeam: 'creating a team',
  CreateToken: 'creating an API token',
  DeleteChangeLog: "clearing a diagram's change history",
  DeleteChangeLogEntry: "removing one entry from a diagram's change history",
  DeleteComment: 'deleting a comment',
  DeleteCustomTheme: 'deleting a saved custom theme',
  DeleteDiagram: 'deleting a diagram',
  DeleteFolder: 'deleting a folder',
  DeleteImage: 'deleting a saved image',
  DeleteShareLink: 'deleting a share link',
  DeleteTab: 'deleting a tab',
  DeleteTeam: 'deleting a team',
  DismissShared: "removing a shared diagram from a visitor's shared list",
  DismissTimelineEvent: 'clearing one entry from the activity timeline',
  DismissTimelineEvents: 'clearing entries from the activity timeline',
  ExtendShareLink: "extending a share link's expiry",
  FindDiagrams: 'searching for a diagram, from an AI tool connected over MCP',
  InviteTeamMember: 'inviting someone to a team',
  JoinTeamByInviteLink: 'joining a team through its invite link',
  LinkTab: 'linking a tab into another diagram',
  List: "listing a visitor's diagrams",
  ListChangeLog: "listing a diagram's change history",
  ListCustomThemes: "listing an account's saved custom themes",
  ListFolders: "listing an account's folders",
  ListImages: 'listing the images saved to an account',
  ListShareLinks: "listing a diagram's share links",
  ListShared: 'listing diagrams shared with a visitor',
  ListTeamInvites: "listing an account's pending team invites",
  ListTeams: "listing an account's teams",
  ListTemplates: 'listing available templates, from an AI tool connected over MCP',
  ListTokens: "listing an account's API tokens",
  LoadSelf: "loading a visitor's own profile details",
  LoadShared: 'opening a diagram through a share link',
  LoadTab: "loading a tab's contents",
  LoadTeam: "loading a team's details",
  LoadTeamLibrary: "loading a team's shared diagram library",
  NotifyAssignedAction: 'emailing someone about an action assigned to them',
  OauthExchange: 'connecting an AI tool over MCP',
  ReadDiagram: 'reading a diagram, from an AI tool connected over MCP',
  RenameDiagram: 'renaming a diagram, from an AI tool connected over MCP',
  ResolveTeamInviteLink: "opening a team's invite link",
  RevokeTeamInviteLink: "turning off a team's invite link",
  RevokeToken: 'revoking an API token',
  SaveDiagramMeta: "saving a diagram's name or other details",
  SaveSelf: "saving a visitor's own profile details",
  SaveTab: "saving a tab's contents",
  SendEmail: 'sending a transactional or lifecycle email',
  SetFolder: 'moving a diagram into, or out of, a folder',
  SetSharePassword: 'setting a password on a share link',
  ShareDiagram: 'generating a share link, from an AI tool connected over MCP',
  UpdateCustomTheme: 'updating a saved custom theme',
  UpdateDiagram: 'updating a diagram, from an AI tool connected over MCP',
  UpdateFolder: 'renaming or updating a folder',
  UpdateTeam: "updating a team's name or organisation",
  UploadImage: 'uploading an image',
};
