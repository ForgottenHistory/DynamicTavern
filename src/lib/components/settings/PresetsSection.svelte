<script lang="ts">
	import { onMount } from 'svelte';

	interface Preset {
		id: number;
		name: string;
		provider: string;
		model: string;
		temperature: number;
		maxTokens: number;
		topP: number;
		frequencyPenalty: number;
		presencePenalty: number;
		contextWindow: number;
		reasoningEnabled?: boolean;
	}

	let {
		presets = [],
		onLoadPreset,
		onDeletePreset,
		deletingPresetId = null
	}: {
		presets: Preset[];
		onLoadPreset: (preset: Preset) => void;
		onDeletePreset: (presetId: number) => void;
		deletingPresetId?: number | null;
	} = $props();

	let selectedPresetId = $state<string>('');
	let lastPresetsLength = $state(0);

	// Restore/update selection from localStorage when presets change
	$effect(() => {
		if (presets.length > 0) {
			const stored = localStorage.getItem('selectedPresetId');
			// Update selection if presets were added or on initial load
			if (stored && presets.some(p => p.id === parseInt(stored))) {
				if (selectedPresetId !== stored) {
					selectedPresetId = stored;
				}
			}
			lastPresetsLength = presets.length;
		}
	});

	function handleSelectionChange(value: string) {
		selectedPresetId = value;
		if (value) {
			localStorage.setItem('selectedPresetId', value);
		} else {
			localStorage.removeItem('selectedPresetId');
		}
	}
</script>
	<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] p-6 mb-6">
		<label for="preset-selector" class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
			Load Preset
		</label>
		<div class="flex items-center gap-3">
			<select
				id="preset-selector"
				value={selectedPresetId}
				onchange={(e) => {
					const value = e.currentTarget.value;
					handleSelectionChange(value);
					const presetId = parseInt(value);
					if (presetId) {
						const preset = presets.find((p) => p.id === presetId);
						if (preset) onLoadPreset(preset);
					}
				}}
				class="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
			>
				<option value="" disabled>Select a preset...</option>
				{#each presets as preset}
					<option value={String(preset.id)}>
						{preset.name}
					</option>
				{/each}
			</select>
			<button
				onclick={() => {
					const presetId = parseInt(selectedPresetId);
					if (presetId) {
						onDeletePreset(presetId);
						handleSelectionChange('');
					}
				}}
				disabled={deletingPresetId !== null}
				class="px-4 py-3 text-[var(--error)] hover:bg-[var(--error)]/10 disabled:opacity-50 rounded-xl transition border border-[var(--error)]/30 hover:border-[var(--error)]/50"
				title="Delete selected preset"
			>
				{#if deletingPresetId !== null}
					<div
						class="w-5 h-5 border-2 border-[var(--error)] border-t-transparent rounded-full animate-spin"
					></div>
				{:else}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				{/if}
			</button>
		</div>
		<p class="text-xs text-[var(--text-muted)] mt-2">
			Select a preset to load its settings
		</p>
	</div>
