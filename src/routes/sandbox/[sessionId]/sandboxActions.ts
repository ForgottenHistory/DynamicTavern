import type { Message, Character } from '$lib/server/db/schema';
import type { World, WorldLocation, SandboxMode } from '$lib/types/sandbox';
import type { WorldStateData } from '$lib/server/services/worldInfoService';
import type { ImpersonateStyle, SceneActionType } from '$lib/types/chat';

export type { ImpersonateStyle, SceneActionType };

export interface ConnectionInfo {
	id: string;
	location: WorldLocation;
}

export interface SessionData {
	session: { mode: SandboxMode; [key: string]: any };
	world: World | null;
	location: WorldLocation | null;
	character: Character | null;
	characters: Character[];
	messages: Message[];
	connections: ConnectionInfo[];
}

export interface MoveResult {
	location: WorldLocation;
	character: Character | null;
	characters: Character[];
	messages: Message[];
	connections: ConnectionInfo[];
}

export async function loadSession(sessionId: number): Promise<SessionData | null> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}`);
	if (!response.ok) {
		if (response.status === 404) return null;
		throw new Error('Failed to load session');
	}
	return response.json();
}

export async function initSession(sessionId: number): Promise<{ messages: Message[]; characters: Character[] }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/init`, {
		method: 'POST'
	});
	if (!response.ok) throw new Error('Failed to init session');
	return response.json();
}

export async function moveToLocation(sessionId: number, locationId: string, followingCharacterIds?: number[]): Promise<MoveResult> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/move`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ locationId, followingCharacterIds })
	});
	if (!response.ok) throw new Error('Failed to move');
	return response.json();
}

export async function sendMessage(sessionId: number, content: string): Promise<{ messages: Message[]; location?: WorldLocation }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content })
	});
	if (!response.ok) throw new Error('Failed to send message');
	return response.json();
}

export async function generateResponse(sessionId: number, characterId?: number): Promise<{ messages: Message[] }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/generate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ characterId })
	});
	if (!response.ok) throw new Error('Failed to generate');
	return response.json();
}

export async function deleteSession(sessionId: number): Promise<void> {
	await fetch(`/api/sandbox/sessions/${sessionId}`, {
		method: 'DELETE'
	});
}

export async function regenerateMessage(sessionId: number, messageId: number): Promise<{ content: string; reasoning?: string }> {
	const response = await fetch(
		`/api/sandbox/sessions/${sessionId}/messages/${messageId}/regenerate`,
		{ method: 'POST' }
	);
	if (!response.ok) throw new Error('Failed to regenerate');
	return response.json();
}

export async function swipeMessage(sessionId: number, messageId: number, swipeIndex: number): Promise<boolean> {
	const response = await fetch(
		`/api/sandbox/sessions/${sessionId}/messages/${messageId}/swipe`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ swipeIndex })
		}
	);
	return response.ok;
}

export async function editMessage(sessionId: number, messageId: number, content: string): Promise<{ message: Message }> {
	const response = await fetch(
		`/api/sandbox/sessions/${sessionId}/messages/${messageId}/edit`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		}
	);
	if (!response.ok) throw new Error('Failed to edit message');
	return response.json();
}

export async function deleteMessage(sessionId: number, messageId: number): Promise<boolean> {
	const response = await fetch(
		`/api/sandbox/sessions/${sessionId}/messages/${messageId}/delete`,
		{ method: 'DELETE' }
	);
	return response.ok;
}

export async function impersonate(sessionId: number, style: ImpersonateStyle): Promise<{ content: string }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/impersonate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ style })
	});
	if (!response.ok) throw new Error('Failed to impersonate');
	return response.json();
}

export async function executeSceneAction(
	sessionId: number,
	actionType: SceneActionType,
	itemContext?: { owner: string; itemName: string; itemDescription: string }
): Promise<{ messages: Message[] }> {
	const body: Record<string, unknown> = { actionType };
	if (actionType === 'look_item' && itemContext) {
		body.itemContext = itemContext;
	}
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/scene-action`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!response.ok) throw new Error('Failed to execute scene action');
	return response.json();
}

export async function fetchCharacters(sessionId: number): Promise<Character[]> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/characters`);
	if (!response.ok) throw new Error('Failed to fetch characters');
	const data = await response.json();
	return data.characters;
}

export async function addCharacter(sessionId: number, characterId: number): Promise<{ characters: Character[]; messages: Message[] }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/characters`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ characterId })
	});
	if (!response.ok) throw new Error('Failed to add character');
	return response.json();
}

export async function removeCharacter(sessionId: number, characterId: number): Promise<{ characters: Character[]; messages: Message[] }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/characters`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ characterId })
	});
	if (!response.ok) throw new Error('Failed to remove character');
	return response.json();
}

export async function wait(sessionId: number): Promise<{ characters: Character[]; messages: Message[] }> {
	const response = await fetch(`/api/sandbox/sessions/${sessionId}/wait`, {
		method: 'POST'
	});
	if (!response.ok) {
		const data = await response.json();
		throw new Error(data.error || 'Failed to wait');
	}
	return response.json();
}

export async function getWorldState(sessionId: number): Promise<WorldStateData | null> {
	try {
		const res = await fetch(`/api/sandbox/sessions/${sessionId}/world-state`);
		if (res.ok) return res.json();
		return null;
	} catch {
		return null;
	}
}

export async function generateWorldState(sessionId: number): Promise<WorldStateData | null> {
	const res = await fetch(`/api/sandbox/sessions/${sessionId}/world-state`, {
		method: 'POST'
	});
	if (res.ok) return res.json();
	return null;
}

export async function updateWorldState(
	sessionId: number,
	entityKey: string,
	attrName: string,
	value: string | { name: string; description: string }[]
): Promise<WorldStateData | null> {
	const res = await fetch(`/api/sandbox/sessions/${sessionId}/world-state`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ entityKey, attrName, value })
	});
	if (res.ok) return res.json();
	return null;
}

export async function clearWorldState(sessionId: number): Promise<boolean> {
	const res = await fetch(`/api/sandbox/sessions/${sessionId}/world-state`, {
		method: 'DELETE'
	});
	return res.ok;
}

export async function loadUserSettings(): Promise<{
	chatLayout: 'bubbles' | 'discord';
	avatarStyle: 'circle' | 'rounded';
	textCleanupEnabled: boolean;
	autoWrapActions: boolean;
	userBubbleColor: string;
	worldSidebarEnabled: boolean;
	userAvatar: string | null;
	userName: string | null;
}> {
	try {
		const res = await fetch('/api/settings');
		if (res.ok) {
			const data = await res.json();
			return {
				chatLayout: data.chatLayout || 'bubbles',
				avatarStyle: data.avatarStyle || 'circle',
				textCleanupEnabled: data.textCleanupEnabled ?? true,
				autoWrapActions: data.autoWrapActions ?? false,
				userBubbleColor: data.userBubbleColor ?? '#14b8a6',
				worldSidebarEnabled: data.worldSidebarEnabled ?? false,
				userAvatar: data.userAvatar || null,
				userName: data.userName || null
			};
		}
	} catch (e) {
		console.error('Failed to load user settings:', e);
	}
	return {
		chatLayout: 'bubbles',
		avatarStyle: 'circle',
		textCleanupEnabled: true,
		autoWrapActions: false,
		userBubbleColor: '#14b8a6',
		worldSidebarEnabled: false,
		userAvatar: null,
		userName: null
	};
}
