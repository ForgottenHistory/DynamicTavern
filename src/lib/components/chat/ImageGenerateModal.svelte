<script lang="ts">
	let {
		show = $bindable(false),
		loading = false,
		generating = false,
		tags = '',
		type = 'character',
		onGenerate,
		onRegenerate,
		onCancel
	}: {
		show: boolean;
		loading?: boolean;
		generating?: boolean;
		tags: string;
		type: 'character' | 'user' | 'scene' | 'raw';
		onGenerate: (tags: string) => void;
		onRegenerate: () => void;
		onCancel: () => void;
	} = $props();

	let editableTags = $state('');
	let isRaw = $derived(type === 'raw');

	$effect(() => {
		if (tags) {
			editableTags = tags;
		}
	});

	function handleClose() {
		show = false;
		editableTags = '';
		onCancel();
	}

	function handleGenerate() {
		onGenerate(editableTags);
	}

	const typeLabels: Record<string, string> = {
		character: 'Character',
		user: 'User',
		scene: 'Scene',
		raw: 'Raw'
	};
</script>

{#if show}
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget && !loading && !generating) handleClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape' && !loading && !generating) handleClose();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="bg-[var(--bg-secondary)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border-primary)]">
			<h3 class="text-xl font-bold text-[var(--text-primary)] mb-2">
				Generate Image - {typeLabels[type]}
			</h3>
			<p class="text-sm text-[var(--text-secondary)] mb-4">
				{#if loading}
					Generating tags from conversation...
				{:else if isRaw}
					Enter your tags manually. These will be added to the base prompt.
				{:else}
					Review and edit the generated tags before creating the image.
				{/if}
			</p>

			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="w-10 h-10 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
				</div>
			{:else}
				<textarea
					bind:value={editableTags}
					rows={4}
					placeholder={isRaw ? "Enter your tags here..." : "Generated tags will appear here..."}
					class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none font-mono text-sm mb-4"
				></textarea>

				<div class="flex items-center gap-3 justify-end">
					<button
						onclick={handleClose}
						disabled={generating}
						class="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition disabled:opacity-50"
					>
						Cancel
					</button>
					{#if !isRaw}
						<button
							onclick={onRegenerate}
							disabled={generating}
							class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl transition font-medium border border-[var(--border-primary)]"
							title="Regenerate tags"
						>
							Regenerate
						</button>
					{/if}
					<button
						onclick={handleGenerate}
						disabled={generating || !editableTags.trim()}
						class="px-6 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center gap-2"
					>
						{#if generating}
							<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
							Generating...
						{:else}
							Generate Image
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
