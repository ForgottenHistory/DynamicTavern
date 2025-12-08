/**
 * Simple token counting utility
 * Uses GPT-style approximation: ~4 characters per token on average
 * This is a reasonable estimate for most LLMs (GPT, Claude, etc.)
 */

/**
 * Estimate token count for a string
 * @param text - The text to count tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string | null | undefined): number {
	if (!text) return 0;

	// GPT-style tokenization approximation:
	// - Average ~4 characters per token for English text
	// - Whitespace and punctuation often form their own tokens
	// - This is a rough estimate but works well for most cases

	const charCount = text.length;

	// Count whitespace separately (often individual tokens)
	const whitespaceCount = (text.match(/\s+/g) || []).length;

	// Count special punctuation (often individual tokens)
	const punctuationCount = (text.match(/[.,!?;:'"()\[\]{}]/g) || []).length;

	// Remaining characters at ~4 chars per token
	const remainingChars = charCount - whitespaceCount - punctuationCount;
	const wordTokens = Math.ceil(remainingChars / 4);

	return whitespaceCount + punctuationCount + wordTokens;
}

/**
 * Format token count for display
 * @param tokens - Token count
 * @returns Formatted string (e.g., "~150 tokens")
 */
export function formatTokenCount(tokens: number): string {
	return `~${tokens.toLocaleString()} tokens`;
}

/**
 * Get token count with formatted string
 * @param text - The text to count tokens for
 * @returns Formatted token count string
 */
export function getTokenCountDisplay(text: string | null | undefined): string {
	return formatTokenCount(estimateTokens(text));
}
