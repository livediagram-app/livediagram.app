import { describeItemNaming } from '@/lib/testing/item-naming';

// What livedesign makes is a design (livedesign/docs/specs/006-design), in its help too: the words livedesign's help
// shows, checked by the shared rule (lib/testing/item-naming.ts), as livedesign/packages/design's design-naming guard
// checks the livedesign tree.
describeItemNaming({ item: 'design' });
