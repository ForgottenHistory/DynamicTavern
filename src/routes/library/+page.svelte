<script lang="ts">
	import type { PageData } from './$types';
	import type { Character } from '$lib/server/db/schema';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import CharacterProfile from '$lib/components/CharacterProfile.svelte';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	let characters = $state<Character[]>([]);
	let loading = $state(true);
	let stats = $state({ total: 0, presets: 0 });
	let selectedCharacter = $state<Character | null>(null);
	let hoveredCharacterId = $state<number | null>(null);
	let deletingCharacterId = $state<number | null>(null);
	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchInputRef = $state<HTMLInputElement | null>(null);
	let viewMode = $state<'grid' | 'compact'>('grid');

	let filteredCharacters = $derived(
		searchQuery.trim()
			? characters.filter(c =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(c.description?.toLowerCase().includes(searchQuery.toLowerCase()))
			)
			: characters
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

	onMount(() => {
		loadCharacters();
	});

	async function loadCharacters() {
		loading = true;
		try {
			const [charactersRes, presetsRes] = await Promise.all([
				fetch('/api/characters'),
				fetch('/api/llm-presets')
			]);

			const charactersData = await charactersRes.json();
			const presetsData = await presetsRes.json();

			characters = charactersData.characters || [];
			stats.total = characters.length;
			stats.presets = presetsData.presets?.length || 0;
		} catch (error) {
			console.error('Failed to load characters:', error);
		} finally {
			loading = false;
		}
	}

	async function handleUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;

		if (!files || files.length === 0) return;

		const formData = new FormData();
		for (let i = 0; i < files.length; i++) {
			formData.append('files', files[i]);
		}

		try {
			const response = await fetch('/api/characters/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok) {
				alert(
					`Successfully imported ${result.success.length} character(s)` +
						(result.failed.length > 0
							? `\n\nFailed: ${result.failed.length}`
							: '')
				);
				loadCharacters();
				window.dispatchEvent(new CustomEvent('characterUpdated'));
			} else {
				alert(result.error || 'Upload failed');
			}
		} catch (error) {
			alert('Upload failed: ' + error);
		}

		// Reset input
		input.value = '';
	}

	async function handleDelete(characterId: number, characterName: string, event: Event) {
		event.stopPropagation();

		if (!confirm(`Delete ${characterName}?`)) return;

		deletingCharacterId = characterId;
		try {
			const response = await fetch(`/api/characters/${characterId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				loadCharacters();
				window.dispatchEvent(new CustomEvent('characterUpdated'));
			} else {
				alert('Failed to delete character');
			}
		} catch (error) {
			alert('Failed to delete character');
		} finally {
			deletingCharacterId = null;
		}
	}
</script>

<svelte:head>
	<title>Library | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/library">
	<div class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-7xl mx-auto px-8 py-8">
			<!-- Stats -->
			<div class="grid grid-cols-2 gap-4 mb-8">
				<div class="bg-[var(--bg-secondary)] rounded-xl p-6 shadow-md border border-[var(--border-primary)]">
					<div class="text-3xl font-bold text-[var(--accent-primary)] mb-1">{stats.total}</div>
					<div class="text-[var(--text-secondary)]">Total Characters</div>
				</div>
				<div class="bg-[var(--bg-secondary)] rounded-xl p-6 shadow-md border border-[var(--border-primary)]">
					<div class="text-3xl font-bold text-[var(--accent-secondary)] mb-1">{stats.presets}</div>
					<div class="text-[var(--text-secondary)]">LLM Presets</div>
				</div>
			</div>

			<!-- Upload Section -->
			<div class="mb-8">
				<h2 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Add Characters</h2>

				<div class="bg-[var(--bg-secondary)] rounded-xl p-6 shadow-md border border-[var(--border-primary)]">
					<h3 class="text-lg font-semibold text-[var(--text-primary)] mb-3">Import Character Cards</h3>
					<p class="text-sm text-[var(--text-secondary)] mb-4">
						Upload PNG character cards (v2 format). You can upload multiple files at once.
					</p>

					<label
						class="block w-full p-8 border-2 border-dashed border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition cursor-pointer text-center"
					>
						<svg
							class="w-12 h-12 mx-auto mb-4 text-[var(--text-muted)]"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						<p class="text-[var(--text-primary)] font-medium mb-1">Click to upload or drag and drop</p>
						<p class="text-sm text-[var(--text-muted)]">PNG character cards</p>
						<input
							type="file"
							accept=".png"
							multiple
							class="hidden"
							onchange={handleUpload}
						/>
					</label>
				</div>
			</div>

			<!-- Characters Grid -->
			<div class="flex items-center gap-4 mb-4">
				<h2 class="text-xl font-semibold text-[var(--text-primary)]">
					Your Characters ({stats.total})
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

			{#if loading}
				<div class="text-center py-16">
					<div
						class="w-16 h-16 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"
					></div>
					<p class="text-[var(--text-secondary)]">Loading characters...</p>
				</div>
			{:else if characters.length === 0}
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
					<p class="text-[var(--text-muted)] text-sm">Upload some character cards to get started!</p>
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
						<div
							class="relative group cursor-pointer"
							onmouseenter={() => (hoveredCharacterId = character.id)}
							onmouseleave={() => (hoveredCharacterId = null)}
							onclick={() => (selectedCharacter = character)}
							role="button"
							tabindex="0"
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

								<!-- Delete button (shows on hover) -->
								{#if hoveredCharacterId === character.id || deletingCharacterId === character.id}
									<button
										onclick={(e) => handleDelete(character.id, character.name, e)}
										disabled={deletingCharacterId === character.id}
										class="absolute top-2 left-2 bg-[var(--error)] hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors disabled:opacity-50"
										aria-label="Delete character"
									>
										{#if deletingCharacterId === character.id}
											<div
												class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
											></div>
										{:else}
											<svg
												class="w-5 h-5"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										{/if}
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Compact View -->
				<div class="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
					{#each filteredCharacters as character, index}
						<div
							class="group flex items-center gap-4 p-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition {index !== filteredCharacters.length - 1 ? 'border-b border-[var(--border-primary)]' : ''}"
							onclick={() => (selectedCharacter = character)}
							onmouseenter={() => (hoveredCharacterId = character.id)}
							onmouseleave={() => (hoveredCharacterId = null)}
							role="button"
							tabindex="0"
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

							<!-- Actions -->
							<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
								<a
									href="/chat/{character.id}"
									onclick={(e) => e.stopPropagation()}
									class="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition"
									title="Start chat"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
									</svg>
								</a>
								<button
									onclick={(e) => handleDelete(character.id, character.name, e)}
									disabled={deletingCharacterId === character.id}
									class="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-secondary)] rounded-lg transition disabled:opacity-50"
									title="Delete character"
								>
									{#if deletingCharacterId === character.id}
										<div class="w-5 h-5 border-2 border-[var(--error)] border-t-transparent rounded-full animate-spin"></div>
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
										</svg>
									{/if}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Character Profile Modal -->
	<CharacterProfile
		character={selectedCharacter}
		onClose={() => (selectedCharacter = null)}
		onUpdate={loadCharacters}
	/>
</MainLayout>
