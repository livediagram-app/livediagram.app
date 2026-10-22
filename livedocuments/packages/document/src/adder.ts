// Who added an element (docs/specs/013-workspace/share-roles.md "What a Participant changes"): the adder key the
// server stamps as `addedBy` when a Participant adds a sticky or text element. Apart from the participant rule so
// validation can bound it without importing the rule.

// The length of an adder key (blueprint SR4): 128 bits of hex.
export const ADDER_KEY_LENGTH = 32;
