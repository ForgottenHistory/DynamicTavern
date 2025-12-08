<script lang="ts">
	interface Props {
		imageData: string | null;
		imagePreview: string | null;
		characterName: string;
	}

	let { imageData, imagePreview, characterName }: Props = $props();
</script>

<div class="relative w-72 flex-shrink-0 bg-[var(--bg-tertiary)]">
	{#if imagePreview || imageData}
		<img
			src={imagePreview || imageData}
			alt={characterName}
			class="w-full h-full object-cover"
		/>
	{:else}
		<div class="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
			<svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
				/>
			</svg>
		</div>
	{/if}
	<!-- Soft edge overlays for smooth transition -->
	<div class="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--bg-secondary)] to-transparent"></div>
	<div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--bg-secondary)]/80 to-transparent"></div>
	<div class="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--bg-secondary)]/60 to-transparent"></div>
</div>
