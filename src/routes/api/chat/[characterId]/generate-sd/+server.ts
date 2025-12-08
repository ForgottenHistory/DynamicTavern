import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { characters, conversations, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { sdService } from '$lib/server/services/sdService';
import { sdSettingsService } from '$lib/server/services/sdSettingsService';
import { getSocketServer } from '$lib/server/socket';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'data/images';

// POST - Generate image using Stable Diffusion
export const POST: RequestHandler = async ({ params, cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const { tags } = await request.json();

		if (!tags || typeof tags !== 'string') {
			return json({ error: 'Tags are required' }, { status: 400 });
		}

		// Get character for overrides
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get active conversation (branch)
		const [conversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId),
					eq(conversations.isActive, true)
				)
			)
			.limit(1);

		if (!conversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		// Get user's SD settings
		const userSettings = await sdSettingsService.getUserSettings(parseInt(userId));

		// Generate image
		const result = await sdService.generateImage({
			// Always include character's base appearance tags
			characterTags: character.imageTags || '',
			// The LLM-generated contextual tags
			contextTags: tags,
			settings: {
				steps: userSettings.steps,
				cfgScale: userSettings.cfgScale,
				sampler: userSettings.sampler,
				scheduler: userSettings.scheduler,
				enableHr: userSettings.enableHr,
				hrScale: userSettings.hrScale,
				hrUpscaler: userSettings.hrUpscaler,
				hrSteps: userSettings.hrSteps,
				denoisingStrength: userSettings.denoisingStrength,
				enableAdetailer: userSettings.enableAdetailer,
				adetailerModel: userSettings.adetailerModel,
				mainPrompt: userSettings.mainPrompt,
				negativePrompt: userSettings.negativePrompt,
				model: userSettings.model
			},
			// Character-specific overrides take precedence
			mainPromptOverride: character.mainPromptOverride || undefined,
			negativePromptOverride: character.negativePromptOverride || undefined
		});

		if (!result.success) {
			return json({ error: result.error || 'Failed to generate image' }, { status: 500 });
		}

		// Ensure images directory exists
		await fs.mkdir(IMAGES_DIR, { recursive: true });

		// Generate unique filename
		const timestamp = Date.now();
		const filename = `${conversation.id}_${timestamp}.png`;
		const filepath = path.join(IMAGES_DIR, filename);

		// Save image to file
		await fs.writeFile(filepath, result.imageBuffer!);

		// Create image message with file path and prompt
		// Format: [SD_IMAGE]/api/images/filename.png|prompt text[/SD_IMAGE]
		const imageContent = `[SD_IMAGE]/api/images/${filename}|${result.prompt}[/SD_IMAGE]`;

		const [newMessage] = await db
			.insert(messages)
			.values({
				conversationId: conversation.id,
				role: 'assistant',
				content: imageContent,
				senderName: character.name,
				senderAvatar: character.thumbnailData || character.imageData
			})
			.returning();

		// Emit via Socket.IO
		const io = getSocketServer();
		if (io) {
			io.to(`conversation-${conversation.id}`).emit('new-message', newMessage);
		}

		return json({
			success: true,
			message: newMessage,
			generationTime: result.generationTime
		});
	} catch (error: any) {
		console.error('Failed to generate SD image:', error);
		return json({ error: error.message || 'Failed to generate image' }, { status: 500 });
	}
};
