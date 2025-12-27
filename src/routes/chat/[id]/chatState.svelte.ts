import type { Character, Message } from '$lib/server/db/schema';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import {
	initSocket,
	joinConversation,
	leaveConversation,
	onNewMessage,
	onTyping,
	removeAllListeners
} from '$lib/stores/socket';
import * as api from './chatActions';
import {
	createMessageActions,
	createBranchActions,
	createImageActions,
	createWorldActions,
	type Branch
} from './state';

export type { SceneActionType, ImpersonateStyle, WorldStateData, ClothesData } from './chatActions';
export type { Branch } from './state';

export interface ChatStateOptions {
	characterId: number;
	userId: number;
	userDisplayName: string;
	onScrollToBottom: () => void;
	onSetInput: (content: string) => void;
}

export function createChatState(options: ChatStateOptions) {
	// Core state
	let character = $state<Character | null>(null);
	let messages = $state<Message[]>([]);
	let loading = $state(true);
	let isNewChat = $state(false);
	let conversationId = $state<number | null>(null);
	let isTyping = $state(false);

	// Action states
	let sending = $state(false);
	let regenerating = $state(false);
	let impersonating = $state(false);

	// Settings
	let chatLayout = $state<'bubbles' | 'discord'>('bubbles');
	let avatarStyle = $state<'circle' | 'rounded'>('circle');
	let textCleanupEnabled = $state(true);
	let autoWrapActions = $state(false);
	let userAvatar = $state<string | null>(null);
	let userName = $state<string | null>(null);

	// Random narration settings
	let randomNarrationEnabled = $state(false);
	let randomNarrationMinMessages = $state(3);
	let randomNarrationMaxMessages = $state(8);
	let messagesSinceLastNarration = $state(0);
	let nextNarrationThreshold = $state(0);
	let randomNarrationPending = $state(false);

	// Auto world state update settings
	let autoWorldStateEnabled = $state(false);
	let autoWorldStateMinMessages = $state(5);
	let autoWorldStateMaxMessages = $state(12);
	let messagesSinceLastWorldUpdate = $state(0);
	let nextWorldUpdateThreshold = $state(0);
	let worldUpdatePending = $state(false);

	// Character image visibility (persisted to localStorage)
	let showCharacterImage = $state(browser ? localStorage.getItem('chatCharacterImageVisible') !== 'false' : true);

	// Branching state
	let branches = $state<Branch[]>([]);
	let activeBranchId = $state<number | null>(null);
	let showBranchPanel = $state(false);
	let creatingBranch = $state(false);

	// World state
	let worldState = $state<api.WorldStateData | null>(null);
	let worldStateLoading = $state(false);
	let worldSidebarEnabled = $state(false);

	// Image generation modal state
	let generatingImage = $state(false);
	let generatingSD = $state(false);
	let showImageModal = $state(false);
	let imageModalLoading = $state(false);
	let imageModalTags = $state('');
	let imageModalType = $state<'character' | 'user' | 'scene' | 'raw'>('character');

	// Post history modal state
	let showPostHistoryModal = $state(false);
	let postHistorySaving = $state(false);

	// Scene characters (multi-character support)
	interface SceneCharacter {
		id: number;
		name: string;
		thumbnailData: string | null;
		imageData: string | null;
	}
	let sceneCharacters = $state<SceneCharacter[]>([]);

	// Track character changes
	let previousCharacterId: number | null = null;

	// Derived state
	const hasAssistantMessages = $derived(messages.some(m => m.role === 'assistant'));

	// Persist character image visibility
	$effect(() => {
		if (browser) {
			localStorage.setItem('chatCharacterImageVisible', String(showCharacterImage));
		}
	});

	// Create module actions
	const messageActions = createMessageActions(
		() => ({ messages, sending, regenerating, impersonating }),
		(updates) => {
			if (updates.messages !== undefined) messages = updates.messages;
			if (updates.sending !== undefined) sending = updates.sending;
			if (updates.regenerating !== undefined) regenerating = updates.regenerating;
			if (updates.impersonating !== undefined) impersonating = updates.impersonating;
		},
		{
			characterId: options.characterId,
			conversationId: () => conversationId,
			onSetInput: options.onSetInput,
			loadConversation
		}
	);

	const branchActions = createBranchActions(
		() => ({ branches, activeBranchId, showBranchPanel, creatingBranch }),
		(updates) => {
			if (updates.branches !== undefined) branches = updates.branches;
			if (updates.activeBranchId !== undefined) activeBranchId = updates.activeBranchId;
			if (updates.showBranchPanel !== undefined) showBranchPanel = updates.showBranchPanel;
			if (updates.creatingBranch !== undefined) creatingBranch = updates.creatingBranch;
		},
		{
			characterId: options.characterId,
			conversationId: () => conversationId,
			loadConversation
		}
	);

	const imageActions = createImageActions(
		() => ({ generatingImage, generatingSD, showImageModal, imageModalLoading, imageModalTags, imageModalType }),
		(updates) => {
			if (updates.generatingImage !== undefined) generatingImage = updates.generatingImage;
			if (updates.generatingSD !== undefined) generatingSD = updates.generatingSD;
			if (updates.showImageModal !== undefined) showImageModal = updates.showImageModal;
			if (updates.imageModalLoading !== undefined) imageModalLoading = updates.imageModalLoading;
			if (updates.imageModalTags !== undefined) imageModalTags = updates.imageModalTags;
			if (updates.imageModalType !== undefined) imageModalType = updates.imageModalType;
		},
		{
			characterId: options.characterId,
			conversationId: () => conversationId,
			onScrollToBottom: options.onScrollToBottom
		}
	);

	const worldActions = createWorldActions(
		() => ({ worldState, worldStateLoading }),
		(updates) => {
			if (updates.worldState !== undefined) worldState = updates.worldState;
			if (updates.worldStateLoading !== undefined) worldStateLoading = updates.worldStateLoading;
		},
		{
			characterId: options.characterId
		}
	);

	// Helper to pick random threshold for next narration
	function pickNextNarrationThreshold() {
		return Math.floor(Math.random() * (randomNarrationMaxMessages - randomNarrationMinMessages + 1)) + randomNarrationMinMessages;
	}

	// Helper to pick random threshold for next world state update
	function pickNextWorldUpdateThreshold() {
		return Math.floor(Math.random() * (autoWorldStateMaxMessages - autoWorldStateMinMessages + 1)) + autoWorldStateMinMessages;
	}

	// Settings handlers
	async function loadSettings() {
		const settings = await api.loadSettings();
		chatLayout = settings.chatLayout;
		avatarStyle = settings.avatarStyle;
		textCleanupEnabled = settings.textCleanupEnabled;
		autoWrapActions = settings.autoWrapActions;
		randomNarrationEnabled = settings.randomNarrationEnabled;
		randomNarrationMinMessages = settings.randomNarrationMinMessages;
		randomNarrationMaxMessages = settings.randomNarrationMaxMessages;
		worldSidebarEnabled = settings.worldSidebarEnabled;
		autoWorldStateEnabled = settings.autoWorldStateEnabled;
		autoWorldStateMinMessages = settings.autoWorldStateMinMessages;
		autoWorldStateMaxMessages = settings.autoWorldStateMaxMessages;
		userAvatar = settings.userAvatar;
		userName = settings.userName;

		// Set initial threshold if enabled
		if (randomNarrationEnabled && nextNarrationThreshold === 0) {
			nextNarrationThreshold = pickNextNarrationThreshold();
		}
		if (autoWorldStateEnabled && nextWorldUpdateThreshold === 0) {
			nextWorldUpdateThreshold = pickNextWorldUpdateThreshold();
		}

	}

	function handleSettingsUpdate(e: CustomEvent<{ chatLayout: 'bubbles' | 'discord'; avatarStyle: 'circle' | 'rounded'; textCleanupEnabled: boolean; autoWrapActions: boolean; randomNarrationEnabled?: boolean; randomNarrationMinMessages?: number; randomNarrationMaxMessages?: number; worldSidebarEnabled?: boolean; autoWorldStateEnabled?: boolean; autoWorldStateMinMessages?: number; autoWorldStateMaxMessages?: number }>) {
		chatLayout = e.detail.chatLayout;
		if (e.detail.avatarStyle) avatarStyle = e.detail.avatarStyle;
		if (typeof e.detail.textCleanupEnabled === 'boolean') textCleanupEnabled = e.detail.textCleanupEnabled;
		if (typeof e.detail.autoWrapActions === 'boolean') autoWrapActions = e.detail.autoWrapActions;
		if (typeof e.detail.randomNarrationEnabled === 'boolean') {
			randomNarrationEnabled = e.detail.randomNarrationEnabled;
			// Reset threshold when enabled
			if (randomNarrationEnabled && nextNarrationThreshold === 0) {
				nextNarrationThreshold = pickNextNarrationThreshold();
			}
		}
		if (typeof e.detail.randomNarrationMinMessages === 'number') randomNarrationMinMessages = e.detail.randomNarrationMinMessages;
		if (typeof e.detail.randomNarrationMaxMessages === 'number') randomNarrationMaxMessages = e.detail.randomNarrationMaxMessages;
		if (typeof e.detail.worldSidebarEnabled === 'boolean') worldSidebarEnabled = e.detail.worldSidebarEnabled;
		if (typeof e.detail.autoWorldStateEnabled === 'boolean') {
			autoWorldStateEnabled = e.detail.autoWorldStateEnabled;
			// Reset threshold when enabled
			if (autoWorldStateEnabled && nextWorldUpdateThreshold === 0) {
				nextWorldUpdateThreshold = pickNextWorldUpdateThreshold();
			}
		}
		if (typeof e.detail.autoWorldStateMinMessages === 'number') autoWorldStateMinMessages = e.detail.autoWorldStateMinMessages;
		if (typeof e.detail.autoWorldStateMaxMessages === 'number') autoWorldStateMaxMessages = e.detail.autoWorldStateMaxMessages;
	}

	// Character and conversation loading
	async function loadCharacter() {
		character = await api.loadCharacter(options.characterId);
	}

	async function loadSceneCharacters() {
		if (!conversationId) {
			sceneCharacters = [];
			return;
		}
		try {
			const response = await fetch(`/api/chat/${conversationId}/characters`);
			if (response.ok) {
				const data = await response.json();
				sceneCharacters = (data.active || []).map((c: SceneCharacter) => ({
					id: c.id,
					name: c.name,
					thumbnailData: c.thumbnailData,
					imageData: c.imageData
				}));
			}
		} catch (error) {
			console.error('Failed to load scene characters:', error);
			sceneCharacters = [];
		}
	}

	async function loadConversation() {
		loading = true;
		try {
			const result = await api.loadConversation(options.characterId);
			isNewChat = result.isNewChat;
			conversationId = result.conversationId;
			messages = result.messages;
			branches = result.branches;
			activeBranchId = result.activeBranchId;

			if (conversationId) {
				joinConversation(conversationId);
				// Load scene characters for the conversation
				await loadSceneCharacters();
				// Load saved world state for existing conversation
				worldActions.loadWorldState();
			}

			setTimeout(() => options.onScrollToBottom(), 100);
		} finally {
			loading = false;
		}
	}

	function handleCharacterChange(newCharacterId: number) {
		if (newCharacterId !== previousCharacterId) {
			if (conversationId) {
				leaveConversation(conversationId);
			}
			previousCharacterId = newCharacterId;
			options.characterId = newCharacterId;
			loadCharacter();
			loadConversation();
		}
	}

	// Scenario handling
	async function handleScenarioStart(newConversationId: number) {
		isNewChat = false;
		conversationId = newConversationId;
		joinConversation(newConversationId);
		await loadConversation();

		// Notify sidebar to refresh conversations list
		if (browser) {
			window.dispatchEvent(new CustomEvent('conversationUpdated'));
		}

		// Generate clothes when conversation starts - Legacy feature disabled
		// clothesActions.generateClothes();
	}

	// Conversation reset
	async function resetConversation() {
		if (!conversationId) return;

		const confirmed = confirm('Are you sure you want to reset this conversation? All messages will be deleted.');
		if (!confirmed) return;

		const success = await api.resetConversation(conversationId);
		if (success) {
			await loadConversation();
		} else {
			alert('Failed to reset conversation');
		}
	}

	// Delete conversation completely
	async function deleteConversation() {
		if (!conversationId) return;

		const confirmed = confirm('Are you sure you want to delete this chat? This action cannot be undone.');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/conversations/${conversationId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Leave the socket room
				leaveConversation(conversationId);
				// Notify sidebar to refresh
				if (browser) {
					window.dispatchEvent(new CustomEvent('conversationUpdated'));
				}
				// Navigate back to home
				goto('/');
			} else {
				const data = await response.json();
				alert(data.error || 'Failed to delete chat');
			}
		} catch (error) {
			console.error('Failed to delete chat:', error);
			alert('Failed to delete chat');
		}
	}

	// Random narration trigger
	async function triggerRandomNarration() {
		if (!conversationId || !character || randomNarrationPending || sending) return;

		randomNarrationPending = true;

		try {
			// Pick a random action type: look_character, look_scene, or narrate
			const actionTypes: api.SceneActionType[] = ['look_character', 'look_scene', 'narrate'];
			const randomAction = actionTypes[Math.floor(Math.random() * actionTypes.length)];

			// For look_character, we need to provide character context
			let context: { characterId: number; characterName: string } | undefined;
			if (randomAction === 'look_character') {
				context = { characterId: character.id, characterName: character.name };
			}

			await api.triggerSceneAction(options.characterId, randomAction, undefined, context, conversationId);
		} catch (error) {
			console.error('Failed to trigger random narration:', error);
		} finally {
			randomNarrationPending = false;
		}
	}

	// Auto world state update trigger
	async function triggerWorldStateUpdate() {
		if (!conversationId || worldUpdatePending || worldStateLoading) return;

		worldUpdatePending = true;

		try {
			await worldActions.generateWorldState();
		} catch (error) {
			console.error('Failed to trigger world state update:', error);
		} finally {
			worldUpdatePending = false;
		}
	}

	// Socket and lifecycle
	function setupSocket() {
		initSocket();

		onNewMessage((message: Message) => {
			if (!messages.find((m) => m.id === message.id)) {
				messages = [...messages, message];
				setTimeout(() => options.onScrollToBottom(), 100);

				// Track messages for random narration (only for user/assistant messages, not narrator)
				if (randomNarrationEnabled && (message.role === 'user' || message.role === 'assistant')) {
					messagesSinceLastNarration++;

					// Check if we should trigger random narration
					if (messagesSinceLastNarration >= nextNarrationThreshold && message.role === 'assistant') {
						// Reset counter and pick new threshold
						messagesSinceLastNarration = 0;
						nextNarrationThreshold = pickNextNarrationThreshold();

						// Trigger after a short delay so the current message renders first
						setTimeout(() => {
							triggerRandomNarration();
						}, 500);
					}
				}

				// Auto world state update logic
				if (autoWorldStateEnabled && worldSidebarEnabled) {
					// Trigger on narrator messages (greetings, scene descriptions)
					if (message.role === 'narrator') {
						setTimeout(() => {
							triggerWorldStateUpdate();
						}, 500);
					}
					// Also track messages for periodic updates
					else if (message.role === 'user' || message.role === 'assistant') {
						messagesSinceLastWorldUpdate++;

						// Check if we should trigger world state update
						if (messagesSinceLastWorldUpdate >= nextWorldUpdateThreshold && message.role === 'assistant') {
							// Reset counter and pick new threshold
							messagesSinceLastWorldUpdate = 0;
							nextWorldUpdateThreshold = pickNextWorldUpdateThreshold();

							setTimeout(() => {
								triggerWorldStateUpdate();
							}, 500);
						}
					}
				}
			}
		});

		onTyping((typing: boolean) => {
			isTyping = typing;
			if (typing) {
				setTimeout(() => options.onScrollToBottom(), 100);
			}
		});
	}

	function cleanup() {
		if (conversationId) {
			leaveConversation(conversationId);
		}
		removeAllListeners();
	}

	// Post history handlers
	function openPostHistoryModal() {
		showPostHistoryModal = true;
	}

	async function savePostHistory(content: string) {
		if (!character) return;
		postHistorySaving = true;

		try {
			const response = await fetch(`/api/characters/${character.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postHistory: content })
			});

			if (response.ok) {
				// Update local character state
				character = { ...character, postHistory: content };
				showPostHistoryModal = false;
			} else {
				alert('Failed to save post history');
			}
		} catch (error) {
			console.error('Failed to save post history:', error);
			alert('Failed to save post history');
		} finally {
			postHistorySaving = false;
		}
	}

	// Keyboard handler for swipe navigation
	function handleKeydown(e: KeyboardEvent) {
		const activeElement = document.activeElement;
		if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') {
			return;
		}

		const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
		if (!lastAssistantMessage) return;

		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			messageActions.swipeMessage(lastAssistantMessage.id, 'left');
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			messageActions.swipeMessage(lastAssistantMessage.id, 'right');
		}
	}

	return {
		// State (getters)
		get character() { return character; },
		get messages() { return messages; },
		get loading() { return loading; },
		get isNewChat() { return isNewChat; },
		get conversationId() { return conversationId; },
		get isTyping() { return isTyping; },
		get sending() { return sending; },
		get regenerating() { return regenerating; },
		get impersonating() { return impersonating; },
		get generatingImage() { return generatingImage; },
		get generatingSD() { return generatingSD; },
		get chatLayout() { return chatLayout; },
		get avatarStyle() { return avatarStyle; },
		get textCleanupEnabled() { return textCleanupEnabled; },
		get autoWrapActions() { return autoWrapActions; },
		get userAvatar() { return userAvatar; },
		get userName() { return userName; },
		get showCharacterImage() { return showCharacterImage; },
		set showCharacterImage(value: boolean) { showCharacterImage = value; },
		get branches() { return branches; },
		get activeBranchId() { return activeBranchId; },
		get showBranchPanel() { return showBranchPanel; },
		set showBranchPanel(value: boolean) { showBranchPanel = value; },
		get worldState() { return worldState; },
		get worldStateLoading() { return worldStateLoading; },
		get worldSidebarEnabled() { return worldSidebarEnabled; },
		get showImageModal() { return showImageModal; },
		set showImageModal(value: boolean) { showImageModal = value; },
		get imageModalLoading() { return imageModalLoading; },
		get imageModalTags() { return imageModalTags; },
		get imageModalType() { return imageModalType; },
		get hasAssistantMessages() { return hasAssistantMessages; },
		get sceneCharacters() { return sceneCharacters; },
		get showPostHistoryModal() { return showPostHistoryModal; },
		set showPostHistoryModal(value: boolean) { showPostHistoryModal = value; },
		get postHistorySaving() { return postHistorySaving; },

		// Core actions
		loadSettings,
		handleSettingsUpdate,
		loadCharacter,
		loadConversation,
		handleCharacterChange,
		handleScenarioStart,
		resetConversation,
		deleteConversation,
		setupSocket,
		cleanup,
		handleKeydown,

		// Module actions
		...messageActions,
		...branchActions,
		...imageActions,
		generateWorldState: worldActions.generateWorldState,

		// Post history actions
		openPostHistoryModal,
		savePostHistory
	};
}
