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

		// Get all active characters
		const activeCharacters = await sandboxService.getActiveCharacters(sessionId);
		if (activeCharacters.length === 0) {
			return json({ error: 'No characters present' }, { status: 400 });
		}

		// Get user info
		const userInfo = await personaService.getActiveUserInfo(parseInt(userId));

		// Get recent chat history
		const recentMessages = await sandboxService.getMessages(sessionId);
		const last10 = recentMessages.slice(-10);

		// Format chat history
		const chatHistory = last10
			.map((m) => {
				const name = m.role === 'user' ? userInfo.name : (m.role === 'assistant' ? (m.senderName || 'Character') : 'Narrator');
				return `${name}: ${m.content}`;
			})
			.join('\n\n');

		// Get previous world state if it exists
		let previousState: WorldStateData | null = null;
		if (session.worldInfo) {
			try {
				const parsed = JSON.parse(session.worldInfo);
				previousState = parsed.worldState || parsed;
			} catch { /* ignore */ }
		}

		// Build character info for all active characters
		const characterInfos = activeCharacters.map(c => {
			let description = c.description || '';
			if (!description) {
				try {
					const cardData = JSON.parse(c.cardData);
					description = cardData.data?.description || cardData.description || '';
				} catch { /* ignore */ }
			}
			return { name: c.name, description };
		});

		// Generate world state for all characters
		const worldState = await clothesGenerationService.generateWorldState({
			characters: characterInfos,
			scenario: '',
			userName: userInfo.name,
			chatHistory,
			previousState
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

// PATCH - Update a specific attribute in world state
export const PATCH: RequestHandler = async ({ params, cookies, request }) => {
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
			return json({ error: 'No world state to update' }, { status: 400 });
		}

		const { entityKey, attrName, value } = await request.json();
		if (!entityKey || !attrName || value === undefined) {
			return json({ error: 'Missing entityKey, attrName, or value' }, { status: 400 });
		}

		const parsed = JSON.parse(session.worldInfo);
		const worldState: WorldStateData = parsed.worldState || parsed;

		const entity = worldState[entityKey];
		if (!entity) {
			return json({ error: 'Entity not found' }, { status: 404 });
		}

		const attr = entity.attributes.find(a => a.name === attrName);
		if (!attr) {
			return json({ error: 'Attribute not found' }, { status: 404 });
		}

		attr.value = value;

		await db
			.update(sandboxSessions)
			.set({ worldInfo: JSON.stringify({ worldState }) })
			.where(eq(sandboxSessions.id, sessionId));

		return json(worldState);
	} catch (error) {
		console.error('Failed to update world state:', error);
		return json({ error: 'Failed to update world state' }, { status: 500 });
	}
};

// DELETE - Clear world state for a sandbox session
export const DELETE: RequestHandler = async ({ params, cookies }) => {
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

		await db
			.update(sandboxSessions)
			.set({ worldInfo: null })
			.where(eq(sandboxSessions.id, sessionId));

		return json({ success: true });
	} catch (error) {
		console.error('Failed to clear world state:', error);
		return json({ error: 'Failed to clear world state' }, { status: 500 });
	}
};
