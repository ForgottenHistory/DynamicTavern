import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { messages, conversations, characters, llmSettings } from '$lib/server/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { generateChatCompletion } from '$lib/server/llm';
import { emitTyping } from '$lib/server/socket';
import { sdService } from '$lib/server/services/sdService';
import { sdSettingsService } from '$lib/server/services/sdSettingsService';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = 'data/images';

// POST - Regenerate a message (create new swipe variant)
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const messageId = parseInt(params.messageId);
	if (isNaN(messageId)) {
		return json({ error: 'Invalid message ID' }, { status: 400 });
	}

	try {
		// Get the message and verify ownership
		const [messageData] = await db
			.select({
				message: messages,
				conversation: conversations
			})
			.from(messages)
			.innerJoin(conversations, eq(messages.conversationId, conversations.id))
			.where(and(
				eq(messages.id, messageId),
				eq(conversations.userId, parseInt(userId))
			))
			.limit(1);

		if (!messageData) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		const { message, conversation } = messageData;

		// Only allow regenerating assistant messages
		if (message.role !== 'assistant') {
			return json({ error: 'Can only regenerate assistant messages' }, { status: 400 });
		}

		// Get character
		const [character] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, conversation.characterId))
			.limit(1);

		if (!character) {
			return json({ error: 'Character not found' }, { status: 404 });
		}

		// Get conversation history up to this message
		const conversationHistory = await db
			.select()
			.from(messages)
			.where(and(
				eq(messages.conversationId, conversation.id),
				lt(messages.id, messageId)
			))
			.orderBy(messages.createdAt);

		// Get LLM settings
		const [settings] = await db
			.select()
			.from(llmSettings)
			.where(eq(llmSettings.userId, parseInt(userId)))
			.limit(1);

		if (!settings) {
			return json({ error: 'LLM settings not found' }, { status: 404 });
		}

		// Check if this is an image message
		const sdImageMatch = message.content.match(/^\[SD_IMAGE\](.+?)\|(.+?)\[\/SD_IMAGE\]$/s);
		const isImageMessage = !!sdImageMatch;

		let newContent: string;
		let newReasoning: string | null = null;

		if (isImageMessage) {
			// Regenerate image using the same prompt (already fully combined)
			const originalPrompt = sdImageMatch![2];

			// Get user's SD settings
			const userSettings = await sdSettingsService.getUserSettings(parseInt(userId));

			// Generate new image with the EXACT same prompt - don't re-combine
			// Pass the full prompt as contextTags and leave others empty
			const result = await sdService.generateImage({
				characterTags: '',  // Already in originalPrompt
				contextTags: originalPrompt,  // This IS the full prompt
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
					mainPrompt: '',  // Already in originalPrompt
					negativePrompt: userSettings.negativePrompt,
					model: userSettings.model
				}
				// No overrides - prompt is already complete
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

			// Create new image content with same prompt
			newContent = `[SD_IMAGE]/api/images/${filename}|${result.prompt}[/SD_IMAGE]`;
		} else {
			// Regular text message - use chat completion
			// Emit typing indicator
			emitTyping(conversation.id, true);

			try {
				// Generate new response
				const result = await generateChatCompletion(
					conversationHistory,
					character,
					settings,
					'swipe' // message type for logging
				);
				newContent = result.content;
				newReasoning = result.reasoning;
			} catch (genError) {
				// Stop typing indicator on generation error
				emitTyping(conversation.id, false);
				throw genError;
			}

			// Stop typing indicator
			emitTyping(conversation.id, false);
		}

		// Parse existing swipes and reasoning arrays
		const swipes = message.swipes ? JSON.parse(message.swipes) : [message.content];
		// Get existing reasoning array or create with null for existing swipes
		const existingReasoning: (string | null)[] = message.reasoning
			? JSON.parse(message.reasoning)
			: new Array(swipes.length).fill(null);

		// Add new variant to swipes and reasoning
		swipes.push(newContent);
		existingReasoning.push(newReasoning);

		// Update message with new swipe
		await db
			.update(messages)
			.set({
				swipes: JSON.stringify(swipes),
				currentSwipe: swipes.length - 1,
				content: newContent,
				reasoning: JSON.stringify(existingReasoning)
			})
			.where(eq(messages.id, messageId));

		return json({ success: true, content: newContent, reasoning: newReasoning, swipeCount: swipes.length });
	} catch (error) {
		console.error('Failed to regenerate message:', error);
		return json({ error: 'Failed to regenerate message' }, { status: 500 });
	}
};
