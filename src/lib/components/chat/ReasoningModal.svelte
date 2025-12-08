<script lang="ts">
	let {
		show = $bindable(false),
		reasoning = ''
	}: {
		show: boolean;
		reasoning: string;
	} = $props();

	function handleClose() {
		show = false;
	}
</script>

{#if show}
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') handleClose();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="bg-[var(--bg-secondary)] rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-[var(--border-primary)]">
			<div class="p-6 border-b border-[var(--border-primary)]">
				<div class="flex items-center justify-between">
					<h3 class="text-xl font-bold text-[var(--text-primary)]">
						Model Reasoning
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
					The model's internal reasoning process before generating the response.
				</p>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				{#if reasoning}
					<div class="prose prose-invert max-w-none">
						<pre class="whitespace-pre-wrap text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-primary)] font-mono leading-relaxed">{reasoning}</pre>
					</div>
				{:else}
					<p class="text-[var(--text-muted)] text-center py-8">
						No reasoning available for this message.
					</p>
				{/if}
			</div>

			<div class="p-4 border-t border-[var(--border-primary)]">
				<button
					onclick={handleClose}
					class="w-full px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] rounded-xl transition font-medium"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
