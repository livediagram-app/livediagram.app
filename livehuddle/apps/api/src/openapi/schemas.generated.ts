// GENERATED FILE — do not edit by hand.
// Produced by scripts/gen-openapi-schemas.mjs from @livehuddle/api-schema.
// Regenerate with: pnpm --filter @livehuddle/api gen:openapi
// Served as the `components.schemas` of GET /api/openapi.json (docs/specs/015-api/api-documentation.md).
import type { ComponentSchemas } from '@liveworkspace/api-kit/openapi-types';

export const COMPONENT_SCHEMAS: ComponentSchemas = {
  "AccentEdge": {
    "enum": [
      "left",
      "top",
      "bottom"
    ],
    "type": "string"
  },
  "AccessLevel": {
    "enum": [
      "view",
      "participate",
      "edit"
    ],
    "type": "string"
  },
  "AgentPresenceResult": {
    "additionalProperties": false,
    "properties": {
      "expiresAt": {
        "type": "number"
      },
      "focus": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "status": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "status",
      "focus",
      "expiresAt"
    ],
    "type": "object"
  },
  "AnimationSpeed": {
    "enum": [
      "slowest",
      "slow",
      "normal",
      "fast"
    ],
    "type": "string"
  },
  "ApiToken": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "expiresAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "lastUsedAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "readOnly": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "name",
      "createdAt",
      "lastUsedAt",
      "expiresAt",
      "readOnly"
    ],
    "type": "object"
  },
  "ArcadeScore": {
    "additionalProperties": false,
    "description": "One score on a machine's table.",
    "properties": {
      "at": {
        "description": "When it was posted, epoch ms.",
        "type": "number"
      },
      "by": {
        "description": "The poster's adder key (an Editor without one writes their participant key).",
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "ms": {
        "description": "How long the run played, paused time not counted.",
        "type": "number"
      },
      "name": {
        "description": "The player's display name in the Space, cut to ARCADE_NAME_MAX; \"Guest\" with none.",
        "type": "string"
      },
      "score": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "score",
      "ms",
      "by",
      "at"
    ],
    "type": "object"
  },
  "BackgroundPattern": {
    "enum": [
      "grid",
      "blank",
      "lines",
      "crosshatch",
      "graph",
      "confetti",
      "stripes",
      "diagonal",
      "waves",
      "bricks",
      "hexagonal",
      "engineering",
      "checkerboard",
      "sparkles",
      "eggs",
      "cobwebs",
      "snowflakes",
      "candy-stripes",
      "flow",
      "drift",
      "aurora",
      "ripple",
      "ribbons",
      "isometric",
      "carpet",
      "carpet-tiles",
      "wood",
      "parquet",
      "tiles",
      "marble",
      "terrazzo",
      "concrete",
      "deck",
      "paving",
      "cobbles",
      "grass",
      "sand",
      "mud"
    ],
    "type": "string"
  },
  "BorderRadius": {
    "enum": [
      "none",
      "sm",
      "md",
      "lg",
      "full"
    ],
    "type": "string"
  },
  "BorderStroke": {
    "enum": [
      "none",
      "thin",
      "medium",
      "thick",
      "extra-thick"
    ],
    "type": "string"
  },
  "BorderStyle": {
    "enum": [
      "solid",
      "dashed",
      "dotted",
      "dash-dot",
      "long-dash",
      "dash-dot-dot"
    ],
    "type": "string"
  },
  "BoxedElement": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/ShapeElement"
      },
      {
        "$ref": "#/components/schemas/TextElement"
      },
      {
        "$ref": "#/components/schemas/StickyElement"
      },
      {
        "$ref": "#/components/schemas/ImageElement"
      },
      {
        "$ref": "#/components/schemas/LinkCardElement"
      },
      {
        "$ref": "#/components/schemas/RetiredTypeElement"
      }
    ]
  },
  "CallsMode": {
    "enum": [
      "on",
      "audio-only",
      "off"
    ],
    "type": "string"
  },
  "CapabilitiesResponse": {
    "additionalProperties": false,
    "properties": {
      "apiBase": {
        "type": "string"
      },
      "authEnabled": {
        "type": "boolean"
      },
      "callsEnabled": {
        "type": "boolean"
      },
      "callsMode": {
        "$ref": "#/components/schemas/CallsMode"
      },
      "communityEnabled": {
        "type": "boolean"
      },
      "documentFormat": {
        "type": "number"
      },
      "emailEnabled": {
        "type": "boolean"
      }
    },
    "type": "object"
  },
  "ChairFacing": {
    "$ref": "#/components/schemas/SeatFacing"
  },
  "ChangesetAuthor": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "color"
    ],
    "type": "object"
  },
  "ChangesetBase": {
    "additionalProperties": false,
    "properties": {
      "elements": {
        "additionalProperties": {
          "type": "string"
        },
        "type": "object"
      },
      "rev": {
        "type": "number"
      }
    },
    "required": [
      "rev"
    ],
    "type": "object"
  },
  "ChangesetCounts": {
    "additionalProperties": false,
    "properties": {
      "added": {
        "type": "number"
      },
      "changed": {
        "type": "number"
      },
      "removed": {
        "type": "number"
      }
    },
    "required": [
      "added",
      "changed",
      "removed"
    ],
    "type": "object"
  },
  "ChangesetDetail": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "$ref": "#/components/schemas/ChangesetSummary"
      },
      "results": {
        "items": {
          "$ref": "#/components/schemas/ResultLine"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "changeset",
      "results",
      "text"
    ],
    "type": "object"
  },
  "ChangesetReplaceBody": {
    "additionalProperties": false,
    "properties": {
      "elements": {
        "items": {},
        "type": "array"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "layout": {
        "enum": [
          "auto",
          "preserve"
        ],
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "template": {
        "type": "string"
      },
      "theme": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "ChangesetRequest": {
    "additionalProperties": false,
    "properties": {
      "base": {
        "$ref": "#/components/schemas/ChangesetBase"
      },
      "operations": {
        "anyOf": [
          {
            "items": {},
            "type": "array"
          },
          {
            "type": "string"
          }
        ]
      },
      "replace": {
        "$ref": "#/components/schemas/ChangesetReplaceBody"
      },
      "strict": {
        "type": "boolean"
      },
      "summary": {
        "type": "string"
      }
    },
    "type": "object"
  },
  "ChangesetResponse": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ChangesetWritten"
          },
          {
            "type": "null"
          }
        ]
      },
      "dryRun": {
        "type": "boolean"
      },
      "lint": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/LintReport"
          },
          {
            "type": "null"
          }
        ]
      },
      "results": {
        "items": {
          "$ref": "#/components/schemas/ResultLine"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      },
      "warnings": {
        "items": {
          "type": "string"
        },
        "type": "array"
      }
    },
    "required": [
      "dryRun",
      "changeset",
      "results",
      "text",
      "warnings",
      "lint"
    ],
    "type": "object"
  },
  "ChangesetSummary": {
    "additionalProperties": false,
    "properties": {
      "agent": {
        "type": "boolean"
      },
      "author": {
        "$ref": "#/components/schemas/ChangesetAuthor"
      },
      "counts": {
        "$ref": "#/components/schemas/ChangesetCounts"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "revertOf": {
        "type": [
          "string",
          "null"
        ]
      },
      "summary": {
        "type": [
          "string",
          "null"
        ]
      },
      "tabId": {
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "tabId",
      "rev",
      "author",
      "agent",
      "summary",
      "counts",
      "revertOf",
      "createdAt"
    ],
    "type": "object"
  },
  "ChangesetWritten": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "previousRev": {
        "type": "number"
      },
      "rebasedOver": {
        "type": "number"
      },
      "rev": {
        "type": "number"
      },
      "tabId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "tabId",
      "rev",
      "previousRev",
      "rebasedOver"
    ],
    "type": "object"
  },
  "ClockZone": {
    "additionalProperties": false,
    "description": "One time zone on a world clock: an IANA zone and its label.",
    "properties": {
      "label": {
        "type": "string"
      },
      "zone": {
        "type": "string"
      }
    },
    "required": [
      "zone",
      "label"
    ],
    "type": "object"
  },
  "Comment": {
    "additionalProperties": false,
    "properties": {
      "authorColor": {
        "type": "string"
      },
      "authorId": {
        "type": "string"
      },
      "authorName": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "mentions": {
        "items": {
          "$ref": "#/components/schemas/CommentMention"
        },
        "type": "array"
      },
      "reactions": {
        "items": {
          "$ref": "#/components/schemas/CommentReaction"
        },
        "type": "array"
      },
      "text": {
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "createdAt",
      "authorName",
      "authorColor"
    ],
    "type": "object"
  },
  "CommentMention": {
    "additionalProperties": false,
    "properties": {
      "handle": {
        "type": "string"
      },
      "memberId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "userId",
      "name",
      "handle"
    ],
    "type": "object"
  },
  "CommentReaction": {
    "additionalProperties": false,
    "properties": {
      "by": {
        "type": "string"
      },
      "emoji": {
        "$ref": "#/components/schemas/CommentReactionId"
      },
      "name": {
        "type": "string"
      },
      "person": {
        "type": "string"
      }
    },
    "required": [
      "emoji",
      "by",
      "name"
    ],
    "type": "object"
  },
  "CommentReactionId": {
    "enum": [
      "thumbs-up",
      "thumbs-down",
      "laugh",
      "hooray",
      "heart",
      "eyes"
    ],
    "type": "string"
  },
  "CommentThread": {
    "additionalProperties": false,
    "properties": {
      "comments": {
        "items": {
          "$ref": "#/components/schemas/Comment"
        },
        "type": "array"
      },
      "resolved": {
        "type": "boolean"
      }
    },
    "required": [
      "comments",
      "resolved"
    ],
    "type": "object"
  },
  "CommentsView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "threads": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "comments": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "authorName": {
                    "type": "string"
                  },
                  "createdAt": {
                    "type": "number"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "authorName",
                  "createdAt",
                  "text"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "ref": {
              "type": "string"
            },
            "resolved": {
              "type": "boolean"
            }
          },
          "required": [
            "ref",
            "kind",
            "label",
            "resolved",
            "comments"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "threads",
      "elision"
    ],
    "type": "object"
  },
  "CommunityApp": {
    "enum": [
      "livediagram.app",
      "liveplanner.app",
      "livedocuments.app",
      "livedesign.app",
      "livehuddle.app"
    ],
    "type": "string"
  },
  "CommunityAuthor": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "picture": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "name",
      "color",
      "picture"
    ],
    "type": "object"
  },
  "CommunityCategory": {
    "enum": [
      "branding",
      "campus",
      "careers",
      "decisions",
      "education",
      "events",
      "finance",
      "games",
      "goals",
      "health",
      "hiring",
      "home",
      "homes",
      "ideas",
      "learning",
      "marketing",
      "media",
      "meetings",
      "office",
      "onboarding",
      "other",
      "outdoor",
      "people",
      "personal",
      "photos",
      "pitches",
      "planning",
      "plans",
      "processes",
      "product",
      "recreation",
      "reports",
      "retros",
      "sales",
      "shopping",
      "social",
      "software",
      "speeches",
      "strategy",
      "support",
      "team",
      "travel",
      "venues",
      "websites",
      "work"
    ],
    "type": "string"
  },
  "CommunityMinePost": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "app": {
        "$ref": "#/components/schemas/CommunityApp"
      },
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "copyCount": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "documentId": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      },
      "publishedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "state": {
        "$ref": "#/components/schemas/CommunityPostState"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "anonymous",
      "app",
      "author",
      "category",
      "copyCount",
      "description",
      "documentId",
      "id",
      "likeCount",
      "liked",
      "publishedAt",
      "shareCode",
      "state",
      "tags",
      "title",
      "updatedAt"
    ],
    "type": "object"
  },
  "CommunityMineResponse": {
    "additionalProperties": false,
    "properties": {
      "nextOffset": {
        "type": [
          "number",
          "null"
        ]
      },
      "posts": {
        "items": {
          "$ref": "#/components/schemas/CommunityMinePost"
        },
        "type": "array"
      },
      "totals": {
        "$ref": "#/components/schemas/CommunityMineTotals"
      }
    },
    "required": [
      "posts",
      "nextOffset",
      "totals"
    ],
    "type": "object"
  },
  "CommunityMineTotals": {
    "additionalProperties": false,
    "properties": {
      "copies": {
        "type": "number"
      },
      "likes": {
        "type": "number"
      },
      "posts": {
        "type": "number"
      }
    },
    "required": [
      "posts",
      "likes",
      "copies"
    ],
    "type": "object"
  },
  "CommunityOwnPost": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "app": {
        "$ref": "#/components/schemas/CommunityApp"
      },
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "copyCount": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "likeCount": {
        "type": "number"
      },
      "liked": {
        "type": "boolean"
      },
      "publishedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": "string"
      },
      "state": {
        "$ref": "#/components/schemas/CommunityPostState"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "anonymous",
      "app",
      "author",
      "category",
      "copyCount",
      "description",
      "id",
      "likeCount",
      "liked",
      "publishedAt",
      "shareCode",
      "state",
      "tags",
      "title",
      "updatedAt"
    ],
    "type": "object"
  },
  "CommunityPostInput": {
    "additionalProperties": false,
    "properties": {
      "anonymous": {
        "type": "boolean"
      },
      "category": {
        "$ref": "#/components/schemas/CommunityCategory"
      },
      "description": {
        "type": "string"
      },
      "tags": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "title",
      "description",
      "category",
      "tags",
      "anonymous"
    ],
    "type": "object"
  },
  "CommunityPostState": {
    "enum": [
      "listed",
      "hidden"
    ],
    "type": "string"
  },
  "CommunityShareInfo": {
    "additionalProperties": false,
    "properties": {
      "author": {
        "$ref": "#/components/schemas/CommunityAuthor"
      },
      "postId": {
        "type": "string"
      }
    },
    "required": [
      "postId",
      "author"
    ],
    "type": "object"
  },
  "CreationTabKind": {
    "const": "diagram",
    "type": "string"
  },
  "CurrentTokenResponse": {
    "additionalProperties": false,
    "properties": {
      "accountId": {
        "type": "string"
      },
      "accountName": {
        "type": [
          "string",
          "null"
        ]
      },
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "role": {
        "enum": [
          "full",
          "read-only"
        ],
        "type": "string"
      },
      "tokenId": {
        "type": "string"
      },
      "tokenName": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "accountId",
      "accountName",
      "tokenId",
      "tokenName",
      "role",
      "expiresAt"
    ],
    "type": "object"
  },
  "DiffView": {
    "additionalProperties": false,
    "properties": {
      "changes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "changes": {
              "items": {
                "additionalProperties": false,
                "properties": {
                  "after": {},
                  "before": {},
                  "field": {
                    "type": "string"
                  }
                },
                "required": [
                  "field",
                  "before",
                  "after"
                ],
                "type": "object"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "op": {
              "enum": [
                "+",
                "-",
                "~"
              ],
              "type": "string"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "op",
            "ref",
            "kind",
            "label",
            "changes"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "since": {
        "type": "number"
      }
    },
    "required": [
      "header",
      "since",
      "changes",
      "elision"
    ],
    "type": "object"
  },
  "Document": {
    "additionalProperties": false,
    "properties": {
      "communityState": {
        "enum": [
          "listed",
          "hidden",
          null
        ],
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "number"
      },
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/EditorMode"
          },
          {
            "type": "null"
          }
        ]
      },
      "ownerColor": {
        "type": [
          "string",
          "null"
        ]
      },
      "ownerId": {
        "type": "string"
      },
      "ownerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "presentation": {
        "type": [
          "string",
          "null"
        ]
      },
      "savedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "shareable": {
        "type": "boolean"
      },
      "source": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabKind": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CreationTabKind"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/TabSummary"
        },
        "type": "array"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "templateFamily": {
        "$ref": "#/components/schemas/TemplateFamilyOrNone"
      }
    },
    "required": [
      "createdAt",
      "folderId",
      "id",
      "name",
      "opensIn",
      "ownerColor",
      "ownerId",
      "ownerName",
      "presentation",
      "savedAt",
      "shareCode",
      "shareable",
      "source",
      "tabKind",
      "tabs",
      "teamId",
      "templateFamily"
    ],
    "type": "object"
  },
  "DocumentCommentThread": {
    "additionalProperties": false,
    "properties": {
      "comments": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "authorColor": {
              "type": "string"
            },
            "authorId": {
              "type": "string"
            },
            "authorName": {
              "type": "string"
            },
            "createdAt": {
              "type": "number"
            },
            "id": {
              "type": "string"
            },
            "mentions": {
              "items": {
                "$ref": "#/components/schemas/CommentMention"
              },
              "type": "array"
            },
            "reactions": {
              "items": {
                "$ref": "#/components/schemas/ReactionSummary"
              },
              "type": "array"
            },
            "text": {
              "type": "string"
            },
            "tokenId": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "text",
            "createdAt",
            "authorName",
            "authorColor"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elementId": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "resolved": {
        "type": "boolean"
      },
      "tabId": {
        "type": "string"
      },
      "tabName": {
        "type": "string"
      }
    },
    "required": [
      "tabId",
      "tabName",
      "elementId",
      "ref",
      "label",
      "resolved",
      "comments"
    ],
    "type": "object"
  },
  "DocumentSource": {
    "enum": [
      "mcp",
      "cli"
    ],
    "type": "string"
  },
  "DocumentStats": {
    "additionalProperties": false,
    "properties": {
      "bytes": {
        "type": "number"
      },
      "comments": {
        "type": "number"
      },
      "elements": {
        "type": "number"
      },
      "mode": {
        "$ref": "#/components/schemas/EditorMode"
      }
    },
    "required": [
      "mode",
      "elements",
      "comments",
      "bytes"
    ],
    "type": "object"
  },
  "DocumentSummary": {
    "additionalProperties": false,
    "properties": {
      "communityListed": {
        "type": "boolean"
      },
      "createdAt": {
        "type": "number"
      },
      "empty": {
        "type": "boolean"
      },
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/EditorMode"
          },
          {
            "type": "null"
          }
        ]
      },
      "ownerId": {
        "type": "string"
      },
      "savedAt": {
        "type": "number"
      },
      "shareCode": {
        "type": [
          "string",
          "null"
        ]
      },
      "shareable": {
        "type": "boolean"
      },
      "source": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentSource"
          },
          {
            "type": "null"
          }
        ]
      },
      "stats": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/DocumentStats"
          },
          {
            "type": "null"
          }
        ]
      },
      "tabKind": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/CreationTabKind"
          },
          {
            "type": "null"
          }
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "templateFamily": {
        "$ref": "#/components/schemas/TemplateFamilyOrNone"
      }
    },
    "required": [
      "communityListed",
      "createdAt",
      "empty",
      "folderId",
      "id",
      "name",
      "opensIn",
      "ownerId",
      "savedAt",
      "shareCode",
      "shareable",
      "source",
      "stats",
      "tabKind",
      "teamId",
      "templateFamily"
    ],
    "type": "object"
  },
  "DrawingAnimation": {
    "enum": [
      "draw",
      "trace",
      "dash",
      "boil",
      "ink",
      "glow",
      "shimmer"
    ],
    "type": "string"
  },
  "EditWarning": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "$ref": "#/components/schemas/EditWarningCode"
      },
      "message": {
        "type": "string"
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "code",
      "message"
    ],
    "type": "object"
  },
  "EditWarningCode": {
    "enum": [
      "no_base",
      "shape_coerced",
      "value_coerced",
      "label_capped",
      "colour_overrides_theme",
      "arrows_freed"
    ],
    "type": "string"
  },
  "EditorMode": {
    "const": "workshop",
    "type": "string"
  },
  "Element": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/BoxedElement"
      },
      {
        "$ref": "#/components/schemas/RetiredArrowElement"
      }
    ]
  },
  "ElementAction": {
    "additionalProperties": false,
    "properties": {
      "assignee": {
        "$ref": "#/components/schemas/ElementActionAssignee"
      },
      "assignerId": {
        "type": "string"
      },
      "assignerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "number"
      },
      "description": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "status": {
        "$ref": "#/components/schemas/ElementActionStatus"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "description",
      "assignee",
      "teamId",
      "assignerId",
      "assignerName",
      "status",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "ElementActionAssignee": {
    "additionalProperties": false,
    "properties": {
      "memberId": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "userId",
      "name"
    ],
    "type": "object"
  },
  "ElementActionStatus": {
    "enum": [
      "open",
      "done",
      "wont-do"
    ],
    "type": "string"
  },
  "ElementAnimation": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/ShapeAnimation"
      },
      {
        "$ref": "#/components/schemas/StickyAnimation"
      },
      {
        "$ref": "#/components/schemas/DrawingAnimation"
      },
      {
        "$ref": "#/components/schemas/MediaAnimation"
      }
    ]
  },
  "ElementId": {
    "type": "string"
  },
  "ElementLink": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "tab",
            "type": "string"
          },
          "tabId": {
            "$ref": "#/components/schemas/TabId"
          }
        },
        "required": [
          "kind",
          "tabId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "elementId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "element",
            "type": "string"
          },
          "tabId": {
            "$ref": "#/components/schemas/TabId"
          }
        },
        "required": [
          "kind",
          "tabId",
          "elementId"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "documentId": {
            "type": "string"
          },
          "kind": {
            "const": "document",
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "documentId",
          "name"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "url",
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        },
        "required": [
          "kind",
          "url"
        ],
        "type": "object"
      }
    ]
  },
  "ElementShadow": {
    "additionalProperties": false,
    "properties": {
      "blur": {
        "type": "number"
      },
      "offsetX": {
        "type": "number"
      },
      "offsetY": {
        "type": "number"
      },
      "opacity": {
        "type": "number"
      }
    },
    "required": [
      "offsetX",
      "offsetY",
      "blur",
      "opacity"
    ],
    "type": "object"
  },
  "Elision": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "arguments": {
            "additionalProperties": {
              "type": [
                "string",
                "number",
                "boolean"
              ]
            },
            "type": "object"
          },
          "collapsed": {
            "items": {
              "additionalProperties": false,
              "properties": {
                "elements": {
                  "type": "number"
                },
                "kind": {
                  "type": "string"
                },
                "ref": {
                  "type": "string"
                }
              },
              "required": [
                "ref",
                "kind",
                "elements"
              ],
              "type": "object"
            },
            "type": "array"
          },
          "command": {
            "type": "string"
          },
          "dropped": {
            "items": {
              "enum": [
                "notes",
                "attributes"
              ],
              "type": "string"
            },
            "type": "array"
          },
          "omitted": {
            "items": {
              "additionalProperties": false,
              "properties": {
                "count": {
                  "type": "number"
                },
                "noun": {
                  "type": "string"
                }
              },
              "required": [
                "noun",
                "count"
              ],
              "type": "object"
            },
            "type": "array"
          }
        },
        "required": [
          "dropped",
          "collapsed",
          "omitted",
          "arguments",
          "command"
        ],
        "type": "object"
      },
      {
        "type": "null"
      }
    ]
  },
  "FieldChange": {
    "additionalProperties": false,
    "properties": {
      "from": {
        "$ref": "#/components/schemas/JsonValue"
      },
      "key": {
        "type": "string"
      },
      "to": {
        "$ref": "#/components/schemas/JsonValue"
      }
    },
    "required": [
      "key"
    ],
    "type": "object"
  },
  "FindField": {
    "enum": [
      "label",
      "note",
      "edge",
      "cell",
      "item",
      "code",
      "comment"
    ],
    "type": "string"
  },
  "FindView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "matches": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "field": {
              "$ref": "#/components/schemas/FindField"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "path": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "kind",
            "label",
            "field",
            "path"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "q": {
        "type": "string"
      }
    },
    "required": [
      "header",
      "q",
      "matches",
      "elision"
    ],
    "type": "object"
  },
  "Finish": {
    "enum": [
      "flexible",
      "professional",
      "sketch",
      "marker"
    ],
    "type": "string"
  },
  "Folder": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "ownerId": {
        "type": "string"
      },
      "parentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "ownerId",
      "parentId",
      "teamId",
      "name",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "FreehandRunJson": {
    "additionalProperties": false,
    "properties": {
      "closed": {
        "type": "number"
      },
      "refs": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "run": {
        "const": "freehand",
        "type": "string"
      }
    },
    "required": [
      "run",
      "refs",
      "closed"
    ],
    "type": "object"
  },
  "GraphView": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "nodes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string"
            },
            "kind": {
              "type": "string"
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "id",
            "kind",
            "label"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "nodes",
      "arrows",
      "elision"
    ],
    "type": "object"
  },
  "HuedPenColourName": {
    "description": "The eight hued stock colours, each tuned per board.",
    "enum": [
      "blue",
      "red",
      "orange",
      "yellow",
      "green",
      "teal",
      "violet",
      "pink"
    ],
    "type": "string"
  },
  "IconAnimation": {
    "enum": [
      "spin",
      "beat",
      "pulse",
      "glow",
      "ping",
      "breathe",
      "shimmer",
      "bounce",
      "wiggle",
      "flash",
      "tada",
      "flip",
      "jump",
      "swing",
      "float"
    ],
    "type": "string"
  },
  "IconPosition": {
    "enum": [
      "left",
      "right",
      "above",
      "below"
    ],
    "type": "string"
  },
  "IconSearchResponse": {
    "additionalProperties": false,
    "properties": {
      "icons": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string"
            },
            "label": {
              "type": "string"
            },
            "set": {
              "enum": [
                "line",
                "technology"
              ],
              "type": "string"
            }
          },
          "required": [
            "id",
            "label",
            "set"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "more": {
        "type": "number"
      }
    },
    "required": [
      "icons",
      "more"
    ],
    "type": "object"
  },
  "IconSize": {
    "enum": [
      "sm",
      "md",
      "lg",
      "xl"
    ],
    "type": "string"
  },
  "IconWeight": {
    "enum": [
      "thin",
      "regular",
      "bold"
    ],
    "type": "string"
  },
  "ImageCredit": {
    "additionalProperties": false,
    "properties": {
      "licenseUrl": {
        "type": "string"
      },
      "sourceUrl": {
        "type": "string"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "text",
      "sourceUrl"
    ],
    "type": "object"
  },
  "ImageElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "alt": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "credit": {
        "$ref": "#/components/schemas/ImageCredit"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "imageId": {
        "type": [
          "string",
          "null"
        ]
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "naturalHeight": {
        "type": "number"
      },
      "naturalWidth": {
        "type": "number"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "objectFit": {
        "enum": [
          "cover",
          "contain"
        ],
        "type": "string"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "image",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "imageId"
    ],
    "type": "object"
  },
  "ImageSummary": {
    "additionalProperties": false,
    "properties": {
      "byteSize": {
        "type": "number"
      },
      "contentType": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "originalName": {
        "type": "string"
      },
      "width": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "contentType",
      "byteSize",
      "width",
      "height",
      "createdAt"
    ],
    "type": "object"
  },
  "JsonValue": {
    "anyOf": [
      {
        "type": "string"
      },
      {
        "type": "number"
      },
      {
        "type": "boolean"
      },
      {
        "type": "null"
      },
      {
        "items": {
          "$ref": "#/components/schemas/JsonValue"
        },
        "type": "array"
      },
      {
        "additionalProperties": {
          "$ref": "#/components/schemas/JsonValue"
        },
        "type": "object"
      }
    ]
  },
  "LayoutView": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "from": {
              "type": "string"
            },
            "ref": {
              "type": "string"
            },
            "style": {
              "type": "string"
            },
            "to": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "from",
            "to",
            "style"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "boxes": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "h": {
              "type": "number"
            },
            "r": {
              "type": "number"
            },
            "ref": {
              "type": "string"
            },
            "w": {
              "type": "number"
            },
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          },
          "required": [
            "ref",
            "x",
            "y",
            "w",
            "h",
            "r"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "origin": {
        "additionalProperties": false,
        "properties": {
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          }
        },
        "required": [
          "x",
          "y"
        ],
        "type": "object"
      },
      "rows": {
        "anyOf": [
          {
            "items": {
              "additionalProperties": false,
              "properties": {
                "container": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "rows": {
                  "items": {
                    "items": {
                      "type": "string"
                    },
                    "type": "array"
                  },
                  "type": "array"
                }
              },
              "required": [
                "container",
                "rows"
              ],
              "type": "object"
            },
            "type": "array"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "header",
      "origin",
      "boxes",
      "arrows",
      "rows",
      "elision"
    ],
    "type": "object"
  },
  "LinkCardElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "meta": {
        "$ref": "#/components/schemas/LinkCardMeta"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "link-card",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "LinkCardMeta": {
    "additionalProperties": false,
    "properties": {
      "favicon": {
        "type": "string"
      },
      "image": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url"
    ],
    "type": "object"
  },
  "LintCode": {
    "enum": [
      "box-overlap",
      "arrow-dangling",
      "arrow-behind-box",
      "edge-crossings",
      "label-collision",
      "label-overflow",
      "node-isolated",
      "duplicate-label",
      "flow-backwards",
      "aspect-extreme",
      "colour-on-themed",
      "text-overflow"
    ],
    "type": "string"
  },
  "LintFinding": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "$ref": "#/components/schemas/LintCode"
      },
      "fix": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "refs": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "severity": {
        "$ref": "#/components/schemas/LintSeverity"
      }
    },
    "required": [
      "code",
      "severity",
      "refs",
      "message",
      "fix"
    ],
    "type": "object"
  },
  "LintMeasures": {
    "additionalProperties": false,
    "properties": {
      "arrows": {
        "type": "number"
      },
      "behind": {
        "type": "number"
      },
      "boxes": {
        "type": "number"
      },
      "crossings": {
        "type": [
          "number",
          "null"
        ]
      },
      "extent": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "height": {
                "type": "number"
              },
              "width": {
                "type": "number"
              }
            },
            "required": [
              "width",
              "height"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "overlaps": {
        "type": "number"
      }
    },
    "required": [
      "crossings",
      "behind",
      "overlaps",
      "extent",
      "arrows",
      "boxes"
    ],
    "type": "object"
  },
  "LintReport": {
    "additionalProperties": false,
    "properties": {
      "counts": {
        "additionalProperties": false,
        "properties": {
          "error": {
            "type": "number"
          },
          "info": {
            "type": "number"
          },
          "warning": {
            "type": "number"
          }
        },
        "required": [
          "error",
          "warning",
          "info"
        ],
        "type": "object"
      },
      "findings": {
        "items": {
          "$ref": "#/components/schemas/LintFinding"
        },
        "type": "array"
      },
      "measures": {
        "$ref": "#/components/schemas/LintMeasures"
      },
      "skipped": {
        "additionalProperties": false,
        "properties": {
          "crossings": {
            "type": "boolean"
          }
        },
        "required": [
          "crossings"
        ],
        "type": "object"
      }
    },
    "required": [
      "measures",
      "findings",
      "counts",
      "skipped"
    ],
    "type": "object"
  },
  "LintSeverity": {
    "enum": [
      "error",
      "warning",
      "info"
    ],
    "type": "string"
  },
  "MediaAnimation": {
    "enum": [
      "kenburns",
      "zoom",
      "pan",
      "tilt",
      "develop",
      "focus",
      "wipe",
      "iris",
      "sheen"
    ],
    "type": "string"
  },
  "NoteColor": {
    "enum": [
      "yellow",
      "pink",
      "blue",
      "green",
      "purple"
    ],
    "type": "string"
  },
  "NoticeNote": {
    "additionalProperties": false,
    "description": "One note pinned on a notice board (docs/specs/009-elements/social-pieces.md \"Notice Board\").",
    "properties": {
      "at": {
        "type": "number"
      },
      "author": {
        "type": "string"
      },
      "by": {
        "type": "string"
      },
      "color": {
        "$ref": "#/components/schemas/NoteColor"
      },
      "day": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "text": {
        "type": "string"
      },
      "title": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "author",
      "by",
      "at"
    ],
    "type": "object"
  },
  "OutlineNode": {
    "additionalProperties": false,
    "properties": {
      "attributes": {
        "items": {
          "$ref": "#/components/schemas/ViewAttributeJson"
        },
        "type": "array"
      },
      "children": {
        "items": {
          "anyOf": [
            {
              "$ref": "#/components/schemas/OutlineNode"
            },
            {
              "$ref": "#/components/schemas/FreehandRunJson"
            }
          ]
        },
        "type": "array"
      },
      "collapsed": {
        "type": "number"
      },
      "edges": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "id": {
        "type": "string"
      },
      "kind": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "summary": {
        "type": [
          "string",
          "null"
        ]
      },
      "unknown": {
        "type": "boolean"
      }
    },
    "required": [
      "ref",
      "id",
      "kind",
      "unknown",
      "label",
      "summary",
      "attributes",
      "edges",
      "children",
      "collapsed"
    ],
    "type": "object"
  },
  "OutlineView": {
    "additionalProperties": false,
    "properties": {
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "nodes": {
        "items": {
          "anyOf": [
            {
              "$ref": "#/components/schemas/OutlineNode"
            },
            {
              "$ref": "#/components/schemas/FreehandRunJson"
            }
          ]
        },
        "type": "array"
      },
      "ownLineArrows": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "nodes",
      "ownLineArrows",
      "elision"
    ],
    "type": "object"
  },
  "OverviewTab": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "outOfScope": {
            "const": true,
            "type": "boolean"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "outOfScope",
          "ref"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "counts": {
            "additionalProperties": false,
            "properties": {
              "arrows": {
                "type": "number"
              },
              "boxes": {
                "type": "number"
              }
            },
            "required": [
              "boxes",
              "arrows"
            ],
            "type": "object"
          },
          "elements": {
            "type": "number"
          },
          "finish": {
            "$ref": "#/components/schemas/Finish"
          },
          "outOfScope": {
            "const": false,
            "type": "boolean"
          },
          "rev": {
            "type": [
              "number",
              "null"
            ]
          },
          "tab": {
            "additionalProperties": false,
            "properties": {
              "id": {
                "type": "string"
              },
              "kind": {
                "$ref": "#/components/schemas/TabKind"
              },
              "name": {
                "type": "string"
              },
              "ref": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "ref",
              "name",
              "kind"
            ],
            "type": "object"
          },
          "threads": {
            "additionalProperties": false,
            "properties": {
              "open": {
                "type": "number"
              },
              "total": {
                "type": "number"
              }
            },
            "required": [
              "open",
              "total"
            ],
            "type": "object"
          },
          "unknown": {
            "type": "number"
          },
          "view": {
            "$ref": "#/components/schemas/ViewName"
          }
        },
        "required": [
          "counts",
          "elements",
          "outOfScope",
          "rev",
          "tab",
          "threads",
          "unknown",
          "view"
        ],
        "type": "object"
      }
    ]
  },
  "OverviewView": {
    "additionalProperties": false,
    "properties": {
      "document": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "savedAt": {
            "type": "number"
          },
          "tabs": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "name",
          "savedAt",
          "tabs"
        ],
        "type": "object"
      },
      "elision": {
        "$ref": "#/components/schemas/Elision"
      },
      "tabs": {
        "items": {
          "$ref": "#/components/schemas/OverviewTab"
        },
        "type": "array"
      }
    },
    "required": [
      "document",
      "tabs",
      "elision"
    ],
    "type": "object"
  },
  "Padding": {
    "enum": [
      "none",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "ParticipantRecord": {
    "additionalProperties": false,
    "properties": {
      "color": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "picture": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "createdAt"
    ],
    "type": "object"
  },
  "PenColourName": {
    "anyOf": [
      {
        "const": "ink",
        "type": "string"
      },
      {
        "const": "grey",
        "type": "string"
      },
      {
        "$ref": "#/components/schemas/HuedPenColourName"
      }
    ]
  },
  "PieceTimer": {
    "additionalProperties": false,
    "description": "What a Timer or Stopwatch stores (`ShapeElement.pieceTimer`): one shape for both.",
    "properties": {
      "accumulatedMs": {
        "description": "Time counted before the current run.",
        "type": "number"
      },
      "durationMs": {
        "description": "A Timer's length; 0 on a Stopwatch.",
        "type": "number"
      },
      "running": {
        "description": "Counting now.",
        "type": "boolean"
      },
      "startedAt": {
        "description": "Epoch ms the current run started; 0 while not running.",
        "type": "number"
      }
    },
    "required": [
      "running",
      "startedAt",
      "accumulatedMs",
      "durationMs"
    ],
    "type": "object"
  },
  "QuickSwatchSlot": {
    "enum": [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "type": "number"
  },
  "Reaction": {
    "enum": [
      "confetti",
      "sparkles",
      "hearts",
      "applause",
      "fireworks"
    ],
    "type": "string"
  },
  "ReactionSummary": {
    "additionalProperties": false,
    "properties": {
      "by": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "count": {
        "type": "number"
      },
      "emoji": {
        "type": "string"
      },
      "name": {
        "type": "string"
      }
    },
    "required": [
      "emoji",
      "name",
      "count",
      "by"
    ],
    "type": "object"
  },
  "RefCandidate": {
    "additionalProperties": false,
    "properties": {
      "kind": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "ref",
      "kind",
      "label"
    ],
    "type": "object"
  },
  "RefErrorBody": {
    "additionalProperties": false,
    "properties": {
      "candidates": {
        "items": {
          "$ref": "#/components/schemas/RefCandidate"
        },
        "type": "array"
      },
      "error": {
        "enum": [
          "target_not_found",
          "target_ambiguous"
        ],
        "type": "string"
      },
      "input": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "stale": {
        "type": "boolean"
      }
    },
    "required": [
      "error",
      "message",
      "input",
      "candidates",
      "stale"
    ],
    "type": "object"
  },
  "ResultLine": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "at": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "ends": {
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "kind": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "mark": {
            "const": "+",
            "type": "string"
          },
          "ref": {
            "type": "string"
          },
          "size": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "styleOf": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "kind"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "changes": {
            "items": {
              "$ref": "#/components/schemas/FieldChange"
            },
            "type": "array"
          },
          "mark": {
            "const": "~",
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "changes"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "ends": {
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "kind": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "mark": {
            "const": "-",
            "type": "string"
          },
          "pinnedTo": {
            "type": "string"
          },
          "reason": {
            "const": "pinned",
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "mark",
          "ref",
          "kind"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "delta": {
            "items": {
              "type": "number"
            },
            "maxItems": 2,
            "minItems": 2,
            "type": "array"
          },
          "layout": {
            "additionalProperties": false,
            "properties": {
              "direction": {
                "enum": [
                  "down",
                  "right"
                ],
                "type": "string"
              },
              "style": {
                "enum": [
                  "flow",
                  "tree"
                ],
                "type": "string"
              }
            },
            "required": [
              "style"
            ],
            "type": "object"
          },
          "mark": {
            "const": "»",
            "type": "string"
          },
          "reason": {
            "enum": [
              "make room",
              "laid out"
            ],
            "type": "string"
          },
          "refs": {
            "items": {
              "type": "string"
            },
            "type": "array"
          }
        },
        "required": [
          "mark",
          "refs",
          "reason"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "mark": {
            "const": "!",
            "type": "string"
          },
          "warning": {
            "$ref": "#/components/schemas/EditWarning"
          }
        },
        "required": [
          "mark",
          "warning"
        ],
        "type": "object"
      }
    ]
  },
  "RetiredAnchor": {
    "enum": [
      "n",
      "nne",
      "ne",
      "ene",
      "e",
      "ese",
      "se",
      "sse",
      "s",
      "ssw",
      "sw",
      "wsw",
      "w",
      "wnw",
      "nw",
      "nnw"
    ],
    "type": "string"
  },
  "RetiredArrowElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "arrowEnds": {
        "enum": [
          "from",
          "to",
          "both",
          "none"
        ],
        "type": "string"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "from": {
        "$ref": "#/components/schemas/RetiredEndpoint"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "to": {
        "$ref": "#/components/schemas/RetiredEndpoint"
      },
      "type": {
        "const": "arrow",
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "from",
      "to"
    ],
    "type": "object"
  },
  "RetiredEndpoint": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "kind": {
            "const": "free",
            "type": "string"
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          }
        },
        "required": [
          "kind",
          "x",
          "y"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "anchor": {
            "$ref": "#/components/schemas/RetiredAnchor"
          },
          "elementId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "pinned",
            "type": "string"
          }
        },
        "required": [
          "kind",
          "elementId",
          "anchor"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "arrowId": {
            "$ref": "#/components/schemas/ElementId"
          },
          "kind": {
            "const": "on-arrow",
            "type": "string"
          },
          "t": {
            "type": "number"
          }
        },
        "required": [
          "kind",
          "arrowId",
          "t"
        ],
        "type": "object"
      }
    ]
  },
  "RetiredTypeElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "enum": [
          "video",
          "table",
          "freehand",
          "path",
          "annotation"
        ],
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "RevertKept": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "reason": {
        "enum": [
          "changed",
          "gone",
          "present",
          "order"
        ],
        "type": "string"
      }
    },
    "required": [
      "id",
      "reason"
    ],
    "type": "object"
  },
  "RevertResponse": {
    "additionalProperties": false,
    "properties": {
      "changeset": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/ChangesetWritten"
          },
          {
            "type": "null"
          }
        ]
      },
      "kept": {
        "items": {
          "$ref": "#/components/schemas/RevertKept"
        },
        "type": "array"
      },
      "lint": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/LintReport"
          },
          {
            "type": "null"
          }
        ]
      },
      "reverted": {
        "type": "number"
      }
    },
    "required": [
      "changeset",
      "reverted",
      "kept",
      "lint"
    ],
    "type": "object"
  },
  "RoomDoor": {
    "enum": [
      "n",
      "e",
      "s",
      "w",
      "none"
    ],
    "type": "string"
  },
  "RunHeading": {
    "enum": [
      1,
      2,
      3
    ],
    "type": "number"
  },
  "RunSize": {
    "enum": [
      "xs",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "SeatFacing": {
    "description": "Where a piece's back is: 'n' at the top, so its front (and its sitter) faces down the canvas.",
    "enum": [
      "n",
      "e",
      "s",
      "w"
    ],
    "type": "string"
  },
  "SelectionMode": {
    "const": "avatar",
    "type": "string"
  },
  "ShapeAnimation": {
    "enum": [
      "pulse",
      "blink",
      "glow",
      "trace",
      "gradient",
      "heartbeat",
      "breathe",
      "shimmer",
      "highlight",
      "bounce",
      "wobble",
      "shake",
      "jelly",
      "float",
      "swing"
    ],
    "type": "string"
  },
  "ShapeElement": {
    "additionalProperties": false,
    "properties": {
      "accentEdge": {
        "$ref": "#/components/schemas/AccentEdge"
      },
      "accentEdgeColor": {
        "type": "string"
      },
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "actions": {
        "items": {
          "$ref": "#/components/schemas/ElementAction"
        },
        "type": "array"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "arcadeScores": {
        "items": {
          "$ref": "#/components/schemas/ArcadeScore"
        },
        "type": "array"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "borderRadius": {
        "$ref": "#/components/schemas/BorderRadius"
      },
      "chairFacing": {
        "$ref": "#/components/schemas/ChairFacing"
      },
      "clockZones": {
        "items": {
          "$ref": "#/components/schemas/ClockZone"
        },
        "type": "array"
      },
      "colorPreset": {
        "type": "string"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "doorClosed": {
        "type": "boolean"
      },
      "fillColor": {
        "type": "string"
      },
      "fillSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "fixedSize": {
        "type": "boolean"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "iconAnimation": {
        "$ref": "#/components/schemas/IconAnimation"
      },
      "iconAnimationRepeat": {
        "type": "boolean"
      },
      "iconAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "iconId": {
        "type": "string"
      },
      "iconPosition": {
        "$ref": "#/components/schemas/IconPosition"
      },
      "iconSize": {
        "$ref": "#/components/schemas/IconSize"
      },
      "iconWeight": {
        "$ref": "#/components/schemas/IconWeight"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "jukeboxSource": {
        "type": "string"
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "marker": {
        "$ref": "#/components/schemas/ShapeMarker"
      },
      "markerSize": {
        "$ref": "#/components/schemas/TextSizePreset"
      },
      "mode": {
        "$ref": "#/components/schemas/SelectionMode"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "noticeNotes": {
        "items": {
          "$ref": "#/components/schemas/NoticeNote"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "pieceTimer": {
        "$ref": "#/components/schemas/PieceTimer"
      },
      "portalTarget": {
        "$ref": "#/components/schemas/ElementId"
      },
      "reaction": {
        "$ref": "#/components/schemas/Reaction"
      },
      "receptionistLeft": {
        "type": "boolean"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "roomDoor": {
        "$ref": "#/components/schemas/RoomDoor"
      },
      "roomOutline": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "x": {
              "type": "number"
            },
            "y": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "y"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "screenUrl": {
        "type": "string"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "shape": {
        "$ref": "#/components/schemas/ShapeKind"
      },
      "stageCameras": {
        "type": "boolean"
      },
      "stageSpeakers": {
        "$ref": "#/components/schemas/StageSpeakers"
      },
      "stickerId": {
        "type": "string"
      },
      "strokeColor": {
        "type": "string"
      },
      "strokeStyle": {
        "$ref": "#/components/schemas/BorderStyle"
      },
      "strokeSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "strokeWidth": {
        "$ref": "#/components/schemas/BorderStroke"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "themeLockFill": {
        "type": "boolean"
      },
      "type": {
        "const": "shape",
        "type": "string"
      },
      "variant": {
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "shape",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "ShapeKind": {
    "enum": [
      "square",
      "circle",
      "diamond",
      "cylinder",
      "parallelogram",
      "hexagon",
      "document",
      "mode-button",
      "portal",
      "chair",
      "fence",
      "avatar-pad",
      "desk",
      "sofa",
      "room",
      "corridor",
      "meeting-table",
      "plant",
      "bookshelf",
      "water-cooler",
      "coffee-machine",
      "rug",
      "stage",
      "office-pod",
      "bar",
      "bar-stool",
      "drinks-cabinet",
      "drinks-fridge",
      "outdoor-plant",
      "tree",
      "garden-path",
      "grass",
      "garden-fence",
      "notice-board",
      "world-clock",
      "jukebox",
      "ping-pong-table",
      "arcade-machine",
      "fireplace",
      "campfire",
      "bench",
      "picnic-table",
      "hammock",
      "garden-umbrella",
      "fountain",
      "pond",
      "pool-table",
      "foosball-table",
      "dartboard",
      "vending-machine",
      "bean-bag",
      "reading-nook",
      "printer",
      "copier",
      "lockers",
      "coat-rack",
      "umbrella-stand",
      "kitchen-counter",
      "kitchen-sink",
      "fridge",
      "microwave",
      "kettle",
      "toilet-cubicle",
      "washbasin",
      "hand-dryer",
      "pillar",
      "column",
      "car-park",
      "bike-rack",
      "swimming-pool",
      "stage-curtains",
      "podium",
      "nap-pod",
      "treadmill",
      "weight-bench",
      "phone-booth",
      "standing-desk",
      "hot-desk",
      "pet-bed",
      "reception-desk",
      "calendar-wall",
      "suggestion-box",
      "signpost",
      "photo-wall",
      "door",
      "window",
      "directory",
      "elevator",
      "stairs",
      "screen",
      "room-sign",
      "timer",
      "stopwatch",
      "stadium",
      "actor",
      "final-state",
      "cloud",
      "triangle",
      "trapezoid",
      "star",
      "speech-bubble",
      "focus-button",
      "icon",
      "sticker"
    ],
    "type": "string"
  },
  "ShapeLibrary": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "items": {
        "items": {
          "$ref": "#/components/schemas/ShapeLibraryItem"
        },
        "type": "array"
      },
      "name": {
        "type": "string"
      },
      "ownerId": {
        "type": "string"
      },
      "source": {
        "$ref": "#/components/schemas/ShapeLibrarySource"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "ownerId",
      "name",
      "source",
      "items",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "ShapeLibraryItem": {
    "additionalProperties": false,
    "description": "One reusable shape: its elements placed from its top-left corner at (0, 0).",
    "properties": {
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "width": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "title",
      "width",
      "height",
      "elements"
    ],
    "type": "object"
  },
  "ShapeLibrarySource": {
    "const": "drawio",
    "description": "Where a library came from; one value today.",
    "type": "string"
  },
  "ShapeMarker": {
    "enum": [
      "green-circle",
      "orange-circle",
      "red-circle",
      "checkbox-unchecked",
      "checkbox-checked"
    ],
    "type": "string"
  },
  "ShareLink": {
    "additionalProperties": false,
    "properties": {
      "code": {
        "type": "string"
      },
      "createdAt": {
        "type": "number"
      },
      "documentId": {
        "type": "string"
      },
      "expiresAt": {
        "type": [
          "number",
          "null"
        ]
      },
      "expiry": {
        "$ref": "#/components/schemas/ShareLinkExpiry"
      },
      "purpose": {
        "$ref": "#/components/schemas/SharePurpose"
      },
      "role": {
        "$ref": "#/components/schemas/ShareRole"
      },
      "tabId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "code",
      "documentId",
      "role",
      "createdAt",
      "expiry",
      "expiresAt",
      "tabId",
      "purpose"
    ],
    "type": "object"
  },
  "ShareLinkExpiry": {
    "enum": [
      "never",
      "week",
      "month",
      "sixMonths"
    ],
    "type": "string"
  },
  "SharePurpose": {
    "enum": [
      "share",
      "community"
    ],
    "type": "string"
  },
  "ShareRole": {
    "$ref": "#/components/schemas/AccessLevel"
  },
  "SharedTabsSummary": {
    "additionalProperties": false,
    "properties": {
      "documents": {
        "type": "number"
      },
      "tabs": {
        "type": "number"
      }
    },
    "required": [
      "tabs",
      "documents"
    ],
    "type": "object"
  },
  "ShowSelectedView": {
    "additionalProperties": false,
    "properties": {
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "selected": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "container": {
              "anyOf": [
                {
                  "additionalProperties": false,
                  "properties": {
                    "kind": {
                      "type": "string"
                    },
                    "label": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "ref": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "ref",
                    "kind",
                    "label"
                  ],
                  "type": "object"
                },
                {
                  "type": "null"
                }
              ]
            },
            "fields": {
              "additionalProperties": {},
              "type": "object"
            },
            "incoming": {
              "items": {
                "$ref": "#/components/schemas/ViewEdgeJson"
              },
              "type": "array"
            },
            "kind": {
              "type": "string"
            },
            "omitted": {
              "items": {
                "type": "string"
              },
              "type": "array"
            },
            "outgoing": {
              "items": {
                "$ref": "#/components/schemas/ViewEdgeJson"
              },
              "type": "array"
            },
            "ref": {
              "type": "string"
            }
          },
          "required": [
            "ref",
            "kind",
            "container",
            "fields",
            "incoming",
            "outgoing",
            "omitted"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "header",
      "selected"
    ],
    "type": "object"
  },
  "ShowView": {
    "additionalProperties": false,
    "properties": {
      "container": {
        "anyOf": [
          {
            "additionalProperties": false,
            "properties": {
              "kind": {
                "type": "string"
              },
              "label": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "ref": {
                "type": "string"
              }
            },
            "required": [
              "ref",
              "kind",
              "label"
            ],
            "type": "object"
          },
          {
            "type": "null"
          }
        ]
      },
      "fields": {
        "additionalProperties": {},
        "type": "object"
      },
      "header": {
        "$ref": "#/components/schemas/ViewHeader"
      },
      "incoming": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "kind": {
        "type": "string"
      },
      "omitted": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "outgoing": {
        "items": {
          "$ref": "#/components/schemas/ViewEdgeJson"
        },
        "type": "array"
      },
      "ref": {
        "type": "string"
      }
    },
    "required": [
      "header",
      "ref",
      "kind",
      "container",
      "fields",
      "incoming",
      "outgoing",
      "omitted"
    ],
    "type": "object"
  },
  "StageSpeakers": {
    "description": "Who may speak from a stage (docs/specs/012-collaboration/meeting-rooms-and-stage.md \"Share roles\").",
    "enum": [
      "edit",
      "take-part"
    ],
    "type": "string"
  },
  "StickyAnimation": {
    "enum": [
      "flutter",
      "sway",
      "peel",
      "lift",
      "wiggle",
      "drop",
      "slap",
      "pulse",
      "glow",
      "highlight"
    ],
    "type": "string"
  },
  "StickyElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "font": {
        "type": "string"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "shadow": {
        "$ref": "#/components/schemas/ElementShadow"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textBold": {
        "type": "boolean"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "sticky",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "Suggestion": {
    "additionalProperties": false,
    "description": "One note in a Suggestion Box.",
    "properties": {
      "day": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "text": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "text",
      "day"
    ],
    "type": "object"
  },
  "SuggestionsResponse": {
    "additionalProperties": false,
    "description": "`GET /api/documents/:id/tabs/:tabId/suggestions?elementId=`: the box's notes, newest first.",
    "properties": {
      "suggestions": {
        "items": {
          "$ref": "#/components/schemas/Suggestion"
        },
        "type": "array"
      }
    },
    "required": [
      "suggestions"
    ],
    "type": "object"
  },
  "Tab": {
    "additionalProperties": false,
    "properties": {
      "backgroundAnimationSpeed": {
        "type": "number"
      },
      "backgroundColor": {
        "type": "string"
      },
      "backgroundOpacity": {
        "type": "number"
      },
      "backgroundPattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "backgroundPatternScale": {
        "type": "number"
      },
      "customColours": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "defaultTextSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "id": {
        "$ref": "#/components/schemas/TabId"
      },
      "kind": {
        "$ref": "#/components/schemas/TabKind"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "$ref": "#/components/schemas/EditorMode"
      },
      "patternColor": {
        "type": "string"
      },
      "tagColours": {},
      "templateChosen": {
        "type": "boolean"
      },
      "theme": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "elements"
    ],
    "type": "object"
  },
  "TabConnectionApp": {
    "enum": [
      "livediagram",
      "liveplanner",
      "livedocuments",
      "livedesign",
      "livehuddle"
    ],
    "type": "string"
  },
  "TabConnectionWire": {
    "additionalProperties": false,
    "properties": {
      "app": {
        "$ref": "#/components/schemas/TabConnectionApp"
      },
      "id": {
        "type": "string"
      },
      "itemId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "app",
      "itemId"
    ],
    "type": "object"
  },
  "TabId": {
    "type": "string"
  },
  "TabKind": {
    "const": "diagram",
    "type": "string"
  },
  "TabRecord": {
    "additionalProperties": false,
    "properties": {
      "backgroundAnimationSpeed": {
        "type": "number"
      },
      "backgroundColor": {
        "type": "string"
      },
      "backgroundOpacity": {
        "type": "number"
      },
      "backgroundPattern": {
        "$ref": "#/components/schemas/BackgroundPattern"
      },
      "backgroundPatternScale": {
        "type": "number"
      },
      "connection": {
        "$ref": "#/components/schemas/TabConnectionWire"
      },
      "customColours": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "defaultTextSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "documentId": {
        "type": "string"
      },
      "elements": {
        "items": {
          "$ref": "#/components/schemas/Element"
        },
        "type": "array"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "folder": {
        "type": "string"
      },
      "font": {
        "type": "string"
      },
      "id": {
        "$ref": "#/components/schemas/TabId"
      },
      "kind": {
        "$ref": "#/components/schemas/TabKind"
      },
      "name": {
        "type": "string"
      },
      "opensIn": {
        "$ref": "#/components/schemas/EditorMode"
      },
      "orderIndex": {
        "type": "number"
      },
      "patternColor": {
        "type": "string"
      },
      "rev": {
        "type": "number"
      },
      "tagColours": {},
      "templateChosen": {
        "type": "boolean"
      },
      "theme": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "documentId",
      "elements",
      "id",
      "name",
      "orderIndex",
      "rev",
      "updatedAt"
    ],
    "type": "object"
  },
  "TabSummary": {
    "additionalProperties": false,
    "properties": {
      "connection": {
        "$ref": "#/components/schemas/TabConnectionWire"
      },
      "documentId": {
        "type": "string"
      },
      "folder": {
        "type": "string"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "orderIndex": {
        "type": "number"
      },
      "outOfScope": {
        "const": true,
        "type": "boolean"
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "documentId",
      "name",
      "orderIndex",
      "updatedAt"
    ],
    "type": "object"
  },
  "Team": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "organisation": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "organisation",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamInvite": {
    "additionalProperties": false,
    "properties": {
      "invitedAt": {
        "type": "number"
      },
      "invitedByName": {
        "type": [
          "string",
          "null"
        ]
      },
      "memberCount": {
        "type": "number"
      },
      "memberId": {
        "type": "string"
      },
      "role": {
        "$ref": "#/components/schemas/TeamRole"
      },
      "team": {
        "$ref": "#/components/schemas/Team"
      }
    },
    "required": [
      "memberId",
      "team",
      "memberCount",
      "invitedAt",
      "role",
      "invitedByName"
    ],
    "type": "object"
  },
  "TeamListItem": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "id": {
        "type": "string"
      },
      "memberCount": {
        "type": "number"
      },
      "myRole": {
        "$ref": "#/components/schemas/TeamRole"
      },
      "name": {
        "type": "string"
      },
      "organisation": {
        "type": [
          "string",
          "null"
        ]
      },
      "updatedAt": {
        "type": "number"
      }
    },
    "required": [
      "createdAt",
      "id",
      "memberCount",
      "myRole",
      "name",
      "organisation",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamMember": {
    "additionalProperties": false,
    "properties": {
      "createdAt": {
        "type": "number"
      },
      "email": {
        "type": [
          "string",
          "null"
        ]
      },
      "id": {
        "type": "string"
      },
      "name": {
        "type": [
          "string",
          "null"
        ]
      },
      "role": {
        "$ref": "#/components/schemas/TeamRole"
      },
      "status": {
        "$ref": "#/components/schemas/TeamMemberStatus"
      },
      "teamId": {
        "type": "string"
      },
      "updatedAt": {
        "type": "number"
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "teamId",
      "userId",
      "email",
      "role",
      "status",
      "name",
      "createdAt",
      "updatedAt"
    ],
    "type": "object"
  },
  "TeamMemberStatus": {
    "enum": [
      "invited",
      "joined",
      "declined",
      "expired"
    ],
    "type": "string"
  },
  "TeamRole": {
    "enum": [
      "admin",
      "member"
    ],
    "type": "string"
  },
  "TelemetryAction": {
    "enum": [
      "Created",
      "Deleted",
      "Added",
      "Removed",
      "Shared",
      "Joined",
      "Declined",
      "Used",
      "Changed",
      "Exported",
      "Locked",
      "Unlocked",
      "Grouped",
      "Ungrouped",
      "Duplicated",
      "Renamed",
      "Reordered",
      "Linked",
      "Unlinked",
      "Resolved",
      "Unresolved",
      "Mentioned",
      "Imported",
      "Aligned",
      "Undone",
      "Redone",
      "Cleared",
      "Loaded",
      "Opened",
      "Searched",
      "Selected",
      "Toggled",
      "Zoomed",
      "Moved",
      "Closed",
      "Copied",
      "Reverted",
      "SignedIn",
      "SignedUp",
      "SignedOut",
      "Started",
      "Ended",
      "View",
      "Helpful",
      "Unhelpful",
      "Returned",
      "Restored",
      "Applied",
      "Conflicted",
      "Present",
      "Held",
      "Viewed",
      "Sent",
      "Api",
      "Client",
      "Warning",
      "Liked",
      "Unliked",
      "Reported",
      "Measured"
    ],
    "type": "string"
  },
  "TelemetryCategory": {
    "enum": [
      "Document",
      "Element",
      "Tab",
      "Theme",
      "Canvas",
      "Template",
      "Comment",
      "Note",
      "Action",
      "Search",
      "UI",
      "Folder",
      "Session",
      "Facilitator",
      "AI",
      "Team",
      "Participant",
      "Help",
      "Token",
      "Mcp",
      "Cli",
      "Email",
      "Error",
      "Timeline",
      "Home",
      "Activity",
      "Page",
      "Cta",
      "Trash",
      "Draw",
      "Editor",
      "Explorer",
      "Agent",
      "Community",
      "Timing"
    ],
    "type": "string"
  },
  "TelemetryEvent": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/TelemetryAction"
      },
      "category": {
        "$ref": "#/components/schemas/TelemetryCategory"
      },
      "type": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "category",
      "action"
    ],
    "type": "object"
  },
  "TemplateCatalogueResponse": {
    "additionalProperties": false,
    "properties": {
      "categories": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "description": {
              "type": "string"
            },
            "id": {
              "type": "string"
            },
            "label": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "label",
            "description"
          ],
          "type": "object"
        },
        "type": "array"
      },
      "templates": {
        "items": {
          "additionalProperties": false,
          "properties": {
            "category": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "kind": {
              "type": "string"
            },
            "title": {
              "type": "string"
            }
          },
          "required": [
            "kind",
            "title",
            "description",
            "category"
          ],
          "type": "object"
        },
        "type": "array"
      }
    },
    "required": [
      "categories",
      "templates"
    ],
    "type": "object"
  },
  "TemplateFamily": {
    "deprecated": true,
    "description": "No template family is offered today: summaries carry null, and a create naming the retired `retrospective` reads as none (any other value is intent_invalid).",
    "type": "string"
  },
  "TemplateFamilyOrNone": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/TemplateFamily"
      },
      {
        "type": "null"
      }
    ],
    "description": "A family, or null for none (only null while there is no family)."
  },
  "TextAlignX": {
    "enum": [
      "left",
      "center",
      "right"
    ],
    "type": "string"
  },
  "TextAlignY": {
    "enum": [
      "top",
      "middle",
      "bottom"
    ],
    "type": "string"
  },
  "TextAnimation": {
    "enum": [
      "typewriter",
      "words",
      "cascade",
      "focus",
      "scramble",
      "highlighter",
      "underline",
      "wave",
      "shine",
      "flicker",
      "rainbow",
      "glow",
      "bounce",
      "float"
    ],
    "type": "string"
  },
  "TextElement": {
    "additionalProperties": false,
    "properties": {
      "action": {
        "$ref": "#/components/schemas/ElementAction"
      },
      "addedBy": {
        "type": "string"
      },
      "animation": {
        "$ref": "#/components/schemas/ElementAnimation"
      },
      "animationRepeat": {
        "type": "boolean"
      },
      "animationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "aspectLocked": {
        "type": "boolean"
      },
      "commentThread": {
        "$ref": "#/components/schemas/CommentThread"
      },
      "fillColor": {
        "type": "string"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "font": {
        "type": "string"
      },
      "fontWeight": {
        "enum": [
          400,
          500,
          700
        ],
        "type": "number"
      },
      "headerFill": {
        "type": "string"
      },
      "height": {
        "type": "number"
      },
      "id": {
        "$ref": "#/components/schemas/ElementId"
      },
      "label": {
        "type": "string"
      },
      "letterSpacing": {
        "type": "number"
      },
      "link": {
        "$ref": "#/components/schemas/ElementLink"
      },
      "note": {
        "type": "string"
      },
      "noteRich": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "opacity": {
        "type": "number"
      },
      "padding": {
        "$ref": "#/components/schemas/Padding"
      },
      "penTextColour": {
        "$ref": "#/components/schemas/PenColourName"
      },
      "richText": {
        "items": {
          "$ref": "#/components/schemas/TextRun"
        },
        "type": "array"
      },
      "rotation": {
        "type": "number"
      },
      "sizing": {
        "$ref": "#/components/schemas/TextSizing"
      },
      "strokeColor": {
        "type": "string"
      },
      "textAlignX": {
        "$ref": "#/components/schemas/TextAlignX"
      },
      "textAlignY": {
        "$ref": "#/components/schemas/TextAlignY"
      },
      "textAnimation": {
        "$ref": "#/components/schemas/TextAnimation"
      },
      "textAnimationRepeat": {
        "type": "boolean"
      },
      "textAnimationSpeed": {
        "$ref": "#/components/schemas/AnimationSpeed"
      },
      "textArc": {
        "type": "number"
      },
      "textBold": {
        "type": "boolean"
      },
      "textCase": {
        "enum": [
          "upper",
          "lower"
        ],
        "type": "string"
      },
      "textColor": {
        "type": "string"
      },
      "textItalic": {
        "type": "boolean"
      },
      "textScale": {
        "type": "number"
      },
      "textSize": {
        "$ref": "#/components/schemas/TextSize"
      },
      "textStrikethrough": {
        "type": "boolean"
      },
      "textSwatch": {
        "$ref": "#/components/schemas/QuickSwatchSlot"
      },
      "textUnderline": {
        "type": "boolean"
      },
      "type": {
        "const": "text",
        "type": "string"
      },
      "width": {
        "type": "number"
      },
      "x": {
        "type": "number"
      },
      "y": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height"
    ],
    "type": "object"
  },
  "TextRun": {
    "additionalProperties": false,
    "properties": {
      "bold": {
        "type": "boolean"
      },
      "color": {
        "type": "string"
      },
      "gradient": {
        "type": "string"
      },
      "heading": {
        "$ref": "#/components/schemas/RunHeading"
      },
      "highlight": {
        "type": "string"
      },
      "italic": {
        "type": "boolean"
      },
      "link": {
        "type": "string"
      },
      "muted": {
        "type": "boolean"
      },
      "size": {
        "$ref": "#/components/schemas/RunSize"
      },
      "strikethrough": {
        "type": "boolean"
      },
      "text": {
        "type": "string"
      },
      "underline": {
        "type": "boolean"
      }
    },
    "required": [
      "text"
    ],
    "type": "object"
  },
  "TextSize": {
    "anyOf": [
      {
        "$ref": "#/components/schemas/TextSizePreset"
      },
      {
        "type": "number"
      }
    ]
  },
  "TextSizePreset": {
    "enum": [
      "scale",
      "sm",
      "md",
      "lg"
    ],
    "type": "string"
  },
  "TextSizing": {
    "enum": [
      "fit",
      "wrap"
    ],
    "type": "string"
  },
  "TrashReason": {
    "enum": [
      "deleted",
      "empty"
    ],
    "type": "string"
  },
  "TrashedDocument": {
    "additionalProperties": false,
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "purgeAt": {
        "type": "number"
      },
      "reason": {
        "$ref": "#/components/schemas/TrashReason"
      },
      "teamId": {
        "type": [
          "string",
          "null"
        ]
      },
      "teamName": {
        "type": [
          "string",
          "null"
        ]
      },
      "trashedAt": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "teamId",
      "teamName",
      "trashedAt",
      "purgeAt",
      "reason"
    ],
    "type": "object"
  },
  "UnfurlResult": {
    "additionalProperties": false,
    "properties": {
      "description": {
        "type": "string"
      },
      "favicon": {
        "type": "string"
      },
      "image": {
        "type": "string"
      },
      "siteName": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "url": {
        "type": "string"
      }
    },
    "required": [
      "url"
    ],
    "type": "object"
  },
  "ViewAttributeJson": {
    "additionalProperties": false,
    "properties": {
      "key": {
        "type": "string"
      },
      "value": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "key",
      "value"
    ],
    "type": "object"
  },
  "ViewEdgeJson": {
    "additionalProperties": false,
    "properties": {
      "from": {
        "$ref": "#/components/schemas/ViewEnd"
      },
      "id": {
        "type": "string"
      },
      "label": {
        "type": [
          "string",
          "null"
        ]
      },
      "ref": {
        "type": "string"
      },
      "style": {
        "items": {
          "type": "string"
        },
        "type": "array"
      },
      "to": {
        "$ref": "#/components/schemas/ViewEnd"
      }
    },
    "required": [
      "ref",
      "id",
      "from",
      "to",
      "label",
      "style"
    ],
    "type": "object"
  },
  "ViewEnd": {
    "anyOf": [
      {
        "additionalProperties": false,
        "properties": {
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "ref"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "arrow": {
            "type": "string"
          }
        },
        "required": [
          "arrow"
        ],
        "type": "object"
      },
      {
        "additionalProperties": false,
        "properties": {
          "free": {
            "additionalProperties": false,
            "properties": {
              "x": {
                "type": "number"
              },
              "y": {
                "type": "number"
              }
            },
            "required": [
              "x",
              "y"
            ],
            "type": "object"
          }
        },
        "required": [
          "free"
        ],
        "type": "object"
      }
    ]
  },
  "ViewHeader": {
    "additionalProperties": false,
    "properties": {
      "counts": {
        "additionalProperties": false,
        "properties": {
          "arrows": {
            "type": "number"
          },
          "boxes": {
            "type": "number"
          }
        },
        "required": [
          "boxes",
          "arrows"
        ],
        "type": "object"
      },
      "elements": {
        "type": "number"
      },
      "finish": {
        "$ref": "#/components/schemas/Finish"
      },
      "rev": {
        "type": [
          "number",
          "null"
        ]
      },
      "tab": {
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string"
          },
          "kind": {
            "$ref": "#/components/schemas/TabKind"
          },
          "name": {
            "type": "string"
          },
          "ref": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "ref",
          "name",
          "kind"
        ],
        "type": "object"
      },
      "threads": {
        "additionalProperties": false,
        "properties": {
          "open": {
            "type": "number"
          },
          "total": {
            "type": "number"
          }
        },
        "required": [
          "open",
          "total"
        ],
        "type": "object"
      },
      "unknown": {
        "type": "number"
      },
      "view": {
        "$ref": "#/components/schemas/ViewName"
      }
    },
    "required": [
      "view",
      "tab",
      "elements",
      "counts",
      "unknown",
      "threads",
      "rev"
    ],
    "type": "object"
  },
  "ViewName": {
    "enum": [
      "overview",
      "outline",
      "graph",
      "layout",
      "comments",
      "show",
      "find",
      "diff",
      "lint"
    ],
    "type": "string"
  }
};
