<script lang="ts">
	interface Props {
		name: string;
		tags: string[];
		saving: boolean;
		onNameSave: (name: string) => Promise<void>;
		onTagsSave: (tags: string[]) => Promise<void>;
		onClose: () => void;
	}

	let { name, tags, saving, onNameSave, onTagsSave, onClose }: Props = $props();

	let editingName = $state(false);
	let editingTags = $state(false);
	let editedName = $state('');
	let editedTags = $state('');

	function startEditingName() {
		editedName = name;
		editingName = true;
	}

	function startEditingTags() {
		editedTags = tags.join(', ');
		editingTags = true;
	}

	async function saveName() {
		if (!editedName.trim()) return;
		await onNameSave(editedName.trim());
		editingName = false;
	}

	async function saveTags() {
		const newTags = editedTags
			.split(',')
			.map(t => t.trim())
			.filter(t => t.length > 0);
		await onTagsSave(newTags);
		editingTags = false;
	}
</script>

<div class="p-5 border-b border-[var(--border-primary)] flex items-start justify-between gap-4">
	<div class="min-w-0 flex-1">
		<!-- Editable Name -->
		{#if editingName}
			<div class="flex items-center gap-2 mb-2">
				<input
					type="text"
					bind:value={editedName}
					class="flex-1 text-xl font-bold bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					onkeydown={(e) => e.key === 'Enter' && saveName()}
				/>
				<button
					onclick={saveName}
					disabled={saving}
					class="p-1.5 text-[var(--success)] hover:bg-[var(--success)]/10 rounded-lg transition"
					aria-label="Save name"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</button>
				<button
					onclick={() => (editingName = false)}
					class="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
					aria-label="Cancel"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{:else}
			<div class="flex items-center gap-2 mb-2 group">
				<h2 class="text-2xl font-bold text-[var(--text-primary)] truncate">{name}</h2>
				<button
					onclick={startEditingName}
					class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
					aria-label="Edit name"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Editable Tags -->
		{#if editingTags}
			<div class="flex items-center gap-2">
				<input
					type="text"
					bind:value={editedTags}
					placeholder="tag1, tag2, tag3"
					class="flex-1 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					onkeydown={(e) => e.key === 'Enter' && saveTags()}
				/>
				<button
					onclick={saveTags}
					disabled={saving}
					class="p-1.5 text-[var(--success)] hover:bg-[var(--success)]/10 rounded-lg transition"
					aria-label="Save tags"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</button>
				<button
					onclick={() => (editingTags = false)}
					class="p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
					aria-label="Cancel"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{:else}
			<div class="flex items-center gap-2 group">
				{#if tags && tags.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each tags as tag}
							<span
								class="px-2 py-0.5 bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] rounded-full text-xs font-medium"
							>
								{tag}
							</span>
						{/each}
					</div>
				{:else}
					<span class="text-sm text-[var(--text-muted)] italic">No tags</span>
				{/if}
				<button
					onclick={startEditingTags}
					class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
					aria-label="Edit tags"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
	<button
		onclick={onClose}
		class="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition flex-shrink-0"
		aria-label="Close"
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M6 18L18 6M6 6l12 12"
			/>
		</svg>
	</button>
</div>
