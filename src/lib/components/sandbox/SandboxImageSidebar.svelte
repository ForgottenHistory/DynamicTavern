<script lang="ts">
	import type { SandboxImageRow } from '../../../routes/sandbox/[sessionId]/sandboxActions';

	interface Props {
		images: SandboxImageRow[];
		onDelete: (imageId: number) => void;
	}

	let { images, onDelete }: Props = $props();

	function handleDelete(image: SandboxImageRow) {
		if (!confirm(`Delete this image of ${image.characterName}?`)) return;
		onDelete(image.id);
	}
</script>

<div class="w-80 flex-shrink-0 border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-y-auto">
	<div class="p-4 border-b border-[var(--border-primary)]">
		<h2 class="text-lg font-semibold text-[var(--text-primary)]">Scene Images</h2>
		<p class="text-xs text-[var(--text-muted)] mt-1">Generated as the Game Master directs</p>
	</div>

	{#if images.length === 0}
		<div class="p-4">
			<p class="text-xs text-[var(--text-muted)] italic">No images yet. The Game Master will request images as the scene unfolds.</p>
		</div>
	{:else}
		<div class="p-3 space-y-3">
			{#each images as image (image.id)}
				<div class="group relative bg-[var(--bg-tertiary)] rounded-lg overflow-hidden border border-[var(--border-primary)]">
					<button
						onclick={() => handleDelete(image)}
						class="absolute top-2 right-2 z-10 p-1.5 opacity-0 group-hover:opacity-100 bg-black/60 text-white/80 hover:text-red-400 hover:bg-black/80 rounded transition"
						title="Delete image"
						aria-label="Delete image"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
					{#if image.status === 'ready' && image.imagePath}
						<img
							src={`/api/sandbox/images/${image.id}`}
							alt={image.characterName}
							class="w-full h-auto block"
							loading="lazy"
						/>
					{:else if image.status === 'pending'}
						<div class="aspect-[2/3] flex flex-col items-center justify-center gap-2 p-4">
							<div class="animate-spin rounded-full h-6 w-6 border-2 border-[var(--accent-primary)] border-t-transparent"></div>
							<p class="text-xs text-[var(--text-muted)]">Generating…</p>
						</div>
					{:else}
						<div class="aspect-[2/3] flex items-center justify-center p-4">
							<p class="text-xs text-red-400 text-center">
								Generation failed{image.error ? `: ${image.error}` : ''}
							</p>
						</div>
					{/if}
					<div class="px-3 py-2">
						<p class="text-sm font-medium text-[var(--text-primary)]">{image.characterName}</p>
						{#if image.reason}
							<p class="text-xs text-[var(--text-muted)] mt-0.5">{image.reason}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
