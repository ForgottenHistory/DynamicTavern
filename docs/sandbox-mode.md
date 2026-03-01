# Sandbox Mode

An AI Dungeon-style exploration mode where users can walk around a world and encounter characters from their library.

## Overview

Sandbox mode provides a freeform exploration experience where:
- Users navigate between locations in a world
- A Narrator AI describes each location
- Characters from the user's library randomly appear based on location filters
- No structured quests or plot points - just exploration and encounters

## Core Design Decisions

| Aspect | Decision |
|--------|----------|
| Navigation | Click-based UI (buttons for connected locations) |
| Characters per scene | One character maximum |
| Character spawning | Random from filtered pool when entering a location |
| Persistence | None - each location move is a fresh scene |
| World files | Multiple supported, user selects which to use |

## World Configuration

World files are stored in `data/worlds/` as JSON files.

### Schema

```json
{
  "name": "World Display Name",
  "startLocation": "location_id",
  "locations": {
    "location_id": {
      "name": "Display Name",
      "description": "Description for the narrator to use when introducing the location.",
      "connections": ["other_location_id", "another_location_id"],
      "characterFilters": {
        "preferTags": ["tag1", "tag2"],
        "excludeTags": ["tag3"]
      }
    }
  }
}
```

### Character Filters

- `preferTags` - Characters with these tags are eligible to appear
- `excludeTags` - Characters with these tags will never appear
- `null` - No characters spawn at this location (e.g., user's private apartment)

If no characters match the filters, the scene is empty (narrator only).

### Example World File

```json
{
  "name": "Modern City",
  "startLocation": "apartment",
  "locations": {
    "apartment": {
      "name": "Your Apartment",
      "description": "A cozy studio apartment with morning light filtering through the blinds.",
      "connections": ["hallway"],
      "characterFilters": null
    },
    "hallway": {
      "name": "Apartment Hallway",
      "description": "A quiet corridor with numbered doors and faded carpet.",
      "connections": ["apartment", "street"],
      "characterFilters": {
        "preferTags": ["neighbor", "residential"]
      }
    },
    "street": {
      "name": "Main Street",
      "description": "A bustling city street with shops and cafes lining both sides.",
      "connections": ["hallway", "cafe", "park", "club"],
      "characterFilters": {
        "preferTags": ["social", "public"],
        "excludeTags": ["reclusive"]
      }
    },
    "cafe": {
      "name": "Corner Cafe",
      "description": "A warm coffee shop with the smell of fresh espresso and soft jazz playing.",
      "connections": ["street"],
      "characterFilters": {
        "preferTags": ["casual", "intellectual", "artist"]
      }
    },
    "park": {
      "name": "Riverside Park",
      "description": "A peaceful green space with walking paths, benches, and a view of the river.",
      "connections": ["street"],
      "characterFilters": {
        "preferTags": ["outdoors", "relaxed", "athletic"]
      }
    },
    "club": {
      "name": "The Neon Lounge",
      "description": "A dimly lit nightclub with pulsing bass, neon lights, and a crowded dance floor.",
      "connections": ["street"],
      "characterFilters": {
        "preferTags": ["nightlife", "party", "social"],
        "excludeTags": ["innocent", "shy"]
      }
    }
  }
}
```

## User Flow

1. User navigates to `/sandbox`
2. User selects a world file from available options
3. Session starts at `startLocation`
4. Narrator describes the location
5. System rolls for character encounter (if filters allow)
6. If character appears, narrator introduces them contextually
7. User can:
   - Chat with the character (if present)
   - Click a connection button to move to another location
8. Moving to a new location = fresh scene (new narrator intro, new character roll)

## Architecture

### Database

New table: `sandboxSessions`

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| userId | integer | Foreign key to users |
| worldFile | text | Which JSON world file |
| currentLocation | text | Current location ID |
| currentCharacterId | integer | Character at location (nullable) |
| createdAt | timestamp | Session creation time |
| updatedAt | timestamp | Last activity |

Messages can either:
- Use existing `messages` table with a `sandboxSessionId` foreign key
- Or store inline in the session (simpler for no-persistence model)

### Services

- `worldService.ts` - Load and parse world JSON files, list available worlds
- `sandboxService.ts` - Session management, location transitions, character spawning

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sandbox/worlds` | GET | List available world files |
| `/api/sandbox/sessions` | POST | Start new sandbox session |
| `/api/sandbox/sessions/[id]` | GET | Get current session state |
| `/api/sandbox/sessions/[id]/move` | POST | Move to a connected location |
| `/api/sandbox/sessions/[id]/messages` | GET | Get session messages |
| `/api/sandbox/sessions/[id]/messages` | POST | Send a message |

### UI Components

Route: `/sandbox`

- World selector (dropdown/cards of available worlds)
- Location panel (current location name, description)
- Connection buttons (navigate to connected locations)
- Character card (shows who you've encountered, if anyone)
- Chat area (narrator messages + character dialogue)
- Message input

## Message Roles

Reuses existing role system:

| Role | Usage in Sandbox |
|------|------------------|
| `narrator` | Location descriptions, character introductions |
| `assistant` | Character dialogue (with characterId) |
| `user` | Player messages |

## Character Spawning Logic

1. Get current location's `characterFilters`
2. If `null`, no character spawns
3. Query characters where:
   - Character has at least one tag in `preferTags` (if specified)
   - Character has no tags in `excludeTags` (if specified)
4. Random selection from matching pool
5. If no matches, scene is empty

## Future Considerations (Not in v1)

- Persistence (remember where you were, who you met)
- Multiple characters per location
- Time-of-day affecting locations/characters
- Character movement between locations
- Location-specific prompts/scenarios
- World editor UI
