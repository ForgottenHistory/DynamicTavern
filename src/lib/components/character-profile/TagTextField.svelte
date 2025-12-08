<script lang="ts">
	interface Props {
		label: string;
		description: string;
		placeholder: string;
		value: string;
		rows?: number;
		id?: string;
	}

	let { label, description, placeholder, value = $bindable(), rows = 3, id }: Props = $props();

	let copied = $state(false);

	// Generate a unique ID if not provided
	let fieldId = $derived(id || `tag-field-${label.toLowerCase().replace(/\s+/g, '-')}`);

	async function copy() {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<div class="space-y-2 group">
	<div class="flex items-center justify-between">
		<label for={fieldId} class="block text-sm font-medium text-[var(--text-secondary)]">
			{label}
		</label>
		{#if value}
			<button
				onclick={copy}
				class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
				title="Copy to clipboard"
			>
				{#if copied}
					<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
					</svg>
				{/if}
			</button>
		{/if}
	</div>
	<p class="text-xs text-[var(--text-muted)]">
		{description}
	</p>
	<textarea
		id={fieldId}
		bind:value
		{placeholder}
		{rows}
		class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] font-mono text-sm"
	></textarea>
</div>
