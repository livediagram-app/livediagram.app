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
  'Action|Changed|Edited':
    "Someone edited the details of an action assigned to an element, without changing who it's assigned to.",
  'Action|Changed|Reassigned':
    'Someone changed who an action assigned to an element is assigned to.',
  'Action|Created|EmailOff':
    'Someone assigned an action to a teammate, or to themselves, on an element, without sending an email.',
  'Action|Created|EmailOn':
    'Someone assigned an action to a teammate on an element and chose to email them about it.',
  'Action|Deleted|': 'Someone removed an assigned action from an element.',
  'Action|Moved|DocumentToTeam':
    "While assigning an action to someone, the document was moved into that person's team so they'd have access to it.",
  'Action|Opened|': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Resolved|': 'Someone marked an assigned action as done.',
  'Action|Resolved|WontDo':
    "Someone closed an assigned action as Won't Do: decided against, closed without being done.",
  'Action|Unresolved|': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Changed|All':
    "Someone showed every row of the Explorer's Inbox again, from the filter bar over its list.",
  'Activity|Changed|MyActions':
    "Someone filtered the Explorer's Inbox to My Actions: the actions and cards assigned to them.",
  'Activity|Changed|AssignedByMe':
    "Someone filtered the Explorer's Inbox to Assigned by Me: the work they handed to others.",
  'Activity|Changed|Comments':
    "Someone filtered the Explorer's Inbox to Comments: mentions, threads on their items and replies.",
  'Activity|Changed|FormResponses':
    "Someone filtered the Explorer's Inbox to Form Responses: forms with responses they haven't seen.",
  'Activity|Added|Reply':
    "Someone replied to a comment thread from the Explorer's Inbox reading pane, without opening the item.",
  'Activity|Resolved|Thread':
    "Someone resolved a comment thread from the Explorer's Inbox reading pane.",
  'Activity|Resolved|Action':
    "Someone marked an assigned action done from the Explorer's Inbox, in the editor's panel beside it.",
  'Activity|Resolved|Card': "Someone marked a Plan card done from the Explorer's Inbox.",
  'Activity|Loaded|Retry':
    'Someone clicked "Try again" after the Explorer\'s Inbox failed to load, retrying the read.',
  'Activity|Opened|':
    "Someone opened the Explorer's Inbox, which lists open actions assigned to them, actions they assigned to others, and comment threads they're in. Counted once per visit, not on every re-fetch.",
  'Activity|Selected|Action':
    "Someone clicked an action row in the Explorer's Inbox, jumping to the element it's assigned on.",
  'Activity|Selected|Thread':
    "Someone clicked a comment-thread row in the Explorer's Inbox, jumping to the element it's on.",
  'Canvas|Used|FollowMe':
    "Someone pinned their canvas to a peer's viewport, following their pan, zoom, and tab until they take it back.",
  'Canvas|Used|FormatPainter':
    "Someone picked up the Format tool, ready to copy one element's style onto others by tapping them.",
  'Canvas|Used|Isometric':
    'Someone switched the canvas into Isometric view, which renders the canvas at an angle for a 3D-style look.',
  'Canvas|Used|Laser':
    "Someone switched on the Laser pointer, a trail visible to everyone that shows where they're pointing without leaving a mark.",
  'Canvas|Used|Spotlight':
    "Someone switched on Spotlight, which dims the rest of the canvas around wherever they're pointing.",
  'Canvas|Zoomed|DoubleTap':
    'Someone double-tapped the canvas with a finger to zoom in on that spot.',
  'Canvas|Zoomed|Fit': 'Someone tapped "Fit to screen".',
  'Canvas|Zoomed|In': 'Someone tapped the zoom-in button.',
  'Canvas|Zoomed|Out': 'Someone tapped the zoom-out button.',
  'Canvas|Zoomed|Preset':
    'Someone jumped straight to a preset zoom level from the zoom-percentage popover.',
  'Comment|Added|': 'A comment was added to an element thread.',
  'Comment|Deleted|': 'A comment was removed from a thread.',
  'Comment|Opened|': 'Someone opened the comment popover on an element.',
  'Comment|Mentioned|': 'A comment was sent that @-mentioned at least one teammate.',
  'Comment|Resolved|': 'A comment thread was marked resolved.',
  'Comment|Unresolved|': 'A resolved comment thread was reopened.',
  'Document|Created|Cloud': 'A brand-new document was created.',
  'Document|Created|Offline': 'A brand-new document was created.',
  'Document|Deleted|': 'A document was deleted.',
  'Document|Duplicated|': 'A document was duplicated into a new one.',
  'Document|Duplicated|Copy': 'A document was duplicated into a new one.',
  'Document|Joined|Edit':
    'Someone came into a document through an edit-role share link. Counted once per person per document, not on every revisit.',
  'Document|Joined|Participate':
    'Someone came into a document through a Participant share link. Counted once per person per document, not on every revisit.',
  'Document|Loaded|':
    'A document was opened, counted on every open (including a page refresh and the first open of a document just created).',
  'Document|Moved|': 'A document was moved into (or out of) a folder.',
  'Document|Moved|SavedToCloud':
    'Someone synced a document in This Browser to their account, turning it into a cloud document kept on the server.',
  'Document|Moved|TakenOffline':
    'Someone took a document offline, moving it out of their account into this browser only.',
  'Document|Redone|': 'Someone hit Redo on a document edit.',
  'Document|Removed|ShareLink':
    "Someone revoked a share link from a document's Share dialog, so it stops working.",
  'Document|Renamed|': 'A document was renamed.',
  'Document|Reverted|':
    "Someone reverted a single change from a tab's activity log, in the since-removed Activity panel.",
  'Document|Shared|Edit': 'Someone generated an edit-role share link for a document.',
  'Document|Shared|ExpiryWeek':
    'Someone set a share link to expire after a week, when creating it.',
  'Document|Shared|Extended':
    'Someone re-armed an expiring share link for another full round of its original lifetime.',
  'Document|Shared|Participate':
    'Someone generated a Participant share link: people take part and write without reshaping the board.',
  'Document|Shared|PasswordCleared': "Someone removed the password from a document's share link.",
  'Document|Shared|PasswordSet': "Someone set a password on a document's share link.",
  'Document|Shared|View': 'Someone generated a view-role share link for a document.',
  'Document|Undone|': 'Someone hit Undo on a document edit.',
  'Document|Used|Multiplayer':
    'A document was open with at least one other person live in the room, counted once per document per visit. The one event that counts collaboration happening rather than being offered.',
  'Element|Changed|IconSwapped': 'Someone dropped an icon onto another icon, swapping its glyph.',
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
  'Element|Changed|ArrowExactStart':
    'Someone set an arrow to start exactly at the anchor it is connected to, or back to fanning out.',
  'Element|Changed|ArrowStyle':
    "Someone changed a selected arrow's shape, such as straight, curved, or elbowed.",
  'Element|Changed|ArrowThickness': "Someone changed a selected arrow's line thickness.",
  'Element|Changed|ArrowheadColor': "Someone changed a selected arrow's arrowhead colour.",
  'Element|Changed|ArrowheadShape': "Someone changed a selected arrow's arrowhead shape.",
  'Element|Changed|ArrowheadSize': "Someone changed a selected arrow's arrowhead size.",
  'Element|Changed|AspectRatioReset':
    'Someone reset a selected shape back to its default proportions.',
  'Element|Changed|AccentEdge':
    'Someone set, moved, recoloured or removed the coloured accent edge along one side of a selected shape.',
  'Element|Changed|CardSlots':
    "Someone switched a card's header band, title, meta line or icon on or off, or changed how its icon is shown.",
  'Element|Changed|Card':
    'Someone added, removed or reordered the tags along the bottom of a card.',
  'Element|Changed|ChipLook':
    'Someone changed how a badge or step number looks (solid, ink, outline, tinted or quiet).',
  'Element|Changed|ChipDetach':
    'Someone let a badge or step number go from the element it was attached to.',
  'Element|Changed|TabWindowTab':
    'Someone chose which tab a Tab Window shows, so a slide or page shows that tab live.',
  'UI|Used|TabWindowOpen':
    'Someone opened the tab a Tab Window shows, from the window or its menu.',
  'Element|Changed|ConceptRows':
    'Someone added, removed, reordered or renamed the layers, tiers or steps of a layer stack, pyramid or cycle.',
  'Element|Changed|PointerTip':
    'Someone moved the tip of a pointer note to a free spot on the board.',
  'Element|Changed|PointerAttach':
    'Someone pinned the tip of a pointer note to a corner or edge of a shape.',
  'Element|Changed|PointerDetach':
    'Someone let a pointer note go from the shape its tip was pinned to.',
  'Element|Changed|TagColour':
    'Someone gave a card tag a colour for the whole tab, so every card with that tag shows it.',
  'Element|Changed|TagColourCleared': 'Someone removed the colour a card tag had across the tab.',
  'Element|Changed|StackDirection':
    'Someone switched a stack between laying things out in a row, a column and a grid.',
  'Element|Changed|StackColumns': 'Someone changed how many columns a grid stack has.',
  'Element|Changed|StackGap': 'Someone changed the gap between the things in a stack.',
  'Element|Changed|StackPadding': 'Someone changed the space inside the edge of a stack.',
  'Element|Changed|StackAlign':
    'Someone changed whether the things in a stack line up at the start, the centre or the end.',
  'Element|Changed|HubSpokes': 'Someone switched the spokes of a hub and spoke graphic on or off.',
  'Element|Changed|PyramidVariant':
    'Someone switched a pyramid between pointing up, pointing down and a funnel.',
  'Element|Changed|ConceptAnim':
    "Someone set or cleared a layer stack's, pyramid's or cycle's animation (Build, Pulse or Flow), or its speed or repeat.",
  'Element|Changed|RenumberSteps':
    'Someone renumbered every step number on a tab in reading order.',
  'Element|Changed|StepSequence':
    "Someone turned on or off playing the step numbers' animations one after another.",
  'Element|Changed|BorderRadius': "Someone changed a selected element's corner rounding.",
  'Element|Changed|BorderStroke': "Someone changed a selected element's border weight.",
  'Element|Changed|BorderStyle':
    "Someone changed a selected element's border pattern: solid, dashed, or dotted.",
  'Element|Changed|ChartAnim':
    'Someone gave a selected chart a looping reveal animation, changed its speed, or turned it off.',
  'Element|Changed|ChartData': "Someone edited a chart element's underlying data.",
  'Element|Changed|ChartLegend':
    "Someone turned a chart's legend on or off, or moved it to a different side.",
  'Element|Changed|ChartPalette': 'Someone applied a colour palette to a selected chart.',
  'Element|Changed|ChartType':
    'Someone changed how a selected chart draws its data: Column, Bar, Line, Area, Scatter, Pie or Doughnut.',
  'Element|Changed|Checklist': "Someone edited a checklist element's items.",
  'Element|Changed|CodeBlock':
    "Someone edited a code block element's snippet or its programming language.",
  'Element|Changed|CodeTheme': 'Someone applied a colour scheme to a selected code block.',
  'Element|Changed|CodeWrap': 'Someone toggled long-line wrapping on a selected code block.',
  'Element|Changed|FillColor': "Someone changed a selected element's fill colour.",
  'Element|Changed|FlowRepeat': "Someone turned a selected arrow's flow animation loop on or off.",
  'Element|Changed|FlowSpeed': "Someone changed how fast a selected arrow's flow animation plays.",
  'Element|Changed|Font': "Someone changed the font used on a selected element's text.",
  'Element|Changed|FormatPainter':
    'Someone used the format painter to copy a style from one element onto another.',
  'Element|Changed|Header':
    "Someone edited a Header web component's lines, such as adding, removing, or retitling one.",
  'Element|Changed|HeaderFill': "Someone changed a table's header row colour.",
  'Element|Changed|Hero': "Someone turned a hero image's caption card on or off.",
  'Element|Changed|Icon': 'Someone placed or repositioned an inline icon on a selected element.',
  'Element|Changed|IconAnimation':
    'Someone gave a selected icon shape a looping animation, or turned it off.',
  'Element|Changed|TextAnimation':
    'Someone gave the words of a selected element a text animation, such as typewriter, or turned it off.',
  'Element|Changed|StickyAnimation':
    'Someone gave a selected sticky note an animation, such as flutter, or turned it off.',
  'Element|Changed|DrawingAnimation':
    'Someone gave a selected drawing or path an animation, such as draw, or turned it off.',
  'Element|Changed|MediaAnimation':
    'Someone gave a selected image or video an animation, such as Ken Burns, or turned it off.',
  'Element|Changed|TableAnimation':
    'Someone gave a selected table an animation, such as rows cascading in, or turned it off.',
  'Element|Changed|IconSize': "Someone changed a selected Technology icon's tile size.",
  'Element|Changed|LabelFill': "Someone changed the background colour of an arrow's label.",
  'Element|Changed|Legend': "Someone edited a Legend element's items.",
  'Element|Changed|LineData': "Someone edited a line chart element's categories and series data.",
  'Element|Changed|LinkUnfurled':
    'A link-card element automatically fetched a preview (title, image, and favicon) after someone gave it a web address.',
  'Element|Changed|Marker': "Someone added or removed a status marker next to a shape's label.",
  'Element|Changed|MarkerSize': "Someone changed the size of a shape's status marker.",
  'Element|Changed|Nudge':
    'Someone nudged a selected element with the arrow keys. Counted once per burst of presses, not once per key press.',
  'Element|Changed|Padding': "Someone changed a selected element's internal padding.",
  'Element|Changed|ProcessSteps':
    "Someone edited a Process web component's steps, such as adding, removing, or retitling one.",
  'Element|Changed|Progress': "Someone changed a progress-bar element's percentage.",
  'Element|Changed|ProgressAnim':
    'Someone gave a progress-bar element a looping fill animation, changed its speed, or turned it off.',
  'Element|Changed|QuickBackground':
    'Someone picked a background colour for the selected shapes from the quick style panel beside the selection.',
  'Element|Changed|QuickClearStyles':
    'Someone pressed Clear Styles in the quick style panel, returning the selected shapes, arrows and text to the theme default and forgetting that style for the next ones drawn.',
  'Element|Changed|QuickIconAlign':
    'Someone moved the icon before, above, or after the label of the selected shapes from the quick style panel.',
  'Element|Changed|QuickCorners':
    'Someone changed the corners of the selected rectangles on a whiteboard from the quick style panel.',
  'Element|Changed|QuickStroke':
    'Someone picked a line colour for the selected shapes or arrows from the quick style panel beside the selection.',
  'Element|Changed|QuickStrokeStyle':
    'Someone made the lines of the selected shapes or arrows solid, dashed, dotted, or flowing from the quick style panel.',
  'Element|Changed|QuickStrokeWidth':
    'Someone made the lines of the selected shapes or arrows thin, medium, or thick from the quick style panel.',
  'Element|Changed|QuickTextColour':
    'Someone picked a colour for the selected text elements from the quick style panel beside the selection.',
  'Element|Changed|QuickTextAlign':
    'Someone aligned the text of the selected shapes left, centre, or right from the quick style panel.',
  'Element|Changed|Rating': "Someone changed a star-rating element's score.",
  'Element|Changed|RatingAnim':
    'Someone gave a star-rating element a looping animation, changed its speed, or turned it off.',
  'Element|Changed|Rotation': 'Someone rotated a selected element to a fixed angle.',
  'Element|Changed|Finish':
    "Someone set a selected element's own finish (Flexible, Professional, Sketch or Marker), or set it back to follow its tab.",
  'Element|Changed|SankeyAnim':
    'Someone set or cleared the animation on a selected Sankey diagram (Grow, Flow, Cascade, Pulse or Rise), or its speed or repeat.',
  'Element|Changed|SankeyFlows':
    "Someone edited a Sankey diagram's flows (what moves from where to where, and how much) or a node's leftover switch.",
  'Element|Changed|SankeyStyle':
    "Someone changed how a Sankey diagram draws: a node's colour, the band colouring, the column layout, the labels, the leftovers or the unit.",
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
  'Element|Changed|TextAlign': "Someone changed a selected element's text alignment.",
  'Element|Changed|TextColor': "Someone changed a selected element's text colour.",
  'Element|Changed|TextFormat':
    "Someone applied rich-text formatting, such as bold, a colour, a list, a heading, or a link, to part of an element's label.",
  'Element|Changed|TextSize': "Someone changed a selected element's text size.",
  'Tab|Changed|PageAddedLikeLast':
    'Someone added another page like the last one, with the + after the pages.',
  'Element|Changed|TimelineRail': "Someone changed a Timeline Rail element's number of points.",
  'Element|Copied|': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted|': 'An element was removed from the canvas.',
  'Element|Deleted|TableColumn': 'Someone removed a column from a table.',
  'Element|Deleted|TableRow': 'Someone removed a row from a table.',
  'Element|Duplicated|': 'An element was duplicated.',
  'Element|Grouped|': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked|ArrowPoint':
    "Someone dragged an arrow's end onto another element, pinning that end to it so the arrow follows if the element moves.",
  'Element|Linked|Document': 'Someone linked an element to another document.',
  'Element|Linked|Tab': 'Someone linked an element to another tab.',
  'Element|Linked|Url': 'Someone linked an element to a web address.',
  'Element|Locked|': "An element's lock was turned on (no edits allowed).",
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
  'Element|Searched|Image':
    "Someone searched for openly licensed pictures in the image picker's Search tab.",
  'Element|Used|ImagePlaceholder':
    "Someone pressed Select Image on an empty image's placeholder to open the image picker.",
  'Element|Used|ImageSearch': 'Someone attached a picture found with image search to an image.',
  'Element|Used|Video': 'Someone pressed play on a video element.',
  'Email|Sent|DocumentJoined':
    "An email went out to a document's owner after someone opened it for the first time through a share link.",
  'Email|Sent|FirstShare': "An email went out marking someone's first time sharing a document.",
  'Email|Sent|Milestone':
    'An email went out congratulating someone on reaching a document-count milestone.',
  'Email|Sent|TeamInviteReminder1':
    'A reminder went out about a team invite nobody had answered, a day after it was sent.',
  'Email|Sent|TeamInviteReminder2':
    'A reminder went out about a team invite nobody had answered, a week after it was sent.',
  'Email|Sent|TeamInviteReminder3':
    'The last reminder went out about a team invite nobody had answered, three weeks after it was sent.',
  'Email|Sent|Week1': 'The one-week onboarding email went out.',
  'Email|Sent|Week2': 'The two-week onboarding email went out.',
  'Email|Sent|Welcome': 'The welcome email went out just after someone signed up.',
  'Error|Api|Internal':
    'A livedocuments server crashed while handling a request. No longer recorded in this bare form; a crash like this now also records which endpoint or tool broke.',
  'Error|Api|Network.SendEmail':
    "An email (a welcome message, an invite, a notification) couldn't be sent, because the email provider couldn't be reached at all.",
  'Error|Client|RealtimeResync':
    'The editor noticed it had missed updates during a live session and refetched the document to catch back up. This is the editor recovering on its own, not a crash.',
  'Error|Client|StaleChunkReload':
    'A tab still running an earlier build of the editor asked for a piece of code the last deploy removed, and loaded the page in full instead of crashing. The editor recovering on its own after a deploy, not a crash.',
  'Error|Client|Uncaught':
    'A part of the editor or help centre crashed with an error nothing in the code caught. No longer recorded in this bare form; a crash like this now also records which page it happened on and what kind of error it was.',
  'Error|Client|UnhandledRejection':
    'A background task failed and nothing in the code handled the failure. No longer recorded in this bare form; a failure like this now also records which page it happened on and what kind of error it was.',
  'Error|Warning|DocumentLoad.Slow':
    'A document took more than 10 seconds to load, so the opening screen offered Refresh.',
  'Error|Warning|DocumentLoad.AutoReload':
    'A document load hit its 30-second limit and the page reloaded itself once to try a fresh start.',
  'Error|Warning|DocumentLoad.Late':
    'A document finished loading after its 30-second limit had already shown the error screen; the editor replaced it.',
  'Error|Warning|OfflineStore.Unavailable':
    "The browser's local database did not open in time, so the load carried on without checking for Offline Mode documents.",
  'Error|Warning|SessionToken.TimedOut':
    "A signed-in browser's session did not hand out a token within 10 seconds, so the request gave up instead of waiting forever.",
  'Facilitator|Changed|Unlocked':
    'Someone freed an element a peer had locked by selecting it, so someone else could work on it.',
  'Folder|Created|': 'A new folder was created in the document explorer.',
  'Folder|Created|Tab':
    'A new tab folder was created inside a document, by typing a name the document had not used before.',
  'Folder|Created|Team': 'A new folder was created in the document explorer.',
  'Folder|Deleted|': 'A folder was deleted (contained documents move to the top level).',
  'Folder|Deleted|Team': 'A folder was deleted (contained documents move to the top level).',
  'Folder|Moved|': 'A folder was re-parented under another folder (or the root).',
  'Folder|Moved|Team': 'A folder was re-parented under another folder (or the root).',
  'Folder|Renamed|': 'A folder was renamed.',
  'Folder|Renamed|Tab': 'A tab folder was renamed.',
  'Folder|Renamed|Team': 'A folder was renamed.',
  'Help|Searched|NoResults':
    'Someone searched the help centre and found no matching article: a direct list of articles worth writing. The search words are never recorded.',
  'Help|Searched|Results':
    'Someone searched the help centre and got at least one matching article. Counted once per finished search; the search words are never recorded.',
  'Home|Loaded|Retry': 'Someone pressed "Try again" after Home failed to load.',
  'Home|Opened|Group':
    "Someone expanded a summary of several people's work on one document in Home's What Happened, to see every action.",
  'Home|Opened|Landing':
    'Someone arrived at the Explorer with Home as the very section that loaded.',
  'Home|Opened|Nav': 'Someone went to Home from another section of the Explorer.',
  'UI|Selected|Sidebar.TrashDropDocument':
    "Someone dragged a document onto the Trash row in the Explorer's sidebar, moving it to the Trash.",
  'UI|Selected|Sidebar.TrashDropFolder':
    "Someone dragged one of their folders onto the Trash row in the Explorer's sidebar to delete it.",
  'Home|Opened|Welcome':
    'Someone with no documents yet saw the first-run Home, with its blanks and popular templates to start from.',
  'Home|Selected|Welcome.AllTemplates':
    'Someone with no documents yet followed Browse All Templates from the first-run Home.',
  'Home|Selected|Welcome.Blank':
    'Someone with no documents yet started a blank from the first-run Home.',
  'Home|Selected|Welcome.Search':
    'Someone with no documents yet searched the templates from the field at the top of the first-run Home.',
  'Home|Selected|Welcome.SignIn':
    'Someone signed out with no documents followed Sign In from the first-run Home, to find their work.',
  'Home|Selected|Welcome.StartBlank':
    'Someone with no documents yet started a blank diagram from the field at the top of the first-run Home.',
  'Home|Selected|Welcome.Template':
    'Someone with no documents yet started a popular template from the first-run Home.',
  'Home|Selected|Hero.Documents':
    'Someone followed the documents pill at the top of Home to My Work.',
  'Home|Selected|Hero.Inbox': 'Someone followed the Inbox pill at the top of Home to their Inbox.',
  'Home|Selected|Hero.NewDocument':
    'Someone started a new document from the New document button in the search field at the top of Home.',
  'Home|Selected|JumpBackIn.MostUsed':
    "Someone opened a document from Home's Jump Back In that was among the ones they used on the most days.",
  'Home|Selected|JumpBackIn.Recent':
    "Someone opened a document from Home's Jump Back In that was among the ones they used most recently.",
  'Home|Selected|JumpBackIn.SeeMore':
    "Someone followed See More from Home's Jump Back In to the Recent page.",
  'Home|Selected|WhatHappened':
    "Someone opened a document from Home's What Happened, which lists what other people did to their documents.",
  'Layer|Added|': 'A new layer was added in the Layers panel.',
  'Layer|Changed|Opacity': "A layer's opacity was adjusted.",
  'Layer|Cleared|': 'A layer was emptied (its elements deleted, the layer kept).',
  'Layer|Deleted|': 'A layer (and everything on it) was deleted.',
  'Layer|Moved|': 'A selection was moved onto another layer.',
  'Layer|Opened|Panel': 'Someone opened the Layers panel.',
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
  'Agent|Viewed|Overview': 'An agent or a script read a document at a glance: one line per tab.',
  'Agent|Viewed|Outline': 'An agent or a script read a tab as an outline, one line per element.',
  'Agent|Viewed|Graph': 'An agent or a script read what connects to what on a tab.',
  'Agent|Viewed|Layout': 'An agent or a script read where things sit on a tab.',
  'Agent|Viewed|Comments': 'An agent or a script read the open comment threads on a tab.',
  'Agent|Viewed|Show': 'An agent or a script read one element in full.',
  'Agent|Viewed|Find': 'An agent or a script searched a tab for some text.',
  'Agent|Viewed|Lint':
    'An agent or a script checked how a tab is drawn: overlaps, crossings, hidden arrows.',
  'Agent|Opened|Toast':
    "Somebody pressed Show on the toast an agent's change raised, to see what it touched.",
  'Mcp|Used|AddTab': 'An AI tool connected over MCP added a new tab to a document.',
  'Mcp|Used|CreateDocument': 'An AI tool connected over MCP created a new document.',
  'Mcp|Used|FindDocuments':
    "An AI tool connected over MCP searched for one of the user's documents.",
  'Mcp|Used|ReadDocument': "An AI tool connected over MCP read a document's contents.",
  'Mcp|Used|RenameDocument': 'An AI tool connected over MCP renamed a document.',
  'Mcp|Used|ShareDocument': 'An AI tool connected over MCP generated a share link for a document.',
  'Mcp|Used|UpdateDocument': "An AI tool connected over MCP updated a tab's content in a document.",
  'Note|Added|': 'A note was added to an element (first non-empty save).',
  'Note|Changed|': "An existing note's text was edited.",
  'Note|Deleted|': 'A note was cleared from an element.',
  'Note|Opened|': 'Someone opened the note popover on an element.',
  'Page|View|/': 'Someone visited the marketing homepage.',
  'Page|View|/document':
    "Someone opened a document in the editor. Every document's page counts under this same path, with no document-specific detail recorded.",
  'Page|View|/explorer': 'Someone opened the Explorer, landing on its default section.',
  'Page|View|/explorer/home': "Someone opened the Explorer's Home, its landing section.",
  'Page|View|/explorer/activity':
    "Someone opened the Explorer's old Activity address, which now opens the Inbox. The Inbox was once called Activity; its visits count under /explorer/inbox.",
  'Page|View|/explorer/inbox': "Someone navigated to the Explorer's Inbox.",
  'Page|View|/explorer/shared': "Someone navigated to the Explorer's Shared with You section.",
  'Page|View|/explorer/timeline': "Someone navigated to the Explorer's Timeline.",
  'Page|View|/features/foundations':
    "Someone visited the marketing site's Foundations features page.",
  'Page|View|/features/simple': "Someone visited the marketing site's Simple features page.",
  'Page|View|/help/canvas/links': 'Someone opened the help centre\'s "Learn about links" article.',
  'Page|View|/new': 'Someone opened the New Document wizard.',
  'Page|View|/sign-in': 'Someone opened the sign-in page.',
  'Page|View|/telemetry': 'Someone opened the public telemetry dashboard.',
  'Participant|Created|':
    'Someone visited livedocuments for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
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
    'A read-only embedded copy of a document was loaded on an outside page (for example an iframe in a wiki or a doc). Counted once per rendered embed.',
  'Session|Opened|Workbench': 'A document opened inside a developer tool’s frame, signed in.',
  'Session|Opened|WorkbenchWorkspace':
    'The Explorer opened inside a developer tool’s frame, signed in.',
  'Session|SignedIn|': 'A visitor just signed in to their account.',
  'Session|SignedOut|': 'A visitor just signed out.',
  'Session|SignedUp|': 'A visitor just created an account.',
  'Tab|Aligned|': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartDown': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|FlowchartRight': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|Mindmap': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Aligned|PageTidyUp':
    'Someone pressed Tidy on an infographic or slide page, lining up and spacing what is on it.',
  'Tab|Aligned|Tree': 'Someone tapped "Auto align" to snap a tab to the grid.',
  'Tab|Changed|PageAdded': 'Someone added an infographic page to a Pages tab.',
  'Tab|Changed|ArticleAdded': 'Someone added a new article to a Pages tab.',
  'Tab|Changed|SlidePageAdded': 'Someone added a slide page to a Pages tab.',
  'Tab|Changed|PageKindInfographic': "Someone chose Infographic for a new Pages tab's first page.",
  'Tab|Changed|PageKindArticle': "Someone chose Article for a new Pages tab's first page.",
  'Tab|Changed|PageKindSlide': "Someone chose Slide for a new Pages tab's first page.",
  'Tab|Changed|ArticleLookClean': 'Someone gave an article the Clean look.',
  'Tab|Changed|ArticleLookClassic': 'Someone gave an article the Classic look.',
  'Tab|Changed|ArticleLookReport': 'Someone gave an article the Report look.',
  'Tab|Changed|ArticleLookNotebook': 'Someone gave an article the Notebook look, on ruled pages.',
  'Tab|Changed|ArticleLookBold': 'Someone gave an article the Bold look.',
  'Tab|Changed|ArticleStyle':
    "Someone changed one part of an article's style: a font, the accent, spacing, rules, margins or page numbers.",
  'Element|Added|ArticleImage': "Someone inserted an image at the caret in an article's writing.",
  'Element|Added|ArticleTable': "Someone inserted a table at the caret in an article's writing.",
  'Element|Added|ArticleChart': "Someone inserted a chart at the caret in an article's writing.",
  'Element|Added|ArticleCallout':
    "Someone inserted a callout at the caret in an article's writing.",
  'Element|Added|ArticleSticky':
    "Someone inserted a sticky note at the caret in an article's writing.",
  'Element|Added|ArticleDrawing':
    "Someone started a drawing in an article's writing: from Insert, or by putting shapes onto the page.",
  'Element|Added|ArticleObject':
    'Someone put an object (a chart, an image, a component) onto an article page, and the writing took it in.',
  'Element|Added|ArticleDivider': "Someone inserted a divider into an article's writing.",
  'Element|Added|ArticlePageBreak': "Someone inserted a page break into an article's writing.",
  'Element|Added|ArticleQuote': "Someone inserted a quote into an article's writing.",
  'Element|Added|ArticleCode': "Someone inserted a code block into an article's writing.",
  'Element|Added|ArticleComment':
    "Someone commented on a stretch of an article's writing, a marker in the margin beside it.",
  'Element|Added|ArticleAction':
    "Someone assigned an action on a stretch of an article's writing, a marker in the margin beside it.",
  'Element|Changed|ArticleFormat':
    'Someone formatted text in an article from the page toolbar: bold, italic, underline, strikethrough, a colour or a highlight.',
  'Element|Changed|ArticleBlockStyle':
    "Someone changed a block of an article's writing to another style or a list, from the page toolbar.",
  'Element|Changed|ArticleLink': 'Someone added a link to text in an article.',
  'Element|Changed|ArticlePaste':
    'Someone pasted Markdown into an article, and it became headings, lists and formatting.',
  'Element|Changed|ArticleZoneWrap':
    "Someone changed how a picture or drawing sits in an article's writing: in line, or wrapped.",
  'Element|Changed|ArticleZoneResized':
    "Someone made a drawing in an article's writing bigger or smaller.",
  'Element|Changed|ArticleZoneFloat':
    'Someone set a picture or drawing in an article to float in front of the text.',
  'Element|Changed|ArticleZoneMoved':
    "Someone dragged a picture or drawing to a new place in an article's writing.",
  'Element|Changed|ArticleZoneRemoved':
    "Someone deleted a picture or drawing from an article's writing.",
  'Tab|Changed|PageRemoved': 'Someone deleted a page from a Pages tab.',
  'Tab|Changed|PagePortrait': 'Someone turned a page to portrait.',
  'Tab|Changed|PageLandscape': 'Someone turned a page to landscape.',
  'Tab|Changed|PageSize': 'Someone changed a page to another size.',
  'Tab|Changed|PageBackground': "Someone changed a page's background colour.",
  'Tab|Changed|PageBackgroundAnimated':
    'Someone gave a slide an animated background (aurora, starfield, waves and the like).',
  'Tab|Changed|PageBackgroundAnimatedSpeed':
    "Someone changed how fast a slide's animated background moves.",
  'Tab|Changed|PageBackgroundImage':
    'Someone put a picture behind a page, searched or uploaded, under an overlay.',
  'Tab|Changed|PagePattern': "Someone changed a page's background pattern.",
  'Tab|Changed|PageBackgroundAppliedToAll':
    "Someone gave every other page of a kind (every slide, say) one page's background at once.",
  'Tab|Changed|PageBackgroundPainted':
    "Someone painted one page's background onto another with the Format tool.",
  'Tab|Changed|PageLocked': 'Someone locked a page, so it and what is on it stay as they are.',
  'Tab|Changed|PageUnlocked': 'Someone unlocked a page.',
  'Tab|Changed|PageRenamed': 'Someone renamed a page.',
  'Tab|Changed|PageDuplicated': 'Someone duplicated a page with its content.',
  'Tab|Changed|PageMoved': 'Someone moved a page left or right in its row.',
  'Tab|Changed|PagesLaidOut':
    'Someone split a Fit to Content page into one page per group of its content.',
  'Tab|Changed|PageFitToContent':
    "A tab's board was put onto a page made around it, nothing moved, as it entered Pages mode.",
  'Tab|Changed|PageLayout': 'Someone put a ready-made layout onto a page.',
  'Tab|Changed|PageLayoutSurprise':
    "Someone pressed Surprise Me in a page's layout gallery, putting a random layout onto the page.",
  'Tab|Changed|Look':
    "Someone picked a look in Tab Look & Feel, setting the tab's theme, finish, font and canvas pattern at once.",
  'Tab|Changed|SeasonalLook':
    "Someone picked a seasonal look (New Year, Easter, Halloween or Christmas) behind the Seasonal toggle in Tab Style, setting the tab's theme, finish, font and canvas pattern at once.",
  'Tab|Changed|AllTabs':
    "Someone pressed Apply to All Tabs in Tab Style, putting the open tab's style on every other tab at once.",
  'Tab|Changed|Finish':
    "Someone changed a tab's finish (Flexible, Professional, Sketch or Marker) from Tab Look & Feel.",
  'Tab|Changed|DefaultTextSize':
    "Someone changed a tab's default text size, used for new elements added to it.",
  'Tab|Changed|Font':
    "Someone changed a tab's default font, or applied the tab's font and size to every element on it.",
  'Tab|Cleared|': "A tab's content was wiped.",
  'Tab|Created|': 'A new tab was added to a document.',
  'Tab|Deleted|': 'A tab was removed from a document.',
  'Tab|Duplicated|': 'A tab was duplicated.',
  'Tab|Linked|': 'A tab was linked into another document.',
  'Tab|Loaded|':
    "A tab's content was fetched for viewing (the first tab when a document opens, then each tab switched to).",
  'Tab|Locked|': 'A tab was locked (read-only).',
  'Tab|Moved|Folder': 'A tab was filed into a tab folder.',
  'Tab|Removed|Folder':
    "Someone took a tab out of its tab folder, making it a loose tab again, whether by dragging it out or from the tab's menu.",
  'Tab|Renamed|': 'A tab was renamed.',
  'Tab|Reordered|': 'Someone dragged a tab to a new position.',
  'Tab|Opened|SideBySideDrag':
    'Someone dragged a tab to the right edge of the screen to open it beside the tab they were editing.',
  'Tab|Opened|SideBySideMenu': "Someone opened a tab side by side from the tab's menu.",
  'Tab|Selected|SideBySideClick':
    'Someone clicked into the other side by side pane, moving the editor (its toolbars and panels) there.',
  'Tab|Selected|SideBySideHover':
    'Someone rested the pointer on the other side by side pane, and the editor followed it there.',
  'Tab|Closed|SideBySide': 'Someone closed the side by side pane, going back to one tab.',
  'Tab|Unlocked|': 'A tab was unlocked (edits resume).',
  'Team|Added|Document': "A document was added to a team's shared library.",
  'Team|Added|Member':
    'An admin invited someone to a team by email. This counts invitations sent, not accepted: that is Joined.',
  'Team|Changed|': "Someone updated a team's name or organisation in its settings.",
  'Team|Changed|Role': "An admin changed a team member's role between Admin and Member.",
  'Team|Created|': 'Someone created a new team.',
  'Team|Declined|Invite':
    'Someone turned down a team invite. Read against Joined: the two are the accept rate on an invitation.',
  'Team|Declined|Email':
    "Someone turned down a team invite from the email's Decline link, without signing in.",
  'Team|Deleted|': 'An admin deleted a team.',
  'Team|Joined|': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved|Document':
    "A document already in a team's shared library was moved: re-foldered within the team, moved to a different team, or taken back to the owner's personal space.",
  'Team|Removed|Document': 'An admin removed a member who had joined the team.',
  'Team|Removed|Link': "A team's shareable invite link was turned off.",
  'Team|Removed|Rejected':
    'An admin cleared a declined or expired team invite from the member list.',
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
    'Someone clicked "Show More" at the bottom of the Timeline, loading the next page of history.',
  'Timeline|Loaded|Retry':
    'Someone clicked "Try again" after the Timeline failed to load, retrying the read.',
  'Timeline|Opened|Landing':
    'Someone arrived at the Explorer with the Timeline as the very section that loaded.',
  'Timeline|Opened|Menu':
    'Someone opened the ⋯ menu on a Timeline card or on a collapsed run of cards.',
  'Timeline|Opened|Nav':
    "Someone went to the Timeline from elsewhere in the Explorer: its sidebar row, or Home's See Timeline link.",
  'Timeline|Opened|Card': "Someone opened a document from its card on the Explorer's Timeline.",
  'Timeline|Opened|Stack':
    'Someone expanded a collapsed run of similar Timeline entries (like "12 documents renamed") into its individual cards.',
  'Timeline|Removed|Entry': 'Someone removed a single entry from their Timeline feed.',
  'Timeline|Removed|Stack':
    'Someone removed every entry in a collapsed run from their Timeline feed at once, from its ⋯ menu.',
  'Timeline|Selected|Everyone':
    "Someone switched the Timeline's filter to show everyone's activity, not just their own.",
  'Timeline|Selected|Others':
    "Someone switched the Timeline's filter to show only other people's activity, hiding their own.",
  'Trash|Opened|Settings': 'Someone opened the Trash from Settings, under Account.',
  'Explorer|Selected|Text':
    'Someone typed words into the Explorer search to narrow a list of documents.',
  'Explorer|Selected|OpensIn':
    'Someone filtered an Explorer list by the editor mode documents open in (Diagram or Draw).',
  'Explorer|Selected|Template':
    'Someone filtered an Explorer list by the template family documents were made from (Retrospective, Kanban).',
  'Explorer|Selected|MadeBy': 'Someone filtered an Explorer list to the documents an AI made.',
  'Explorer|Selected|Edited':
    'Someone filtered an Explorer list by when documents were last edited.',
  'Explorer|Selected|People':
    'Someone filtered an Explorer list by who owns the documents (Me or Others).',
  'Explorer|Created|Tag':
    'Someone made a tag, a coloured label for grouping their documents, from the tag picker or the Tags page.',
  'Explorer|Added|Tag': 'Someone put one of their tags on a document.',
  'Explorer|Removed|Tag': 'Someone took one of their tags off a document.',
  'Explorer|Renamed|Tag': 'Someone renamed one of their tags.',
  'Explorer|Changed|TagColour': 'Someone changed the colour of one of their tags.',
  'Explorer|Deleted|Tag':
    'Someone deleted one of their tags, which takes it off every document it was on.',
  'Explorer|Selected|Space':
    'Someone filtered an aggregate Explorer list by where documents live (My Work, Shared With Me, a team).',
  'Token|Created|MCP':
    'An AI tool was connected to the account over MCP, which creates an API token for it to use.',
  'Token|Created|Manual':
    'Someone created a new personal API token by hand, from the API Tokens category in Settings.',
  'Token|Linked|Workbench': 'A token’s owner allowed a developer tool to open their documents.',
  'Token|Removed|': 'Someone revoked an API token.',
  'UI|Added|PaletteFavourite':
    'Someone added a tile to their Favourites in the shape palette. No longer recorded: the palette opens on Popular, a fixed pick.',
  'UI|Added|Slide':
    'Someone added a slide to the Slide Deck: either a fresh slide built from the current selection, or a duplicate of an existing one.',
  'UI|Changed|FormatCopies':
    'Someone toggled which style properties the format painter copies (fill, border, text, effects, or size), in the Format panel.',
  'UI|Changed|FormatMode':
    'Someone changed whether the format painter keeps applying after each use or turns off after one copy, in the Format panel.',
  'UI|Changed|LaserColour': "Someone changed the laser pointer's colour, in the Laser panel.",
  'UI|Changed|LaserEffect': "Someone changed the laser pointer's trail effect, in the Laser panel.",
  'UI|Changed|LaserTrail':
    "Someone changed how long the laser pointer's trail lingers, in the Laser panel.",
  'UI|Changed|LaserWidth': "Someone changed the laser pointer's width, in the Laser panel.",
  'UI|Changed|ElementIndicatorsTop':
    'Someone set element indicators (link, note, action, comments) to quiet icons along the top of each element, in Settings > Editor.',
  'UI|Changed|ElementIndicatorsOff':
    'Someone turned element indicators (link, note, action, comments) off, in Settings > Editor.',
  'UI|Changed|ElementIndicatorsFooter':
    'Someone set element indicators (link, note, action, comments) to a labelled row along the bottom of each element, in Settings > Editor.',
  'UI|Changed|MapSize':
    'Someone resized the minimap, in Settings > Editor. An earlier version of this event, before it recorded which size was chosen. No longer recorded.',
  'UI|Changed|MapSizeMedium': 'Someone set the minimap to its medium size, in Settings > Editor.',
  'UI|Changed|MapSizeShort': 'Someone set the minimap to its short size, in Settings > Editor.',
  'UI|Changed|MapSizeTall': 'Someone set the minimap to its tall size, in Settings > Editor.',
  'UI|Changed|PaletteFavourite':
    'Someone reordered their palette Favourites by dragging, or reset the list back to its default tiles. No longer recorded: Favourites is gone.',
  'UI|Changed|PanelLayout':
    "Someone changed the editor's panel layout, in Settings > Editor. An earlier version of this event, before it recorded which layout was chosen. No longer recorded.",
  'UI|Changed|PanelLayoutFloating':
    "Someone switched the editor's panel layout to Floating, in Settings > Editor. No longer recorded: Toolbar became the only layout.",
  'UI|Changed|PanelLayoutMinimal':
    "Someone switched the editor's panel layout to Minimal, in Settings > Editor. No longer recorded: the Minimal layout was removed.",
  'UI|Changed|PanelLayoutToolbar':
    "Someone switched the editor's panel layout to Toolbar, in Settings > Editor. No longer recorded: Toolbar became the only layout.",
  'UI|Changed|PanelOpacity':
    'Someone adjusted how see-through the panels are, on the Panel Opacity slider in Settings > Editor.',
  'UI|Changed|UiScale':
    'Someone made the panels, the toolbar and the bottom-right buttons bigger or smaller together, on the UI Scale slider in Settings > Appearance.',
  'UI|Changed|UiScalePanels':
    'Someone made just the panels bigger or smaller, on the Panel Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|UiScaleToolbar':
    'Someone made just the toolbar bigger or smaller, on the Toolbar Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|UiScaleCornerButtons':
    'Someone made just the bottom-right buttons (undo, layers, theme, zoom) bigger or smaller, on the Corner Buttons Scale slider under UI Scale in Settings > Appearance.',
  'UI|Changed|QuickSwatchCustom':
    "Someone replaced one of the quick style panel's theme colours with a colour of their own, by right-clicking the swatch.",
  'UI|Changed|QuickSwatchReset':
    'Someone put a quick style panel swatch back to its theme colour, with Clear override.',
  'UI|Changed|LooksFinishFilter':
    "Someone narrowed the Tab Style popover's Looks to one finish with its Finish filter.",
  'UI|Changed|LooksSeasonal':
    "Someone switched the Tab Style popover's Looks to the seasonal looks, with the Seasonal toggle beside the Finish filter.",
  'UI|Changed|SlideNotes':
    'Someone typed presenter notes for a slide, in the Slide Deck panel. Counted once per slide edited, not per keystroke.',
  'UI|Changed|SpotlightDim':
    'Someone changed how dark the area outside the Spotlight is, in the Spotlight panel.',
  'UI|Changed|SpotlightEdge':
    "Someone changed the Spotlight's edge softness, in the Spotlight panel.",
  'UI|Changed|SpotlightShape': "Someone changed the Spotlight's shape, in the Spotlight panel.",
  'UI|Changed|SpotlightSize': "Someone changed the Spotlight's size, in the Spotlight panel.",
  'UI|Changed|ToolbarCategory':
    'Someone opened a category in the palette strip across the top of the canvas: a category on the category bar.',
  'UI|Changed|ContentsPlacementButton':
    "Someone minimised Pages mode's Contents sidebar to its button, from the sidebar or in Settings > Editor.",
  'UI|Changed|ContentsSideLeft':
    "Someone dragged Pages mode's Contents sidebar to the canvas's left edge.",
  'UI|Changed|ContentsSideRight':
    "Someone dragged Pages mode's Contents sidebar to the canvas's right edge.",
  'UI|Changed|ContentsPlacementSidebar':
    "Someone docked Pages mode's Contents as a sidebar down the canvas's left, from its popover or in Settings > Editor.",
  'UI|Opened|EmptyPageInvite':
    'Someone pressed Choose a Layout on an empty page too small on screen for its layout card (a phone, or zoomed out).',
  'UI|Closed|EmptyPageLayouts': 'Someone hid the Start From a Layout card on an empty page.',
  'UI|Closed|Presentation': 'Someone exited presentation mode.',
  'UI|Closed|SignInBanner':
    'Someone dismissed the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Closed|SignInBannerEditor': 'Someone dismissed the guest sign-in banner shown in the editor.',
  'UI|Closed|SignInBannerExplorer':
    'Someone dismissed the guest sign-in banner shown in the Explorer.',
  'UI|Closed|PagesTourOffer':
    'Someone turned the Pages tour down with No on its own card. Nothing sends this since 25 October 2026, when tours stopped offering themselves.',
  'UI|Closed|Welcome': 'Someone dismissed the first-run welcome modal.',
  'UI|Cleared|BrowserRepair':
    "Someone used Repair This Browser on a failed document load: livedocuments's settings and caches in that browser were cleared and the page reloaded.",
  'UI|Cleared|BrowserRepair.Help':
    "Someone used Repair This Browser from the help centre's Repair page, clearing livedocuments's settings and caches in that browser.",
  'UI|Copied|Diagnostics':
    'Someone copied the diagnostics report from a failed document load, to send to support.',
  'UI|Copied|Diagnostics.Help':
    "Someone copied the browser diagnostics report from the help centre's Repair page.",
  'UI|Copied|EmbedCode':
    "Someone copied an embed URL or an iframe snippet from the Share dialog's Embed menu.",
  'UI|Copied|LiveImage':
    "Someone copied a live-updating image URL from the Share dialog's Live Image menu.",
  'UI|Copied|ShareLink': 'Someone copied a share link to the clipboard.',
  'UI|Copied|TeamInviteLink': "Someone copied a team's shareable invite link to their clipboard.",
  'UI|Ended|ShareTourCompleted': "Someone reached the end of the Share dialog's Show Me tour.",
  'UI|Ended|ShareTourSkipped': "Someone left the Share dialog's Show Me tour before its end.",
  'UI|Ended|SlideTourCompleted': "Someone reached the end of a slide page's Show Me tour.",
  'UI|Ended|SlideTourSkipped': "Someone left a slide page's Show Me tour before its end.",
  'UI|Ended|InfographicTourCompleted':
    "Someone reached the end of an infographic page's Show Me tour.",
  'UI|Ended|InfographicTourSkipped':
    "Someone left an infographic page's Show Me tour before its end.",
  'UI|Ended|ArticleTourCompleted': "Someone reached the end of an article page's Show Me tour.",
  'UI|Ended|ArticleTourSkipped': "Someone left an article page's Show Me tour before its end.",
  'UI|Ended|TabStyleTourCompleted':
    "Someone reached the end of the Tab Style dialog's Show Me tour.",
  'UI|Ended|TabStyleTourSkipped':
    "Someone left the Tab Style dialog's Show Me tour before its end.",
  'UI|Ended|LayerStackTourCompleted':
    'Someone reached the end of the Layer Stack tour, offered beside a selected layer stack.',
  'UI|Ended|LayerStackTourSkipped':
    'Someone left the Layer Stack tour before its end, or the stack it was on went away.',
  'UI|Ended|PyramidTourCompleted':
    'Someone reached the end of the Pyramid tour, offered beside a selected pyramid.',
  'UI|Ended|PyramidTourSkipped':
    'Someone left the Pyramid tour before its end, or the pyramid it was on went away.',
  'UI|Ended|FunnelTourCompleted':
    'Someone reached the end of the Funnel tour, offered beside a selected funnel.',
  'UI|Ended|FunnelTourSkipped':
    'Someone left the Funnel tour before its end, or the funnel it was on went away.',
  'UI|Ended|CycleTourCompleted':
    'Someone reached the end of the Cycle tour, offered beside a selected cycle.',
  'UI|Ended|CycleTourSkipped':
    'Someone left the Cycle tour before its end, or the cycle it was on went away.',
  'UI|Ended|HubTourCompleted':
    'Someone reached the end of the Hub and Spoke tour, offered beside a selected hub and spoke.',
  'UI|Ended|HubTourSkipped':
    'Someone left the Hub and Spoke tour before its end, or the hub and spoke it was on went away.',
  'UI|Ended|OnionTourCompleted':
    'Someone reached the end of the Onion tour, offered beside a selected onion.',
  'UI|Ended|OnionTourSkipped':
    'Someone left the Onion tour before its end, or the onion it was on went away.',
  'UI|Ended|TimelineTourCompleted':
    'Someone reached the end of the Timeline tour, offered beside a selected timeline.',
  'UI|Ended|TimelineTourSkipped':
    'Someone left the Timeline tour before its end, or the timeline it was on went away.',
  'UI|Ended|ChevronsTourCompleted':
    'Someone reached the end of the Chevrons tour, offered beside a selected chevron process.',
  'UI|Ended|ChevronsTourSkipped':
    'Someone left the Chevrons tour before its end, or the chevron process it was on went away.',
  'UI|Ended|ChartTourCompleted':
    'Someone reached the end of the Chart tour, offered beside a selected chart.',
  'UI|Ended|ChartTourSkipped':
    'Someone left the Chart tour before its end, or the chart it was on went away.',
  'UI|Ended|StackTourCompleted':
    'Someone reached the end of the Stack tour, offered beside a selected stack.',
  'UI|Ended|StackTourSkipped':
    'Someone left the Stack tour before its end, or the stack it was on went away.',
  'UI|Ended|TabWindowTourCompleted':
    'Someone reached the end of the Tab Window tour, offered beside a selected tab window.',
  'UI|Ended|TabWindowTourSkipped':
    'Someone left the Tab Window tour before its end, or the tab window it was on went away.',
  'UI|Ended|SankeyTourCompleted':
    'Someone reached the end of the Sankey tour, offered beside a selected Sankey diagram.',
  'UI|Ended|SankeyTourSkipped':
    'Someone left the Sankey tour before its end, or the diagram it was on went away.',
  'UI|Ended|SankeyFlowsTourCompleted':
    "Someone reached the end of a Sankey Flows dialog's Show Me tour.",
  'UI|Ended|SankeyFlowsTourSkipped':
    "Someone left a Sankey Flows dialog's Show Me tour before its end.",
  'UI|Ended|PagesTourCompleted':
    "Someone reached the end of the Pages tour, or a step's target never appeared and the tour finished early.",
  'UI|Ended|PagesTourSkipped': 'Someone closed the Pages tour before its end.',
  'UI|Moved|PanelDock':
    'Someone dragged a panel, such as the Map or the AI panel, to a different corner of the screen, or let it go free.',
  'UI|Moved|Slide':
    'Someone dragged a slide to a new position in the Slide Deck. Counted once per completed drag, not per position crossed.',
  'UI|Opened|ActionSignInNudge':
    'A signed-out visitor opened the "Assign action" dialog and saw the sign-in nudge, since a guest can only assign work to themself. Counted once per dialog open.',
  'UI|Opened|Activity': 'Someone expanded the since-removed Activity panel.',
  'UI|Opened|Collaborate': 'Someone opened the Collaborate panel from its bottom-bar button.',
  'UI|Opened|CanvasStyle':
    "Someone opened the tab's look-and-feel dialog on its Canvas tab, to change the background.",
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
  'UI|Opened|SettingsExperimental':
    'Someone opened the Experimental category in the Settings dialog. No longer recorded: the category is gone.',
  'UI|Opened|SettingsKeyboard': 'Someone opened the Keyboard category in the Settings dialog.',
  'UI|Opened|SettingsNotifications':
    'Someone opened the Notifications category in the Settings dialog.',
  'UI|Opened|SettingsPanels': 'Someone opened the Panels category in the Settings dialog.',
  'UI|Opened|SettingsPrivacy': 'Someone opened the Privacy category in the Settings dialog.',
  'UI|Opened|SettingsTours': 'Someone opened the Tours category in the Settings dialog.',
  'UI|Opened|SettingsTokens': 'Someone opened the API Tokens category in the Settings dialog.',
  'UI|Opened|Share': 'Someone opened the Share dialog.',
  'UI|Opened|Shortcuts': 'Someone opened the keyboard-shortcuts dialog.',
  'UI|Opened|SignInReasons':
    'Someone clicked "Learn more" on the guest sign-in banner to read why they should sign in. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Opened|SignInReasonsEditor':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the editor, opening the reasons-to-sign-in card.',
  'UI|Opened|SignInReasonsExplorer':
    'Someone clicked "Learn more" on the guest sign-in banner shown in the Explorer, opening the reasons-to-sign-in card.',
  'UI|Opened|PageContents':
    "Someone opened Pages mode's Contents: every page of the tab in a list.",
  'UI|Used|PageContentsJump': "Someone went to a page from Pages mode's Contents list.",
  'UI|Used|PageSwipe':
    'Someone turned to the next or previous page in Pages mode with a short pan or a flick, the view gliding onto it.',
  'UI|Used|PageContentsReorder':
    "Someone dragged a page to a new place in Pages mode's Contents list.",
  'UI|Added|AllPageSlides':
    "Someone added every slide page of a tab to the deck at once, from the Slide Deck's Add All Slide Pages.",
  'UI|Opened|SlideDeck':
    "Someone opened the deck-building panel: the Slide Deck tool, or a Pages tab's Slides button.",
  'UI|Opened|SlideElementDetail':
    'While presenting, someone clicked an element on the slide to read its detail, such as a note or comment, without leaving presentation mode.',
  'UI|Opened|TechGroup': "Someone opened a category inside the palette's Technology tab.",
  'UI|Opened|ThemePicker': "Someone opened the tab's look-and-feel dialog on its Theme tab.",
  'UI|Opened|ToolbarExplorer':
    'In the Toolbar panel layout, someone clicked the top-left menu button to open the Explorer as a popover.',
  'UI|Opened|ToolbarMore':
    'In the Toolbar panel layout, someone clicked "More" to see every tile in the current palette category.',
  'UI|Opened|ToolbarSearch':
    'In the Toolbar panel layout, someone opened the Search at the far right of the palette strip to find an element by name.',
  'UI|Opened|ToolbarSearchOtherModes':
    "In the Toolbar strip's Search, someone expanded the elements that other editor modes offer.",
  'UI|Opened|PowerUserOffer':
    'The one-time offer of power user mode appeared, after 20 editing days or 50 keyboard shortcuts on one device.',
  'UI|Used|PowerUserOffer': 'Someone accepted the power user mode offer, switching the mode on.',
  'UI|Declined|PowerUserOffer':
    'Someone said no thanks to the power user mode offer, or closed it.',
  'UI|Opened|NewVersionPrompt':
    'An open editor learned the server now serves a newer document format and offered "A new version of livedocuments is ready".',
  'UI|Used|NewVersionPrompt':
    'Someone pressed Reload on the new version prompt; the editor reloads once their changes are saved.',
  'UI|Opened|PagesTourOffer':
    'The Pages tour was offered: as its own card the first time someone worked in Pages mode, or replayed from Settings\' Tours › "Pages Tour". Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|LayerStackTourOffer':
    'The Layer Stack tour was offered, as a small Tour toolbar beside a selected layer stack (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|PyramidTourOffer':
    'The Pyramid tour was offered, as a small Tour toolbar beside a selected pyramid (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|FunnelTourOffer':
    'The Funnel tour was offered, as a small Tour toolbar beside a selected funnel (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|CycleTourOffer':
    'The Cycle tour was offered, as a small Tour toolbar beside a selected cycle (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|HubTourOffer':
    'The Hub and Spoke tour was offered, as a small Tour toolbar beside a selected hub and spoke (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|OnionTourOffer':
    'The Onion tour was offered, as a small Tour toolbar beside a selected onion (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|TimelineTourOffer':
    'The Timeline tour was offered, as a small Tour toolbar beside a selected timeline (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|ChevronsTourOffer':
    'The Chevrons tour was offered, as a small Tour toolbar beside a selected chevron process (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|ChartTourOffer':
    'The Chart tour was offered, as a small Tour toolbar beside a selected chart (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|StackTourOffer':
    'The Stack tour was offered, as a small Tour toolbar beside a selected stack (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|TabWindowTourOffer':
    'The Tab Window tour was offered, as a small Tour toolbar beside a selected tab window (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|SankeyTourOffer':
    'The Sankey tour was offered, as a small Tour toolbar beside a selected Sankey diagram (counted once per visit). Since 25 October 2026 this counts the Start Tour button in the footer showing it, once per page load: tours no longer offer themselves.',
  'UI|Opened|activity':
    "Someone opened the help article about the Explorer's Inbox, from a help link or a search result.",
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
    "Someone opened the help article explaining the editor's since-removed Activity panel (the change-log panel, not the Explorer section), from a help link or a search result.",
  'UI|Opened|your-first-diagram':
    'Someone opened the help article about building their first diagram, from the empty-canvas banner or a search result.',
  'UI|Removed|PaletteFavourite':
    'Someone removed a tile from their Favourites in the shape palette. No longer recorded: Favourites is gone.',
  'UI|Removed|Slide': 'Someone deleted a slide from the Slide Deck.',
  'UI|Searched|IconSearch': "Someone searched within the palette's Icons tab.",
  'UI|Searched|PaletteSearch':
    'Someone searched within their Favourites in the palette. No longer recorded: Favourites is gone.',
  // The Inbox was once the Activity row (docs/specs/013-workspace/explorer-structure.md#telemetry).
  'UI|Selected|Sidebar.Activity':
    "Someone picked the Activity row in the Explorer's sidebar, the row since renamed Inbox. No longer recorded: the row now counts as Inbox.",
  'UI|Selected|ExplorerPanel.Activity':
    "Someone picked the Activity row in the editor's Explorer panel, the row since renamed Inbox. No longer recorded: the row now counts as Inbox.",
  'UI|Selected|LiveImageTab':
    "Someone picked a specific tab from the dropdown in the Share dialog's Live Image menu, pointing the live-updating image at that tab instead of the default.",
  'UI|Selected|SignInBanner':
    'Someone clicked "Sign in" on the guest sign-in banner. An earlier version of this event, before it recorded which surface (the editor or the Explorer) showed the banner. No longer recorded.',
  'UI|Selected|SignInBannerEditor':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the editor.',
  'UI|Selected|SignInBannerExplorer':
    'Someone clicked "Sign in" on the guest sign-in banner shown in the Explorer.',
  'UI|Started|Presentation': 'Someone started presenting: entering full-screen slideshow mode.',
  'UI|Started|SlideTour':
    "Someone pressed Show Me in a slide page's panel, starting its tour of layouts, backgrounds, the deck and presenting.",
  'UI|Started|InfographicTour':
    "Someone pressed Show Me in an infographic page's panel, starting its tour of layouts, backgrounds and page size.",
  'UI|Started|ArticleTour':
    "Someone pressed Show Me in an article page's panel, starting its tour of writing and article style.",
  'UI|Started|TabStyleTour':
    'Someone pressed Show Me in the Tab Style dialog, starting its tour of looks and fine-tuning.',
  'UI|Started|LayerStackTour':
    'Someone pressed Play on the Tour toolbar beside a selected layer stack, starting its tour.',
  'UI|Started|PyramidTour':
    'Someone pressed Play on the Tour toolbar beside a selected pyramid, starting its tour.',
  'UI|Started|FunnelTour':
    'Someone pressed Play on the Tour toolbar beside a selected funnel, starting its tour.',
  'UI|Started|CycleTour':
    'Someone pressed Play on the Tour toolbar beside a selected cycle, starting its tour.',
  'UI|Started|HubTour':
    'Someone pressed Play on the Tour toolbar beside a selected hub and spoke, starting its tour.',
  'UI|Started|OnionTour':
    'Someone pressed Play on the Tour toolbar beside a selected onion, starting its tour.',
  'UI|Started|TimelineTour':
    'Someone pressed Play on the Tour toolbar beside a selected timeline, starting its tour.',
  'UI|Started|ChevronsTour':
    'Someone pressed Play on the Tour toolbar beside a selected chevron process, starting its tour.',
  'UI|Started|ChartTour':
    'Someone pressed Play on the Tour toolbar beside a selected chart, starting its tour.',
  'UI|Started|StackTour':
    'Someone pressed Play on the Tour toolbar beside a selected stack, starting its tour.',
  'UI|Started|TabWindowTour':
    'Someone pressed Play on the Tour toolbar beside a selected tab window, starting its tour.',
  'UI|Started|SankeyTour':
    'Someone pressed Play on the Tour toolbar beside a selected Sankey diagram, starting its tour.',
  'UI|Started|SankeyFlowsTour':
    "Someone pressed Show Me in a Sankey's Flows dialog, starting its tour of writing flows.",
  'UI|Started|ShareTour':
    'Someone pressed Show Me in the Share dialog, starting its tour of issuing and managing passes.',
  'UI|Started|PagesTour':
    "Someone pressed Yes on the Pages tour's first card, beginning its walkthrough of the pages.",
  'UI|Toggled|ActivityRevertPreviewOff':
    'Someone turned off the hover preview that showed what a change would look like before reverting it, in the since-removed Activity panel settings.',
  'UI|Toggled|ActivityRevertPreviewOn':
    'Someone turned on the hover preview that showed what a change would look like before reverting it, in the since-removed Activity panel settings.',
  'UI|Toggled|AlignmentGuidesOff':
    'Someone turned off the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AlignmentGuidesOn':
    'Someone turned on the alignment guides that appear while dragging elements, in Settings > Editor.',
  'UI|Toggled|AutoRebindOff': 'Someone turned off auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|AutoRebindOn': 'Someone turned on auto-attach for arrows, in Settings > Editor.',
  'UI|Toggled|Dark': "Someone set the editor's appearance to Dark.",
  'UI|Toggled|ExplorerViewCard':
    'Someone switched the Explorer to Card view, showing a large preview of each document.',
  'UI|Toggled|ExplorerViewDetails':
    'Someone switched the Explorer to Details view, a sortable table of type, comments, access, size and dates.',
  'UI|Toggled|ExplorerViewList':
    'Someone switched the Explorer to List view, showing documents as compact rows.',
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
    'Someone switched the panel layout back to Floating, from the quick toggle rather than the Settings dialog. No longer recorded: the Minimal layout was removed.',
  'UI|Toggled|MinimalPanelsOn':
    'Someone switched the panel layout to Minimal, from the quick toggle rather than the Settings dialog. No longer recorded: the Minimal layout was removed.',
  'UI|Toggled|MinimapOff': 'Someone turned off the minimap, in Settings > Editor.',
  'UI|Toggled|DockButtonNamesOff':
    'Someone turned off Button Labels in Settings > Appearance, so the bottom-right buttons show icons alone on a wide desktop.',
  'UI|Toggled|DockButtonNamesOn':
    'Someone turned Button Labels back on in Settings > Appearance, naming the bottom-right buttons beside their icons on a wide desktop.',
  'UI|Toggled|MinimapOn': 'Someone turned on the minimap, in Settings > Editor.',
  'UI|Toggled|HomeBannerOff':
    "Someone hid Explorer Home's banner, from its close button or Settings > Documents. Home then opens on its page header.",
  'UI|Toggled|HomeBannerOn':
    "Someone turned Explorer Home's banner back on, in Settings > Documents.",
  'UI|Toggled|NotificationsOff':
    'Someone turned off in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotificationsOn':
    'Someone turned on in-editor toast notifications, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOff':
    'Someone turned off the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|NotifyActionAssignedOn':
    'Someone turned on the email that arrives when a teammate assigns them an action, in Settings > Notifications.',
  'UI|Toggled|NotifyMentionsOff':
    'Someone turned off the email that arrives when a teammate @-mentions them in a comment, in Settings > Notifications.',
  'UI|Toggled|NotifyMentionsOn':
    'Someone turned on the email that arrives when a teammate @-mentions them in a comment, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOff':
    'Someone turned off the email that arrives when someone comments on a document they own, in Settings > Notifications.',
  'UI|Toggled|NotifyCommentsOn':
    'Someone turned on the email that arrives when someone comments on a document they own, in Settings > Notifications.',
  'UI|Toggled|NotifyDocumentJoinOff':
    'Someone turned off the email that arrives when a new person opens one of their shared documents, in Settings > Notifications.',
  'UI|Toggled|NotifyDocumentJoinOn':
    'Someone turned on the email that arrives when a new person opens one of their shared documents, in Settings > Notifications.',
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
    'Someone entered reordering or editing mode for their palette Favourites. No longer recorded: Favourites is gone.',
  'UI|Toggled|PatternExport':
    "Someone turned on painting the tab's background pattern into an exported image.",
  'UI|Toggled|QuickAddHoverOff':
    'Someone turned off quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|QuickAddHoverOn':
    'Someone turned on quick-add on hover in the palette, in Settings > Editor.',
  'UI|Toggled|PagesModeOff':
    'Someone turned off Pages mode, in Settings > Experimental. No longer recorded: Pages mode is always offered.',
  'UI|Toggled|PagesModeOn':
    'Someone turned on Pages mode, in Settings > Experimental. No longer recorded: Pages mode is always offered.',
  'UI|Toggled|PlanModeOff':
    'Someone turned off Plan mode, in Settings > Experimental. No longer recorded: Plan mode is always offered.',
  'UI|Toggled|PlanModeOn':
    'Someone turned on Plan mode, in Settings > Experimental. No longer recorded: Plan mode is always offered.',
  'UI|Toggled|ReduceMotionOff': 'Someone turned off reduced motion, in Settings > Accessibility.',
  'UI|Toggled|ReduceMotionOn': 'Someone turned on reduced motion, in Settings > Accessibility.',
  'UI|Toggled|HideCursorsOff':
    "Someone turned off Hide Participant Cursors, in Settings > Collaborate or the Collaborators window, so other people's cursors show on their screen again.",
  'UI|Toggled|HideCursorsOn':
    "Someone turned on Hide Participant Cursors, in Settings > Collaborate or the Collaborators window, so other people's cursors stop showing on their screen.",
  'UI|Toggled|ShortcutsOff': 'Someone turned off keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|ShortcutsOn': 'Someone turned on keyboard shortcuts, in Settings > Keyboard.',
  'UI|Toggled|SkipLocationStepOff':
    'Someone turned off skipping the Location step, in Settings > Documents, so the New Document wizard asks where each document goes again.',
  'UI|Toggled|SkipLocationStepOn':
    'Someone ticked "Always save new documents in <place> and skip this step" on the New Document wizard\'s Location step.',
  'UI|Toggled|SlideHidden':
    'Someone hid a slide from the presentation run, without deleting it, in the Slide Deck panel.',
  'UI|Toggled|SlideShown':
    'Someone unhid a slide, putting it back into the presentation run, in the Slide Deck panel.',
  'UI|Toggled|System': "Someone set the editor's appearance to follow the system.",
  'UI|Toggled|TemplateModeAll':
    'Someone set the New Document template filter back to Everything, showing templates for every mode.',
  'UI|Toggled|TemplateModeDiagram':
    'Someone narrowed the New Document templates to the ones that open in Diagram mode.',
  'UI|Toggled|TemplateModeDraw':
    'Someone narrowed the New Document templates to the ones that open in Draw mode.',
  'UI|Toggled|TemplateModePages':
    'Someone narrowed the New Document templates to the ones that open in Pages mode.',
  'UI|Toggled|TemplateModePlan':
    'Someone narrowed the New Document templates to the ones that open in Plan mode.',
  'UI|Toggled|TemplateModeWorkshop':
    'Someone narrowed the New Document templates to the ones that open in Workshop mode.',
  'UI|Toggled|TemplateShelfCollapsed':
    'Someone put the New Document template shelf back to a carousel, with the other categories as a grid.',
  'UI|Toggled|TemplateShelfExpanded':
    'Someone expanded the New Document template shelf to show every template in the category, with the other categories as a carousel.',
  'UI|Toggled|TelemetryOff':
    'Someone opted out of sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|TelemetryOn':
    'Someone opted in to sending anonymous usage events, in Settings > Privacy.',
  'UI|Toggled|PagesTourSeenOff':
    'Someone switched on Tours › "Pages Tours" in Settings (the switch over every kind of page; "Pages Tour" until October 2026), so every kind\'s Pages tour is offered again.',
  'UI|Toggled|PagesTourSeenOn':
    'Someone switched off Tours › "Pages Tours" in Settings (the switch over every kind of page; "Pages Tour" until October 2026), answering every kind\'s Pages tour.',
  'UI|Toggled|SlidesTourSeenOff':
    'Someone switched on Tours › "Slides Tour" in Settings, so the Pages tour\'s slides track is offered again.',
  'UI|Toggled|SlidesTourSeenOn':
    'Someone switched off Tours › "Slides Tour" in Settings, marking the Pages tour\'s slides track as answered.',
  'UI|Toggled|InfographicTourSeenOff':
    'Someone switched on Tours › "Infographic Tour" in Settings, so the Pages tour\'s infographic track is offered again.',
  'UI|Toggled|InfographicTourSeenOn':
    'Someone switched off Tours › "Infographic Tour" in Settings, marking the Pages tour\'s infographic track as answered.',
  'UI|Toggled|ArticleTourSeenOff':
    'Someone switched on Tours › "Article Tour" in Settings, so the Pages tour\'s article track is offered again.',
  'UI|Toggled|ArticleTourSeenOn':
    'Someone switched off Tours › "Article Tour" in Settings, marking the Pages tour\'s article track as answered.',
  'UI|Toggled|ElementToursSeenOff':
    'Someone switched on Tours › Element Tours in Settings, so every element tour is offered again.',
  'UI|Toggled|ElementToursSeenOn':
    'Someone switched off Tours › Element Tours in Settings, so no element tour is offered.',
  'UI|Toggled|LayerStackTourSeenOff':
    'Someone switched on Tours › Element Tours › "Layer Stack Tour" in Settings, so it is offered again.',
  'UI|Toggled|LayerStackTourSeenOn':
    'Someone switched off Tours › Element Tours › "Layer Stack Tour" in Settings, so it is not offered.',
  'UI|Toggled|PyramidTourSeenOff':
    'Someone switched on Tours › Element Tours › "Pyramid Tour" in Settings, so it is offered again.',
  'UI|Toggled|PyramidTourSeenOn':
    'Someone switched off Tours › Element Tours › "Pyramid Tour" in Settings, so it is not offered.',
  'UI|Toggled|FunnelTourSeenOff':
    'Someone switched on Tours › Element Tours › "Funnel Tour" in Settings, so it is offered again.',
  'UI|Toggled|FunnelTourSeenOn':
    'Someone switched off Tours › Element Tours › "Funnel Tour" in Settings, so it is not offered.',
  'UI|Toggled|CycleTourSeenOff':
    'Someone switched on Tours › Element Tours › "Cycle Tour" in Settings, so it is offered again.',
  'UI|Toggled|CycleTourSeenOn':
    'Someone switched off Tours › Element Tours › "Cycle Tour" in Settings, so it is not offered.',
  'UI|Toggled|HubTourSeenOff':
    'Someone switched on Tours › Element Tours › "Hub and Spoke Tour" in Settings, so it is offered again.',
  'UI|Toggled|HubTourSeenOn':
    'Someone switched off Tours › Element Tours › "Hub and Spoke Tour" in Settings, so it is not offered.',
  'UI|Toggled|OnionTourSeenOff':
    'Someone switched on Tours › Element Tours › "Onion Tour" in Settings, so it is offered again.',
  'UI|Toggled|OnionTourSeenOn':
    'Someone switched off Tours › Element Tours › "Onion Tour" in Settings, so it is not offered.',
  'UI|Toggled|TimelineTourSeenOff':
    'Someone switched on Tours › Element Tours › "Timeline Tour" in Settings, so it is offered again.',
  'UI|Toggled|TimelineTourSeenOn':
    'Someone switched off Tours › Element Tours › "Timeline Tour" in Settings, so it is not offered.',
  'UI|Toggled|ChevronsTourSeenOff':
    'Someone switched on Tours › Element Tours › "Chevrons Tour" in Settings, so it is offered again.',
  'UI|Toggled|ChevronsTourSeenOn':
    'Someone switched off Tours › Element Tours › "Chevrons Tour" in Settings, so it is not offered.',
  'UI|Toggled|ChartTourSeenOff':
    'Someone switched on Tours › Element Tours › "Chart Tour" in Settings, so it is offered again.',
  'UI|Toggled|ChartTourSeenOn':
    'Someone switched off Tours › Element Tours › "Chart Tour" in Settings, so it is not offered.',
  'UI|Toggled|StackTourSeenOff':
    'Someone switched on Tours › Element Tours › "Stack Tour" in Settings, so it is offered again.',
  'UI|Toggled|StackTourSeenOn':
    'Someone switched off Tours › Element Tours › "Stack Tour" in Settings, so it is not offered.',
  'UI|Toggled|TabWindowTourSeenOff':
    'Someone switched on Tours › Element Tours › "Tab Window Tour" in Settings, so it is offered again.',
  'UI|Toggled|TabWindowTourSeenOn':
    'Someone switched off Tours › Element Tours › "Tab Window Tour" in Settings, so it is not offered.',
  'UI|Toggled|SankeyTourSeenOff':
    'Someone switched on Tours › Element Tours › "Sankey Diagram Tour" in Settings, so it is offered again.',
  'UI|Toggled|SankeyTourSeenOn':
    'Someone switched off Tours › Element Tours › "Sankey Diagram Tour" in Settings, so it is not offered.',
  'UI|Toggled|LandscapeBarsOff':
    'Someone folded the header and the tab bar away again from the handle on a phone held sideways, giving the canvas the whole screen.',
  'UI|Toggled|LandscapeBarsOn':
    'Someone showed the header and the tab bar from the handle on a phone held sideways, where they fold away so the canvas fills the screen.',
  'UI|Toggled|ZenModeOff': "Someone turned off zen mode, restoring the editor's chrome.",
  'UI|Toggled|ZenModeOn':
    "Someone turned on zen mode, hiding the editor's chrome for a distraction-free canvas.",
  'UI|Used|TemplateLink':
    'Someone landed on the New Document page through a link that skips the wizard and goes straight into a specific template.',
  'UI|View|PagesTourStepPageName':
    'The Pages tour reached its "Your Pages" step, on the first page\'s name.',
  'UI|View|PagesTourStepPageSettings':
    'The Pages tour reached its "Page Settings" step, on the first page\'s cog.',
  'UI|View|PagesTourStepAddPage':
    'The Pages tour reached its "Add a Page" step, on the + after the last page.',
  'UI|View|PagesTourStepSlides':
    'The Pages tour reached its "Slides" step, on the Slides button in the bottom-right cluster.',
  'UI|View|PagesTourStepOutro':
    'The Pages tour reached its closing "You\'re ready to make pages" card.',
  'UI|View|PagesTourStepSlideLayouts':
    'The Pages tour\'s slides track reached its "Choose a Layout" step, with the slide\'s Layout popover open.',
  'UI|View|PagesTourStepSlideBackground':
    'The Pages tour\'s slides track reached its "Change the Background" step, with the slide\'s Background popover open.',
  'UI|View|PagesTourStepSlideDeck':
    'The Pages tour\'s slides track reached its "Add It to the Deck" step, on the slide\'s deck button (retired in October 2026 for the speaker notes step: every slide of a deck is in it already).',
  'UI|View|PagesTourStepSlideNotes':
    'The Pages tour\'s slides track reached its "Write Your Speaker Notes" step, with the slide\'s notes popover open.',
  'UI|View|PagesTourStepSlideAddPage':
    'The Pages tour\'s slides track reached its "Add Another Slide" step, on the + after the last page.',
  'UI|View|PagesTourStepSlidePresent':
    'The Pages tour\'s slides track reached its "Present" step, with the Slide Deck open.',
  'UI|View|PagesTourStepSlideOutro':
    'The Pages tour\'s slides track reached its closing "You\'re ready to present" card.',
  'UI|View|PagesTourStepInfographicPageName':
    'The Pages tour\'s infographic track reached its "Your Page" step, on the page\'s name.',
  'UI|View|PagesTourStepInfographicLayouts':
    'The Pages tour\'s infographic track reached its "Start From a Layout" step, with the page\'s Layout popover open.',
  'UI|View|PagesTourStepInfographicBackground':
    'The Pages tour\'s infographic track reached its "Change the Background" step, with the page\'s Background popover open.',
  'UI|View|PagesTourStepInfographicPageSize':
    'The Pages tour\'s infographic track reached its "Page Size" step, with the page\'s settings open.',
  'UI|View|PagesTourStepInfographicAddPage':
    'The Pages tour\'s infographic track reached its "Add a Page" step, on the + after the last page.',
  'UI|View|PagesTourStepInfographicPresent':
    'The Pages tour\'s infographic track reached its "Present It" step, with the Slide Deck open.',
  'UI|View|PagesTourStepInfographicOutro':
    'The Pages tour\'s infographic track reached its closing "You\'re ready to make pages" card.',
  'UI|View|PagesTourStepArticleWrite':
    'The Pages tour\'s article track reached its "Write on the Page" step, on the article page.',
  'UI|View|PagesTourStepArticleToolbar':
    'The Pages tour\'s article track reached its "The Page Toolbar" step.',
  'UI|View|PagesTourStepArticleStyle':
    'The Pages tour\'s article track reached its "Article Style" step, with the page\'s Style settings open.',
  'UI|View|PagesTourStepArticleText':
    'The Pages tour\'s article track reached its "Fonts and Spacing" step, with the page\'s Text settings open.',
  'UI|View|PagesTourStepArticleOutro':
    'The Pages tour\'s article track reached its closing "You\'re ready to write" card.',
  'UI|View|LayerStackTourStepLayers':
    'The Layer Stack tour reached its "One Element, Many Layers" step, on the whole stack.',
  'UI|View|LayerStackTourStepEdit':
    'The Layer Stack tour reached its "Type Over a Layer" step, on the top layer\'s name.',
  'UI|View|LayerStackTourStepNotes':
    'The Layer Stack tour reached its "Side Notes" step, on a layer\'s side note.',
  'UI|View|LayerStackTourStepAdd':
    'The Layer Stack tour reached its "Add a Layer" step, with the "+" ring open on Add Layer.',
  'UI|View|LayerStackTourStepRows':
    'The Layer Stack tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|LayerStackTourStepColours':
    'The Layer Stack tour reached its "One Colour, a Whole Ramp" step, on the bottom layer.',
  'UI|View|LayerStackTourStepAnimate':
    'The Layer Stack tour reached its "Build It Up" step, playing the Build animation on the stack.',
  'UI|View|LayerStackTourStepOutro':
    'The Layer Stack tour reached its closing "That Is a Layer Stack" card.',
  'UI|View|PyramidTourStepTiers':
    'The Pyramid tour reached its "Tiers Cut From One Triangle" step, on the whole pyramid.',
  'UI|View|PyramidTourStepEdit':
    'The Pyramid tour reached its "Type Over a Tier" step, on the first tier\'s name.',
  'UI|View|PyramidTourStepAdd':
    'The Pyramid tour reached its "Add a Tier" step, with the "+" ring open on Add Tier.',
  'UI|View|PyramidTourStepShape':
    'The Pyramid tour reached its "Pyramid, Inverted or Funnel" step, on the selection toolbar\'s More button.',
  'UI|View|PyramidTourStepColours':
    'The Pyramid tour reached its "From the Accent Down" step, on the last tier.',
  'UI|View|PyramidTourStepAnimate':
    'The Pyramid tour reached its Build step, playing the Build animation on the pyramid.',
  'UI|View|PyramidTourStepOutro': 'The Pyramid tour reached its closing card.',
  'UI|View|FunnelTourStepStages':
    'The Funnel tour reached its "Narrowing Stage by Stage" step, on the whole funnel.',
  'UI|View|FunnelTourStepEdit':
    'The Funnel tour reached its "Type Over a Stage" step, on the first band\'s name.',
  'UI|View|FunnelTourStepValues':
    'The Funnel tour reached its "A Number on Each Band" step, on a band\'s value.',
  'UI|View|FunnelTourStepAdd':
    'The Funnel tour reached its "Add a Stage" step, with the "+" ring open on Add Tier.',
  'UI|View|FunnelTourStepShape':
    'The Funnel tour reached its "Funnel, Pyramid or Inverted" step, on the selection toolbar\'s More button.',
  'UI|View|FunnelTourStepColours':
    'The Funnel tour reached its "From the Accent Down" step, on the last band.',
  'UI|View|FunnelTourStepAnimate':
    'The Funnel tour reached its "Pour It In" step, playing the Build animation on the funnel.',
  'UI|View|FunnelTourStepOutro': 'The Funnel tour reached its closing "That Is a Funnel" card.',
  'UI|View|CycleTourStepLoop':
    'The Cycle tour reached its "A Loop, Clockwise" step, on the whole cycle.',
  'UI|View|CycleTourStepFirst':
    'The Cycle tour reached its "Where It Starts" step, on the first step.',
  'UI|View|CycleTourStepCentre':
    'The Cycle tour reached its "Name the Loop" step, on the words in the middle.',
  'UI|View|CycleTourStepAdd':
    'The Cycle tour reached its "Add a Step" step, with the "+" ring open on Add Step.',
  'UI|View|CycleTourStepRows':
    'The Cycle tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|CycleTourStepAnimate':
    'The Cycle tour reached its "Set It Turning" step, playing the Flow animation on the cycle.',
  'UI|View|CycleTourStepOutro': 'The Cycle tour reached its closing "That Is a Cycle" card.',
  'UI|View|HubTourStepHub':
    'The Hub and Spoke tour reached its "One Thing in the Middle" step, on the hub.',
  'UI|View|HubTourStepSatellites':
    'The Hub and Spoke tour reached its "Round It, Clockwise" step, on the whole hub and spoke.',
  'UI|View|HubTourStepEdit':
    'The Hub and Spoke tour reached its "Type Over a Satellite" step, on the first satellite.',
  'UI|View|HubTourStepAdd':
    'The Hub and Spoke tour reached its "Add a Satellite" step, with the "+" ring open on Add Satellite.',
  'UI|View|HubTourStepSpokes':
    'The Hub and Spoke tour reached its "Spokes or None" step, on the selection toolbar\'s More button.',
  'UI|View|HubTourStepAnimate':
    'The Hub and Spoke tour reached its "Light Them Up" step, playing the Pulse animation on the hub.',
  'UI|View|HubTourStepOutro':
    'The Hub and Spoke tour reached its closing "That Is a Hub and Spoke" card.',
  'UI|View|OnionTourStepRings':
    'The Onion tour reached its "Nested, Not Overlapping" step, on the whole onion.',
  'UI|View|OnionTourStepCore': 'The Onion tour reached its "The Core" step, on the core\'s name.',
  'UI|View|OnionTourStepOuter':
    'The Onion tour reached its "Outward From There" step, on the outermost ring\'s name.',
  'UI|View|OnionTourStepAdd':
    'The Onion tour reached its "Add a Ring" step, with the "+" ring open on Add Ring.',
  'UI|View|OnionTourStepRows':
    'The Onion tour reached its "Reorder in the Menu" step, on the selection toolbar\'s More button.',
  'UI|View|OnionTourStepAnimate':
    'The Onion tour reached its "Ripple Outward" step, playing the Pulse animation on the onion.',
  'UI|View|OnionTourStepOutro': 'The Onion tour reached its closing "That Is an Onion" card.',
  'UI|View|TimelineTourStepLine':
    'The Timeline tour reached its "Along One Line" step, on the whole timeline.',
  'UI|View|TimelineTourStepName':
    'The Timeline tour reached its "What Happens" step, on the first milestone\'s name.',
  'UI|View|TimelineTourStepWhen':
    'The Timeline tour reached its "And When" step, on the first milestone\'s when.',
  'UI|View|TimelineTourStepAdd':
    'The Timeline tour reached its "Add a Milestone" step, the "+" ring open on Add Milestone.',
  'UI|View|TimelineTourStepRows':
    'The Timeline tour reached its "Reorder in the Menu" step, on More.',
  'UI|View|TimelineTourStepAnimate':
    'The Timeline tour reached its "Play It in Order" step, previewing Build.',
  'UI|View|TimelineTourStepOutro':
    'The Timeline tour reached its closing "That Is a Timeline" card.',
  'UI|View|ChevronsTourStepStages':
    'The Chevrons tour reached its "Stages, Left to Right" step, on the whole process.',
  'UI|View|ChevronsTourStepEdit':
    'The Chevrons tour reached its "Type Over a Stage" step, on the first stage\'s name.',
  'UI|View|ChevronsTourStepBar':
    'The Chevrons tour reached its "Each Stage\'s Own Bar" step, with a stage\'s bar held open.',
  'UI|View|ChevronsTourStepNotes':
    'The Chevrons tour reached its "A Note Under Each" step, on a stage\'s note.',
  'UI|View|ChevronsTourStepAdd':
    'The Chevrons tour reached its "Add a Stage" step, with the "+" ring open on Add Stage.',
  'UI|View|ChevronsTourStepAnimate':
    'The Chevrons tour reached its "Run the Pipeline" step, playing the Pulse animation on the process.',
  'UI|View|ChevronsTourStepOutro':
    'The Chevrons tour reached its closing "That Is a Chevron Process" card.',
  'UI|View|ChartTourStepChart':
    'The Chart tour reached its first step, how a chart is sized by value.',
  'UI|View|ChartTourStepReadout':
    "The Chart tour reached its step on reading a mark's label and value.",
  'UI|View|ChartTourStepAnimate': 'The Chart tour reached its step previewing Grow on the chart.',
  'UI|View|ChartTourStepMenu':
    "The Chart tour reached its step on the chart's menu (Chart Type, Data, Chart).",
  'UI|View|ChartTourStepData': 'The Chart tour reached its step on the Chart Data grid.',
  'UI|View|ChartTourStepSeries':
    'The Chart tour reached its step on the series across the top of Chart Data.',
  'UI|View|ChartTourStepAddRow': 'The Chart tour reached its step on Add Row in Chart Data.',
  'UI|View|ChartTourStepImport': 'The Chart tour reached its step on Import CSV in Chart Data.',
  'UI|View|ChartTourStepOutro': 'The Chart tour reached its closing card.',
  'UI|View|StackTourStepStack':
    'The Stack tour reached its first step, how a stack lays itself out.',
  'UI|View|StackTourStepChild':
    'The Stack tour reached its step on dragging a child to a new slot.',
  'UI|View|StackTourStepDrop':
    'The Stack tour reached its step on dropping things into an empty stack.',
  'UI|View|StackTourStepCarry':
    'The Stack tour reached its step on a stack carrying what it holds.',
  'UI|View|StackTourStepMenu': 'The Stack tour reached its step on the Stack menu.',
  'UI|View|StackTourStepOutro': 'The Stack tour reached its closing card.',
  'UI|View|TabWindowTourStepWindow':
    'The Tab Window tour reached its first step, another tab drawn live.',
  'UI|View|TabWindowTourStepOpen': 'The Tab Window tour reached its step on its Open button.',
  'UI|View|TabWindowTourStepChoose':
    'The Tab Window tour reached its step on its Choose a Tab button.',
  'UI|View|TabWindowTourStepMenu': 'The Tab Window tour reached its step on the Tab Window menu.',
  'UI|View|TabWindowTourStepSize': 'The Tab Window tour reached its step on resizing it.',
  'UI|View|TabWindowTourStepOutro': 'The Tab Window tour reached its closing card.',
  'UI|View|SankeyTourStepBands':
    'The Sankey tour reached its "Bands Carry Amounts" step, lifting the widest band of the diagram.',
  'UI|View|SankeyTourStepLeftover':
    'The Sankey tour reached its "What Is Left Over" step, lifting a leftover band.',
  'UI|View|SankeyTourStepStyle':
    'The Sankey tour reached its "Style It" step, on the selection toolbar\'s More button.',
  'UI|View|SankeyTourStepFlows':
    'The Sankey tour reached its "Write the Flows" step, on the whole diagram.',
  'UI|View|SankeyTourStepFlowsNodes':
    'The Sankey tour reached its "Your Nodes" step, inside the Flows dialog it opened.',
  'UI|View|SankeyTourStepFlowsRows':
    'The Sankey tour reached its "Flows, Step by Step" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsAdd':
    'The Sankey tour reached its "Add a Flow" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsBalance':
    'The Sankey tour reached its "In and Out Differ" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsText':
    'The Sankey tour reached its "Or Type Them" step, on the Flows dialog\'s Text tab.',
  'UI|View|SankeyTourStepFlowsImport':
    'The Sankey tour reached its "Import a File" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepFlowsPreview':
    'The Sankey tour reached its "Live Preview" step, inside the Flows dialog.',
  'UI|View|SankeyTourStepOutro': 'The Sankey tour reached its closing "That Is a Sankey" card.',
  'Document|Shared|ExpiryMonth':
    'Someone set a share link to expire after a month, when making it.',
  'Document|Shared|ExpirySixMonths':
    'Someone set a share link to expire after six months, when making it.',
  'Document|Shared|TabScoped': 'Someone made a share link that opens on one tab only.',
  'Document|Shared|Rescoped': 'Someone changed which tab an existing share link opens on.',
  'Document|Joined|View':
    'Someone came into a document through a view-only share link. Counted once per person per document, not on every revisit.',
  'Folder|Changed|Kind':
    'Someone chose a default folder: where new documents land when they pick no place.',
  'Folder|Changed|Template':
    'Someone chose a default folder for one template family: where new documents from it land.',
  'Folder|Cleared|Kind':
    'Someone cleared a default folder, so new documents land in My Work again.',
  'Folder|Cleared|Template':
    "Someone cleared a template family's default folder, so its new documents land in My Work again.",
  'Trash|Deleted|Personal':
    'Someone deleted one of their own documents in the Trash for good, before its 30 days were up.',
  'Trash|Deleted|Team':
    "Someone deleted a team's document in the Trash for good, before its 30 days were up.",
  'Trash|Cleared|Personal':
    'Someone emptied their own Trash, deleting every document in it for good.',
  'Trash|Cleared|Team': "Someone emptied a team's Trash, deleting every document in it for good.",
  'Trash|Restored|Personal':
    'Someone brought one of their own deleted documents back, putting it back where it was.',
  'Trash|Restored|Team':
    "Someone brought a team's deleted document back, putting it back where it was.",
  'Team|Removed|Member': 'An admin removed a member who had joined the team.',
  'Team|Removed|Invite': 'An admin withdrew a pending team invite.',
};

export const BY_ACTION: Readonly<Record<string, string>> = {
  'Timing|Measured':
    'A key moment was timed: a document opening, a tab switch, a save, the live room connecting, or a page loading. Only the range it fell in is recorded, never the exact time.',
  'Element|Created': 'Someone made an element in a way other than placing it from the palette.',
  'Cta|Opened':
    'Someone followed a call to action on a public page (the landing page, a feature or comparison page, the help centre) and reached the New Document page.',
  'Cta|Created':
    'Someone who arrived from a call to action on a public page went on to create a document. Counted once per arrival.',
  'AI|Toggled': 'Someone turned an AI setting on or off in Settings under AI Tools.',
  'AI|Used':
    'Someone used a feature of the AI Assistant panel, or another AI-powered tool in the editor.',
  'Action|Changed': 'Someone changed something about an action assigned to an element.',
  'Action|Created': 'Someone assigned an action to a teammate, or to themselves, on an element.',
  'Action|Deleted': 'Someone removed an assigned action from an element.',
  'Action|Moved': "A document was moved into a teammate's team while assigning them an action.",
  'Action|Opened': 'Someone opened the popover for an action already assigned to an element.',
  'Action|Resolved': 'Someone marked an assigned action as done.',
  'Action|Unresolved': 'Someone reopened an assigned action that had been marked done.',
  'Activity|Changed': "Someone changed the filter over the Explorer's Inbox.",
  'Activity|Added': "Someone replied from the Explorer's Inbox reading pane.",
  'Activity|Resolved':
    "Someone closed something from the Explorer's Inbox: a thread resolved, or an action marked done.",
  'Activity|Loaded':
    "Something happened while loading the Explorer's Inbox (the list of outstanding actions and comment threads).",
  'Activity|Opened': "Someone opened or interacted with the Explorer's Inbox.",
  'Activity|Selected': "Someone clicked a row in the Explorer's Inbox, jumping to what it's about.",
  'Canvas|Used': 'Someone picked up one of the canvas tools or modes, or used a canvas feature.',
  'Canvas|Zoomed': 'Someone changed the zoom from the zoom controls.',
  'Comment|Added': 'A comment was added to an element thread.',
  'Comment|Deleted': 'A comment was removed from a thread.',
  'Comment|Opened': 'Someone opened the comment popover on an element.',
  'Comment|Mentioned': 'A comment was sent that @-mentioned at least one teammate.',
  'Comment|Resolved': 'A comment thread was marked resolved.',
  'Comment|Unresolved': 'A resolved comment thread was reopened.',
  'Document|Created': 'A brand-new document was created.',
  'Document|Deleted': 'A document was deleted.',
  'Document|Exported': 'Someone exported a tab, a selection or a page to a file or the clipboard.',
  'Document|Duplicated': 'A document was duplicated into a new one.',
  'Document|Joined':
    'Someone came into a document through a share link. Counted once per person per document, not on every revisit.',
  'Document|Loaded':
    'A document was opened, counted on every open (including a page refresh and the first open of a document just created).',
  'Document|Moved': 'A document was moved into (or out of) a folder.',
  'Document|Redone': 'Someone hit Redo on a document edit.',
  'Document|Removed':
    "Someone removed something from a document's sharing, such as revoking a share link.",
  'Document|Renamed': 'A document was renamed.',
  'Document|Reverted':
    "Someone reverted a single change from a tab's activity log, in the since-removed Activity panel.",
  'Document|Shared':
    "Someone created or changed a document's share link: its role, how long it lasts, or its password.",
  'Document|Undone': 'Someone hit Undo on a document edit.',
  'Document|Used': 'A document was used in a particular way, such as with other people live in it.',
  'Element|Changed':
    "Someone changed a property of one or more selected elements, from a style panel, the right-click menu, or an element's own controls.",
  'Element|Copied': 'Someone copied one or more selected elements to the clipboard.',
  'Element|Deleted': 'An element was removed from the canvas.',
  'Element|Duplicated': 'Someone duplicated one or more elements on the canvas.',
  'Element|Grouped': 'A multi-selection was grouped (before groups were removed).',
  'Element|Linked':
    'Someone linked an element to something: another element, a web address, a document or a tab.',
  'Element|Locked': "An element's lock was turned on (no edits allowed).",
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
  'Element|Searched': 'Someone searched for something to put in an element, such as a picture.',
  'Element|Used': 'Someone used an element in place on the canvas, such as playing a video.',
  'Element|Added': 'Someone added an element to a canvas, or put something into a document.',
  'Email|Sent':
    'An automatic email went out: a welcome message, an onboarding nudge, a team invite, or a notification about activity on a document. The type names which one; it never says who received it.',
  'Error|Api':
    "A request to livedocuments's servers failed, or a server itself hit an error while handling one. The type says what kind of failure it was and which operation was being attempted; see the accompanying pattern for how to read it.",
  'Error|Client':
    "Something failed in a visitor's browser: a part of the editor or help centre crashed, or recovered on its own from a hiccup in live sync. The type says what happened and where; see the accompanying pattern for how to read it.",
  'Error|Warning':
    'A feature hit a soft limit and quietly fell back to a slower or more limited way of working, rather than failing outright.',
  'Facilitator|Changed': 'Someone freed an element a peer had locked by selecting it.',
  'Folder|Created': 'A new folder was created in the document explorer.',
  'Folder|Deleted': 'A folder was deleted (contained documents move to the top level).',
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
  'Agent|Opened': "Somebody opened something an agent's change pointed them to.",
  'Agent|Viewed': 'An agent or a script read a document as text.',
  'Agent|Applied':
    'An agent changed a tab with a changeset: through the MCP server, the CLI or the API.',
  'Agent|Conflicted':
    "An agent's changeset was refused because something it touched changed since the agent read it.",
  'Agent|Held':
    "An agent's changeset was refused because a person had one of its elements selected.",
  'Agent|Present':
    'An agent showed itself on a tab, with what it is doing, through the MCP server, the CLI or the API.',
  'Agent|Reverted':
    "An agent's changeset was undone, from the editor's toast or another front door.",
  'Mcp|Used':
    'An AI tool connected to livedocuments over MCP used one of its actions on a document.',
  'Note|Added': 'A note was added to an element (first non-empty save).',
  'Cli|Used': 'Someone ran a livedocuments command from the command line, and it succeeded.',
  'Note|Changed': "An existing note's text was edited.",
  'Note|Deleted': 'A note was cleared from an element.',
  'Note|Opened': 'Someone opened the note popover on an element.',
  'Note|Used':
    "Someone applied rich-text formatting, such as bold, a colour, a bullet or numbered list, a heading, or a link, to part of a note's text.",
  'Page|View':
    'Someone loaded or navigated to a page on the site. Counted once per distinct page, not on every scroll or in-page action.',
  'Participant|Created':
    'Someone visited livedocuments for the first time in this browser, and a new anonymous guest identity was created for them. Counted once per browser, ever.',
  'Participant|Returned':
    'A returning visitor reopened the app on a later day than their first visit, counted once per day.',
  'Search|Opened': 'The global search panel was opened.',
  'Search|Searched':
    'A query was typed into search. Counted once per session, not on every keystroke.',
  'Search|Selected': "Someone picked a result from the editor's search.",
  'Session|Deleted': "Someone permanently deleted part of their account's data.",
  'Session|Opened': 'Someone opened a session-related surface in livedocuments.',
  'Session|SignedIn': 'A visitor just signed in to their account.',
  'Session|SignedOut': 'A visitor just signed out.',
  'Session|SignedUp': 'A visitor just created an account.',
  'Tab|Aligned':
    "Someone tidied a tab's layout with Auto Layout, arranging its elements automatically.",
  'Tab|Changed': "Someone changed a tab-wide setting, such as the tab's default font or text size.",
  'Tab|Cleared': "A tab's content was wiped.",
  'Tab|Created': 'A new tab was added to a document.',
  'Tab|Deleted': 'A tab was removed from a document.',
  'Tab|Duplicated': 'A tab was duplicated.',
  'Tab|Imported': 'Someone imported a tab from a file.',
  'Tab|Linked': 'A tab was linked into another document.',
  'Tab|Loaded':
    "A tab's content was fetched for viewing (the first tab when a document opens, then each tab switched to).",
  'Tab|Locked': 'A tab was locked (read-only).',
  'Tab|Moved': 'A tab was filed into a tab folder.',
  'Tab|Removed': 'Someone took a tab out of its tab folder, making it a loose tab again.',
  'Tab|Renamed': 'A tab was renamed.',
  'Tab|Reordered': 'Someone dragged a tab to a new position.',
  'Tab|Opened': 'Someone opened a tab beside the one they were editing (side by side).',
  'Tab|Selected':
    'Someone moved the editor to the other side by side pane, by a click or by resting the pointer there.',
  'Tab|Closed': 'Someone closed the side by side pane.',
  'Tab|Unlocked': 'A tab was unlocked (edits resume).',
  'Team|Added':
    'Something was added to a team: an invitation sent, or a document added to its shared library.',
  'Team|Changed': "Something about a team's settings, or a member's role, was changed.",
  'Team|Created': 'Someone created a new team.',
  'Team|Declined': 'Someone turned down a team invite.',
  'Team|Deleted': 'An admin deleted a team.',
  'Team|Joined': 'Someone accepted a team invite, by email or by invite link.',
  'Team|Moved': "A document already in a team's shared library was moved somewhere else.",
  'Team|Removed':
    'Someone was taken off a team, left one, or had a pending invite or the invite link withdrawn.',
  'Team|Shared': 'A team turned on a way for people to ask to join it.',
  'Theme|Created': 'Someone created a custom theme with their own colours.',
  'Theme|Deleted': 'Someone deleted a custom theme they had created.',
  'Home|Loaded': "More of Home's Timeline column loaded, or Home was read again after failing.",
  'Home|Opened': "Someone opened the Explorer's Home, or expanded a summary within it.",
  'Home|Selected': "Someone opened a document from one part of the Explorer's Home.",
  'Timeline|Changed': "Someone switched how the Explorer's Timeline displays its history.",
  'Timeline|Loaded':
    'The Timeline loaded more of its history, either the next page or a retry after a failed read.',
  'Timeline|Opened': 'Someone opened the Timeline, or a menu or collapsed group within it.',
  'Timeline|Removed': 'Someone removed one or more entries from their Timeline feed.',
  'Timeline|Selected':
    "Someone changed a Timeline filter: turned a category chip (such as Comments, Renames, or Sharing) off, or switched between seeing everyone's activity and just their own.",
  'Folder|Changed':
    'Someone chose a default folder: where new documents land when they pick no place.',
  'Folder|Cleared': 'Someone cleared a default folder, so new documents land in My Work again.',
  'Trash|Opened': 'Someone opened the Trash, where deleted documents wait for 30 days.',
  'Explorer|Created': 'Someone made something in the Explorer (a tag).',
  'Explorer|Added': 'Someone put one of their tags on a document.',
  'Explorer|Removed': 'Someone took one of their tags off a document.',
  'Explorer|Renamed': 'Someone renamed one of their tags.',
  'Explorer|Changed': 'Someone changed one of their tags (its colour).',
  'Explorer|Deleted': 'Someone deleted one of their tags.',
  'Explorer|Selected':
    'Someone narrowed an Explorer list with a filter: a chip, a suggestion or a typed token. The type names which kind of filter, never what was picked.',
  'Trash|Cleared':
    'Someone emptied one group of their Trash (their own documents, a team, or this browser), deleting everything in it for good.',
  'Trash|Deleted': 'Someone deleted a document in the Trash for good, before its 30 days were up.',
  'Trash|Restored':
    'Someone brought a deleted document back from the Trash, putting it back where it was.',
  'Token|Created':
    'A new API token was created, either by hand or for an AI tool connected over MCP.',
  'Token|Linked': 'A token’s owner allowed a developer tool to open their documents.',
  'Token|Removed': 'Someone revoked an API token.',
  'UI|Added': 'Someone added something in the editor, such as a slide.',
  'UI|Changed':
    "Someone changed a setting or a control's value somewhere in the editor: a tool panel's option (Laser, Spotlight, Format Painter), a Settings dialog row, or a palette/toolbar choice.",
  'UI|Cleared':
    "Someone cleared livedocuments's saved settings and caches in their browser (Repair This Browser); the value says where from.",
  'UI|Closed':
    'Someone closed or dismissed a banner, card, or presentation somewhere in the editor.',
  'UI|Copied':
    'Someone copied something to their clipboard from a Share or invite control, such as a share link, an embed snippet, a live image URL, or a team invite link.',
  'UI|Ended': 'The welcome tour finished, either completed in full or skipped partway through.',
  'UI|Moved': "Someone dragged something to a new position in the editor's interface.",
  'UI|Opened':
    "Someone opened a dialog, panel, popover, or menu somewhere in the editor. A lowercase, hyphenated type is a help-centre article's address: someone clicked a help link, or a Help result in search, to read it.",
  'UI|Removed': 'Someone removed something in the editor, such as a slide.',
  'UI|Searched':
    'Someone typed into a search box inside a palette tab (Icons, Technology or Stickers), narrowing it to matching tiles. Counted once per tab visit, on the first keystroke.',
  'UI|Selected':
    'Someone picked an option from a dropdown, or clicked through on a banner, somewhere in the editor.',
  'UI|Started': 'Someone started a presentation or the welcome tour.',
  'UI|Toggled': 'Someone turned an editor setting on or off.',
  'UI|Used':
    'Someone used a wizard-skipping entry point into a new document, or accepted an offer.',
  'UI|Declined': 'Someone turned down an offer the editor made them.',
  'UI|View': 'The welcome tour advanced to (or back to) a particular stage.',
};

export const API_OPERATIONS: Readonly<Record<string, string>> = {
  AcceptTeamInvite: 'accepting a team invite',
  AddTab: 'adding a tab to a document, from an AI tool connected over MCP',
  AppendChangeLog: "recording an entry in a document's since-removed change history",
  CopyDocument: 'duplicating a document',
  CreateCustomTheme: 'saving a new custom theme',
  CreateDocument: 'creating a new document',
  CreateFolder: 'creating a folder',
  CreateShareLink: 'generating a share link',
  CreateTeam: 'creating a team',
  CreateToken: 'creating an API token',
  DeclineTeamInvite: "declining a team invite from the email's Decline link",
  DeleteChangeLog: "clearing a document's since-removed change history",
  DeleteChangeLogEntry: "removing one entry from a document's since-removed change history",
  DeleteComment: 'deleting a comment',
  DeleteCustomTheme: 'deleting a saved custom theme',
  DeleteDocument: 'deleting a document',
  DeleteFolder: 'deleting a folder',
  DeleteImage: 'deleting a saved image',
  DeleteShareLink: 'deleting a share link',
  DeleteTab: 'deleting a tab',
  DeleteTeam: 'deleting a team',
  DismissShared: "removing a shared document from a visitor's shared list",
  DismissTimelineEvent: 'clearing one entry from the activity timeline',
  DismissTimelineEvents: 'clearing entries from the activity timeline',
  ExtendShareLink: "extending a share link's expiry",
  FindDocuments: 'searching for a document, from an AI tool connected over MCP',
  InviteTeamMember: 'inviting someone to a team',
  JoinTeamByInviteLink: 'joining a team through its invite link',
  LinkTab: 'linking a tab into another document',
  List: "listing a visitor's documents",
  ListChangeLog: "listing a document's since-removed change history",
  ListCustomThemes: "listing an account's saved custom themes",
  ListFolders: "listing an account's folders",
  ListImages: 'listing the images saved to an account',
  ListShareLinks: "listing a document's share links",
  ListShared: 'listing documents shared with a visitor',
  ListTeamInvites: "listing an account's pending team invites",
  ListTeams: "listing an account's teams",
  ListTemplates: 'listing available templates, from an AI tool connected over MCP',
  ListTokens: "listing an account's API tokens",
  LoadSelf: "loading a visitor's own profile details",
  LoadShared: 'opening a document through a share link',
  LoadTab: "loading a tab's contents",
  LoadTeam: "loading a team's details",
  LoadTeamLibrary: "loading a team's shared document library",
  NotifyAssignedAction: 'emailing someone about an action assigned to them',
  OauthExchange: 'connecting an AI tool over MCP',
  ReadDocument: 'reading a document, from an AI tool connected over MCP',
  ReadTeamInviteDecline: "opening a team invite email's Decline link",
  RenameDocument: 'renaming a document, from an AI tool connected over MCP',
  ResolveTeamInviteLink: "opening a team's invite link",
  RevokeTeamInviteLink: "turning off a team's invite link",
  RevokeToken: 'revoking an API token',
  SaveDocumentMeta: "saving a document's name or other details",
  SaveSelf: "saving a visitor's own profile details",
  SaveTab: "saving a tab's contents",
  SearchIcons: 'searching the icon catalogue by name, from an AI tool connected over MCP',
  SendEmail: 'sending a transactional or lifecycle email',
  SetFolder: 'moving a document into, or out of, a folder',
  SetSharePassword: 'setting a password on a share link',
  ShareDocument: 'generating a share link, from an AI tool connected over MCP',
  UpdateCustomTheme: 'updating a saved custom theme',
  UpdateDocument: 'updating a document, from an AI tool connected over MCP',
  UpdateFolder: 'renaming or updating a folder',
  UpdateTeam: "updating a team's name or organisation",
  UploadImage: 'uploading an image',
};
