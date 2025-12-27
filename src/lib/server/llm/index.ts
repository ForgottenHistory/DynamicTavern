// Re-export all LLM functions and types from submodules

// Prompt utilities
export {
	loadSystemPromptFromFile,
	loadImpersonatePromptFromFile,
	loadWritingStyle,
	loadNarrationPromptFromFile,
	replaceTemplateVariables,
	type NarrationType,
	type TemplateVariables,
	DEFAULT_SYSTEM_PROMPT,
	DEFAULT_IMPERSONATE_PROMPT,
	DEFAULT_NARRATION_PROMPTS,
	PROMPTS_DIR
} from './promptUtils';

// Chat generation
export {
	generateChatCompletion,
	type ChatCompletionResult
} from './chatGeneration';

// Narration
export {
	generateNarration,
	generateSceneNarration,
	type ItemContext,
	type SceneContext
} from './narration';

// Impersonation
export {
	generateImpersonation
} from './impersonation';
