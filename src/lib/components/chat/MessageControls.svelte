<script lang="ts">
	import type { Message } from '$lib/server/db/schema';

	interface Props {
		message: Message;
		showSwipe: boolean;
		align: 'start' | 'end';
		onSwipe: (direction: 'left' | 'right') => void;
		onEdit: () => void;
		onDelete: () => void;
		onShowReasoning?: () => void;
		onBranch?: () => void;
		disabled?: boolean;
		compact?: boolean; // For inline display in row layout
	}

	let { message, showSwipe, align, onSwipe, onEdit, onDelete, onShowReasoning, onBranch, disabled = false, compact = false }: Props = $props();

	// Copy feedback state
	let copied = $state(false);

	async function copyMessage() {
		try {
			await navigator.clipboard.writeText(message.content);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	// Check if reasoning is available for the current swipe
	let hasReasoning = $derived(() => {
		if (!message.reasoning) return false;
		// Try parsing as array (for swipes)
		try {
			const reasoningArray = JSON.parse(message.reasoning);
			if (Array.isArray(reasoningArray)) {
				const currentIndex = message.currentSwipe ?? 0;
				return !!reasoningArray[currentIndex];
			}
		} catch {
			// Not JSON array, treat as plain string
		}
		return !!message.reasoning;
	});

	function getSwipes(): string[] {
		if (!message.swipes) return [message.content];
		try {
			const swipes = JSON.parse(message.swipes);
			return Array.isArray(swipes) ? swipes : [message.content];
		} catch {
			return [message.content];
		}
	}

	function getCurrentSwipeIndex(): number {
		return message.currentSwipe ?? 0;
	}

	let swipes = $derived(getSwipes());
	let currentIndex = $derived(getCurrentSwipeIndex());
</script>

{#if !disabled}
<div class="flex items-center {align === 'end' ? 'justify-end' : 'justify-start'} gap-2">
	{#if showSwipe}
		<button
			onclick={() => onSwipe('left')}
			class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
			title="Previous variant"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
		<span class="text-xs text-[var(--text-muted)]">{currentIndex + 1} / {swipes.length}</span>
		<button
			onclick={() => onSwipe('right')}
			class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
			title="Next variant"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
			</svg>
		</button>
	{/if}

	<!-- Reasoning button (only for assistant messages with reasoning) -->
	{#if message.role === 'assistant' && hasReasoning() && onShowReasoning}
		<button
			onclick={onShowReasoning}
			class="p-1.5 text-[var(--accent-secondary)] hover:text-[var(--accent-primary)] transition {compact ? '' : 'opacity-0 group-hover:opacity-100'}"
			title="View reasoning"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
			</svg>
		</button>
	{/if}

	<!-- Copy button -->
	<button
		onclick={copyMessage}
		class="p-1.5 transition {compact ? '' : 'opacity-0 group-hover:opacity-100'} {copied ? 'text-[var(--success)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-primary)]'}"
		title={copied ? 'Copied!' : 'Copy message'}
	>
		{#if copied}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
			</svg>
		{:else}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
			</svg>
		{/if}
	</button>

	<!-- Edit button (show on hover via parent group, unless compact mode) -->
	<button
		onclick={onEdit}
		class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition {compact ? '' : 'opacity-0 group-hover:opacity-100'}"
		title="Edit message"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
		</svg>
	</button>

	<!-- Branch button (show on hover via parent group, unless compact mode) -->
	{#if onBranch}
		<button
			onclick={onBranch}
			class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition {compact ? '' : 'opacity-0 group-hover:opacity-100'}"
			title="Create branch from here"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="18" cy="18" r="3"/>
				<circle cx="6" cy="6" r="3"/>
				<circle cx="6" cy="18" r="3"/>
				<path d="M6 9v9"/>
				<path d="M18 15V9a3 3 0 0 0-3-3H9"/>
			</svg>
		</button>
	{/if}

	<!-- Delete button (show on hover via parent group, unless compact mode) -->
	<button
		onclick={onDelete}
		class="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] transition {compact ? '' : 'opacity-0 group-hover:opacity-100'}"
		title="Delete this message and all below"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
		</svg>
	</button>
</div>
{/if}
