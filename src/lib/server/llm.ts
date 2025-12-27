/**
 * LLM Module - Re-exports all LLM functionality from submodules
 *
 * This file serves as the main entry point for LLM-related functions.
 * The actual implementations are split across:
 * - llm/promptUtils.ts - Prompt loading and template functions
 * - llm/chatGeneration.ts - Chat completion generation
 * - llm/narration.ts - Scene narration functions
 * - llm/impersonation.ts - User impersonation generation
 */

export {
	// Prompt utilities
	loadSystemPromptFromFile,
	loadImpersonatePromptFromFile,
	loadWritingStyle,
	loadNarrationPromptFromFile,
	replaceTemplateVariables,
	DEFAULT_SYSTEM_PROMPT,
	DEFAULT_IMPERSONATE_PROMPT,
	DEFAULT_NARRATION_PROMPTS,
	PROMPTS_DIR,

	// Chat generation
	generateChatCompletion,

	// Narration
	generateNarration,
	generateSceneNarration,

	// Impersonation
	generateImpersonation,

	// Types
	type NarrationType,
	type TemplateVariables,
	type ChatCompletionResult,
	type ItemContext,
	type SceneContext
} from './llm/index';
