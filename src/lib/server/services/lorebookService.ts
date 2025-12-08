import { db } from '../db';
import { lorebooks, lorebookEntries, characterLorebooks } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface LorebookEntry {
	id: number;
	name: string;
	keywords: string[];
	content: string;
	caseSensitive: boolean;
	priority: number;
}

/**
 * Get all active lorebook entries for a conversation
 * Includes global lorebooks and character-specific lorebooks
 */
async function getActiveEntries(userId: number, characterId: number): Promise<LorebookEntry[]> {
	// Get global lorebooks for this user (only enabled ones)
	const globalLorebooks = await db
		.select()
		.from(lorebooks)
		.where(and(eq(lorebooks.userId, userId), eq(lorebooks.isGlobal, true), eq(lorebooks.enabled, true)));

	// Get character-specific lorebooks (only enabled ones)
	const characterLorebookLinks = await db
		.select({ lorebookId: characterLorebooks.lorebookId })
		.from(characterLorebooks)
		.innerJoin(lorebooks, eq(characterLorebooks.lorebookId, lorebooks.id))
		.where(and(eq(characterLorebooks.characterId, characterId), eq(lorebooks.enabled, true)));

	const lorebookIds = [
		...globalLorebooks.map((l) => l.id),
		...characterLorebookLinks.map((cl) => cl.lorebookId)
	];

	if (lorebookIds.length === 0) {
		return [];
	}

	// Get all enabled entries from these lorebooks
	const allEntries: LorebookEntry[] = [];
	for (const lorebookId of lorebookIds) {
		const entries = await db
			.select()
			.from(lorebookEntries)
			.where(and(eq(lorebookEntries.lorebookId, lorebookId), eq(lorebookEntries.enabled, true)))
			.orderBy(desc(lorebookEntries.priority));

		for (const entry of entries) {
			allEntries.push({
				id: entry.id,
				name: entry.name,
				keywords: JSON.parse(entry.keywords),
				content: entry.content,
				caseSensitive: entry.caseSensitive,
				priority: entry.priority
			});
		}
	}

	// Sort by priority (higher first)
	return allEntries.sort((a, b) => b.priority - a.priority);
}

/**
 * Check if any keyword matches the text
 */
function keywordMatches(keywords: string[], text: string, caseSensitive: boolean): boolean {
	const searchText = caseSensitive ? text : text.toLowerCase();

	for (const keyword of keywords) {
		const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
		if (searchText.includes(searchKeyword)) {
			return true;
		}
	}

	return false;
}

/**
 * Scan conversation and return triggered lorebook entries
 * @param userId - User ID
 * @param characterId - Character ID
 * @param conversationText - Combined text from recent messages to scan
 * @returns Array of triggered entry contents, sorted by priority
 */
async function getTriggeredEntries(
	userId: number,
	characterId: number,
	conversationText: string
): Promise<string[]> {
	const entries = await getActiveEntries(userId, characterId);
	const triggered: string[] = [];
	const seenIds = new Set<number>();

	for (const entry of entries) {
		// Skip if already triggered (by ID to handle duplicates across lorebooks)
		if (seenIds.has(entry.id)) continue;

		if (keywordMatches(entry.keywords, conversationText, entry.caseSensitive)) {
			triggered.push(entry.content);
			seenIds.add(entry.id);
		}
	}

	return triggered;
}

/**
 * Build lorebook context string from conversation
 * @param userId - User ID
 * @param characterId - Character ID
 * @param messages - Recent conversation messages
 * @param scanDepth - Number of recent messages to scan (default 10)
 * @returns Formatted lorebook context or empty string
 */
async function buildLorebookContext(
	userId: number,
	characterId: number,
	messages: Array<{ content: string }>,
	scanDepth: number = 10
): Promise<string> {
	// Get recent messages to scan
	const recentMessages = messages.slice(-scanDepth);
	const conversationText = recentMessages.map((m) => m.content).join('\n');

	const triggeredEntries = await getTriggeredEntries(userId, characterId, conversationText);

	if (triggeredEntries.length === 0) {
		return '';
	}

	// Format as world info block
	return `[World Info]\n${triggeredEntries.join('\n\n')}\n[/World Info]`;
}

export const lorebookService = {
	getActiveEntries,
	getTriggeredEntries,
	buildLorebookContext
};
