# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-05

### Features

#### Scene-Based Chat System
- Multi-character scenes with narrator support
- Characters can enter and leave scenes dynamically
- Scene actions: look at character, look at scene, look at item, explore, narrate
- Narrator generates scene introductions and character entrances/exits

#### World State System
- Dynamic world state tracking (mood, position, clothes, body, thinking)
- Collapsible sidebar panel showing character state
- Auto-generation on new chat start
- Periodic regeneration based on message count settings
- "Look at" actions for clothing items with detailed descriptions

#### Prompt Management
- Full prompt editor with 7 categories: Chat, Impersonate, Action, World, Decision, Content, Image
- 25+ editable prompts covering all system functionality
- Template variables with documentation for each category
- Conditional syntax support (`{{#if}}`, `{{#unless}}`)
- Preset system for saving/loading prompt configurations
- Export/import prompts as JSON files
- Writing style guide applied across all prompts

#### Multi-LLM Architecture
- Separate LLM configurations for Chat, Decision, Content, and Image generation
- Support for OpenRouter, Featherless, and NanoGPT providers
- File-based settings storage for easy backup/restore
- Per-provider queue management with retry logic

#### Image Generation
- Stable Diffusion WebUI integration
- Danbooru tag generation from conversation context
- Separate prompts for character, user POV, and scene composition
- Configurable image dimensions
- Decision engine for automatic image sending

#### Character Management
- Character card import (v1/v2 PNG format)
- Character profile editing with tabbed interface
- Scenario-based custom greetings
- Content cleanup/rewriting using Content LLM
- Reset to original card data

#### Chat Features
- Message regeneration with swipe navigation
- Impersonation with multiple tones (serious, sarcastic, flirty)
- Name highlighting in messages
- Real-time updates via Socket.IO
- Conversation history in sidebar

#### User Experience
- Dark theme with customizable CSS variables
- Responsive layout with collapsible sidebar
- LLM debug logs (last 5 prompts/responses per type)
- Lorebook support for world-building

### Technical
- SvelteKit 2.47+ with Svelte 5
- TypeScript 5.9+
- Tailwind CSS 4.1+
- SQLite with Drizzle ORM
- Modular LLM service architecture
