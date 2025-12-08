<script lang="ts">
	import ModelSelector from '$lib/components/ModelSelector.svelte';

	interface LLMSettings {
		provider: string;
		model: string;
		temperature: number;
		maxTokens: number;
		topP: number;
		frequencyPenalty: number;
		presencePenalty: number;
		contextWindow: number;
		reasoningEnabled?: boolean;
		// Featherless-specific parameters
		topK?: number;
		minP?: number;
		repetitionPenalty?: number;
	}

	let {
		settings = $bindable(),
		saving = false,
		onSave,
		onSavePreset,
		onReload
	}: {
		settings: LLMSettings;
		saving?: boolean;
		onSave: () => void;
		onSavePreset?: () => void;
		onReload: () => void;
	} = $props();
</script>

<form
	class="p-6 space-y-6"
	onsubmit={(e) => {
		e.preventDefault();
		onSave();
	}}
>
	<!-- Provider Selection -->
	<div>
		<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Provider</label>
		<select
			bind:value={settings.provider}
			class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
		>
			<option value="openrouter">OpenRouter</option>
			<option value="featherless">Featherless</option>
		</select>
	</div>

	<!-- Model Selection -->
	<div>
		<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Model</label>
		<ModelSelector
			selectedModel={settings.model}
			provider={settings.provider}
			onSelect={(modelId) => (settings.model = modelId)}
		/>
	</div>

	<!-- Temperature -->
	<div>
		<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
			Temperature: {settings.temperature}
		</label>
		<input
			type="range"
			bind:value={settings.temperature}
			min="0"
			max="2"
			step="0.1"
			class="w-full accent-[var(--accent-primary)]"
		/>
		<p class="text-xs text-[var(--text-muted)] mt-1">
			Higher values make output more random, lower values more deterministic
		</p>
	</div>

	<!-- Max Tokens -->
	<div>
		<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Max Tokens</label>
		<input
			type="number"
			bind:value={settings.maxTokens}
			min="50"
			max="4000"
			step="50"
			class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
		/>
		<p class="text-xs text-[var(--text-muted)] mt-1">Maximum length of generated responses</p>
	</div>

	<!-- Context Window -->
	<div>
		<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Context Window</label>
		<input
			type="number"
			bind:value={settings.contextWindow}
			min="1000"
			max="200000"
			step="1000"
			class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
		/>
		<p class="text-xs text-[var(--text-muted)] mt-1">Total tokens available for context</p>
	</div>

	<!-- Reasoning (OpenRouter only) -->
	{#if settings.provider === 'openrouter'}
		<div class="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl">
			<div>
				<label class="block text-sm font-medium text-[var(--text-primary)]">Extended Thinking</label>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					Enable reasoning for models that support it (OpenRouter)
				</p>
			</div>
			<label class="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					checked={settings.reasoningEnabled ?? false}
					onchange={(e) => settings.reasoningEnabled = e.currentTarget.checked}
					class="sr-only peer"
				/>
				<div class="w-11 h-6 bg-[var(--bg-secondary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-primary)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
			</label>
		</div>
	{/if}

	<!-- Featherless-specific Settings -->
	{#if settings.provider === 'featherless'}
		<div class="border border-[var(--border-primary)] rounded-xl p-4 space-y-4">
			<h3 class="font-medium text-[var(--text-primary)]">Featherless Parameters</h3>

			<!-- Top K -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Top K: {settings.topK ?? -1}
				</label>
				<input
					type="range"
					bind:value={settings.topK}
					min="-1"
					max="100"
					step="1"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					Limits tokens to top K most likely (-1 = disabled)
				</p>
			</div>

			<!-- Min P -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Min P: {(settings.minP ?? 0).toFixed(2)}
				</label>
				<input
					type="range"
					bind:value={settings.minP}
					min="0"
					max="1"
					step="0.01"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					Minimum probability threshold for tokens (0 = disabled)
				</p>
			</div>

			<!-- Repetition Penalty -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Repetition Penalty: {(settings.repetitionPenalty ?? 1.0).toFixed(2)}
				</label>
				<input
					type="range"
					bind:value={settings.repetitionPenalty}
					min="1"
					max="2"
					step="0.05"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					Penalize repeated tokens (1.0 = no penalty)
				</p>
			</div>
		</div>
	{/if}

	<!-- Advanced Settings -->
	<details class="border border-[var(--border-primary)] rounded-xl">
		<summary
			class="px-4 py-3 cursor-pointer font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl"
		>
			Advanced Settings
		</summary>
		<div class="px-4 py-4 space-y-4 border-t border-[var(--border-primary)]">
			<!-- Top P -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Top P: {settings.topP}
				</label>
				<input
					type="range"
					bind:value={settings.topP}
					min="0"
					max="1"
					step="0.05"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">Nucleus sampling threshold</p>
			</div>

			<!-- Frequency Penalty -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Frequency Penalty: {settings.frequencyPenalty}
				</label>
				<input
					type="range"
					bind:value={settings.frequencyPenalty}
					min="0"
					max="2"
					step="0.1"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">
					Penalize repeated tokens based on frequency
				</p>
			</div>

			<!-- Presence Penalty -->
			<div>
				<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
					Presence Penalty: {settings.presencePenalty}
				</label>
				<input
					type="range"
					bind:value={settings.presencePenalty}
					min="0"
					max="2"
					step="0.1"
					class="w-full accent-[var(--accent-primary)]"
				/>
				<p class="text-xs text-[var(--text-muted)] mt-1">Penalize tokens that appear at all</p>
			</div>
		</div>
	</details>

	<!-- Save Buttons -->
	<div class="flex items-center gap-3">
		<button
			type="submit"
			disabled={saving}
			class="px-8 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center gap-2"
		>
			{#if saving}
				<div
					class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
				></div>
				Saving...
			{:else}
				Save Settings
			{/if}
		</button>
		{#if onSavePreset}
			<button
				type="button"
				onclick={onSavePreset}
				class="px-8 py-3 bg-[var(--success)] hover:bg-[var(--success)]/80 text-white rounded-xl transition font-semibold shadow-lg hover:shadow-xl"
			>
				Save as Preset
			</button>
		{/if}
		<button
			type="button"
			onclick={onReload}
			disabled={saving}
			class="px-8 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl transition font-semibold shadow-lg hover:shadow-xl border border-[var(--border-primary)]"
		>
			Reload
		</button>
	</div>
</form>
