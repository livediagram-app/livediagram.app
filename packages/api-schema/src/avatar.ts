// The Avatar-mode costume vocabulary (spec/101): the four choices the Avatar
// Panel offers, as closed sets of preset tokens.
//
// It lives in the wire package rather than the editor because both ends need
// it and neither owns it. The editor picks a costume and publishes it on the
// presence channel (AvatarPresence below); a peer receives the packet and
// draws the same character. Written out twice — once as named types in
// apps/live, once inline in the presence message — the two sets could drift,
// and adding a sixteenth jumper to one of them would quietly mean peers never
// see it.
//
// Tokens only, no labels: what a costume is CALLED in the panel is the
// editor's business, and its catalogues (AVATAR_CLOTHING and friends) type
// their ids against these unions so the two cannot separate.
//
// Colour is deliberately absent. The shirt takes the participant's presence
// colour so a character matches its owner's cursor and name chip.
export type AvatarGender = 'male' | 'female';

export type AvatarClothing =
  | 'tee'
  | 'stripes'
  | 'jumper'
  | 'hoodie'
  | 'vest'
  | 'suit'
  | 'dress'
  | 'skirt'
  | 'polo'
  | 'flannel'
  | 'overalls'
  | 'labcoat'
  | 'hawaiian'
  | 'varsity'
  | 'turtleneck'
  | 'apron';

export type AvatarHair =
  | 'short'
  | 'buzz'
  | 'curly'
  | 'long'
  | 'ponytail'
  | 'bun'
  | 'mohawk'
  | 'bald'
  | 'pigtails'
  | 'afro'
  | 'spiky'
  | 'bob'
  | 'braid'
  | 'topknot';

export type AvatarSize = 'small' | 'regular' | 'tall';

export type AvatarConfig = {
  gender: AvatarGender;
  clothing: AvatarClothing;
  hair: AvatarHair;
  size: AvatarSize;
};
