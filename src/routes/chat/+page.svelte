<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchInputRef = $state<HTMLInputElement | null>(null);
	let viewMode = $state<'grid' | 'compact'>('grid');

	let filteredCharacters = $derived(
		searchQuery.trim()
			? data.characters.filter(c =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(c.description?.toLowerCase().includes(searchQuery.toLowerCase()))
			)
			: data.characters
	);

	function startSearch() {
		isSearching = true;
		setTimeout(() => searchInputRef?.focus(), 0);
	}

	function endSearch() {
		if (!searchQuery.trim()) {
			isSearching = false;
		}
	}

	function clearSearch() {
		searchQuery = '';
		isSearching = false;
	}
</script>

<svelte:head>
	<title>Start a Chat | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/chat">
	<div class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-7xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-8">
				<h1 class="text-2xl font-bold text-[var(--text-primary)] mb-2">Start a Chat</h1>
				<p class="text-[var(--text-muted)]">Select a character to begin a conversation</p>
			</div>

			<!-- Characters Section -->
			<div class="flex items-center gap-4 mb-4">
				<h2 class="text-xl font-semibold text-[var(--text-primary)]">
					Characters ({data.characters.length})
				</h2>

				<!-- Search Button / Expandable Search Bar -->
				{#if isSearching}
					<div class="relative w-64 transition-all">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
						</svg>
						<input
							bind:this={searchInputRef}
							type="text"
							bind:value={searchQuery}
							onblur={endSearch}
							onkeydown={(e) => e.key === 'Escape' && clearSearch()}
							placeholder="Search characters..."
							class="w-full pl-10 pr-8 py-2 bg-[var(--bg-secondary)] border border-[var(--accent-primary)]/30 rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition"
						/>
						<button
							onmousedown={(e) => e.preventDefault()}
							onclick={clearSearch}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
							aria-label="Clear search"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						</button>
					</div>
				{:else}
					<button
						onclick={startSearch}
						class="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition"
						title="Search characters"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
						</svg>
					</button>
				{/if}

				<!-- View Mode Toggle -->
				<div class="flex items-center bg-[var(--bg-secondary)] rounded-lg p-1 border border-[var(--border-primary)]">
					<button
						onclick={() => viewMode = 'grid'}
						class="p-1.5 rounded transition {viewMode === 'grid' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
						title="Grid view"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
						</svg>
					</button>
					<button
						onclick={() => viewMode = 'compact'}
						class="p-1.5 rounded transition {viewMode === 'compact' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
						title="Compact view"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
						</svg>
					</button>
				</div>
			</div>

			{#if data.characters.length === 0}
				<div class="text-center py-16 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
					<svg
						class="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
					<p class="text-[var(--text-primary)] font-semibold mb-1">No characters yet</p>
					<p class="text-[var(--text-muted)] text-sm mb-4">Import a character from the Library to get started</p>
					<a
						href="/library"
						class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium rounded-xl hover:opacity-90 transition"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
						</svg>
						Go to Library
					</a>
				</div>
			{:else if filteredCharacters.length === 0}
				<div class="text-center py-16 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
					<svg class="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<p class="text-[var(--text-primary)] font-semibold mb-1">No matches found</p>
					<p class="text-[var(--text-muted)] text-sm">Try a different search term</p>
				</div>
			{:else if viewMode === 'grid'}
				<!-- Grid View -->
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{#each filteredCharacters as character}
						<a
							href="/chat/{character.id}"
							class="relative group cursor-pointer"
						>
							<div
								class="aspect-[3/4] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow bg-[var(--bg-tertiary)]"
							>
								<!-- Character Image -->
								{#if character.imageData}
									<img
										src={character.imageData}
										alt={character.name}
										class="w-full h-full object-cover"
									/>
								{:else}
									<div
										class="w-full h-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center"
									>
										<svg class="w-16 h-16 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
												clip-rule="evenodd"
											/>
										</svg>
									</div>
								{/if}

								<!-- Hover Overlay with info -->
								<div
									class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<div class="absolute bottom-0 left-0 right-0 p-4">
										<h3 class="text-white font-bold text-lg mb-1">{character.name}</h3>
										{#if character.description}
											<p class="text-white/90 text-sm line-clamp-2">
												{character.description}
											</p>
										{/if}
									</div>
								</div>

								<!-- Chat icon on hover -->
								<div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
									<div class="p-2 bg-[var(--accent-primary)] text-white rounded-full shadow-lg">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
										</svg>
									</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<!-- Compact View -->
				<div class="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
					{#each filteredCharacters as character, index}
						<a
							href="/chat/{character.id}"
							class="group flex items-center gap-4 p-3 hover:bg-[var(--bg-tertiary)] transition {index !== filteredCharacters.length - 1 ? 'border-b border-[var(--border-primary)]' : ''}"
						>
							<!-- Avatar -->
							<div class="flex-shrink-0">
								{#if character.thumbnailData || character.imageData}
									<img
										src={character.thumbnailData || character.imageData}
										alt={character.name}
										class="w-12 h-16 rounded-lg object-cover"
									/>
								{:else}
									<div class="w-12 h-16 rounded-lg bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center">
										<span class="text-lg font-bold text-[var(--accent-primary)]">{character.name.charAt(0).toUpperCase()}</span>
									</div>
								{/if}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-[var(--text-primary)] truncate">{character.name}</h3>
								{#if character.description}
									<p class="text-sm text-[var(--text-muted)] truncate">{character.description}</p>
								{/if}
							</div>

							<!-- Chat icon -->
							<div class="flex items-center opacity-0 group-hover:opacity-100 transition">
								<div class="p-2 text-[var(--accent-primary)]">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
									</svg>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>
