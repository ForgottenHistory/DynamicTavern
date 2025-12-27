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
		textCleanupEnabled?: boolean;
		autoWrapActions?: boolean;
		generating: boolean;
		onSwipe: (direction: 'left' | 'right') => void;
		onSaveEdit: (content: string) => void;
		onDelete: () => void;
		onBranch?: () => void;
	}

	let { message, index, isLast, charName, userName, textCleanupEnabled = true, autoWrapActions = false, generating, onSwipe, onSaveEdit, onDelete, onBranch }: Props = $props();

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
	let isSystem = $derived(message.role === 'system');
	let isNarrator = $derived(message.role === 'narrator');
	let showSwipeControls = $derived(message.role === 'assistant' && isLast);
	let showGeneratingPlaceholder = $derived(generating && isLast && message.role === 'assistant');

	// Display info - prefer stored sender info, fall back to current names
	let displayName = $derived(
		message.senderName ||
		(isNarrator ? 'Narrator' : (isSystem ? 'System' : (isUser ? (userName || 'User') : (charName || 'Assistant'))))
	);

	// Format timestamp
	let timestamp = $derived(() => {
		const date = new Date(message.createdAt);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
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
		// Reset content
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

<div class="group flex {isSystem || isNarrator ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'}">
	<div class="flex flex-col gap-1 {isSystem || isNarrator ? 'max-w-[85%]' : 'max-w-[70%]'}">
		<!-- Name and timestamp -->
		<div class="flex items-center gap-2 {isSystem || isNarrator ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'}">
			{#if isSystem}
				<svg class="w-4 h-4 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
				</svg>
			{:else if isNarrator}
				<svg class="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
				</svg>
			{/if}
			<span class="text-sm font-semibold {isNarrator ? 'text-[var(--text-secondary)]' : isSystem ? 'text-[var(--warning)]' : isUser ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-secondary)]'}">
				{displayName}
			</span>
			<span class="text-xs text-[var(--text-muted)]">
				{timestamp()}
			</span>
		</div>

		<div
			class="rounded-2xl px-4 py-3 {isNarrator
				? 'bg-[var(--bg-tertiary)] border-2 border-[var(--border-primary)] text-[var(--text-secondary)] italic'
				: isSystem
				? 'bg-[var(--warning)]/10 border-2 border-[var(--warning)]/30 text-[var(--text-primary)] italic'
				: isUser
				? 'bg-[var(--assistant-bubble)] border-2 border-[var(--accent-primary)] text-[var(--text-primary)]'
				: 'bg-[var(--assistant-bubble)] border-2 border-[var(--accent-secondary)]/60 text-[var(--text-primary)]'} {isEditing ? 'ring-2 ring-[var(--accent-primary)]' : ''}"
		>
			{#if showGeneratingPlaceholder}
				<div class="flex items-center gap-2">
					<div class="flex gap-1">
						<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0s"></div>
						<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
						<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
					</div>
				</div>
			{:else if isEditing}
				<div
					bind:this={editableRef}
					contenteditable="true"
					onkeydown={handleKeydown}
					role="textbox"
					class="outline-none whitespace-pre-wrap"
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
			{:else}
				<ChatMessage
					content={message.content}
					role={message.role as 'user' | 'assistant'}
					{charName}
					{userName}
					{textCleanupEnabled}
					{autoWrapActions}
				/>
			{/if}
		</div>

		<MessageControls
			{message}
			showSwipe={showSwipeControls}
			align={isUser ? 'end' : 'start'}
			{onSwipe}
			onEdit={startEdit}
			{onDelete}
			{onBranch}
			onShowReasoning={() => showReasoningModal = true}
			disabled={isEditing || generating}
		/>
	</div>
</div>

<ReasoningModal bind:show={showReasoningModal} reasoning={currentReasoning()} />
