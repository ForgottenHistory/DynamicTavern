import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { characters, lorebooks, lorebookEntries, characterLorebooks } from '$lib/server/db/schema';
import { characterImageParser } from '$lib/utils/characterImageParser';
import sharp from 'sharp';

interface CharacterBookEntry {
	keys: string[];
	content: string;
	enabled: boolean;
	insertion_order: number;
	case_sensitive?: boolean;
	name?: string;
	priority?: number;
}

interface CharacterBook {
	name?: string;
	description?: string;
	entries: CharacterBookEntry[];
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const userId = cookies.get('userId');

		if (!userId) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const formData = await request.formData();
		const files = formData.getAll('files') as File[];

		if (!files || files.length === 0) {
			return json({ error: 'No files provided' }, { status: 400 });
		}

		const results = {
			success: [] as any[],
			failed: [] as any[]
		};

		for (const file of files) {
			try {
				// Extract character data from PNG
				const cardData = await characterImageParser.extractFromPNG(file);

				if (!cardData) {
					results.failed.push({
						filename: file.name,
						error: 'Not a valid character card'
					});
					continue;
				}

				// Extract basic info for display (full card data is preserved in cardData field)
				const name = cardData.data?.name || 'Unknown';
				const description = cardData.data?.description || '';
				const tags = cardData.data?.tags || [];

				// Convert image to base64
				const arrayBuffer = await file.arrayBuffer();
				const imageBuffer = Buffer.from(arrayBuffer);
				const base64 = imageBuffer.toString('base64');
				const imageData = `data:image/png;base64,${base64}`;

				// Generate thumbnail for sidebar (128px width, maintain aspect ratio)
				let thumbnailData: string | null = null;
				try {
					const thumbnailBuffer = await sharp(imageBuffer)
						.resize(128, 170, { fit: 'cover' })
						.png({ quality: 80 })
						.toBuffer();
					thumbnailData = `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
				} catch (thumbError) {
					console.warn('Failed to generate thumbnail:', thumbError);
					// Fall back to full image if thumbnail generation fails
				}

				// Store in database
				const newChar = await db
					.insert(characters)
					.values({
						userId: parseInt(userId),
						name,
						description,
						tags: JSON.stringify(tags),
						imageData,
						thumbnailData,
						cardData: JSON.stringify(cardData)
					})
					.returning();

				const character = newChar[0];
				let lorebookImported = false;

				// Import character_book if present
				const characterBook = cardData.data?.character_book as CharacterBook | undefined;
				if (characterBook && characterBook.entries && characterBook.entries.length > 0) {
					try {
						// Create a lorebook for this character
						const lorebookName = characterBook.name || `${name}'s Lorebook`;
						const lorebookDescription = characterBook.description || `Imported from ${name}'s character card`;

						const [newLorebook] = await db
							.insert(lorebooks)
							.values({
								userId: parseInt(userId),
								name: lorebookName,
								description: lorebookDescription,
								enabled: true,
								isGlobal: false
							})
							.returning();

						// Link lorebook to character
						await db.insert(characterLorebooks).values({
							characterId: character.id,
							lorebookId: newLorebook.id
						});

						// Import all entries
						for (const entry of characterBook.entries) {
							await db.insert(lorebookEntries).values({
								lorebookId: newLorebook.id,
								name: entry.name || entry.keys.slice(0, 3).join(', ') || 'Unnamed Entry',
								keywords: JSON.stringify(entry.keys || []),
								content: entry.content || '',
								enabled: entry.enabled !== false,
								caseSensitive: entry.case_sensitive || false,
								priority: entry.priority ?? entry.insertion_order ?? 0
							});
						}

						lorebookImported = true;
						console.log(`Imported ${characterBook.entries.length} lorebook entries for ${name}`);
					} catch (lorebookError) {
						console.error(`Failed to import lorebook for ${name}:`, lorebookError);
						// Continue even if lorebook import fails - character is still created
					}
				}

				results.success.push({
					filename: file.name,
					character,
					lorebookImported,
					lorebookEntries: lorebookImported ? characterBook?.entries?.length : 0
				});
			} catch (error: any) {
				console.error(`Failed to process ${file.name}:`, error);
				results.failed.push({
					filename: file.name,
					error: error.message || 'Processing failed'
				});
			}
		}

		return json(results);
	} catch (error: any) {
		console.error('Upload error:', error);
		return json({ error: 'Upload failed' }, { status: 500 });
	}
};
