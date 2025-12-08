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
		generating: boolean;
		onSwipe: (direction: 'left' | 'right') => void;
		onSaveEdit: (content: string) => void;
		onDelete: () => void;
		onBranch?: () => void;
	}

	let { message, index, isLast, charName, userName, generating, onSwipe, onSaveEdit, onDelete, onBranch }: Props = $props();

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

<div class="group flex {isUser ? 'justify-end' : 'justify-start'}">
	<div class="flex flex-col gap-1 max-w-[70%]">
		<!-- Name and timestamp -->
		<div class="flex items-center gap-2 {isUser ? 'justify-end' : 'justify-start'}">
			<span class="text-sm font-semibold {isUser ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-secondary)]'}">
				{displayName}
			</span>
			<span class="text-xs text-[var(--text-muted)]">
				{timestamp()}
			</span>
		</div>

		<div
			class="rounded-2xl px-4 py-3 {isUser
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
