// Emoji catalogue data (spec/85): native colour emoji as ordinary line-art
// catalogue entries, each a single `text` prim centred in the 0..24 art box.
// Concatenated onto the end of ICON_CATALOG_2 so every consumer sees one
// line-art catalogue and no registry/renderer changes are needed. Pure-data
// catalogue, size-exempt per CLAUDE.md. Weighted toward collaboration and
// status: smileys/reactions, status marks, work objects, hands/people.
import type { IconDef } from './types';

export const EMOJI_CATALOG: IconDef[] = [
  // Smileys + reactions
  {
    id: 'emoji-thumbs-up',
    label: 'Thumbs up',
    keywords: 'yes approve like agree +1 plus one ok good react',
    prims: [{ t: 'text', text: '👍', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-thumbs-down',
    label: 'Thumbs down',
    keywords: 'no reject dislike disagree -1 minus one bad react',
    prims: [{ t: 'text', text: '👎', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-clap',
    label: 'Clapping hands',
    keywords: 'applause congrats congratulations well done praise bravo',
    prims: [{ t: 'text', text: '👏', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-party-popper',
    label: 'Party popper',
    keywords: 'celebrate celebration party tada hooray shipped launch confetti',
    prims: [{ t: 'text', text: '🎉', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-thinking-face',
    label: 'Thinking face',
    keywords: 'hmm consider ponder unsure maybe question wondering',
    prims: [{ t: 'text', text: '🤔', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-heart',
    label: 'Red heart',
    keywords: 'love like favourite favorite react red',
    prims: [{ t: 'text', text: '❤️', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-smile',
    label: 'Smiling face',
    keywords: 'happy grin smiley face positive glad',
    prims: [{ t: 'text', text: '😀', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-laughing',
    label: 'Laughing face',
    keywords: 'lol funny joy tears haha joke humour humor',
    prims: [{ t: 'text', text: '😂', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-sad',
    label: 'Crying face',
    keywords: 'sad unhappy tear cry upset disappointed',
    prims: [{ t: 'text', text: '😢', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-surprised',
    label: 'Surprised face',
    keywords: 'wow shock shocked open mouth astonished oh',
    prims: [{ t: 'text', text: '😮', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-eyes',
    label: 'Eyes',
    keywords: 'look looking watch watching see attention review',
    prims: [{ t: 'text', text: '👀', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-hundred',
    label: 'Hundred points',
    keywords: '100 percent perfect score full marks keep it',
    prims: [{ t: 'text', text: '💯', x: 12, y: 12, size: 20 }],
  },
  // Status marks
  {
    id: 'emoji-check',
    label: 'Check mark',
    keywords: 'tick done complete yes ok pass approved green',
    prims: [{ t: 'text', text: '✅', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-cross',
    label: 'Cross mark',
    keywords: 'x no fail failed wrong error blocked rejected red',
    prims: [{ t: 'text', text: '❌', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-warning',
    label: 'Warning',
    keywords: 'caution alert danger risk attention hazard triangle',
    prims: [{ t: 'text', text: '⚠️', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-question',
    label: 'Question mark',
    keywords: 'help unknown ask query unclear tbd red',
    prims: [{ t: 'text', text: '❓', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-fire',
    label: 'Fire',
    keywords: 'hot flame burn urgent trending lit incident',
    prims: [{ t: 'text', text: '🔥', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-star',
    label: 'Star',
    keywords: 'favourite favorite rating important highlight gold',
    prims: [{ t: 'text', text: '⭐', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-sparkles',
    label: 'Sparkles',
    keywords: 'new shiny magic ai clean polish glitter',
    prims: [{ t: 'text', text: '✨', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-rocket',
    label: 'Rocket',
    keywords: 'launch ship deploy fast startup release space',
    prims: [{ t: 'text', text: '🚀', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-bulb',
    label: 'Light bulb',
    keywords: 'idea insight tip lightbulb brainstorm think innovation',
    prims: [{ t: 'text', text: '💡', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-target',
    label: 'Target',
    keywords: 'goal aim objective bullseye dart focus okr',
    prims: [{ t: 'text', text: '🎯', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-trophy',
    label: 'Trophy',
    keywords: 'win winner award achievement prize champion success',
    prims: [{ t: 'text', text: '🏆', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-hourglass',
    label: 'Hourglass',
    keywords: 'waiting pending time timer deadline in progress sand',
    prims: [{ t: 'text', text: '⏳', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-red-circle',
    label: 'Red circle',
    keywords: 'status stop blocked critical dot colour color light',
    prims: [{ t: 'text', text: '🔴', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-green-circle',
    label: 'Green circle',
    keywords: 'status go ok healthy done dot colour color light',
    prims: [{ t: 'text', text: '🟢', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-yellow-circle',
    label: 'Yellow circle',
    keywords: 'status caution pending at risk dot colour color amber light',
    prims: [{ t: 'text', text: '🟡', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-flag',
    label: 'Red flag',
    keywords: 'flagged risk issue blocker attention marker triangular',
    prims: [{ t: 'text', text: '🚩', x: 12, y: 12, size: 20 }],
  },
  // Work objects
  {
    id: 'emoji-calendar',
    label: 'Calendar',
    keywords: 'date schedule event month planner deadline day',
    prims: [{ t: 'text', text: '📅', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-clock',
    label: 'Clock',
    keywords: 'time hour watch schedule oclock duration',
    prims: [{ t: 'text', text: '🕐', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-pushpin',
    label: 'Pushpin',
    keywords: 'pin location marker note tack important',
    prims: [{ t: 'text', text: '📌', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-lock',
    label: 'Lock',
    keywords: 'locked secure security private closed padlock',
    prims: [{ t: 'text', text: '🔒', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-key',
    label: 'Key',
    keywords: 'password unlock access secret credential',
    prims: [{ t: 'text', text: '🔑', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-bug',
    label: 'Bug',
    keywords: 'defect issue error insect fix debug',
    prims: [{ t: 'text', text: '🐛', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-wrench',
    label: 'Wrench',
    keywords: 'tool fix repair spanner maintenance configure',
    prims: [{ t: 'text', text: '🔧', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-hammer',
    label: 'Hammer',
    keywords: 'tool build construction fix work',
    prims: [{ t: 'text', text: '🔨', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-memo',
    label: 'Memo',
    keywords: 'note notes write pencil document todo list',
    prims: [{ t: 'text', text: '📝', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-folder',
    label: 'Folder',
    keywords: 'file directory documents organise organize archive',
    prims: [{ t: 'text', text: '📁', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-chart-up',
    label: 'Chart increasing',
    keywords: 'graph growth up trend gain metrics analytics improve',
    prims: [{ t: 'text', text: '📈', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-chart-down',
    label: 'Chart decreasing',
    keywords: 'graph decline down trend loss drop metrics analytics',
    prims: [{ t: 'text', text: '📉', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-clipboard',
    label: 'Clipboard',
    keywords: 'checklist tasks list form survey notes',
    prims: [{ t: 'text', text: '📋', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-email',
    label: 'E-mail',
    keywords: 'mail message envelope inbox send contact',
    prims: [{ t: 'text', text: '📧', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-phone',
    label: 'Telephone',
    keywords: 'call receiver contact ring support',
    prims: [{ t: 'text', text: '📞', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-laptop',
    label: 'Laptop',
    keywords: 'computer pc notebook work code screen',
    prims: [{ t: 'text', text: '💻', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-magnifier',
    label: 'Magnifying glass',
    keywords: 'search find look zoom inspect investigate research',
    prims: [{ t: 'text', text: '🔍', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-gear',
    label: 'Gear',
    keywords: 'settings cog config configure machine process',
    prims: [{ t: 'text', text: '⚙️', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-link',
    label: 'Link',
    keywords: 'chain url hyperlink connect reference attach',
    prims: [{ t: 'text', text: '🔗', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-scissors',
    label: 'Scissors',
    keywords: 'cut trim snip crop remove split',
    prims: [{ t: 'text', text: '✂️', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-package',
    label: 'Package',
    keywords: 'box parcel delivery ship module release bundle',
    prims: [{ t: 'text', text: '📦', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-books',
    label: 'Books',
    keywords: 'library docs documentation read learn study knowledge',
    prims: [{ t: 'text', text: '📚', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-money-bag',
    label: 'Money bag',
    keywords: 'cash budget cost revenue funding dollar finance',
    prims: [{ t: 'text', text: '💰', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-speech-balloon',
    label: 'Speech balloon',
    keywords: 'comment chat message talk discussion feedback bubble',
    prims: [{ t: 'text', text: '💬', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-bell',
    label: 'Bell',
    keywords: 'notification alert reminder ring alarm subscribe',
    prims: [{ t: 'text', text: '🔔', x: 12, y: 12, size: 20 }],
  },
  // Hands + people
  {
    id: 'emoji-wave',
    label: 'Waving hand',
    keywords: 'hello hi bye greeting welcome goodbye',
    prims: [{ t: 'text', text: '👋', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-handshake',
    label: 'Handshake',
    keywords: 'deal agreement partnership collaborate welcome thanks',
    prims: [{ t: 'text', text: '🤝', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-muscle',
    label: 'Flexed biceps',
    keywords: 'strong strength power effort arm gym you got this',
    prims: [{ t: 'text', text: '💪', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-point-right',
    label: 'Pointing right',
    keywords: 'point finger direction next see here look',
    prims: [{ t: 'text', text: '👉', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-raised-hand',
    label: 'Raised hand',
    keywords: 'stop halt high five question volunteer palm',
    prims: [{ t: 'text', text: '✋', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-person',
    label: 'Person',
    keywords: 'user member individual profile someone owner assignee',
    prims: [{ t: 'text', text: '🧑', x: 12, y: 12, size: 20 }],
  },
  {
    id: 'emoji-people',
    label: 'People',
    keywords: 'users team group members silhouette audience crowd',
    prims: [{ t: 'text', text: '👥', x: 12, y: 12, size: 20 }],
  },
];
