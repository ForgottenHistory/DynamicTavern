<script lang="ts">
	import type { PageData } from './$types';
	import type { Character, Message } from '$lib/server/db/schema';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatCharacterImage from '$lib/components/chat/ChatCharacterImage.svelte';
	import ChatBranchPanel from '$lib/components/chat/ChatBranchPanel.svelte';
	import ImageGenerateModal from '$lib/components/chat/ImageGenerateModal.svelte';
	import ScenarioSelector from '$lib/components/chat/ScenarioSelector.svelte';
	import { onMount, onDestroy } from 'svelte';
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

	let { data }: { data: PageData } = $props();

	// Character image visibility (persisted to localStorage)
	let showCharacterImage = $state(browser ? localStorage.getItem('chatCharacterImageVisible') !== 'false' : true);

	// Persist character image visibility when it changes
	$effect(() => {
		if (browser) {
			localStorage.setItem('chatCharacterImageVisible', String(showCharacterImage));
		}
	});

	let character = $state<Character | null>(null);
	let messages = $state<Message[]>([]);
	let loading = $state(true);
	let isNewChat = $state(false);
	let sending = $state(false);
	let regenerating = $state(false);
	let impersonating = $state(false);
	let generatingImage = $state(false);
	let generatingSD = $state(false);
	let conversationId = $state<number | null>(null);
	let isTyping = $state(false);
	let chatLayout = $state<'bubbles' | 'discord'>('bubbles');
	let avatarStyle = $state<'circle' | 'rounded'>('circle');
	let userAvatar = $state<string | null>(null);
	let userName = $state<string | null>(null);

	// Branching state
	interface Branch {
		id: number;
		name: string | null;
		isActive: boolean;
		createdAt: Date;
	}
	let branches = $state<Branch[]>([]);
	let activeBranchId = $state<number | null>(null);
	let showBranchPanel = $state(false);
	let creatingBranch = $state(false);

	// Image generation modal state
	let showImageModal = $state(false);
	let imageModalLoading = $state(false);
	let imageModalTags = $state('');
	let imageModalType = $state<'character' | 'user' | 'scene' | 'raw'>('character');
	let chatMessages: ChatMessages;
	let chatInput: ChatInput;
	let previousCharacterId: number | null = null;

	let hasAssistantMessages = $derived(messages.some(m => m.role === 'assistant'));

	onMount(() => {
		initSocket();
		loadSettings();

		onNewMessage((message: Message) => {
			if (!messages.find((m) => m.id === message.id)) {
				messages = [...messages, message];
				setTimeout(() => chatMessages?.scrollToBottom(), 100);
			}
		});

		onTyping((typing: boolean) => {
			isTyping = typing;
			if (typing) {
				setTimeout(() => chatMessages?.scrollToBottom(), 100);
			}
		});

		// Arrow key swipe navigation
		const handleKeydown = (e: KeyboardEvent) => {
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
		};

		window.addEventListener('keydown', handleKeydown);

		// Listen for settings updates from the general settings page
		const handleSettingsUpdate = (e: CustomEvent<{ chatLayout: 'bubbles' | 'discord'; avatarStyle: 'circle' | 'rounded' }>) => {
			chatLayout = e.detail.chatLayout;
			if (e.detail.avatarStyle) avatarStyle = e.detail.avatarStyle;
		};
		window.addEventListener('settingsUpdated', handleSettingsUpdate as EventListener);

		// Listen for persona changes to update user name/avatar
		const handlePersonaUpdate = () => {
			loadSettings();
		};
		window.addEventListener('personaUpdated', handlePersonaUpdate);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('settingsUpdated', handleSettingsUpdate as EventListener);
			window.removeEventListener('personaUpdated', handlePersonaUpdate);
		};
	});

	$effect(() => {
		const currentCharacterId = data.characterId;
		if (currentCharacterId !== previousCharacterId) {
			if (conversationId) {
				leaveConversation(conversationId);
			}
			previousCharacterId = currentCharacterId;
			loadCharacter();
			loadConversation();
		}
	});

	onDestroy(() => {
		if (conversationId) {
			leaveConversation(conversationId);
		}
		removeAllListeners();
	});

	async function loadSettings() {
		const settings = await api.loadSettings();
		chatLayout = settings.chatLayout;
		avatarStyle = settings.avatarStyle;
		userAvatar = settings.userAvatar;
		userName = settings.userName;
	}

	async function loadCharacter() {
		character = await api.loadCharacter(data.characterId);
	}

	async function loadConversation() {
		loading = true;
		try {
			const result = await api.loadConversation(data.characterId);
			isNewChat = result.isNewChat;
			conversationId = result.conversationId;
			messages = result.messages;
			branches = result.branches;
			activeBranchId = result.activeBranchId;

			if (conversationId) {
				joinConversation(conversationId);
			}

			setTimeout(() => chatMessages?.scrollToBottom(), 100);
		} finally {
			loading = false;
		}
	}

	async function handleScenarioStart(newConversationId: number) {
		isNewChat = false;
		conversationId = newConversationId;
		joinConversation(newConversationId);
		await loadConversation();
	}

	async function createBranch(messageId: number, name?: string) {
		if (creatingBranch) return;
		creatingBranch = true;

		try {
			const success = await api.createBranch(data.characterId, messageId, name);
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

		const success = await api.switchBranch(data.characterId, branchId);
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

		const success = await api.deleteBranch(data.characterId, branchId);
		if (success) {
			if (branchId === activeBranchId && conversationId) {
				leaveConversation(conversationId);
			}
			await loadConversation();
		} else {
			alert('Failed to delete branch');
		}
	}

	async function sendMessage(userMessage: string) {
		if (sending) return;
		sending = true;

		try {
			const success = await api.sendMessage(data.characterId, userMessage);
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
			const success = await api.generateResponse(data.characterId);
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
			const content = await api.impersonate(data.characterId);
			if (content) {
				chatInput?.setInput(content);
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
			const success = await api.triggerSceneAction(data.characterId, actionType);
			if (!success) {
				alert('Failed to execute action');
			}
		} finally {
			sending = false;
		}
	}

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
			const tags = await api.generateImageTags(data.characterId, type);
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
			const success = await api.generateSDImage(data.characterId, tags);
			if (success) {
				showImageModal = false;
				imageModalTags = '';
				setTimeout(() => chatMessages?.scrollToBottom(), 100);
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
			const tags = await api.generateImageTags(data.characterId, imageModalType);
			if (tags) {
				imageModalTags = tags;
			} else {
				alert('Failed to regenerate tags');
			}
		} finally {
			imageModalLoading = false;
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
</script>

<svelte:head>
	<title>{character?.name ?? 'Chat'} | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/chat">
	<div class="h-full flex flex-col bg-[var(--bg-primary)]">
		{#if isNewChat && character}
			<!-- Scenario Selection for New Chat -->
			<ScenarioSelector {character} onStart={handleScenarioStart} />
		{:else}
			<ChatHeader
				{character}
				{conversationId}
				branchCount={branches.length}
				onReset={resetConversation}
				onBack={() => window.location.href = '/library'}
				onToggleBranches={() => showBranchPanel = !showBranchPanel}
			/>

			<!-- Chat Area with Character Image -->
			<div class="flex-1 flex min-h-0 gap-4 p-4">
				<!-- Left Side: Character Image -->
				{#if character}
					<ChatCharacterImage
						{character}
						show={showCharacterImage}
						onToggle={(show) => showCharacterImage = show}
					/>
				{/if}

				<!-- Messages Area -->
				<ChatMessages
					bind:this={chatMessages}
					{messages}
					{loading}
					{isTyping}
					generating={regenerating}
					charName={character?.name}
					userName={userName || data.user?.displayName}
					charAvatar={character?.thumbnailData || character?.imageData}
					{userAvatar}
					{chatLayout}
					{avatarStyle}
					onSwipe={swipeMessage}
					onSaveEdit={saveMessageEdit}
					onDelete={deleteMessageAndBelow}
					onBranch={createBranch}
				/>

				<!-- Branch Panel (Right Side) -->
				{#if showBranchPanel}
					<ChatBranchPanel
						{branches}
						{activeBranchId}
						onSwitch={switchBranch}
						onDelete={deleteBranch}
						onClose={() => showBranchPanel = false}
					/>
				{/if}
			</div>

			<ChatInput
				bind:this={chatInput}
				disabled={sending || regenerating}
				{hasAssistantMessages}
				{impersonating}
				{generatingImage}
				onSend={sendMessage}
				onGenerate={generateResponse}
				onRegenerate={regenerateLastMessage}
				onImpersonate={impersonate}
				onGenerateImage={generateImage}
				onSceneAction={handleSceneAction}
			/>
		{/if}
	</div>
</MainLayout>

<ImageGenerateModal
	bind:show={showImageModal}
	loading={imageModalLoading}
	generating={generatingSD}
	tags={imageModalTags}
	type={imageModalType}
	onGenerate={handleImageGenerate}
	onRegenerate={handleImageRegenerate}
	onCancel={handleImageCancel}
/>
