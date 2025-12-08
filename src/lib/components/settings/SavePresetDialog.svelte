<script lang="ts">
	let {
		show = $bindable(false),
		saving = false,
		onSave
	}: {
		show: boolean;
		saving?: boolean;
		onSave: (name: string) => void;
	} = $props();

	let presetName = $state('');

	function handleSave() {
		if (presetName.trim()) {
			onSave(presetName.trim());
			presetName = '';
		}
	}

	function handleClose() {
		show = false;
		presetName = '';
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
		<div class="bg-[var(--bg-secondary)] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--border-primary)]">
			<h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">Save Preset</h3>
			<p class="text-sm text-[var(--text-secondary)] mb-4">
				Save your current settings as a reusable preset
			</p>
			<input
				type="text"
				bind:value={presetName}
				placeholder="Preset name"
				class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] mb-4"
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						handleSave();
					}
				}}
			/>
			<div class="flex items-center gap-3 justify-end">
				<button
					onclick={handleClose}
					class="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={saving || !presetName.trim()}
					class="px-6 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition"
				>
					{#if saving}
						<div
							class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"
						></div>
					{:else}
						Save
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
