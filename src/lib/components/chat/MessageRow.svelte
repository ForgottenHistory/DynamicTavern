<script lang="ts">
	import type { Message } from '$lib/server/db/schema';
	import ChatMessage from '$lib/components/ChatMessage.svelte';
	import MessageControls from './MessageControls.svelte';
	import ReasoningModal from './ReasoningModal.svelte';

	interface Props {
		message: Message;
		index: number;
		isLast: boolean;
		charName: string | undefined;
		userName: string | undefined;
		charAvatar: string | null | undefined;
		userAvatar: string | null | undefined;
		avatarStyle?: 'circle' | 'rounded';
		generating: boolean;
		onSwipe: (direction: 'left' | 'right') => void;
		onSaveEdit: (content: string) => void;
		onDelete: () => void;
		onBranch?: () => void;
	}

	let { message, index, isLast, charName, userName, charAvatar, userAvatar, avatarStyle = 'circle', generating, onSwipe, onSaveEdit, onDelete, onBranch }: Props = $props();

	// Reasoning modal state
	let showReasoningModal = $state(false);
	let currentReasoning = $derived(() => {
		if (!message.reasoning) return '';
		// Try parsing as array (for swipes)
		try {
			const reasoningArray = JSON.parse(message.reasoning);
			if (Array.isArray(reasoningArray)) {
				const currentIndex = message.currentSwipe ?? 0;
				return reasoningArray[currentIndex] || '';
			}
		} catch {
			// Not JSON array, treat as plain string
		}
		return message.reasoning;
	});

	let isUser = $derived(message.role === 'user');
	let showSwipeControls = $derived(message.role === 'assistant' && isLast);
	let showGeneratingPlaceholder = $derived(generating && isLast && message.role === 'assistant');

	// Display info - prefer stored sender info, fall back to current names
	let displayName = $derived(message.senderName || (isUser ? (userName || 'User') : (charName || 'Assistant')));
	let avatar = $derived(message.senderAvatar || (isUser ? userAvatar : charAvatar));
	let avatarClass = $derived(avatarStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');
	let avatarSize = $derived(avatarStyle === 'rounded' ? 'w-12 h-16' : 'w-12 h-12');

	// Format timestamp
	let timestamp = $derived(() => {
		const date = new Date(message.createdAt);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	});

	// Inline edit state
	let isEditing = $state(false);
	let editableRef = $state<HTMLDivElement | undefined>(undefined);

	function startEdit() {
		isEditing = true;
		setTimeout(() => {
			if (editableRef) {
				editableRef.focus();
				// Move cursor to end
				const range = document.createRange();
				range.selectNodeContents(editableRef);
				range.collapse(false);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
			}
		}, 0);
	}

	function cancelEdit() {
		isEditing = false;
		if (editableRef) {
			editableRef.innerText = message.content;
		}
	}

	function saveEdit() {
		if (editableRef) {
			const newContent = editableRef.innerText.trim();
			if (newContent) {
				onSaveEdit(newContent);
			}
		}
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
		} else if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			saveEdit();
		}
	}
</script>

<div class="group flex gap-4 px-2 py-1 hover:bg-[var(--bg-secondary)]/50 rounded-lg transition-colors">
	<!-- Avatar -->
	<div class="flex-shrink-0">
		{#if avatar}
			<img
				src={avatar}
				alt={displayName}
				class="{avatarSize} {avatarClass} object-cover"
			/>
		{:else}
			<div class="{avatarSize} {avatarClass} bg-[var(--bg-tertiary)] flex items-center justify-center">
				<svg class="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
			</div>
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		<!-- Header: Name and timestamp -->
		<div class="flex items-baseline gap-2 mb-1">
			<span class="font-semibold text-[var(--text-primary)] {isUser ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-secondary)]'}">
				{displayName}
			</span>
			<span class="text-xs text-[var(--text-muted)]">
				{timestamp()}
			</span>

			<!-- Inline controls (show on hover) -->
			<div class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
				<MessageControls
					{message}
					showSwipe={showSwipeControls}
					align="end"
					{onSwipe}
					onEdit={startEdit}
					{onDelete}
					{onBranch}
					onShowReasoning={() => showReasoningModal = true}
					disabled={isEditing || generating}
					compact={true}
				/>
			</div>
		</div>

		<!-- Message content -->
		{#if showGeneratingPlaceholder}
			<div class="flex items-center gap-2">
				<div class="flex gap-1">
					<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0s"></div>
					<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
					<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
				</div>
			</div>
		{:else if isEditing}
			<div class="bg-[var(--bg-tertiary)] rounded-lg p-3 {isEditing ? 'ring-2 ring-[var(--accent-primary)]' : ''}">
				<div
					bind:this={editableRef}
					contenteditable="true"
					onkeydown={handleKeydown}
					role="textbox"
					class="outline-none whitespace-pre-wrap text-[var(--text-primary)]"
					style="min-height: 1.5em;"
				>{message.content}</div>
				<div class="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-primary)]">
					<button
						onclick={saveEdit}
						class="px-3 py-1 text-xs font-medium rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition"
					>
						Save (Ctrl+Enter)
					</button>
					<button
						onclick={cancelEdit}
						class="px-3 py-1 text-xs font-medium rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
					>
						Cancel (Esc)
					</button>
				</div>
			</div>
		{:else}
			<div class="text-[var(--text-primary)]">
				<ChatMessage
					content={message.content}
					role={message.role as 'user' | 'assistant'}
					{charName}
					{userName}
				/>
			</div>
		{/if}
	</div>
</div>

<ReasoningModal bind:show={showReasoningModal} reasoning={currentReasoning()} />
