import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sandboxSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { sandboxService } from '$lib/server/services/sandboxService';
import { clothesGenerationService } from '$lib/server/services/clothesGenerationService';
import { personaService } from '$lib/server/services/personaService';
import type { WorldStateData } from '$lib/server/services/worldInfoService';

// GET - Get saved world state for a sandbox session
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		if (!session.worldInfo) {
			return json(null);
		}

		try {
			const parsed = JSON.parse(session.worldInfo);
			return json(parsed.worldState || parsed);
		} catch {
			return json(null);
		}
	} catch (error) {
		console.error('Failed to get world state:', error);
		return json({ error: 'Failed to get world state' }, { status: 500 });
	}
};

// POST - Generate world state for a sandbox session
export const POST: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const sessionId = parseInt(params.id!);
	if (isNaN(sessionId)) {
		return json({ error: 'Invalid session ID' }, { status: 400 });
	}

	try {
		const session = await sandboxService.getSession(sessionId, parseInt(userId));
		if (!session) {
			return json({ error: 'Session not found' }, { status: 404 });
		}

		const character = await sandboxService.getCurrentCharacter(session);
		if (!character) {
			return json({ error: 'No character present' }, { status: 400 });
		}

		// Parse character card data for scenario
		let characterData: any = {};
		try {
			characterData = JSON.parse(character.cardData);
			if (characterData.data) {
				characterData = characterData.data;
			}
		} catch (error) {
			console.error('Failed to parse character card data:', error);
		}

		// Get user info
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Get recent chat history
		const recentMessages = await sandboxService.getMessages(sessionId);
		const last10 = recentMessages.slice(-10);

		// Format chat history
		const chatHistory = last10
			.map((m) => {
				const name = m.role === 'user' ? userInfo.name : (m.role === 'assistant' ? character.name : 'Narrator');
				return `[${name}] ${m.content}`;
			})
			.join('\n\n');

		// Generate world state
		const worldState = await clothesGenerationService.generateClothes({
			characterName: character.name,
			characterDescription: character.description || characterData.description || '',
			scenario: characterData.scenario || '',
			userName: userInfo.name,
			chatHistory
		});

		// Save to database
		await db
			.update(sandboxSessions)
			.set({ worldInfo: JSON.stringify({ worldState }) })
			.where(eq(sandboxSessions.id, sessionId));

		return json(worldState);
	} catch (error) {
		console.error('Failed to generate world state:', error);
		return json({ error: 'Failed to generate world state' }, { status: 500 });
	}
};
