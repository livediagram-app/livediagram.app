# System architecture

Follow the references below only as needed; never upfront.

- ./apps-and-storage.md - when touching where livehuddle keeps a space or how its apps fit together: one SQLite-backed Durable Object per space, no D1, filing and sharing in liveworkspace's index, images in media, presence never stored, and the room's size limits
