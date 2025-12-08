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

export type { SceneActionType } from './chatActions';

export interface Branch {
	id: number;
	name: string | null;
	isActive: boolean;
	createdAt: Date;
}

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
	let generatingImage = $state(false);
	let generatingSD = $state(false);

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

	// Image generation modal state
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
	}

	// Branch operations
	async function createBranch(messageId: number, name?: string) {
		if (creatingBranch) return;
		creatingBranch = true;

		try {
			const success = await api.createBranch(options.characterId, messageId, name);
			if (success) {
				if (conversationId) {
					leaveConversation(conversationId);
				}
				await loadConversation();
			} else {
				alert('Failed to create branch');
			}
		} finally {
			creatingBranch = false;
		}
	}

	async function switchBranch(branchId: number) {
		if (branchId === activeBranchId) return;

		const success = await api.switchBranch(options.characterId, branchId);
		if (success) {
			if (conversationId) {
				leaveConversation(conversationId);
			}
			await loadConversation();
		} else {
			alert('Failed to switch branch');
		}
	}

	async function deleteBranch(branchId: number) {
		if (!confirm('Delete this branch? All messages will be lost.')) return;

		const success = await api.deleteBranch(options.characterId, branchId);
		if (success) {
			if (branchId === activeBranchId && conversationId) {
				leaveConversation(conversationId);
			}
			await loadConversation();
		} else {
			alert('Failed to delete branch');
		}
	}

	// Message operations
	async function sendMessage(userMessage: string) {
		if (sending) return;
		sending = true;

		try {
			const success = await api.sendMessage(options.characterId, userMessage);
			if (!success) {
				alert('Failed to send message');
			}
		} finally {
			sending = false;
		}
	}

	async function generateResponse() {
		if (sending) return;
		sending = true;

		try {
			const success = await api.generateResponse(options.characterId);
			if (!success) {
				alert('Failed to generate response');
			}
		} finally {
			sending = false;
		}
	}

	async function impersonate() {
		if (sending || impersonating) return;
		impersonating = true;

		try {
			const content = await api.impersonate(options.characterId);
			if (content) {
				options.onSetInput(content);
			} else {
				alert('Failed to impersonate');
			}
		} finally {
			impersonating = false;
		}
	}

	async function handleSceneAction(actionType: api.SceneActionType) {
		if (sending || !conversationId) return;
		sending = true;

		try {
			const success = await api.triggerSceneAction(options.characterId, actionType);
			if (!success) {
				alert('Failed to execute action');
			}
		} finally {
			sending = false;
		}
	}

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

	// Swipe operations
	async function swipeMessage(messageId: number, direction: 'left' | 'right') {
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		const message = messages[messageIndex];
		const swipes = api.getSwipes(message);
		const currentIndex = api.getCurrentSwipeIndex(message);
		const isFirstMessage = messageIndex === 0;

		if (direction === 'right') {
			const nextIndex = currentIndex + 1;

			if (nextIndex < swipes.length) {
				await updateSwipeIndex(messageId, messageIndex, message, swipes, nextIndex);
			} else if (!isFirstMessage) {
				await regenerateMessage(messageId);
			} else {
				await updateSwipeIndex(messageId, messageIndex, message, swipes, 0);
			}
		} else {
			let newIndex = currentIndex - 1;
			if (newIndex < 0) {
				newIndex = swipes.length - 1;
			}
			await updateSwipeIndex(messageId, messageIndex, message, swipes, newIndex);
		}
	}

	async function updateSwipeIndex(messageId: number, messageIndex: number, message: Message, swipes: string[], newIndex: number) {
		const success = await api.updateSwipeIndex(messageId, newIndex);
		if (success) {
			const updatedMessage = {
				...message,
				content: swipes[newIndex],
				currentSwipe: newIndex
			};
			messages[messageIndex] = updatedMessage;
			messages = [...messages];
		}
	}

	async function regenerateMessage(messageId: number) {
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		regenerating = true;

		try {
			const result = await api.regenerateMessage(messageId);
			if (result) {
				const message = messages[messageIndex];
				const swipes = api.getSwipes(message);
				swipes.push(result.content);

				messages[messageIndex] = {
					...message,
					content: result.content,
					swipes: JSON.stringify(swipes),
					currentSwipe: swipes.length - 1
				};
				messages = [...messages];
			} else {
				alert('Failed to regenerate message');
			}
		} finally {
			regenerating = false;
		}
	}

	async function regenerateLastMessage() {
		const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
		if (!lastAssistantMessage) return;

		const messageIndex = messages.findIndex(m => m.id === lastAssistantMessage.id);
		if (messageIndex !== -1) {
			messages = messages.slice(0, messageIndex);
		}

		const success = await api.regenerateFresh(lastAssistantMessage.id);
		if (!success) {
			await loadConversation();
			alert('Failed to regenerate message');
		}
	}

	async function deleteMessageAndBelow(messageId: number, messageIndex: number) {
		const messagesBelow = messages.length - messageIndex;
		const confirmed = confirm(`Delete this message and ${messagesBelow > 1 ? `${messagesBelow - 1} message(s) below it` : 'no messages below'}?`);
		if (!confirmed) return;

		const success = await api.deleteMessageAndBelow(messageId);
		if (success) {
			messages = messages.slice(0, messageIndex);
		} else {
			alert('Failed to delete messages');
		}
	}

	async function saveMessageEdit(messageId: number, messageIndex: number, content: string) {
		const result = await api.saveMessageEdit(messageId, content);
		if (result) {
			messages[messageIndex] = result;
			messages = [...messages];
		} else {
			alert('Failed to save edit');
		}
	}

	// Image generation
	async function generateImage(type: 'character' | 'user' | 'scene' | 'raw') {
		if (generatingImage || !conversationId) return;

		imageModalType = type;
		imageModalTags = '';
		showImageModal = true;

		if (type === 'raw') {
			imageModalLoading = false;
			return;
		}

		imageModalLoading = true;
		generatingImage = true;

		try {
			const tags = await api.generateImageTags(options.characterId, type);
			if (tags) {
				imageModalTags = tags;
			} else {
				alert('Failed to generate tags');
				showImageModal = false;
			}
		} finally {
			imageModalLoading = false;
			generatingImage = false;
		}
	}

	async function handleImageGenerate(tags: string) {
		if (generatingSD) return;
		generatingSD = true;

		try {
			const success = await api.generateSDImage(options.characterId, tags);
			if (success) {
				showImageModal = false;
				imageModalTags = '';
				setTimeout(() => options.onScrollToBottom(), 100);
			} else {
				alert('Failed to generate image');
			}
		} finally {
			generatingSD = false;
		}
	}

	function handleImageCancel() {
		imageModalTags = '';
	}

	async function handleImageRegenerate() {
		imageModalTags = '';
		imageModalLoading = true;

		try {
			const tags = await api.generateImageTags(options.characterId, imageModalType);
			if (tags) {
				imageModalTags = tags;
			} else {
				alert('Failed to regenerate tags');
			}
		} finally {
			imageModalLoading = false;
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
			swipeMessage(lastAssistantMessage.id, 'left');
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			swipeMessage(lastAssistantMessage.id, 'right');
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
		get showImageModal() { return showImageModal; },
		set showImageModal(value: boolean) { showImageModal = value; },
		get imageModalLoading() { return imageModalLoading; },
		get imageModalTags() { return imageModalTags; },
		get imageModalType() { return imageModalType; },
		get hasAssistantMessages() { return hasAssistantMessages; },

		// Actions
		loadSettings,
		handleSettingsUpdate,
		loadCharacter,
		loadConversation,
		handleCharacterChange,
		handleScenarioStart,
		createBranch,
		switchBranch,
		deleteBranch,
		sendMessage,
		generateResponse,
		impersonate,
		handleSceneAction,
		resetConversation,
		swipeMessage,
		regenerateLastMessage,
		deleteMessageAndBelow,
		saveMessageEdit,
		generateImage,
		handleImageGenerate,
		handleImageCancel,
		handleImageRegenerate,
		setupSocket,
		cleanup,
		handleKeydown
	};
}
