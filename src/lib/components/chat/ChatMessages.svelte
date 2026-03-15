<script lang="ts">
	import type { Message } from '$lib/server/db/schema';
	import MessageBubble from './MessageBubble.svelte';
	import MessageRow from './MessageRow.svelte';

	// Palette of distinct colors for different characters
	const CHARACTER_COLORS = [
		'#06b6d4', // cyan
		'#a78bfa', // violet
		'#f472b6', // pink
		'#fb923c', // orange
		'#4ade80', // green
		'#facc15', // yellow
		'#f87171', // red
		'#38bdf8', // sky
		'#c084fc', // purple
		'#34d399', // emerald
	];

	// Parse hex color to RGB
	function hexToRgb(hex: string): [number, number, number] {
		const h = hex.replace('#', '');
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}

	// Simple RGB distance — threshold of 80 filters out perceptually similar colors
	function colorDistance(a: string, b: string): number {
		const [r1, g1, b1] = hexToRgb(a);
		const [r2, g2, b2] = hexToRgb(b);
		return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
	}

	// Filter palette to exclude colors too similar to the user's bubble color
	const availableColors = $derived(
		CHARACTER_COLORS.filter(c => colorDistance(c, userBubbleColor) > 80)
	);

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
		textCleanupEnabled?: boolean;
		autoWrapActions?: boolean;
		userBubbleColor?: string;
		sceneCharacters?: { id: number; name: string }[];
		onSwipe: (messageId: number, direction: 'left' | 'right') => void;
		onSaveEdit: (messageId: number, index: number, content: string) => void;
		onDelete: (messageId: number, index: number) => void;
		onBranch?: (messageId: number) => void;
	}

	let { messages, loading, isTyping, generating, charName, userName, charAvatar, userAvatar, chatLayout = 'bubbles', avatarStyle = 'circle', textCleanupEnabled = true, autoWrapActions = false, userBubbleColor = '#14b8a6', sceneCharacters, onSwipe, onSaveEdit, onDelete, onBranch }: Props = $props();

	// Build a stable color map: characterId → color, assigned in order of first appearance
	// Also seeds from sceneCharacters so characters get colors before they speak
	// Uses availableColors which excludes colors too similar to userBubbleColor
	const characterColorMap = $derived.by(() => {
		const colors = availableColors;
		const map = new Map<number, string>();
		let colorIndex = 0;
		// First, assign colors from message history (stable ordering)
		for (const msg of messages) {
			if (msg.characterId && !map.has(msg.characterId)) {
				map.set(msg.characterId, colors[colorIndex % colors.length]);
				colorIndex++;
			}
		}
		// Then, assign colors to scene characters who haven't spoken yet
		if (sceneCharacters) {
			for (const char of sceneCharacters) {
				if (!map.has(char.id)) {
					map.set(char.id, colors[colorIndex % colors.length]);
					colorIndex++;
				}
			}
		}
		return map;
	});

	// Build name → color map for inline text highlighting (used by ChatMessage)
	const characterNameColorMap = $derived.by(() => {
		const map = new Map<string, string>();
		// From messages
		for (const msg of messages) {
			if (msg.characterId && msg.senderName && !map.has(msg.senderName)) {
				const color = characterColorMap.get(msg.characterId);
				if (color) {
					map.set(msg.senderName, color);
				}
			}
		}
		// From scene characters who haven't spoken yet
		if (sceneCharacters) {
			for (const char of sceneCharacters) {
				if (!map.has(char.name)) {
					const color = characterColorMap.get(char.id);
					if (color) {
						map.set(char.name, color);
					}
				}
			}
		}
		return map;
	});

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

<div class="flex-1 overflow-y-auto pl-6 pr-24 py-6" bind:this={container}>
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
		<div class="{chatLayout === 'discord' ? 'space-y-3' : 'space-y-4'}">
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
						{textCleanupEnabled}
						{autoWrapActions}
						{userBubbleColor}
						{characterColorMap}
						characterColors={characterNameColorMap}
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
						{textCleanupEnabled}
						{autoWrapActions}
						{userBubbleColor}
						{characterColorMap}
						characterColors={characterNameColorMap}
						{generating}
						onSwipe={(direction) => onSwipe(message.id, direction)}
						onSaveEdit={(content) => onSaveEdit(message.id, index, content)}
						onDelete={() => onDelete(message.id, index)}
						onBranch={onBranch ? () => onBranch(message.id) : undefined}
					/>
				{/if}
			{/each}
		</div>

		<!-- Typing Indicator (only show when not regenerating and no placeholder message) -->
		{#if isTyping && !generating && messages.at(-1)?.content}
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
