# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered character chat application enabling users to create and chat with AI characters using character cards (v1/v2 format), manage conversations, and configure LLM settings.

## Rules
- Don't git commit without permission
- Don't add features that were not part of original request
- Styling needs to be consistent. Check other similar components first before implementation.

## Tech Stack

- **Framework**: SvelteKit 2.47+ with Svelte 5
- **Language**: TypeScript 5.9+
- **Styling**: Tailwind CSS 4.1+ with dark theme (CSS custom properties in app.css)
- **Database**: SQLite with Drizzle ORM 0.44+
- **LLM Providers**: OpenRouter & Featherless APIs
- **Real-time**: Socket.IO 4.8+ (custom Vite plugin at `src/lib/server/vite-plugin-socket.ts`)
- **Image Processing**: Sharp 0.34+

## Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run preview       # Preview production build
npm run check         # Type check with svelte-check
npm run lint          # Run ESLint
npm run db:push       # Push schema changes to SQLite
npm run db:studio     # Open Drizzle Studio (visual DB editor)
```

## Architecture

### Key Directories

- `src/lib/server/` - Server-side code (auth, LLM, database, services)
- `src/lib/components/` - Reusable Svelte components
- `src/lib/stores/` - Client-side state (characters cache, socket client)
- `src/routes/api/` - REST API endpoints
- `data/prompts/` - File-based system prompts (system.txt, impersonate.txt)

### Database Schema (`src/lib/server/db/schema.ts`)

Tables: users, llmSettings, decisionEngineSettings, contentLlmSettings, imageLlmSettings, llmPresets, characters, tagLibrary, conversations, messages

- Characters store card data as JSON, images as Base64
- Messages support "swipes" (alternative responses) as JSON array

### Multi-LLM Architecture

Four separate LLM configurations, each with its own settings table and service:

| LLM Type | Purpose | Settings Service |
|----------|---------|------------------|
| **Chat** | Character conversations | `llmSettingsService.ts` |
| **Decision** | Pre-processing decisions before content | `decisionEngineSettingsService.ts` |
| **Content** | Content creation/generation | `contentLlmSettingsService.ts` |
| **Image** | Generate Danbooru tags for SD | `imageLlmSettingsService.ts` |

### LLM Integration (`src/lib/server/`)

- `llm.ts` - Prompt building with template variables: `{{char}}`, `{{user}}`, `{{description}}`, `{{personality}}`, `{{scenario}}`
- `services/llmService.ts` - API calls with retry logic (max 3 retries, exponential backoff)
- `services/queueService.ts` - Request concurrency control per provider
- `services/llmLogService.ts` - Stores last 5 prompts/responses per type for debugging

### Image Generation

- `services/imageTagGenerationService.ts` - Generates Danbooru-style tags from conversation context using Image LLM
- `services/sdService.ts` - Stable Diffusion API integration (txt2img, health check, model listing)
- Tags are stored per-user in `data/tags_{userId}.txt`

### Authentication

Cookie-based sessions using userId. Password hashing via bcryptjs. Auth logic in `src/lib/server/auth.ts`.

### Socket.IO Integration

Custom Vite plugin integrates Socket.IO. Rooms: `conversation-{conversationId}`. Events: `message`, `typing`.

### Character Cards

Supports v1/v2 formats. Image extraction from PNG metadata via `src/lib/utils/characterImageParser.ts`.

## API Patterns

- Endpoints at `src/routes/api/[feature]/+server.ts`
- Export `GET`, `POST`, `PUT`, `DELETE` functions
- Access userId from cookies for auth
- Return JSON responses

## Styling

Dark theme with CSS custom properties (--bg-primary, --accent-primary, etc.) defined in `src/app.css`. Use Tailwind classes in components.

## Environment Variables

Create `.env` from `.env.example`:
```
OPENROUTER_API_KEY=sk-or-v1-...
FEATHERLESS_API_KEY=...  # optional
SD_SERVER_URL=http://127.0.0.1:7860  # Stable Diffusion server
```
