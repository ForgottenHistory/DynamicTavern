<script lang="ts">
	let {
		show = $bindable(false),
		postHistory = $bindable(''),
		characterName = '',
		saving = false,
		onSave
	}: {
		show: boolean;
		postHistory: string;
		characterName: string;
		saving: boolean;
		onSave: (content: string) => Promise<void>;
	} = $props();

	let localContent = $state('');

	$effect(() => {
		if (show) {
			localContent = postHistory || '';
		}
	});

	function handleClose() {
		show = false;
	}

	async function handleSave() {
		await onSave(localContent);
	}
</script>

{#if show}
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-[var(--bg-secondary)] rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-[var(--border-primary)]">
			<div class="p-6 border-b border-[var(--border-primary)]">
				<div class="flex items-center justify-between">
					<h3 class="text-xl font-bold text-[var(--text-primary)]">
						Post History
					</h3>
					<button
						onclick={handleClose}
						class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
						aria-label="Close"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<p class="text-sm text-[var(--text-secondary)] mt-1">
					Text that appears after the conversation history for {characterName}. Use this for persistent instructions or context.
				</p>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<textarea
					bind:value={localContent}
					placeholder="Enter post-history content here...

Example: Always describe actions in detail. Focus on emotional reactions."
					class="w-full h-64 bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl border border-[var(--border-primary)] p-4 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono text-sm"
				></textarea>
				<p class="text-xs text-[var(--text-muted)] mt-2">
					Available variables: {"{{char}}"}, {"{{user}}"}, {"{{scenario}}"}
				</p>
			</div>

			<div class="p-4 border-t border-[var(--border-primary)] flex gap-3">
				<button
					onclick={handleClose}
					class="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] rounded-xl transition font-medium"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={saving}
					class="flex-1 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
