<script lang="ts">
	import type { Character } from '$lib/server/db/schema';

	interface Props {
		character: Character;
		show: boolean;
		onToggle: (show: boolean) => void;
	}

	let { character, show, onToggle }: Props = $props();
</script>

{#if show}
	<div class="relative w-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-primary)] hidden lg:block group transition-all duration-300">
		{#if character.imageData}
			<img
				src={character.imageData}
				alt={character.name}
				class="w-full h-full object-cover object-center"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
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
		<!-- Top gradient fade -->
		<div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/40 via-black/20 to-transparent"></div>
		<!-- Side gradient for blending -->
		<div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--bg-primary)]/20"></div>
		<!-- Subtle vignette -->
		<div class="absolute inset-0" style="box-shadow: inset 0 0 80px rgba(0,0,0,0.15)"></div>

		<!-- Hide button (top right, shows on hover) -->
		<button
			onclick={() => onToggle(false)}
			class="absolute top-3 right-3 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-all opacity-0 group-hover:opacity-100"
			title="Hide character image"
		>
			<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
			</svg>
		</button>

		<!-- Character name overlay at bottom -->
		<div class="absolute bottom-0 left-0 right-0 h-24">
			<!-- Blur layer with gradual fade -->
			<div class="absolute inset-0 backdrop-blur-sm" style="mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%); -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)"></div>
			<!-- Dark gradient -->
			<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
			<!-- Name text -->
			<div class="absolute bottom-4 left-4 right-4">
				<h2 class="text-lg font-bold text-white drop-shadow-lg">{character.name}</h2>
			</div>
		</div>
	</div>
{:else}
	<!-- Show Image Button (when hidden) -->
	<button
		onclick={() => onToggle(true)}
		class="w-12 flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg hover:bg-[var(--bg-tertiary)] transition-all hidden lg:flex items-center justify-center"
		title="Show character image"
	>
		<svg class="w-6 h-6 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
		</svg>
	</button>
{/if}
