<script lang="ts">
	import type { PageData } from './$types';
	import type { Character, Message } from '$lib/server/db/schema';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ImageGenerateModal from '$lib/components/chat/ImageGenerateModal.svelte';
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
		try {
			const response = await fetch('/api/settings');
			if (response.ok) {
				const result = await response.json();
				chatLayout = result.chatLayout || 'bubbles';
				avatarStyle = result.avatarStyle || 'circle';
				userAvatar = result.userAvatar || null;
				userName = result.userName || null;
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
		}
	}

	async function loadCharacter() {
		try {
			const response = await fetch(`/api/characters/${data.characterId}`);
			const result = await response.json();
			character = result.character;
		} catch (error) {
			console.error('Failed to load character:', error);
		}
	}

	async function loadConversation() {
		loading = true;
		try {
			const response = await fetch(`/api/chat/${data.characterId}`);
			const result = await response.json();
			conversationId = result.conversationId;
			messages = result.messages || [];
			branches = result.branches || [];
			activeBranchId = result.activeBranchId;

			if (conversationId) {
				joinConversation(conversationId);
			}

			setTimeout(() => chatMessages?.scrollToBottom(), 100);
		} catch (error) {
			console.error('Failed to load conversation:', error);
		} finally {
			loading = false;
		}
	}

	async function createBranch(messageId: number, name?: string) {
		if (creatingBranch) return;
		creatingBranch = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/branches`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messageId, name })
			});

			if (response.ok) {
				// Leave old conversation room
				if (conversationId) {
					leaveConversation(conversationId);
				}
				// Reload to get new branch
				await loadConversation();
			} else {
				alert('Failed to create branch');
			}
		} catch (error) {
			console.error('Failed to create branch:', error);
			alert('Failed to create branch');
		} finally {
			creatingBranch = false;
		}
	}

	async function switchBranch(branchId: number) {
		if (branchId === activeBranchId) return;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/branches/${branchId}`, {
				method: 'PUT'
			});

			if (response.ok) {
				// Leave old conversation room
				if (conversationId) {
					leaveConversation(conversationId);
				}
				// Reload to get new branch messages
				await loadConversation();
			} else {
				alert('Failed to switch branch');
			}
		} catch (error) {
			console.error('Failed to switch branch:', error);
			alert('Failed to switch branch');
		}
	}

	async function deleteBranch(branchId: number) {
		if (!confirm('Delete this branch? All messages will be lost.')) return;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/branches/${branchId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// If we deleted the active branch, reload
				if (branchId === activeBranchId) {
					if (conversationId) {
						leaveConversation(conversationId);
					}
				}
				await loadConversation();
			} else {
				const result = await response.json();
				alert(result.error || 'Failed to delete branch');
			}
		} catch (error) {
			console.error('Failed to delete branch:', error);
			alert('Failed to delete branch');
		}
	}

	async function sendMessage(userMessage: string) {
		if (sending) return;
		sending = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: userMessage })
			});

			if (!response.ok) {
				alert('Failed to send message');
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		} finally {
			sending = false;
		}
	}

	async function generateResponse() {
		if (sending) return;
		sending = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/generate`, {
				method: 'POST'
			});

			if (!response.ok) {
				alert('Failed to generate response');
			}
		} catch (error) {
			console.error('Failed to generate response:', error);
		} finally {
			sending = false;
		}
	}

	async function impersonate() {
		if (sending || impersonating) return;
		impersonating = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/impersonate`, {
				method: 'POST'
			});

			if (response.ok) {
				const result = await response.json();
				chatInput?.setInput(result.content);
			} else {
				alert('Failed to impersonate');
			}
		} catch (error) {
			console.error('Failed to impersonate:', error);
		} finally {
			impersonating = false;
		}
	}

	async function generateImage(type: 'character' | 'user' | 'scene' | 'raw') {
		if (generatingImage || !conversationId) return;

		// Open modal
		imageModalType = type;
		imageModalTags = '';
		showImageModal = true;

		// Raw mode - just open empty modal for manual input
		if (type === 'raw') {
			imageModalLoading = false;
			return;
		}

		// AI-assisted mode - generate tags from conversation
		imageModalLoading = true;
		generatingImage = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/generate-image`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type })
			});

			if (response.ok) {
				const result = await response.json();
				imageModalTags = result.tags;
			} else {
				const error = await response.json();
				alert(`Failed to generate tags: ${error.error || 'Unknown error'}`);
				showImageModal = false;
			}
		} catch (error) {
			console.error('Failed to generate tags:', error);
			alert('Failed to generate tags');
			showImageModal = false;
		} finally {
			imageModalLoading = false;
			generatingImage = false;
		}
	}

	async function handleImageGenerate(tags: string) {
		if (generatingSD) return;
		generatingSD = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/generate-sd`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tags })
			});

			if (response.ok) {
				// Message will arrive via Socket.IO
				showImageModal = false;
				imageModalTags = '';
				setTimeout(() => chatMessages?.scrollToBottom(), 100);
			} else {
				const error = await response.json();
				alert(`Failed to generate image: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Failed to generate image:', error);
			alert('Failed to generate image');
		} finally {
			generatingSD = false;
		}
	}

	function handleImageCancel() {
		imageModalTags = '';
	}

	async function handleImageRegenerate() {
		// Re-trigger tag generation with current type
		imageModalTags = '';
		imageModalLoading = true;

		try {
			const response = await fetch(`/api/chat/${data.characterId}/generate-image`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: imageModalType })
			});

			if (response.ok) {
				const result = await response.json();
				imageModalTags = result.tags;
			} else {
				const error = await response.json();
				alert(`Failed to regenerate tags: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Failed to regenerate tags:', error);
			alert('Failed to regenerate tags');
		} finally {
			imageModalLoading = false;
		}
	}

	async function resetConversation() {
		if (!conversationId) return;

		const confirmed = confirm('Are you sure you want to reset this conversation? All messages will be deleted.');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/chat/${conversationId}/reset`, {
				method: 'POST'
			});

			if (response.ok) {
				await loadConversation();
			} else {
				alert('Failed to reset conversation');
			}
		} catch (error) {
			console.error('Failed to reset conversation:', error);
			alert('Failed to reset conversation');
		}
	}

	function getSwipes(message: Message): string[] {
		if (!message.swipes) return [message.content];
		try {
			const swipes = JSON.parse(message.swipes);
			return Array.isArray(swipes) ? swipes : [message.content];
		} catch {
			return [message.content];
		}
	}

	function getCurrentSwipeIndex(message: Message): number {
		return message.currentSwipe ?? 0;
	}

	async function swipeMessage(messageId: number, direction: 'left' | 'right') {
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		const message = messages[messageIndex];
		const swipes = getSwipes(message);
		const currentIndex = getCurrentSwipeIndex(message);
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
		try {
			const response = await fetch(`/api/chat/messages/${messageId}/swipe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ swipeIndex: newIndex })
			});

			if (response.ok) {
				const updatedMessage = {
					...message,
					content: swipes[newIndex],
					currentSwipe: newIndex
				};
				messages[messageIndex] = updatedMessage;
				messages = [...messages];
			}
		} catch (error) {
			console.error('Failed to swipe message:', error);
		}
	}

	async function regenerateMessage(messageId: number) {
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		regenerating = true; // Disable message controls while generating

		try {
			const response = await fetch(`/api/chat/messages/${messageId}/regenerate`, {
				method: 'POST'
			});

			if (response.ok) {
				const result = await response.json();
				// Update message locally with new content and swipe count
				const message = messages[messageIndex];
				const swipes = getSwipes(message);
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
		} catch (error) {
			console.error('Failed to regenerate message:', error);
			alert('Failed to regenerate message');
		} finally {
			regenerating = false;
		}
	}

	async function regenerateLastMessage() {
		const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
		if (!lastAssistantMessage) return;

		// Remove the message from UI immediately
		const messageIndex = messages.findIndex(m => m.id === lastAssistantMessage.id);
		if (messageIndex !== -1) {
			messages = messages.slice(0, messageIndex);
		}

		try {
			const response = await fetch(`/api/chat/messages/${lastAssistantMessage.id}/regenerate-fresh`, {
				method: 'POST'
			});

			if (!response.ok) {
				// Reload conversation to restore state on error
				await loadConversation();
				alert('Failed to regenerate message');
			}
			// New message will arrive via Socket.IO
		} catch (error) {
			console.error('Failed to regenerate message:', error);
			await loadConversation();
			alert('Failed to regenerate message');
		}
	}

	async function deleteMessageAndBelow(messageId: number, messageIndex: number) {
		const messagesBelow = messages.length - messageIndex;
		const confirmed = confirm(`Delete this message and ${messagesBelow > 1 ? `${messagesBelow - 1} message(s) below it` : 'no messages below'}?`);
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/chat/messages/${messageId}/delete`, {
				method: 'DELETE'
			});

			if (response.ok) {
				messages = messages.slice(0, messageIndex);
			} else {
				alert('Failed to delete messages');
			}
		} catch (error) {
			console.error('Failed to delete messages:', error);
			alert('Failed to delete messages');
		}
	}

	async function saveMessageEdit(messageId: number, messageIndex: number, content: string) {
		try {
			const response = await fetch(`/api/chat/messages/${messageId}/edit`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});

			if (response.ok) {
				const result = await response.json();
				messages[messageIndex] = result.message;
				messages = [...messages];
			} else {
				alert('Failed to save edit');
			}
		} catch (error) {
			console.error('Failed to save edit:', error);
			alert('Failed to save edit');
		}
	}
</script>

<svelte:head>
	<title>{character?.name ?? 'Chat'} | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/chat">
	<div class="h-full flex flex-col bg-[var(--bg-primary)]">
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
			{#if character && showCharacterImage}
				<div class="relative w-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-primary)] hidden lg:block group transition-all duration-300">
					{#if character.imageData}
						<img
							src={character.imageData}
							alt={character.name}
							class="w-full h-full object-cover object-center"
						/>
					{:else}
						<div class="w-full h-full flex items-center justify-center text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
							<svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
								/>
							</svg>
						</div>
					{/if}
					<!-- Top gradient fade -->
					<div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/40 via-black/20 to-transparent"></div>
					<!-- Side gradient for blending -->
					<div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--bg-primary)]/20"></div>
					<!-- Subtle vignette -->
					<div class="absolute inset-0" style="box-shadow: inset 0 0 80px rgba(0,0,0,0.15)"></div>

					<!-- Hide button (top right, shows on hover) -->
					<button
						onclick={() => (showCharacterImage = false)}
						class="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-all opacity-0 group-hover:opacity-100"
						title="Hide character image"
					>
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
						</svg>
					</button>

					<!-- Character name overlay at bottom -->
					<div class="absolute bottom-0 left-0 right-0 h-24">
						<!-- Blur layer with gradual fade -->
						<div class="absolute inset-0 backdrop-blur-sm" style="mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%); -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)"></div>
						<!-- Dark gradient -->
						<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
						<!-- Name text -->
						<div class="absolute bottom-4 left-4 right-4">
							<h2 class="text-lg font-bold text-white drop-shadow-lg">{character.name}</h2>
						</div>
					</div>
				</div>
			{/if}

			<!-- Show Image Button (when hidden) -->
			{#if character && !showCharacterImage}
				<button
					onclick={() => (showCharacterImage = true)}
					class="w-12 flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg hover:bg-[var(--bg-tertiary)] transition-all hidden lg:flex items-center justify-center"
					title="Show character image"
				>
					<svg class="w-6 h-6 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
					</svg>
				</button>
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
				<div class="w-72 flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg flex flex-col overflow-hidden">
					<div class="flex items-center justify-between p-3 border-b border-[var(--border-primary)]">
						<h3 class="font-semibold text-[var(--text-primary)]">Branches</h3>
						<button
							onclick={() => showBranchPanel = false}
							class="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
							title="Close panel"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						</button>
					</div>
					<div class="flex-1 overflow-y-auto p-2 space-y-2">
						{#each branches as branch (branch.id)}
							<div
								class="group p-3 rounded-lg cursor-pointer transition {branch.id === activeBranchId ? 'bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-transparent'}"
								onclick={() => switchBranch(branch.id)}
								onkeydown={(e) => e.key === 'Enter' && switchBranch(branch.id)}
								tabindex="0"
								role="button"
							>
								<div class="flex items-center justify-between">
									<span class="font-medium text-[var(--text-primary)] truncate flex-1">
										{branch.name || 'Main'}
									</span>
									{#if branch.id === activeBranchId}
										<span class="text-xs text-[var(--accent-primary)] font-medium ml-2">Active</span>
									{/if}
								</div>
								<div class="flex items-center justify-between mt-1">
									<span class="text-xs text-[var(--text-muted)]">
										{new Date(branch.createdAt).toLocaleDateString()}
									</span>
									{#if branches.length > 1}
										<button
											onclick={(e) => { e.stopPropagation(); deleteBranch(branch.id); }}
											class="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition opacity-0 group-hover:opacity-100"
											title="Delete branch"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
											</svg>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
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
		/>
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
