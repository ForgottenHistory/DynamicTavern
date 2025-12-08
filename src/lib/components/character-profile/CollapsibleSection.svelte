<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		expanded: boolean;
		onToggle: () => void;
		badge?: string | number;
		children: Snippet;
	}

	let { title, expanded, onToggle, badge, children }: Props = $props();
</script>

<div class="mt-6">
	<button
		onclick={onToggle}
		class="w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] rounded-lg border border-[var(--border-primary)] transition"
	>
		<div class="flex items-center gap-2">
			<h4 class="text-sm font-semibold text-[var(--text-primary)]">{title}</h4>
			{#if badge !== undefined}
				<span class="text-xs bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] px-2 py-0.5 rounded-full">
					{badge}
				</span>
			{/if}
		</div>
		<svg
			class="w-5 h-5 text-[var(--text-secondary)] transition-transform {expanded ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>
	{#if expanded}
		<div class="mt-2 p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg">
			{@render children()}
		</div>
	{/if}
</div>
