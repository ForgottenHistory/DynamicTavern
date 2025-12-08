import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { lorebooks, lorebookEntries } from '$lib/server/db/schema';

interface ImportedEntry {
	keys?: string[];
	key?: string[];
	keywords?: string[];
	content: string;
	comment?: string;
	name?: string;
	enabled?: boolean;
	case_sensitive?: boolean;
	caseSensitive?: boolean;
	priority?: number;
	insertion_order?: number;
}

interface ImportedLorebook {
	name?: string;
	description?: string;
	entries?: ImportedEntry[] | Record<string, ImportedEntry>;
	// SillyTavern format
	character_book?: {
		name?: string;
		description?: string;
		entries?: ImportedEntry[] | Record<string, ImportedEntry>;
	};
}

// POST - Import lorebook from JSON file
export const POST: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const data: ImportedLorebook = await request.json();

		// Handle SillyTavern character_book format
		const lorebookData = data.character_book || data;

		// Extract name
		const name = lorebookData.name || data.name || 'Imported Lorebook';
		const description = lorebookData.description || data.description || null;

		// Get entries - handle both array and object formats
		let rawEntries: ImportedEntry[] = [];
		const entriesData = lorebookData.entries || data.entries;

		if (Array.isArray(entriesData)) {
			rawEntries = entriesData;
		} else if (entriesData && typeof entriesData === 'object') {
			// Object format (keyed by ID)
			rawEntries = Object.values(entriesData);
		}

		if (rawEntries.length === 0) {
			return json({ error: 'No entries found in lorebook file' }, { status: 400 });
		}

		// Create the lorebook
		const [lorebook] = await db
			.insert(lorebooks)
			.values({
				userId: parseInt(userId),
				name,
				description,
				isGlobal: false
			})
			.returning();

		// Process and insert entries
		let importedCount = 0;
		for (const entry of rawEntries) {
			// Get keywords from various possible field names
			let keywords: string[] = [];
			if (entry.keys && Array.isArray(entry.keys)) {
				keywords = entry.keys;
			} else if (entry.key && Array.isArray(entry.key)) {
				keywords = entry.key;
			} else if (entry.keywords && Array.isArray(entry.keywords)) {
				keywords = entry.keywords;
			}

			// Skip entries without keywords or content
			if (keywords.length === 0 || !entry.content) {
				continue;
			}

			// Get entry name
			const entryName = entry.name || entry.comment || keywords[0] || 'Unnamed Entry';

			// Get enabled status (default true)
			const enabled = entry.enabled !== false;

			// Get case sensitivity
			const caseSensitive = entry.case_sensitive === true || entry.caseSensitive === true;

			// Get priority (some formats use insertion_order)
			const priority = entry.priority ?? entry.insertion_order ?? 0;

			await db.insert(lorebookEntries).values({
				lorebookId: lorebook.id,
				name: entryName,
				keywords: JSON.stringify(keywords),
				content: entry.content,
				enabled,
				caseSensitive,
				priority
			});

			importedCount++;
		}

		return json({
			success: true,
			lorebook: {
				...lorebook,
				entryCount: importedCount,
				enabledCount: importedCount
			},
			importedCount
		}, { status: 201 });
	} catch (error) {
		console.error('Failed to import lorebook:', error);
		return json({ error: 'Failed to import lorebook. Make sure the file is valid JSON.' }, { status: 500 });
	}
};
