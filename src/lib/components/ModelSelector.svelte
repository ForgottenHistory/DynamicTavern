<script lang="ts">
	interface Model {
		id: string;
		name: string;
		description: string;
		contextLength: number;
		pricing: any;
	}

	interface Props {
		selectedModel: string;
		provider?: string;
		onSelect: (modelId: string) => void;
	}

	let { selectedModel, provider = 'openrouter', onSelect }: Props = $props();

	let models = $state<Model[]>([]);
	let filteredModels = $state<Model[]>([]);
	let searchQuery = $state('');
	let isOpen = $state(false);
	let loading = $state(true);

	// Load models on mount and when provider changes
	$effect(() => {
		// Access provider to track it as a dependency
		const currentProvider = provider;
		loadModels(currentProvider);
	});

	// Filter models when search changes
	$effect(() => {
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filteredModels = models.filter(
				(m) =>
					m.id.toLowerCase().includes(query) ||
					m.name.toLowerCase().includes(query) ||
					m.description.toLowerCase().includes(query)
			);
		} else {
			filteredModels = models;
		}
	});

	async function loadModels(currentProvider: string) {
		loading = true;
		try {
			// Add timestamp to prevent caching issues
			const response = await fetch(`/api/llm/models?provider=${currentProvider}&_t=${Date.now()}`);
			const data = await response.json();
			models = data.models || [];
			filteredModels = models;
		} catch (error) {
			console.error('Failed to load models:', error);
		} finally {
			loading = false;
		}
	}

	function selectModel(modelId: string) {
		onSelect(modelId);
		isOpen = false;
		searchQuery = '';
	}

	function getModelName(modelId: string): string {
		const model = models.find((m) => m.id === modelId);
		return model?.name || modelId;
	}
</script>

<div class="relative">
	<!-- Selected Model Display -->
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="w-full px-4 py-2 text-left bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition"
	>
		<div class="flex items-center justify-between">
			<span class="text-sm text-[var(--text-primary)]">{getModelName(selectedModel)}</span>
			<svg
				class="w-5 h-5 text-[var(--text-muted)] transition-transform {isOpen ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</div>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg max-h-96 overflow-hidden"
		>
			<!-- Search Input -->
			<div class="p-3 border-b border-[var(--border-primary)]">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search models..."
					class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					autofocus
				/>
			</div>

			<!-- Models List -->
			<div class="overflow-y-auto max-h-80">
				{#if loading}
					<div class="p-4 text-center text-[var(--text-muted)]">Loading models...</div>
				{:else if filteredModels.length === 0}
					<div class="p-4 text-center text-[var(--text-muted)]">No models found</div>
				{:else}
					{#each filteredModels as model (model.id)}
						<button
							type="button"
							onclick={() => selectModel(model.id)}
							class="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] last:border-b-0 transition-colors {selectedModel ===
							model.id
								? 'bg-[var(--accent-primary)]/10'
								: ''}"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-[var(--text-primary)] truncate">
										{model.name}
									</div>
									<div class="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
										{model.description || model.id}
									</div>
									<div class="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
										<span>Context: {model.contextLength.toLocaleString()}</span>
									</div>
								</div>
								{#if selectedModel === model.id}
									<svg
										class="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 ml-2"
										fill="currentColor"
										viewBox="0 0 20 20"
									>
										<path
											fill-rule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
	<button
		type="button"
		class="fixed inset-0 z-0"
		onclick={() => (isOpen = false)}
		aria-label="Close model selector"
	></button>
{/if}
