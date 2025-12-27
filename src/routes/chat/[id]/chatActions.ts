import type { Message } from '$lib/server/db/schema';
import type { ImpersonateStyle, SceneActionType } from '$lib/types/chat';

export type { ImpersonateStyle, SceneActionType };

export interface ChatActions {
	loadSettings: () => Promise<{
		chatLayout: 'bubbles' | 'discord';
		avatarStyle: 'circle' | 'rounded';
		textCleanupEnabled: boolean;
		autoWrapActions: boolean;
		userAvatar: string | null;
		userName: string | null;
	}>;
	loadCharacter: (characterId: number) => Promise<any>;
	loadConversation: (characterId: number) => Promise<{
		isNewChat: boolean;
		conversationId: number | null;
		messages: Message[];
		branches: any[];
		activeBranchId: number | null;
	}>;
	sendMessage: (characterId: number, userMessage: string) => Promise<boolean>;
	generateResponse: (characterId: number) => Promise<boolean>;
	impersonate: (characterId: number, style: ImpersonateStyle) => Promise<string | null>;
	generateImageTags: (characterId: number, type: 'character' | 'user' | 'scene' | 'raw') => Promise<string | null>;
	generateSDImage: (characterId: number, tags: string) => Promise<boolean>;
	resetConversation: (conversationId: number) => Promise<boolean>;
	createBranch: (characterId: number, messageId: number, name?: string) => Promise<boolean>;
	switchBranch: (characterId: number, branchId: number) => Promise<boolean>;
	deleteBranch: (characterId: number, branchId: number) => Promise<boolean>;
	swipeMessage: (messageId: number, swipeIndex: number) => Promise<boolean>;
	regenerateMessage: (messageId: number) => Promise<{ content: string } | null>;
	regenerateFresh: (messageId: number) => Promise<boolean>;
	deleteMessageAndBelow: (messageId: number) => Promise<boolean>;
	saveMessageEdit: (messageId: number, content: string) => Promise<Message | null>;
}

export async function loadSettings(): Promise<{
	chatLayout: 'bubbles' | 'discord';
	avatarStyle: 'circle' | 'rounded';
	textCleanupEnabled: boolean;
	autoWrapActions: boolean;
	randomNarrationEnabled: boolean;
	randomNarrationMinMessages: number;
	randomNarrationMaxMessages: number;
	worldSidebarEnabled: boolean;
	autoWorldStateEnabled: boolean;
	autoWorldStateMinMessages: number;
	autoWorldStateMaxMessages: number;
	userAvatar: string | null;
	userName: string | null;
}> {
	try {
		const response = await fetch('/api/settings');
		if (response.ok) {
			const result = await response.json();
			return {
				chatLayout: result.chatLayout || 'bubbles',
				avatarStyle: result.avatarStyle || 'circle',
				textCleanupEnabled: result.textCleanupEnabled ?? true,
				autoWrapActions: result.autoWrapActions ?? false,
				randomNarrationEnabled: result.randomNarrationEnabled ?? false,
				randomNarrationMinMessages: result.randomNarrationMinMessages ?? 3,
				randomNarrationMaxMessages: result.randomNarrationMaxMessages ?? 8,
				worldSidebarEnabled: result.worldSidebarEnabled ?? false,
				autoWorldStateEnabled: result.autoWorldStateEnabled ?? false,
				autoWorldStateMinMessages: result.autoWorldStateMinMessages ?? 5,
				autoWorldStateMaxMessages: result.autoWorldStateMaxMessages ?? 12,
				userAvatar: result.userAvatar || null,
				userName: result.userName || null
			};
		}
	} catch (error) {
		console.error('Failed to load settings:', error);
	}
	return {
		chatLayout: 'bubbles',
		avatarStyle: 'circle',
		textCleanupEnabled: true,
		autoWrapActions: false,
		randomNarrationEnabled: false,
		randomNarrationMinMessages: 3,
		randomNarrationMaxMessages: 8,
		worldSidebarEnabled: false,
		autoWorldStateEnabled: false,
		autoWorldStateMinMessages: 5,
		autoWorldStateMaxMessages: 12,
		userAvatar: null,
		userName: null
	};
}

export async function loadCharacter(characterId: number): Promise<any | null> {
	try {
		const response = await fetch(`/api/characters/${characterId}`);
		const result = await response.json();
		return result.character;
	} catch (error) {
		console.error('Failed to load character:', error);
		return null;
	}
}

export async function loadConversation(characterId: number): Promise<{
	isNewChat: boolean;
	conversationId: number | null;
	messages: Message[];
	branches: any[];
	activeBranchId: number | null;
}> {
	try {
		const response = await fetch(`/api/chat/${characterId}`);
		const result = await response.json();
		return {
			isNewChat: result.isNewChat || false,
			conversationId: result.conversationId,
			messages: result.messages || [],
			branches: result.branches || [],
			activeBranchId: result.activeBranchId
		};
	} catch (error) {
		console.error('Failed to load conversation:', error);
		return {
			isNewChat: false,
			conversationId: null,
			messages: [],
			branches: [],
			activeBranchId: null
		};
	}
}

export async function sendMessage(characterId: number, userMessage: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/send`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: userMessage })
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to send message:', error);
		return false;
	}
}

export async function generateResponse(characterId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/generate`, {
			method: 'POST'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to generate response:', error);
		return false;
	}
}

export async function impersonate(characterId: number, style: ImpersonateStyle = 'impersonate'): Promise<string | null> {
	try {
		const response = await fetch(`/api/chat/${characterId}/impersonate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ style })
		});
		if (response.ok) {
			const result = await response.json();
			return result.content;
		}
		return null;
	} catch (error) {
		console.error('Failed to impersonate:', error);
		return null;
	}
}

export async function generateImageTags(
	characterId: number,
	type: 'character' | 'user' | 'scene' | 'raw'
): Promise<string | null> {
	try {
		const response = await fetch(`/api/chat/${characterId}/generate-image`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type })
		});
		if (response.ok) {
			const result = await response.json();
			return result.tags;
		}
		const error = await response.json();
		console.error('Failed to generate tags:', error.error || 'Unknown error');
		return null;
	} catch (error) {
		console.error('Failed to generate tags:', error);
		return null;
	}
}

export async function generateSDImage(characterId: number, tags: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/generate-sd`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tags })
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to generate image:', error);
		return false;
	}
}

export async function resetConversation(conversationId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${conversationId}/reset`, {
			method: 'POST'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to reset conversation:', error);
		return false;
	}
}

export async function createBranch(
	characterId: number,
	messageId: number,
	name?: string
): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/branches`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId, name })
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to create branch:', error);
		return false;
	}
}

export async function switchBranch(characterId: number, branchId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/branches/${branchId}`, {
			method: 'PUT'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to switch branch:', error);
		return false;
	}
}

export async function deleteBranch(characterId: number, branchId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/${characterId}/branches/${branchId}`, {
			method: 'DELETE'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to delete branch:', error);
		return false;
	}
}

export async function updateSwipeIndex(messageId: number, swipeIndex: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/messages/${messageId}/swipe`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ swipeIndex })
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to swipe message:', error);
		return false;
	}
}

export async function regenerateMessage(messageId: number): Promise<{ content: string } | null> {
	try {
		const response = await fetch(`/api/chat/messages/${messageId}/regenerate`, {
			method: 'POST'
		});
		if (response.ok) {
			return await response.json();
		}
		return null;
	} catch (error) {
		console.error('Failed to regenerate message:', error);
		return null;
	}
}

export async function regenerateFresh(messageId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/messages/${messageId}/regenerate-fresh`, {
			method: 'POST'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to regenerate message:', error);
		return false;
	}
}

export async function deleteMessageAndBelow(messageId: number): Promise<boolean> {
	try {
		const response = await fetch(`/api/chat/messages/${messageId}/delete`, {
			method: 'DELETE'
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to delete messages:', error);
		return false;
	}
}

export async function saveMessageEdit(messageId: number, content: string): Promise<Message | null> {
	try {
		const response = await fetch(`/api/chat/messages/${messageId}/edit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
		if (response.ok) {
			const result = await response.json();
			return result.message;
		}
		return null;
	} catch (error) {
		console.error('Failed to save edit:', error);
		return null;
	}
}

export interface ItemContext {
	owner: string;
	itemName: string;
	itemDescription: string;
}

export interface CharacterContext {
	characterId: number;
	characterName: string;
}

export async function triggerSceneAction(
	characterId: number,
	actionType: SceneActionType,
	itemContext?: ItemContext,
	characterContext?: CharacterContext,
	conversationId?: number
): Promise<boolean> {
	if (!conversationId) {
		console.error('No conversation ID provided for scene action');
		return false;
	}
	try {
		// Use target character ID if provided (for "Look at [Character]" actions)
		const targetCharacterId = characterContext?.characterId ?? characterId;
		const response = await fetch('/api/scene-action', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ actionType, itemContext, characterId: targetCharacterId, conversationId })
		});
		return response.ok;
	} catch (error) {
		console.error('Failed to trigger scene action:', error);
		return false;
	}
}

// World state generation - generic structure for any attributes
export interface ListItem {
	name: string;
	description: string;
}

export interface WorldAttribute {
	name: string;
	type: 'text' | 'list';
	value: string | ListItem[];
}

export interface EntityState {
	attributes: WorldAttribute[];
}

export interface WorldStateData {
	[entity: string]: EntityState;
}

// Backwards compatibility alias
export type ClothesData = WorldStateData;

export async function generateWorldState(characterId: number): Promise<WorldStateData | null> {
	try {
		const response = await fetch(`/api/chat/${characterId}/clothes`, {
			method: 'POST'
		});
		if (response.ok) {
			return await response.json();
		}
		return null;
	} catch (error) {
		console.error('Failed to generate world state:', error);
		return null;
	}
}

export async function getWorldState(characterId: number): Promise<WorldStateData | null> {
	try {
		const response = await fetch(`/api/chat/${characterId}/clothes`);
		if (response.ok) {
			const data = await response.json();
			// Check if it's valid world state data (has entity with attributes)
			if (data && typeof data === 'object') {
				const firstEntity = Object.values(data)[0] as EntityState | undefined;
				if (firstEntity?.attributes) {
					return data;
				}
			}
		}
		return null;
	} catch (error) {
		console.error('Failed to get world state:', error);
		return null;
	}
}

// Backwards compatibility aliases
export const generateClothes = generateWorldState;
export const getClothes = getWorldState;

// Utility functions for swipes
export function getSwipes(message: Message): string[] {
	if (!message.swipes) return [message.content];
	try {
		const swipes = JSON.parse(message.swipes);
		return Array.isArray(swipes) ? swipes : [message.content];
	} catch {
		return [message.content];
	}
}

export function getCurrentSwipeIndex(message: Message): number {
	return message.currentSwipe ?? 0;
}
