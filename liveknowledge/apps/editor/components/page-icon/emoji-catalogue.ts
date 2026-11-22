// The emoji a page icon offers (docs/specs/030-knowledgebase/page-surface.md "The page icon"), in groups, each with
// its name and the words it is found by. Data only, loaded by the picker as its own chunk (import() in
// PageIconPicker), so no page pays for it until the picker opens. One line an emoji: `emoji name: words`.

export type EmojiEntry = { emoji: string; name: string; words: string };
export type EmojiGroup = { id: string; label: string; emoji: readonly EmojiEntry[] };

const parse = (lines: string): EmojiEntry[] =>
  lines
    .trim()
    .split('\n')
    .map((line) => {
      const space = line.indexOf(' ');
      const colon = line.indexOf(':', space);
      const emoji = line.slice(0, space);
      const name = (colon < 0 ? line.slice(space + 1) : line.slice(space + 1, colon)).trim();
      const words = colon < 0 ? '' : line.slice(colon + 1).trim();
      return { emoji, name, words };
    });

const SMILEYS = `
😀 grinning face: smile happy joy
😃 smiling face with big eyes: happy joy
😄 smiling face with smiling eyes: happy joy laugh
😁 beaming face: grin happy
😆 squinting face: laugh happy
😅 sweat smile: relief nervous
🤣 rolling on the floor laughing: lol laugh
😂 tears of joy: laugh lol funny
🙂 slightly smiling face: smile
🙃 upside down face: silly sarcasm
😉 winking face: wink
😊 smiling face with smiling eyes: blush happy
😇 halo: angel innocent
🥰 smiling face with hearts: love adore
😍 heart eyes: love crush
🤩 star struck: wow amazed
😘 blowing a kiss: love kiss
😋 yum: delicious tasty
😜 winking face with tongue: playful silly
🤪 zany face: crazy wild
🤓 nerd face: geek smart glasses
😎 sunglasses: cool
🥳 partying face: party celebrate birthday
🤔 thinking face: think hmm idea question
🤨 raised eyebrow: sceptical doubt
😐 neutral face: meh
😶 face without mouth: quiet silent
🙄 rolling eyes: annoyed
😏 smirking face: smug
😬 grimacing face: awkward oops
😌 relieved face: calm relief
😴 sleeping face: sleep tired zzz
🤤 drooling face: hungry
😷 face with mask: sick ill health
🤒 thermometer face: sick fever
🤯 exploding head: mind blown shock
🥵 hot face: heat
🥶 cold face: freezing
😵 dizzy face: dizzy
🤠 cowboy hat face: cowboy
🥸 disguised face: incognito spy
😕 confused face: confused
😟 worried face: worried concern
😮 open mouth: surprise wow
😲 astonished face: shock surprise
🥺 pleading face: please puppy eyes
😢 crying face: sad tear
😭 loudly crying: sob sad
😱 screaming in fear: scared horror
😤 steam from nose: frustrated triumph
😠 angry face: mad
😡 pouting face: angry rage
🤬 cursing face: swearing angry
😈 smiling devil: evil mischief
💀 skull: dead death
💩 pile of poo: poop
🤡 clown face: clown joke
👻 ghost: halloween spooky
👽 alien: ufo space
🤖 robot: bot ai machine automation
😺 grinning cat: cat
🙈 see no evil monkey: monkey shy
🙊 speak no evil monkey: secret
`;

const PEOPLE = `
👋 waving hand: hello hi wave bye welcome
🤚 raised back of hand: stop
✋ raised hand: stop high five
🖖 vulcan salute: spock
👌 ok hand: okay perfect
🤌 pinched fingers: italian
✌️ victory hand: peace
🤞 crossed fingers: luck hope
🤟 love you gesture: love
🤘 sign of the horns: rock
👈 pointing left: left
👉 pointing right: right next
👆 pointing up: up
👇 pointing down: down
☝️ index pointing up: one first
👍 thumbs up: like yes approve good
👎 thumbs down: dislike no bad
✊ raised fist: power solidarity
👊 fist bump: punch
👏 clapping hands: applause bravo well done
🙌 raising hands: celebrate hooray
🫶 heart hands: love support
👐 open hands: hug
🤝 handshake: deal agreement partner
🙏 folded hands: please thanks pray
✍️ writing hand: write author
💪 flexed biceps: strong muscle strength
🧠 brain: mind smart think knowledge learning
👀 eyes: look watch see review
👁️ eye: see vision
🗣️ speaking head: speak talk announce
👤 bust in silhouette: user person profile
👥 busts in silhouette: users people team group
🫂 people hugging: hug support
👶 baby: child new
🧒 child: kid
👩 woman: person
👨 man: person
🧑 person: adult
🧓 older person: elder
👩‍💻 woman technologist: developer engineer coder
👨‍💻 man technologist: developer engineer coder
🧑‍💻 technologist: developer engineer coder programmer
🧑‍🏫 teacher: teach school training
🧑‍🎓 student: graduate learn
🧑‍🔬 scientist: science research lab
🧑‍⚕️ health worker: doctor nurse medical
🧑‍🍳 cook: chef kitchen
🧑‍🔧 mechanic: repair fix
🧑‍🎨 artist: art design paint
🧑‍🚀 astronaut: space
🧑‍⚖️ judge: law legal
🧑‍💼 office worker: business manager
🕵️ detective: investigate spy
👷 construction worker: build
💂 guard: security
🦸 superhero: hero power
🧙 mage: wizard magic
🧑‍🤝‍🧑 people holding hands: partners pair
🏃 person running: run fast exercise
🚶 person walking: walk
🧘 person in lotus position: yoga calm meditate wellbeing
`;

const NATURE = `
🐶 dog face: dog puppy pet
🐱 cat face: cat kitten pet
🐭 mouse face: mouse
🐰 rabbit face: bunny
🦊 fox: fox
🐻 bear: bear
🐼 panda: panda
🐨 koala: koala
🐯 tiger face: tiger
🦁 lion: lion king
🐮 cow face: cow
🐷 pig face: pig
🐸 frog: frog
🐵 monkey face: monkey
🐔 chicken: chicken
🐧 penguin: penguin
🐦 bird: bird
🦅 eagle: eagle
🦉 owl: owl wise night
🦄 unicorn: magic startup
🐝 honeybee: bee busy
🐛 bug: bug insect issue
🦋 butterfly: change transform
🐌 snail: slow
🐞 lady beetle: ladybird bug
🐢 turtle: slow
🐍 snake: python
🦖 t-rex: dinosaur
🐙 octopus: octopus github
🦀 crab: crab rust
🐠 tropical fish: fish
🐬 dolphin: dolphin
🐳 spouting whale: whale docker
🦈 shark: shark
🐘 elephant: elephant memory php
🦒 giraffe: giraffe
🐎 horse: horse
🐿️ chipmunk: squirrel
🦔 hedgehog: hedgehog
🐾 paw prints: paw pet
🌵 cactus: desert
🎄 christmas tree: christmas holiday
🌲 evergreen tree: tree forest pine
🌳 deciduous tree: tree
🌴 palm tree: holiday beach
🌱 seedling: plant grow new start
🌿 herb: plant leaf
☘️ shamrock: luck clover
🍀 four leaf clover: luck
🍁 maple leaf: autumn canada
🍂 fallen leaf: autumn
🍃 leaf in the wind: wind
🍄 mushroom: fungus
🌷 tulip: flower spring
🌹 rose: flower love
🌻 sunflower: flower summer
🌸 cherry blossom: flower spring
💐 bouquet: flowers gift
🌍 globe europe africa: world earth global
🌎 globe americas: world earth
🌏 globe asia australia: world earth
🌙 crescent moon: night moon
⭐ star: favourite star
🌟 glowing star: shine highlight
✨ sparkles: magic new shiny ai
⚡ high voltage: lightning fast power electric
🔥 fire: hot flame popular trending
🌈 rainbow: colour pride
☀️ sun: sunny weather
⛅ sun behind cloud: weather
☁️ cloud: cloud weather
🌧️ rain cloud: rain weather
⛈️ thunder cloud: storm
❄️ snowflake: snow winter cold
☃️ snowman: winter snow
💧 droplet: water
🌊 water wave: ocean sea wave
`;

const FOOD = `
🍏 green apple: fruit apple
🍎 red apple: fruit apple teacher
🍐 pear: fruit
🍊 tangerine: orange fruit
🍋 lemon: fruit sour
🍌 banana: fruit
🍉 watermelon: fruit summer
🍇 grapes: fruit
🍓 strawberry: fruit
🫐 blueberries: fruit
🍒 cherries: fruit
🍑 peach: fruit
🥭 mango: fruit
🍍 pineapple: fruit
🥥 coconut: fruit
🥝 kiwi fruit: fruit
🍅 tomato: vegetable
🥑 avocado: fruit
🥦 broccoli: vegetable
🥕 carrot: vegetable
🌽 ear of corn: corn
🌶️ hot pepper: chilli spicy
🥔 potato: vegetable
🥐 croissant: bread breakfast
🍞 bread: bread loaf
🧀 cheese wedge: cheese
🥚 egg: egg
🍳 cooking: fried egg breakfast
🥞 pancakes: breakfast
🥓 bacon: breakfast
🍔 hamburger: burger food
🍟 french fries: chips
🍕 pizza: pizza food
🌭 hot dog: sausage
🥪 sandwich: lunch
🌮 taco: mexican
🌯 burrito: mexican
🥗 green salad: salad healthy
🍝 spaghetti: pasta
🍜 steaming bowl: ramen noodles
🍣 sushi: sushi japanese
🍱 bento box: lunch
🍙 rice ball: rice
🍩 doughnut: donut sweet
🍪 cookie: biscuit cookies
🎂 birthday cake: birthday cake celebrate
🍰 shortcake: cake dessert
🧁 cupcake: cake
🍫 chocolate bar: chocolate sweet
🍬 candy: sweet
🍭 lollipop: sweet
🍿 popcorn: movie cinema
☕ hot beverage: coffee tea break
🍵 teacup: tea
🧋 bubble tea: boba
🥤 cup with straw: drink soda
🍺 beer mug: beer drink pub
🍻 clinking beer mugs: cheers
🥂 clinking glasses: cheers celebrate toast
🍷 wine glass: wine
🍸 cocktail glass: cocktail
🧃 beverage box: juice
🍽️ fork and knife with plate: dinner restaurant
🥄 spoon: spoon
`;

const TRAVEL = `
🚗 automobile: car drive
🚕 taxi: cab
🚌 bus: bus transport
🚑 ambulance: emergency
🚒 fire engine: fire emergency
🚓 police car: police
🚚 delivery truck: delivery shipping
🚜 tractor: farm
🏎️ racing car: fast speed
🚲 bicycle: bike cycle
🛴 kick scooter: scooter
🏍️ motorcycle: motorbike
🚂 locomotive: train steam
🚆 train: train rail
🚇 metro: underground tube subway
✈️ airplane: plane flight travel
🛫 airplane departure: takeoff launch
🛬 airplane arrival: landing
🚁 helicopter: helicopter
🚀 rocket: launch ship release space startup
🛸 flying saucer: ufo
🛰️ satellite: space
⛵ sailboat: boat sail
🚢 ship: ship cruise
⚓ anchor: anchor stable
🗺️ world map: map plan
🧭 compass: direction navigate guide
🏔️ snow capped mountain: mountain
⛰️ mountain: mountain goal
🌋 volcano: volcano
🏕️ camping: camp tent
🏖️ beach with umbrella: beach holiday
🏝️ desert island: island holiday
🏠 house: home house
🏡 house with garden: home
🏢 office building: office company work
🏬 department store: shop store
🏭 factory: factory industry production
🏥 hospital: hospital health
🏦 bank: bank finance money
🏫 school: school education
🏛️ classical building: government museum
⛪ church: church
🏰 castle: castle
🗼 tokyo tower: tower
🗽 statue of liberty: liberty
🌉 bridge at night: bridge
🌃 night with stars: city night
🏙️ cityscape: city
🚦 traffic light: traffic status
🚧 construction: construction work in progress wip
⛽ fuel pump: petrol gas
🛣️ motorway: road highway
🏁 chequered flag: finish race done
🚩 triangular flag: flag milestone
🎌 crossed flags: japan
`;

const ACTIVITIES = `
⚽ soccer ball: football sport
🏀 basketball: sport
🏈 american football: sport
⚾ baseball: sport
🎾 tennis: sport
🏐 volleyball: sport
🏉 rugby football: rugby sport
🎱 pool 8 ball: billiards
🏓 ping pong: table tennis
🏸 badminton: sport
🏒 ice hockey: hockey
⛳ flag in hole: golf
🏹 bow and arrow: archery target
🎣 fishing pole: fishing
🥊 boxing glove: boxing fight
🥋 martial arts uniform: karate judo
⛸️ ice skate: skating
🎿 skis: ski
🏆 trophy: win award prize champion
🥇 first place medal: gold winner
🥈 second place medal: silver
🥉 third place medal: bronze
🏅 sports medal: medal award
🎖️ military medal: medal honour
🎗️ reminder ribbon: ribbon awareness
🎫 ticket: ticket
🎟️ admission tickets: tickets event
🎪 circus tent: circus event
🎭 performing arts: theatre drama
🎨 artist palette: art design colour paint
🎬 clapper board: film movie video
🎤 microphone: sing speak podcast
🎧 headphone: music listen audio
🎼 musical score: music
🎹 musical keyboard: piano
🥁 drum: drum
🎸 guitar: guitar music
🎻 violin: violin
🎲 game die: dice game random
♟️ chess pawn: chess strategy
🎯 direct hit: target goal bullseye focus objective
🎳 bowling: bowling
🎮 video game: game controller gaming
🧩 puzzle piece: puzzle jigsaw integration plugin
🎉 party popper: party celebrate tada launch
🎊 confetti ball: celebrate
🎈 balloon: party birthday
🎁 wrapped gift: present gift
🎀 ribbon: bow gift
🎃 jack o lantern: halloween pumpkin
`;

const OBJECTS = `
📌 pushpin: pin important
📍 round pushpin: location pin place
📎 paperclip: attach attachment
🖇️ linked paperclips: attach
📏 straight ruler: ruler measure
📐 triangular ruler: design measure
✂️ scissors: cut
🖊️ pen: pen write
✏️ pencil: pencil write edit draft
🖍️ crayon: draw
🖌️ paintbrush: paint art design
🔍 magnifying glass: search find zoom
🔎 magnifying glass tilted right: search find
🔒 locked: lock secure private security
🔓 unlocked: unlock open
🔐 locked with key: secure
🔑 key: key password access
🗝️ old key: key secret
🔨 hammer: build tool
🪓 axe: chop
🛠️ hammer and wrench: tools build fix settings
🔧 wrench: tool fix settings
🔩 nut and bolt: hardware
⚙️ gear: settings config cog engineering process
🧰 toolbox: tools kit
🧲 magnet: attract
🧪 test tube: test experiment lab science
🔬 microscope: science research
🔭 telescope: vision future explore
💡 light bulb: idea tip insight
🔦 flashlight: torch light
🕯️ candle: light
📱 mobile phone: phone mobile app
💻 laptop: computer laptop work
🖥️ desktop computer: computer screen
⌨️ keyboard: keyboard type
🖱️ computer mouse: mouse click
🖨️ printer: print
💾 floppy disk: save disk
💿 optical disk: cd
📷 camera: photo picture
📹 video camera: video record
📺 television: tv screen
📻 radio: radio
☎️ telephone: phone call
📞 telephone receiver: call phone support
📡 satellite antenna: signal broadcast
🔋 battery: battery power energy
🔌 electric plug: plug power connect integration
💰 money bag: money budget finance
💵 dollar banknote: money cash
💳 credit card: payment card billing
💎 gem stone: diamond value premium
⚖️ balance scale: law legal justice balance
🧾 receipt: receipt invoice expenses
📧 e-mail: email mail
📨 incoming envelope: email inbox
📩 envelope with arrow: email send
📮 postbox: mail post
📦 package: box package delivery shipping release
🏷️ label: tag label price
📝 memo: note notes write document
📄 page facing up: document page file doc
📃 page with curl: document
📑 bookmark tabs: tabs bookmark
📊 bar chart: chart stats analytics data report
📈 chart increasing: growth trend up metrics
📉 chart decreasing: decline down
📋 clipboard: clipboard checklist todo
📅 calendar: date calendar schedule
📆 tear off calendar: calendar date
🗓️ spiral calendar: calendar plan schedule
📇 card index: contacts index
🗂️ card index dividers: organise folders
📁 file folder: folder files
📂 open file folder: folder open
🗃️ card file box: archive
🗄️ file cabinet: archive files
🗑️ wastebasket: trash bin delete
📚 books: books library learn knowledge docs
📖 open book: book read guide manual handbook
📕 closed book: book
📒 ledger: notebook
📓 notebook: notebook notes
🔖 bookmark: bookmark save
🔗 link: link url chain
📰 newspaper: news press announcement
🗞️ rolled up newspaper: news
✉️ envelope: letter mail
📣 megaphone: announce marketing
📢 loudspeaker: announcement broadcast
🔔 bell: notification alert reminder
🔕 bell with slash: mute silent
⏰ alarm clock: alarm time deadline
⏱️ stopwatch: timer time
⏳ hourglass not done: waiting pending time
⌛ hourglass done: time done
🕐 one o clock: time clock
🛒 shopping cart: shop cart buy ecommerce
🛎️ bellhop bell: service
🚪 door: door exit
🪑 chair: seat
🛏️ bed: bed sleep
🛋️ couch and lamp: sofa lounge
🧸 teddy bear: toy
🎓 graduation cap: education graduate learning course
👑 crown: king queen leader
🎩 top hat: magic formal
👓 glasses: glasses read
💼 briefcase: work business job
🎒 backpack: school bag
🩺 stethoscope: health doctor
💊 pill: medicine health
🩹 adhesive bandage: fix patch
🧬 dna: dna biology science
🧯 fire extinguisher: incident emergency
🧹 broom: clean cleanup
🧼 soap: clean
🪴 potted plant: plant office
🗿 moai: stone
`;

const SYMBOLS = `
❤️ red heart: love heart
🧡 orange heart: heart
💛 yellow heart: heart
💚 green heart: heart
💙 blue heart: heart
💜 purple heart: heart
🖤 black heart: heart
🤍 white heart: heart
💔 broken heart: heartbreak
💯 hundred points: perfect score 100
✅ check mark button: done complete yes approved
✔️ check mark: done tick
☑️ check box with check: checked todo
❌ cross mark: no wrong cancel error
❎ cross mark button: no
➕ plus: add new
➖ minus: remove
❓ question mark: question help faq
❔ white question mark: question
❗ exclamation mark: important alert
‼️ double exclamation mark: important
⚠️ warning: warning caution alert risk
🚫 prohibited: forbidden no blocked
⛔ no entry: stop blocked
🛑 stop sign: stop halt
🚨 police light: alert incident emergency urgent
🔴 red circle: red status
🟠 orange circle: orange status
🟡 yellow circle: yellow status
🟢 green circle: green status ok
🔵 blue circle: blue status
🟣 purple circle: purple
⚫ black circle: black
⚪ white circle: white
🟥 red square: red
🟧 orange square: orange
🟨 yellow square: yellow
🟩 green square: green
🟦 blue square: blue
🟪 purple square: purple
🔶 large orange diamond: diamond
🔷 large blue diamond: diamond
🔺 red triangle pointed up: up
🔻 red triangle pointed down: down
💠 diamond with a dot: diamond
🔘 radio button: option
♻️ recycling symbol: recycle sustainability
⚜️ fleur de lis: fleur
🔱 trident emblem: trident
📛 name badge: badge name
🔰 beginner symbol: beginner new starter onboarding
⭕ hollow red circle: circle
💤 zzz: sleep
💬 speech balloon: chat comment message talk
💭 thought balloon: think thought
🗯️ right anger bubble: shout
♾️ infinity: forever unlimited
🔁 repeat button: repeat loop
🔄 counterclockwise arrows: refresh sync update
🔃 clockwise arrows: reload
⬆️ up arrow: up
⬇️ down arrow: down
⬅️ left arrow: left back
➡️ right arrow: right next
↗️ up right arrow: up
↘️ down right arrow: down
↩️ right arrow curving left: return undo
↪️ left arrow curving right: redo
🔀 shuffle tracks: shuffle random
▶️ play button: play start
⏸️ pause button: pause
⏹️ stop button: stop
⏭️ next track: next skip
⏮️ previous track: previous
🔊 speaker high volume: sound loud
🔇 muted speaker: mute
🆕 new button: new
🆓 free button: free
🆗 ok button: ok
🆒 cool button: cool
🆙 up button: up
🆘 sos button: help emergency
ℹ️ information: info information about
🔤 latin letters: abc alphabet text
🔢 input numbers: numbers 123
#️⃣ keycap number sign: hash number
*️⃣ keycap asterisk: star
0️⃣ keycap 0: zero number
1️⃣ keycap 1: one number first
2️⃣ keycap 2: two number second
3️⃣ keycap 3: three number third
4️⃣ keycap 4: four number
5️⃣ keycap 5: five number
🔟 keycap 10: ten number
🅰️ a button: letter a
🅱️ b button: letter b
©️ copyright: copyright legal
®️ registered: registered trademark
™️ trade mark: trademark
💲 heavy dollar sign: dollar money price
💱 currency exchange: exchange money
☮️ peace symbol: peace
☯️ yin yang: balance
✳️ eight spoked asterisk: asterisk
❇️ sparkle: sparkle
🌀 cyclone: swirl spiral
🎵 musical note: music
🏴 black flag: flag
🏳️ white flag: surrender flag
`;

const FLAGS = `
🏳️‍🌈 rainbow flag: pride lgbt
🏴‍☠️ pirate flag: pirate jolly roger
🇺🇳 united nations: un world
🇪🇺 european union: eu europe
🇬🇧 united kingdom: uk britain england
🇮🇪 ireland: irish
🇺🇸 united states: usa america
🇨🇦 canada: canadian
🇦🇺 australia: australian
🇳🇿 new zealand: nz kiwi
🇫🇷 france: french
🇩🇪 germany: german
🇪🇸 spain: spanish
🇵🇹 portugal: portuguese
🇮🇹 italy: italian
🇳🇱 netherlands: dutch holland
🇧🇪 belgium: belgian
🇨🇭 switzerland: swiss
🇦🇹 austria: austrian
🇸🇪 sweden: swedish
🇳🇴 norway: norwegian
🇩🇰 denmark: danish
🇫🇮 finland: finnish
🇵🇱 poland: polish
🇬🇷 greece: greek
🇹🇷 turkey: turkish
🇺🇦 ukraine: ukrainian
🇮🇳 india: indian
🇨🇳 china: chinese
🇯🇵 japan: japanese
🇰🇷 south korea: korean
🇸🇬 singapore: singapore
🇧🇷 brazil: brazilian
🇲🇽 mexico: mexican
🇦🇷 argentina: argentinian
🇿🇦 south africa: south african
🇳🇬 nigeria: nigerian
🇰🇪 kenya: kenyan
🇪🇬 egypt: egyptian
🇮🇱 israel: israeli
🇦🇪 united arab emirates: uae dubai
`;

export const EMOJI_GROUPS: readonly EmojiGroup[] = [
  { id: 'smileys', label: 'Smileys', emoji: parse(SMILEYS) },
  { id: 'people', label: 'People', emoji: parse(PEOPLE) },
  { id: 'nature', label: 'Nature', emoji: parse(NATURE) },
  { id: 'food', label: 'Food', emoji: parse(FOOD) },
  { id: 'travel', label: 'Travel', emoji: parse(TRAVEL) },
  { id: 'activities', label: 'Activities', emoji: parse(ACTIVITIES) },
  { id: 'objects', label: 'Objects', emoji: parse(OBJECTS) },
  { id: 'symbols', label: 'Symbols', emoji: parse(SYMBOLS) },
  { id: 'flags', label: 'Flags', emoji: parse(FLAGS) },
];

const BY_EMOJI = new Map<string, EmojiEntry>(
  EMOJI_GROUPS.flatMap((g) => g.emoji.map((e) => [e.emoji, e] as const)),
);

/** An emoji's entry, for its name; undefined for one the list does not hold (a Recent pick from another build). */
export const emojiEntry = (emoji: string): EmojiEntry | undefined => BY_EMOJI.get(emoji);

/** The emoji a search finds, best first: a name that starts with the query, then a word that does, then a name or
 *  the words holding it. Each emoji once, in list order within a rank. Every word of a several-word query must hit. */
export function searchEmoji(query: string): EmojiEntry[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const ranked: { e: EmojiEntry; rank: number; at: number }[] = [];
  let at = 0;
  for (const e of BY_EMOJI.values()) {
    at += 1;
    const name = e.name.toLowerCase();
    const hay = `${name} ${e.words.toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const first = words[0]!;
    const rank = name.startsWith(first)
      ? 0
      : hay.split(' ').some((w) => w.startsWith(first))
        ? 1
        : 2;
    ranked.push({ e, rank, at });
  }
  return ranked.sort((a, b) => a.rank - b.rank || a.at - b.at).map((r) => r.e);
}
