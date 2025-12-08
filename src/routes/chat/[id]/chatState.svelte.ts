import type { Character, Message } from '$lib/server/db/schema';
import { browser } from '$app/environment';
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
	createClothesActions,
	type Branch
} from './state';

export type { SceneActionType, ImpersonateStyle, ClothesData } from './chatActions';
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

	// Character image visibility (persisted to localStorage)
	let showCharacterImage = $state(browser ? localStorage.getItem('chatCharacterImageVisible') !== 'false' : true);

	// Branching state
	let branches = $state<Branch[]>([]);
	let activeBranchId = $state<number | null>(null);
	let showBranchPanel = $state(false);
	let creatingBranch = $state(false);

	// Clothes state
	let clothes = $state<api.ClothesData | null>(null);
	let clothesLoading = $state(false);

	// Image generation modal state
	let generatingImage = $state(false);
	let generatingSD = $state(false);
	let showImageModal = $state(false);
	let imageModalLoading = $state(false);
	let imageModalTags = $state('');
	let imageModalType = $state<'character' | 'user' | 'scene' | 'raw'>('character');

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

	const clothesActions = createClothesActions(
		() => ({ clothes, clothesLoading }),
		(updates) => {
			if (updates.clothes !== undefined) clothes = updates.clothes;
			if (updates.clothesLoading !== undefined) clothesLoading = updates.clothesLoading;
		},
		{
			characterId: options.characterId
		}
	);

	// Settings handlers
	async function loadSettings() {
		const settings = await api.loadSettings();
		chatLayout = settings.chatLayout;
		avatarStyle = settings.avatarStyle;
		textCleanupEnabled = settings.textCleanupEnabled;
		autoWrapActions = settings.autoWrapActions;
		userAvatar = settings.userAvatar;
		userName = settings.userName;
	}

	function handleSettingsUpdate(e: CustomEvent<{ chatLayout: 'bubbles' | 'discord'; avatarStyle: 'circle' | 'rounded'; textCleanupEnabled: boolean; autoWrapActions: boolean }>) {
		chatLayout = e.detail.chatLayout;
		if (e.detail.avatarStyle) avatarStyle = e.detail.avatarStyle;
		if (typeof e.detail.textCleanupEnabled === 'boolean') textCleanupEnabled = e.detail.textCleanupEnabled;
		if (typeof e.detail.autoWrapActions === 'boolean') autoWrapActions = e.detail.autoWrapActions;
	}

	// Character and conversation loading
	async function loadCharacter() {
		character = await api.loadCharacter(options.characterId);
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
				// Load saved clothes for existing conversation
				clothesActions.loadClothes();
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

		// Generate clothes when conversation starts
		clothesActions.generateClothes();
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

	// Socket and lifecycle
	function setupSocket() {
		initSocket();

		onNewMessage((message: Message) => {
			if (!messages.find((m) => m.id === message.id)) {
				messages = [...messages, message];
				setTimeout(() => options.onScrollToBottom(), 100);
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
		get clothes() { return clothes; },
		get clothesLoading() { return clothesLoading; },
		get showImageModal() { return showImageModal; },
		set showImageModal(value: boolean) { showImageModal = value; },
		get imageModalLoading() { return imageModalLoading; },
		get imageModalTags() { return imageModalTags; },
		get imageModalType() { return imageModalType; },
		get hasAssistantMessages() { return hasAssistantMessages; },

		// Core actions
		loadSettings,
		handleSettingsUpdate,
		loadCharacter,
		loadConversation,
		handleCharacterChange,
		handleScenarioStart,
		resetConversation,
		setupSocket,
		cleanup,
		handleKeydown,

		// Module actions
		...messageActions,
		...branchActions,
		...imageActions,
		generateClothes: clothesActions.generateClothes
	};
}
