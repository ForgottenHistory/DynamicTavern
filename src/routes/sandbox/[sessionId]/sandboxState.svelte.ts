import type { Character, Message } from '$lib/server/db/schema';
import type { World, WorldLocation, SandboxMode } from '$lib/types/sandbox';
import { goto } from '$app/navigation';
import * as api from './sandboxActions';
import { createWorldState } from './sandboxWorldState.svelte';
import { createMessageActions } from './sandboxMessageActions.svelte';
import { createCharacters } from './sandboxCharacters.svelte';

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
	let mode = $state<SandboxMode>('scene');
	let world = $state<World | null>(null);
	let location = $state<WorldLocation | null>(null);
	let characters = $state<Character[]>([]);
	let messages = $state<Message[]>([]);
	let connections = $state<api.ConnectionInfo[]>([]);
	let loading = $state(true);
	let moving = $state(false);
	let sending = $state(false);
	let generating = $state(false);
	let impersonating = $state(false);
	let error = $state<string | null>(null);

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
	const primaryCharacter = $derived(characters.length > 0 ? characters[0] : null);
	const hasCharacters = $derived(characters.length > 0);
	const sceneCharacters = $derived(
		characters.map((c) => ({ id: c.id, name: c.name, thumbnailData: c.thumbnailData, imageData: c.imageData }))
	);

	// --- Sub-modules ---

	const worldStateModule = createWorldState({
		sessionId: options.sessionId,
		getPrimaryCharacter: () => primaryCharacter
	});

	const messageActions = createMessageActions({
		sessionId: options.sessionId,
		getMessages: () => messages,
		setMessages: (msgs) => { messages = msgs; },
		getGenerating: () => generating,
		setGenerating: (v) => { generating = v; }
	});

	const charactersModule = createCharacters({
		sessionId: options.sessionId,
		getCharacters: () => characters,
		setCharacters: (chars) => { characters = chars; },
		setMessages: (msgs) => { messages = msgs; },
		getSending: () => sending,
		setSending: (v) => { sending = v; },
		getGenerating: () => generating,
		setError: (err) => { error = err; },
		onScrollToBottom: options.onScrollToBottom
	});

	// Auto-scroll when typing indicator appears
	$effect(() => {
		if (sending || generating) {
			options.onScrollToBottom();
		}
	});

	// --- Init ---

	async function init() {
		await Promise.all([loadSession(), loadSettings(), worldStateModule.load()]);
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

			mode = result.session?.mode || 'scene';
			world = result.world;
			location = result.location;
			characters = result.characters || (result.character ? [result.character] : []);
			messages = result.messages;
			connections = result.connections;

			if (messages.length === 0) {
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
		// Scene mode requires world + location; dynamic mode always inits
		if (mode === 'scene' && (!world || !location)) return;

		try {
			const result = await api.initSession(options.sessionId);
			characters = result.characters;
			messages = result.messages;

			// Dynamic mode: re-load session to get the generated location
			if (mode === 'dynamic') {
				const sessionResult = await api.loadSession(options.sessionId);
				if (sessionResult?.location) {
					location = sessionResult.location;
				}
			}

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
			const followingIds = charactersModule.getFollowingIds();
			const result = await api.moveToLocation(options.sessionId, locationId, followingIds.length > 0 ? followingIds : undefined);
			location = result.location;
			characters = result.characters || (result.character ? [result.character] : []);
			messages = result.messages;
			connections = result.connections;
			worldStateModule.reset();
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
			// Update location if the server returned one (dynamic mode GM may have changed it)
			if (result.location) {
				location = result.location;
			}
			options.onScrollToBottom();
		} catch (e) {
			error = 'Failed to send message';
			console.error(e);
		} finally {
			sending = false;
		}
	}

	async function generate(characterId?: number) {
		if (sending || generating || characters.length === 0) return;
		sending = true;
		error = null;

		// Pick the target character (same logic the server uses: specific or random)
		const targetChar = characterId
			? characters.find((c) => c.id === characterId) || characters[0]
			: characters[Math.floor(Math.random() * characters.length)];

		// Add optimistic placeholder so the UI shows "..." for the right character
		const placeholderId = Date.now();
		const placeholderMessage = {
			id: placeholderId,
			conversationId: null,
			sandboxSessionId: options.sessionId,
			role: 'assistant',
			characterId: targetChar.id,
			content: '',
			swipes: null,
			currentSwipe: 0,
			senderName: targetChar.name,
			senderAvatar: targetChar.thumbnailData || targetChar.imageData,
			reasoning: null,
			createdAt: new Date()
		} satisfies Message;
		messages = [...messages, placeholderMessage];
		options.onScrollToBottom();

		try {
			const result = await api.generateResponse(options.sessionId, characterId);
			messages = result.messages;
			options.onScrollToBottom();
		} catch (e) {
			// Remove placeholder on failure
			messages = messages.filter((m) => m.id !== placeholderId);
			error = 'Failed to generate response';
			console.error(e);
		} finally {
			sending = false;
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

	// --- Impersonate & Scene Actions ---

	async function handleImpersonate(style: api.ImpersonateStyle) {
		if (impersonating || characters.length === 0) return;
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

	// --- Settings ---

	async function loadSettings() {
		const settings = await api.loadUserSettings();
		chatLayout = settings.chatLayout;
		avatarStyle = settings.avatarStyle;
		textCleanupEnabled = settings.textCleanupEnabled;
		autoWrapActions = settings.autoWrapActions;
		userBubbleColor = settings.userBubbleColor;
		worldStateModule.setSidebarEnabled(settings.worldSidebarEnabled);
		userAvatar = settings.userAvatar;
		userName = settings.userName;
	}

	return {
		// Core state
		get mode() { return mode; },
		get world() { return world; },
		get location() { return location; },
		get characters() { return characters; },
		get primaryCharacter() { return primaryCharacter; },
		get hasCharacters() { return hasCharacters; },
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

		// World state (delegated)
		get worldState() { return worldStateModule.worldState; },
		get worldStateLoading() { return worldStateModule.worldStateLoading; },
		get worldSidebarEnabled() { return worldStateModule.worldSidebarEnabled; },
		get worldExpanded() { return worldStateModule.worldExpanded; },
		set worldExpanded(v: boolean) { worldStateModule.worldExpanded = v; },
		get expandedWorldSections() { return worldStateModule.expandedWorldSections; },
		get expandedWorldItems() { return worldStateModule.expandedWorldItems; },
		get editingWorldKey() { return worldStateModule.editingWorldKey; },
		get editingWorldValue() { return worldStateModule.editingWorldValue; },
		set editingWorldValue(v: string) { worldStateModule.editingWorldValue = v; },
		get editingListItem() { return worldStateModule.editingListItem; },
		get editingItemName() { return worldStateModule.editingItemName; },
		set editingItemName(v: string) { worldStateModule.editingItemName = v; },
		get editingItemDescription() { return worldStateModule.editingItemDescription; },
		set editingItemDescription(v: string) { worldStateModule.editingItemDescription = v; },

		// Character picker (delegated)
		get showCharacterPicker() { return charactersModule.showCharacterPicker; },
		get availableCharacters() { return charactersModule.availableCharacters; },
		get characterPickerLoading() { return charactersModule.characterPickerLoading; },
		get removingCharacterIds() { return charactersModule.removingCharacterIds; },
		get followingCharacterIds() { return charactersModule.followingCharacterIds; },

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
		handleSwipe: messageActions.handleSwipe,
		handleSaveEdit: messageActions.handleSaveEdit,
		handleDelete: messageActions.handleDelete,
		handleRegenerate: messageActions.handleRegenerate,
		handleImpersonate,
		handleSceneAction,
		handleWait: charactersModule.handleWait,

		// Character picker actions
		openCharacterPicker: charactersModule.openCharacterPicker,
		closeCharacterPicker: charactersModule.closeCharacterPicker,
		addCharacter: charactersModule.addCharacter,
		removeCharacter: charactersModule.removeCharacter,
		toggleFollow: charactersModule.toggleFollow,

		// World state actions
		generateWorldState: worldStateModule.generate,
		clearWorldState: worldStateModule.clear,

		// World state display helpers
		getEntityLabel: worldStateModule.getEntityLabel,
		getAttributeIcon: worldStateModule.getAttributeIcon,
		toggleWorldSection: worldStateModule.toggleWorldSection,
		toggleWorldItem: worldStateModule.toggleWorldItem,

		// World state editing
		startEditText: worldStateModule.startEditText,
		startEditListItem: worldStateModule.startEditListItem,
		cancelEdit: worldStateModule.cancelEdit,
		saveTextEdit: worldStateModule.saveTextEdit,
		saveListItemEdit: worldStateModule.saveListItemEdit,
		deleteListItem: worldStateModule.deleteListItem
	};
}
