# Architecture

Follow the references below only as needed; never upfront.

- ./architecture.md - when touching how the services fit together: one origin, the paths each Worker takes, what an app's router forwards, who calls whom, environments, deploys and local ports
- ./integrating-an-app.md - when wiring an app to the platform: its secrets and config, sign-in, the token check, guests
- ./room-restore.md - when an operator must wind a room, or every room, back to a moment after a bad deploy: point-in-time recovery, the restore door, its key and its limits
- ./blueprints/README.md - when implementing an architecture spec: the blueprints hold the engineering detail derived from it
