import type { Character, Message } from '$lib/server/db/schema';
import type { World, WorldLocation } from '$lib/types/sandbox';
import type { WorldStateData } from '$lib/server/services/worldInfoService';
import { goto } from '$app/navigation';
import * as api from './sandboxActions';

export type { ImpersonateStyle, SceneActionType } from './sandboxActions';
export type { ConnectionInfo } from './sandboxActions';

export interface SandboxStateOptions {
	sessionId: number;
	userId: number;
	userDisplayName: string;
	onScrollToBottom: () => void;
	onSetInput: (content: string) => void;
}

export function createSandboxState(options: SandboxStateOptions) {
	// Core state
	let world = $state<World | null>(null);
	let location = $state<WorldLocation | null>(null);
	let character = $state<Character | null>(null);
	let messages = $state<Message[]>([]);
	let connections = $state<api.ConnectionInfo[]>([]);
	let loading = $state(true);
	let moving = $state(false);
	let sending = $state(false);
	let generating = $state(false);
	let impersonating = $state(false);
	let error = $state<string | null>(null);

	// World state
	let worldState = $state<WorldStateData | null>(null);
	let worldStateLoading = $state(false);
	let worldSidebarEnabled = $state(false);

	// World state display
	let worldExpanded = $state(true);
	let expandedWorldSections = $state<Set<string>>(new Set(['character']));
	let expandedWorldItems = $state<Set<string>>(new Set());

	// World state editing
	let editingWorldKey = $state<string | null>(null);
	let editingWorldValue = $state<string>('');
	let editingListItem = $state<{ entityKey: string; attrName: string; itemIdx: number } | null>(null);
	let editingItemName = $state('');
	let editingItemDescription = $state('');

	// User settings
	let chatLayout = $state<'bubbles' | 'discord'>('bubbles');
	let avatarStyle = $state<'circle' | 'rounded'>('circle');
	let textCleanupEnabled = $state(true);
	let autoWrapActions = $state(false);
	let userBubbleColor = $state('#14b8a6');
	let userAvatar = $state<string | null>(null);
	let userName = $state<string | null>(null);

	// Derived
	const hasAssistantMessages = $derived(messages.some((m) => m.role === 'assistant' || m.role === 'narrator'));
	const sceneCharacters = $derived.by(() => {
		if (!character) return [];
		return [{ id: character.id, name: character.name, thumbnailData: character.thumbnailData, imageData: character.imageData }];
	});

	// Auto-scroll when typing indicator appears
	$effect(() => {
		if (sending || generating) {
			options.onScrollToBottom();
		}
	});

	// --- Init ---

	async function init() {
		await Promise.all([loadSession(), loadSettings(), loadWorldState()]);
	}

	// --- Session loading ---

	async function loadSession() {
		loading = true;
		error = null;

		try {
			const result = await api.loadSession(options.sessionId);
			if (!result) {
				goto('/sandbox');
				return;
			}

			world = result.world;
			location = result.location;
			character = result.character;
			messages = result.messages;
			connections = result.connections;

			if (messages.length === 0 && location && world) {
				await generateInitialNarration();
			}
			setTimeout(() => options.onScrollToBottom(), 100);
		} catch (e) {
			error = 'Failed to load session';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function generateInitialNarration() {
		if (!world || !location) return;

		let locationId = world.startLocation;
		for (const [id, loc] of Object.entries(world.locations)) {
			if (loc.name === location!.name) {
				locationId = id;
				break;
			}
		}

		try {
			const result = await api.moveToLocation(options.sessionId, locationId);
			location = result.location;
			character = result.character;
			messages = result.messages;
			connections = result.connections;
			options.onScrollToBottom();
		} catch (e) {
			console.error('Failed to generate initial narration:', e);
		}
	}

	// --- Movement ---

	async function move(locationId: string) {
		if (moving) return;
		moving = true;
		error = null;

		try {
			const result = await api.moveToLocation(options.sessionId, locationId);
			location = result.location;
			character = result.character;
			messages = result.messages;
			connections = result.connections;
			worldState = null;
			options.onScrollToBottom();
		} catch (e) {
			error = 'Failed to move to location';
			console.error(e);
		} finally {
			moving = false;
		}
	}

	// --- Messaging ---

	async function sendMessage(content: string) {
		if (sending) return;
		sending = true;
		error = null;

		const optimisticMessage = {
			id: Date.now(),
			conversationId: null,
			sandboxSessionId: options.sessionId,
			role: 'user',
			characterId: null,
			content,
			swipes: null,
			currentSwipe: 0,
			senderName: userName || options.userDisplayName,
			senderAvatar: userAvatar,
			reasoning: null,
			createdAt: new Date()
		} satisfies Message;
		messages = [...messages, optimisticMessage];
		options.onScrollToBottom();

		try {
			const result = await api.sendMessage(options.sessionId, content);
			messages = result.messages;
			options.onScrollToBottom();
		} catch (e) {
			error = 'Failed to send message';
			console.error(e);
		} finally {
			sending = false;
		}
	}

	async function generate() {
		if (generating || !character) return;
		generating = true;
		error = null;

		try {
			const result = await api.generateResponse(options.sessionId);
			messages = result.messages;
			options.onScrollToBottom();
		} catch (e) {
			error = 'Failed to generate response';
			console.error(e);
		} finally {
			generating = false;
		}
	}

	// --- Session management ---

	async function endSession() {
		try {
			await api.deleteSession(options.sessionId);
		} catch (e) {
			console.error('Failed to delete session:', e);
		}
		goto('/sandbox');
	}

	// --- Message actions ---

	function applyRegeneration(msg: Message, newContent: string, newReasoning?: string): Message {
		const updatedSwipes = msg.swipes ? JSON.parse(msg.swipes) : [msg.content];
		updatedSwipes.push(newContent);
		return {
			...msg,
			content: newContent,
			swipes: JSON.stringify(updatedSwipes),
			currentSwipe: updatedSwipes.length - 1,
			reasoning: newReasoning
				? JSON.stringify([
						...(msg.reasoning ? (() => { try { const a = JSON.parse(msg.reasoning!); return Array.isArray(a) ? a : new Array(updatedSwipes.length - 1).fill(null); } catch { return new Array(updatedSwipes.length - 1).fill(null); } })() : new Array(updatedSwipes.length - 1).fill(null)),
						newReasoning
					])
				: msg.reasoning
		};
	}

	async function handleSwipe(messageId: number, direction: 'left' | 'right') {
		const message = messages.find((m) => m.id === messageId);
		if (!message) return;

		const swipes: string[] = message.swipes ? JSON.parse(message.swipes) : [message.content];
		const currentIndex = message.currentSwipe ?? 0;

		if (direction === 'right' && currentIndex >= swipes.length - 1) {
			generating = true;
			try {
				const result = await api.regenerateMessage(options.sessionId, messageId);
				messages = messages.map((m) =>
					m.id === messageId ? applyRegeneration(m, result.content, result.reasoning) : m
				);
			} catch (e) {
				console.error('Failed to regenerate:', e);
			} finally {
				generating = false;
			}
			return;
		}

		const newIndex =
			direction === 'left'
				? Math.max(0, currentIndex - 1)
				: Math.min(swipes.length - 1, currentIndex + 1);

		if (newIndex === currentIndex) return;

		try {
			const ok = await api.swipeMessage(options.sessionId, messageId, newIndex);
			if (ok) {
				messages = messages.map((m) =>
					m.id === messageId ? { ...m, content: swipes[newIndex], currentSwipe: newIndex } : m
				);
			}
		} catch (e) {
			console.error('Failed to swipe:', e);
		}
	}

	async function handleSaveEdit(messageId: number, _index: number, content: string) {
		try {
			const result = await api.editMessage(options.sessionId, messageId, content);
			messages = messages.map((m) => (m.id === messageId ? result.message : m));
		} catch (e) {
			console.error('Failed to edit message:', e);
		}
	}

	async function handleDelete(messageId: number, _index: number) {
		try {
			const ok = await api.deleteMessage(options.sessionId, messageId);
			if (ok) {
				messages = messages.filter((m) => m.id < messageId);
			}
		} catch (e) {
			console.error('Failed to delete message:', e);
		}
	}

	async function handleRegenerate() {
		const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'narrator');
		if (!lastAssistant) return;

		generating = true;
		try {
			const result = await api.regenerateMessage(options.sessionId, lastAssistant.id);
			messages = messages.map((m) =>
				m.id === lastAssistant.id ? applyRegeneration(m, result.content, result.reasoning) : m
			);
		} catch (e) {
			console.error('Failed to regenerate:', e);
		} finally {
			generating = false;
		}
	}

	async function handleImpersonate(style: api.ImpersonateStyle) {
		if (impersonating || !character) return;
		impersonating = true;

		try {
			const result = await api.impersonate(options.sessionId, style);
			options.onSetInput(result.content);
		} catch (e) {
			console.error('Failed to impersonate:', e);
		} finally {
			impersonating = false;
		}
	}

	async function handleSceneAction(type: api.SceneActionType, context?: { characterId?: number; characterName?: string; owner?: string; itemName?: string; itemDescription?: string }) {
		if (sending || generating) return;
		sending = true;
		error = null;

		try {
			let itemContext: { owner: string; itemName: string; itemDescription: string } | undefined;
			if (type === 'look_item' && context?.owner && context?.itemName && context?.itemDescription) {
				itemContext = { owner: context.owner, itemName: context.itemName, itemDescription: context.itemDescription };
			}

			const result = await api.executeSceneAction(options.sessionId, type, itemContext);
			messages = result.messages;
			options.onScrollToBottom();
		} catch (e) {
			error = 'Failed to execute scene action';
			console.error(e);
		} finally {
			sending = false;
		}
	}

	// --- World state ---

	async function loadWorldState() {
		try {
			worldState = await api.getWorldState(options.sessionId);
		} catch (e) {
			console.error('Failed to load world state:', e);
		}
	}

	async function handleGenerateWorldState() {
		worldStateLoading = true;
		try {
			worldState = await api.generateWorldState(options.sessionId);
		} catch (e) {
			console.error('Failed to generate world state:', e);
		} finally {
			worldStateLoading = false;
		}
	}

	async function handleClearWorldState() {
		try {
			await api.clearWorldState(options.sessionId);
			worldState = null;
		} catch (e) {
			console.error('Failed to clear world state:', e);
		}
	}

	// --- World state display helpers ---

	function getEntityLabel(entityKey: string): string {
		if (entityKey === 'character') return character?.name ?? 'Character';
		if (entityKey === 'user') return 'You';
		return entityKey.charAt(0).toUpperCase() + entityKey.slice(1);
	}

	function getAttributeIcon(attrName: string): { path: string; color: string } | null {
		const icons: Record<string, { path: string; color: string }> = {
			mood: { path: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'var(--warning)' },
			position: { path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', color: 'var(--accent-primary)' },
			clothes: { path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'var(--text-muted)' },
			clothing: { path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'var(--text-muted)' },
			body: { path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'var(--accent-secondary)' },
			thinking: { path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'var(--text-secondary)' }
		};
		return icons[attrName.toLowerCase()] || null;
	}

	function toggleWorldSection(section: string) {
		const newSet = new Set(expandedWorldSections);
		if (newSet.has(section)) newSet.delete(section); else newSet.add(section);
		expandedWorldSections = newSet;
	}

	function toggleWorldItem(key: string) {
		const newSet = new Set(expandedWorldItems);
		if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
		expandedWorldItems = newSet;
	}

	// --- World state editing ---

	function startEditText(entityKey: string, attrName: string, currentValue: string) {
		editingWorldKey = `${entityKey}-${attrName}`;
		editingWorldValue = currentValue;
		editingListItem = null;
	}

	function startEditListItem(entityKey: string, attrName: string, itemIdx: number, item: { name: string; description: string }) {
		editingListItem = { entityKey, attrName, itemIdx };
		editingItemName = item.name;
		editingItemDescription = item.description;
		editingWorldKey = null;
	}

	function cancelEdit() {
		editingWorldKey = null;
		editingListItem = null;
	}

	async function saveTextEdit(entityKey: string, attrName: string) {
		const updated = await api.updateWorldState(options.sessionId, entityKey, attrName, editingWorldValue);
		if (updated) worldState = updated;
		editingWorldKey = null;
	}

	async function saveListItemEdit() {
		if (!editingListItem || !worldState) return;
		const { entityKey, attrName, itemIdx } = editingListItem;
		const entity = worldState[entityKey];
		if (!entity) return;

		const attr = entity.attributes.find(a => a.name === attrName);
		if (!attr || attr.type !== 'list' || !Array.isArray(attr.value)) return;

		const newList = [...attr.value];
		newList[itemIdx] = { name: editingItemName, description: editingItemDescription };

		const updated = await api.updateWorldState(options.sessionId, entityKey, attrName, newList);
		if (updated) worldState = updated;
		editingListItem = null;
	}

	async function deleteListItem(entityKey: string, attrName: string, itemIdx: number) {
		if (!worldState) return;
		const entity = worldState[entityKey];
		if (!entity) return;

		const attr = entity.attributes.find(a => a.name === attrName);
		if (!attr || attr.type !== 'list' || !Array.isArray(attr.value)) return;

		const newList = attr.value.filter((_, i) => i !== itemIdx);
		const updated = await api.updateWorldState(options.sessionId, entityKey, attrName, newList);
		if (updated) worldState = updated;
	}

	// --- Settings ---

	async function loadSettings() {
		const settings = await api.loadUserSettings();
		chatLayout = settings.chatLayout;
		avatarStyle = settings.avatarStyle;
		textCleanupEnabled = settings.textCleanupEnabled;
		autoWrapActions = settings.autoWrapActions;
		userBubbleColor = settings.userBubbleColor;
		worldSidebarEnabled = settings.worldSidebarEnabled;
		userAvatar = settings.userAvatar;
		userName = settings.userName;
	}

	return {
		// Core state
		get world() { return world; },
		get location() { return location; },
		get character() { return character; },
		get messages() { return messages; },
		get connections() { return connections; },
		get loading() { return loading; },
		get moving() { return moving; },
		get sending() { return sending; },
		get generating() { return generating; },
		get impersonating() { return impersonating; },
		get error() { return error; },

		// Settings
		get chatLayout() { return chatLayout; },
		get avatarStyle() { return avatarStyle; },
		get textCleanupEnabled() { return textCleanupEnabled; },
		get autoWrapActions() { return autoWrapActions; },
		get userBubbleColor() { return userBubbleColor; },
		get userAvatar() { return userAvatar; },
		get userName() { return userName; },

		// World state
		get worldState() { return worldState; },
		get worldStateLoading() { return worldStateLoading; },
		get worldSidebarEnabled() { return worldSidebarEnabled; },
		get worldExpanded() { return worldExpanded; },
		set worldExpanded(v: boolean) { worldExpanded = v; },
		get expandedWorldSections() { return expandedWorldSections; },
		get expandedWorldItems() { return expandedWorldItems; },
		get editingWorldKey() { return editingWorldKey; },
		get editingWorldValue() { return editingWorldValue; },
		set editingWorldValue(v: string) { editingWorldValue = v; },
		get editingListItem() { return editingListItem; },
		get editingItemName() { return editingItemName; },
		set editingItemName(v: string) { editingItemName = v; },
		get editingItemDescription() { return editingItemDescription; },
		set editingItemDescription(v: string) { editingItemDescription = v; },

		// Derived
		get hasAssistantMessages() { return hasAssistantMessages; },
		get sceneCharacters() { return sceneCharacters; },

		// Lifecycle
		init,
		loadSession,

		// Actions
		move,
		sendMessage,
		generate,
		endSession,
		handleSwipe,
		handleSaveEdit,
		handleDelete,
		handleRegenerate,
		handleImpersonate,
		handleSceneAction,

		// World state actions
		generateWorldState: handleGenerateWorldState,
		clearWorldState: handleClearWorldState,

		// World state display helpers
		getEntityLabel,
		getAttributeIcon,
		toggleWorldSection,
		toggleWorldItem,

		// World state editing
		startEditText,
		startEditListItem,
		cancelEdit,
		saveTextEdit,
		saveListItemEdit,
		deleteListItem
	};
}
