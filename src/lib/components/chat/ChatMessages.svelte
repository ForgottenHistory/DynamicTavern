<script lang="ts">
	import type { Message } from '$lib/server/db/schema';
	import MessageBubble from './MessageBubble.svelte';
	import MessageRow from './MessageRow.svelte';

	interface Props {
		messages: Message[];
		loading: boolean;
		isTyping: boolean;
		generating: boolean;
		charName: string | undefined;
		userName: string | undefined;
		charAvatar?: string | null;
		userAvatar?: string | null;
		chatLayout?: 'bubbles' | 'discord';
		avatarStyle?: 'circle' | 'rounded';
		onSwipe: (messageId: number, direction: 'left' | 'right') => void;
		onSaveEdit: (messageId: number, index: number, content: string) => void;
		onDelete: (messageId: number, index: number) => void;
		onBranch?: (messageId: number) => void;
	}

	let { messages, loading, isTyping, generating, charName, userName, charAvatar, userAvatar, chatLayout = 'bubbles', avatarStyle = 'circle', onSwipe, onSaveEdit, onDelete, onBranch }: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	export function scrollToBottom() {
		if (container) {
			container.scrollTop = container.scrollHeight;
		}
	}

	export function getContainer() {
		return container;
	}
</script>

<div class="flex-1 overflow-y-auto px-6 py-6" bind:this={container}>
	{#if loading}
		<div class="flex items-center justify-center h-full">
			<div class="text-[var(--text-muted)]">Loading conversation...</div>
		</div>
	{:else if messages.length === 0}
		<div class="flex items-center justify-center h-full">
			<div class="text-center">
				<p class="text-[var(--text-secondary)] mb-2">No messages yet</p>
				<p class="text-sm text-[var(--text-muted)]">Start a conversation!</p>
			</div>
		</div>
	{:else}
		<div class="{chatLayout === 'discord' ? 'space-y-1' : 'space-y-4'}">
			{#each messages as message, index (message.id)}
				{#if chatLayout === 'discord'}
					<MessageRow
						{message}
						{index}
						isLast={index === messages.length - 1}
						{charName}
						{userName}
						{charAvatar}
						{userAvatar}
						{avatarStyle}
						{generating}
						onSwipe={(direction) => onSwipe(message.id, direction)}
						onSaveEdit={(content) => onSaveEdit(message.id, index, content)}
						onDelete={() => onDelete(message.id, index)}
						onBranch={onBranch ? () => onBranch(message.id) : undefined}
					/>
				{:else}
					<MessageBubble
						{message}
						{index}
						isLast={index === messages.length - 1}
						{charName}
						{userName}
						{generating}
						onSwipe={(direction) => onSwipe(message.id, direction)}
						onSaveEdit={(content) => onSaveEdit(message.id, index, content)}
						onDelete={() => onDelete(message.id, index)}
						onBranch={onBranch ? () => onBranch(message.id) : undefined}
					/>
				{/if}
			{/each}
		</div>

		<!-- Typing Indicator (only show when not regenerating an existing message) -->
		{#if isTyping && !generating}
			<div class="mt-4">
				{#if chatLayout === 'discord'}
					<!-- Discord-style typing indicator -->
					<div class="flex gap-4 px-2 py-1">
						<div class="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
						</div>
						<div class="flex items-center gap-1">
							<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0s"></div>
							<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
							<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
						</div>
					</div>
				{:else}
					<!-- Bubble-style typing indicator -->
					<div class="flex justify-start">
						<div class="flex items-center gap-2 bg-[var(--assistant-bubble)] border border-[var(--assistant-border)] rounded-2xl px-4 py-3">
							<div class="flex gap-1">
								<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0s"></div>
								<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
								<div class="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
