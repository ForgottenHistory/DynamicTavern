<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	interface Lorebook {
		id: number;
		name: string;
		description: string | null;
		enabled: boolean;
		isGlobal: boolean;
		entryCount: number;
		enabledCount: number;
		createdAt: Date;
	}

	interface LorebookEntry {
		id: number;
		lorebookId: number;
		name: string;
		keywords: string[];
		content: string;
		enabled: boolean;
		caseSensitive: boolean;
		priority: number;
		createdAt: Date;
	}

	let lorebooks = $state<Lorebook[]>([]);
	let loading = $state(true);
	let selectedLorebook = $state<Lorebook | null>(null);
	let entries = $state<LorebookEntry[]>([]);
	let loadingEntries = $state(false);

	// Create/Edit lorebook modal
	let showLorebookModal = $state(false);
	let editingLorebook = $state<Lorebook | null>(null);
	let lorebookForm = $state({ name: '', description: '', isGlobal: false });
	let savingLorebook = $state(false);

	// Create/Edit entry modal
	let showEntryModal = $state(false);
	let editingEntry = $state<LorebookEntry | null>(null);
	let entryForm = $state({
		name: '',
		keywords: '',
		content: '',
		enabled: true,
		caseSensitive: false,
		priority: 0
	});
	let savingEntry = $state(false);

	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let importing = $state(false);

	onMount(() => {
		loadLorebooks();
	});

	async function handleImport(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importing = true;
		try {
			const text = await file.text();
			const data = JSON.parse(text);

			const response = await fetch('/api/lorebooks/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			const result = await response.json();

			if (response.ok) {
				message = { type: 'success', text: `Imported "${result.lorebook.name}" with ${result.importedCount} entries!` };
				await loadLorebooks();
				// Select the newly imported lorebook
				if (result.lorebook) {
					await selectLorebook(result.lorebook);
				}
				setTimeout(() => (message = null), 5000);
			} else {
				message = { type: 'error', text: result.error || 'Failed to import lorebook' };
			}
		} catch (error) {
			console.error('Import error:', error);
			message = { type: 'error', text: 'Failed to parse file. Make sure it\'s valid JSON.' };
		} finally {
			importing = false;
			input.value = '';
		}
	}

	async function loadLorebooks() {
		loading = true;
		try {
			const response = await fetch('/api/lorebooks');
			const data = await response.json();
			lorebooks = data.lorebooks || [];
		} catch (error) {
			console.error('Failed to load lorebooks:', error);
		} finally {
			loading = false;
		}
	}

	async function selectLorebook(lorebook: Lorebook) {
		selectedLorebook = lorebook;
		loadingEntries = true;
		try {
			const response = await fetch(`/api/lorebooks/${lorebook.id}`);
			const data = await response.json();
			entries = data.entries || [];
		} catch (error) {
			console.error('Failed to load entries:', error);
		} finally {
			loadingEntries = false;
		}
	}

	function openCreateLorebook() {
		editingLorebook = null;
		lorebookForm = { name: '', description: '', isGlobal: false };
		showLorebookModal = true;
	}

	function openEditLorebook(lorebook: Lorebook) {
		editingLorebook = lorebook;
		lorebookForm = {
			name: lorebook.name,
			description: lorebook.description || '',
			isGlobal: lorebook.isGlobal
		};
		showLorebookModal = true;
	}

	async function saveLorebook() {
		if (!lorebookForm.name.trim()) return;

		savingLorebook = true;
		try {
			const url = editingLorebook
				? `/api/lorebooks/${editingLorebook.id}`
				: '/api/lorebooks';
			const method = editingLorebook ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(lorebookForm)
			});

			if (response.ok) {
				showLorebookModal = false;
				await loadLorebooks();
				if (editingLorebook && selectedLorebook?.id === editingLorebook.id) {
					const updated = lorebooks.find((l) => l.id === editingLorebook!.id);
					if (updated) selectedLorebook = updated;
				}
				message = { type: 'success', text: `Lorebook ${editingLorebook ? 'updated' : 'created'}!` };
				setTimeout(() => (message = null), 3000);
			} else {
				const data = await response.json();
				message = { type: 'error', text: data.error || 'Failed to save lorebook' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to save lorebook' };
		} finally {
			savingLorebook = false;
		}
	}

	async function deleteLorebook(lorebook: Lorebook) {
		if (!confirm(`Delete "${lorebook.name}" and all its entries?`)) return;

		try {
			const response = await fetch(`/api/lorebooks/${lorebook.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				if (selectedLorebook?.id === lorebook.id) {
					selectedLorebook = null;
					entries = [];
				}
				await loadLorebooks();
				message = { type: 'success', text: 'Lorebook deleted!' };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: 'Failed to delete lorebook' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to delete lorebook' };
		}
	}

	function openCreateEntry() {
		if (!selectedLorebook) return;
		editingEntry = null;
		entryForm = {
			name: '',
			keywords: '',
			content: '',
			enabled: true,
			caseSensitive: false,
			priority: 0
		};
		showEntryModal = true;
	}

	function openEditEntry(entry: LorebookEntry) {
		editingEntry = entry;
		entryForm = {
			name: entry.name,
			keywords: entry.keywords.join(', '),
			content: entry.content,
			enabled: entry.enabled,
			caseSensitive: entry.caseSensitive,
			priority: entry.priority
		};
		showEntryModal = true;
	}

	async function saveEntry() {
		if (!selectedLorebook || !entryForm.name.trim() || !entryForm.keywords.trim() || !entryForm.content.trim()) return;

		savingEntry = true;
		try {
			const keywords = entryForm.keywords.split(',').map((k) => k.trim()).filter((k) => k);
			const url = editingEntry
				? `/api/lorebooks/${selectedLorebook.id}/entries/${editingEntry.id}`
				: `/api/lorebooks/${selectedLorebook.id}/entries`;
			const method = editingEntry ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: entryForm.name,
					keywords,
					content: entryForm.content,
					enabled: entryForm.enabled,
					caseSensitive: entryForm.caseSensitive,
					priority: entryForm.priority
				})
			});

			if (response.ok) {
				showEntryModal = false;
				await selectLorebook(selectedLorebook);
				await loadLorebooks();
				message = { type: 'success', text: `Entry ${editingEntry ? 'updated' : 'created'}!` };
				setTimeout(() => (message = null), 3000);
			} else {
				const data = await response.json();
				message = { type: 'error', text: data.error || 'Failed to save entry' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to save entry' };
		} finally {
			savingEntry = false;
		}
	}

	async function deleteEntry(entry: LorebookEntry) {
		if (!selectedLorebook || !confirm(`Delete entry "${entry.name}"?`)) return;

		try {
			const response = await fetch(`/api/lorebooks/${selectedLorebook.id}/entries/${entry.id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await selectLorebook(selectedLorebook);
				await loadLorebooks();
				message = { type: 'success', text: 'Entry deleted!' };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: 'Failed to delete entry' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to delete entry' };
		}
	}

	async function toggleEntryEnabled(entry: LorebookEntry) {
		if (!selectedLorebook) return;

		try {
			const response = await fetch(`/api/lorebooks/${selectedLorebook.id}/entries/${entry.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !entry.enabled })
			});

			if (response.ok) {
				entry.enabled = !entry.enabled;
				entries = [...entries];
				await loadLorebooks();
			}
		} catch (error) {
			console.error('Failed to toggle entry:', error);
		}
	}

	async function toggleLorebookEnabled(lorebook: Lorebook, event: Event) {
		event.stopPropagation();

		try {
			const response = await fetch(`/api/lorebooks/${lorebook.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !lorebook.enabled })
			});

			if (response.ok) {
				lorebook.enabled = !lorebook.enabled;
				lorebooks = [...lorebooks];
				if (selectedLorebook?.id === lorebook.id) {
					selectedLorebook = { ...selectedLorebook, enabled: lorebook.enabled };
				}
			}
		} catch (error) {
			console.error('Failed to toggle lorebook:', error);
		}
	}
</script>

<svelte:head>
	<title>Lorebooks | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/lorebooks">
	<div class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-7xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="flex items-center justify-between mb-6">
				<div>
					<h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Lorebooks</h1>
					<p class="text-[var(--text-secondary)]">
						Create world info entries that inject context based on keywords
					</p>
				</div>
				<div class="flex items-center gap-2">
					<label
						class="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium rounded-xl hover:bg-[var(--bg-tertiary)] transition flex items-center gap-2 cursor-pointer {importing ? 'opacity-50 pointer-events-none' : ''}"
					>
						{#if importing}
							<div class="w-5 h-5 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
							</svg>
						{/if}
						Import
						<input
							type="file"
							accept=".json"
							onchange={handleImport}
							class="hidden"
							disabled={importing}
						/>
					</label>
					<button
						onclick={openCreateLorebook}
						class="px-4 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium rounded-xl hover:opacity-90 transition flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						New Lorebook
					</button>
				</div>
			</div>

			<!-- Message -->
			{#if message}
				<div
					class="mb-6 p-4 rounded-xl border {message.type === 'success'
						? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
						: 'bg-[var(--error)]/10 border-[var(--error)]/30 text-[var(--error)]'}"
				>
					{message.text}
				</div>
			{/if}

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Lorebooks List -->
				<div class="lg:col-span-1">
					<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
						<div class="p-4 border-b border-[var(--border-primary)]">
							<h2 class="text-lg font-semibold text-[var(--text-primary)]">Your Lorebooks</h2>
						</div>
						<div class="divide-y divide-[var(--border-primary)]">
							{#if loading}
								<div class="p-8 text-center text-[var(--text-muted)]">Loading...</div>
							{:else if lorebooks.length === 0}
								<div class="p-8 text-center text-[var(--text-muted)]">
									<svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
									</svg>
									<p>No lorebooks yet</p>
									<p class="text-sm mt-1">Create one to get started</p>
								</div>
							{:else}
								{#each lorebooks as lorebook}
									<div
										onclick={() => selectLorebook(lorebook)}
										onkeydown={(e) => e.key === 'Enter' && selectLorebook(lorebook)}
										role="button"
										tabindex="0"
										class="w-full text-left p-4 hover:bg-[var(--bg-tertiary)] transition cursor-pointer {selectedLorebook?.id === lorebook.id ? 'bg-[var(--bg-tertiary)]' : ''} {!lorebook.enabled ? 'opacity-60' : ''}"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-3">
												<!-- Enable/Disable Toggle -->
												<button
													onclick={(e) => toggleLorebookEnabled(lorebook, e)}
													class="p-1 rounded transition {lorebook.enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}"
													title={lorebook.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}
												>
													<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
														{#if lorebook.enabled}
															<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
														{:else}
															<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
														{/if}
													</svg>
												</button>
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2">
														<span class="font-medium text-[var(--text-primary)] truncate">{lorebook.name}</span>
														{#if lorebook.isGlobal}
															<span class="px-2 py-0.5 text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-full">Global</span>
														{/if}
													</div>
													<div class="text-sm text-[var(--text-muted)] mt-1">
														{lorebook.enabledCount}/{lorebook.entryCount} entries enabled
													</div>
												</div>
											</div>
											<div class="flex items-center gap-1 ml-2">
												<button
													onclick={(e) => { e.stopPropagation(); openEditLorebook(lorebook); }}
													class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
													title="Edit"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
													</svg>
												</button>
												<button
													onclick={(e) => { e.stopPropagation(); deleteLorebook(lorebook); }}
													class="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition"
													title="Delete"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<!-- Entries Panel -->
				<div class="lg:col-span-2">
					{#if selectedLorebook}
						<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
							<div class="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
								<div>
									<h2 class="text-lg font-semibold text-[var(--text-primary)]">{selectedLorebook.name}</h2>
									{#if selectedLorebook.description}
										<p class="text-sm text-[var(--text-muted)] mt-1">{selectedLorebook.description}</p>
									{/if}
								</div>
								<button
									onclick={openCreateEntry}
									class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition flex items-center gap-1"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
									</svg>
									Add Entry
								</button>
							</div>

							{#if loadingEntries}
								<div class="p-8 text-center text-[var(--text-muted)]">Loading entries...</div>
							{:else if entries.length === 0}
								<div class="p-8 text-center text-[var(--text-muted)]">
									<svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									<p>No entries yet</p>
									<p class="text-sm mt-1">Add entries with keywords to trigger context injection</p>
								</div>
							{:else}
								<div class="divide-y divide-[var(--border-primary)]">
									{#each entries as entry}
										<div class="p-4 hover:bg-[var(--bg-tertiary)]/50 transition">
											<div class="flex items-start justify-between gap-4">
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 mb-2">
														<button
															onclick={() => toggleEntryEnabled(entry)}
															class="p-1 rounded transition {entry.enabled ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}"
															title={entry.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}
														>
															<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
																{#if entry.enabled}
																	<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
																{:else}
																	<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
																{/if}
															</svg>
														</button>
														<span class="font-medium text-[var(--text-primary)] {!entry.enabled ? 'opacity-50' : ''}">{entry.name}</span>
														{#if entry.caseSensitive}
															<span class="px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded">Case Sensitive</span>
														{/if}
														{#if entry.priority !== 0}
															<span class="px-1.5 py-0.5 text-xs bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">Priority: {entry.priority}</span>
														{/if}
													</div>
													<div class="flex flex-wrap gap-1 mb-2">
														{#each entry.keywords as keyword}
															<span class="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full">{keyword}</span>
														{/each}
													</div>
													<p class="text-sm text-[var(--text-muted)] line-clamp-2 {!entry.enabled ? 'opacity-50' : ''}">{entry.content}</p>
												</div>
												<div class="flex items-center gap-1">
													<button
														onclick={() => openEditEntry(entry)}
														class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
														title="Edit"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
														</svg>
													</button>
													<button
														onclick={() => deleteEntry(entry)}
														class="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition"
														title="Delete"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
														</svg>
													</button>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] p-8 text-center text-[var(--text-muted)]">
							<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
							</svg>
							<p class="text-lg">Select a lorebook to view entries</p>
							<p class="text-sm mt-2">Or create a new one to get started</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<!-- Lorebook Modal -->
{#if showLorebookModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => (showLorebookModal = false)}>
		<div class="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-md mx-4 border border-[var(--border-primary)]" onclick={(e) => e.stopPropagation()}>
			<div class="p-6 border-b border-[var(--border-primary)]">
				<h3 class="text-xl font-semibold text-[var(--text-primary)]">
					{editingLorebook ? 'Edit Lorebook' : 'Create Lorebook'}
				</h3>
			</div>
			<div class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
					<input
						type="text"
						bind:value={lorebookForm.name}
						placeholder="My Lorebook"
						class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description (optional)</label>
					<textarea
						bind:value={lorebookForm.description}
						placeholder="What is this lorebook for?"
						rows="2"
						class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					></textarea>
				</div>
				<label class="flex items-center gap-3 cursor-pointer">
					<input type="checkbox" bind:checked={lorebookForm.isGlobal} class="w-5 h-5 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]" />
					<div>
						<span class="font-medium text-[var(--text-primary)]">Global Lorebook</span>
						<p class="text-sm text-[var(--text-muted)]">Apply to all character conversations</p>
					</div>
				</label>
			</div>
			<div class="p-6 border-t border-[var(--border-primary)] flex justify-end gap-3">
				<button
					onclick={() => (showLorebookModal = false)}
					class="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition"
				>
					Cancel
				</button>
				<button
					onclick={saveLorebook}
					disabled={savingLorebook || !lorebookForm.name.trim()}
					class="px-4 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
				>
					{#if savingLorebook}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{editingLorebook ? 'Save Changes' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Entry Modal -->
{#if showEntryModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => (showEntryModal = false)}>
		<div class="bg-[var(--bg-secondary)] rounded-xl shadow-2xl w-full max-w-2xl mx-4 border border-[var(--border-primary)] max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<div class="p-6 border-b border-[var(--border-primary)]">
				<h3 class="text-xl font-semibold text-[var(--text-primary)]">
					{editingEntry ? 'Edit Entry' : 'Create Entry'}
				</h3>
			</div>
			<div class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
					<input
						type="text"
						bind:value={entryForm.name}
						placeholder="Entry name for organization"
						class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Keywords (comma-separated)</label>
					<input
						type="text"
						bind:value={entryForm.keywords}
						placeholder="keyword1, keyword2, keyword3"
						class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					/>
					<p class="text-xs text-[var(--text-muted)] mt-1">When these words appear in conversation, this entry's content will be injected</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Content</label>
					<textarea
						bind:value={entryForm.content}
						placeholder="The lore/world info content to inject into context..."
						rows="6"
						class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-y font-mono text-sm"
					></textarea>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Priority</label>
						<input
							type="number"
							bind:value={entryForm.priority}
							class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
						/>
						<p class="text-xs text-[var(--text-muted)] mt-1">Higher priority entries are inserted first</p>
					</div>
					<div class="space-y-3 pt-7">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={entryForm.enabled} class="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--accent-primary)]" />
							<span class="text-sm text-[var(--text-primary)]">Enabled</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={entryForm.caseSensitive} class="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--accent-primary)]" />
							<span class="text-sm text-[var(--text-primary)]">Case Sensitive</span>
						</label>
					</div>
				</div>
			</div>
			<div class="p-6 border-t border-[var(--border-primary)] flex justify-end gap-3">
				<button
					onclick={() => (showEntryModal = false)}
					class="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition"
				>
					Cancel
				</button>
				<button
					onclick={saveEntry}
					disabled={savingEntry || !entryForm.name.trim() || !entryForm.keywords.trim() || !entryForm.content.trim()}
					class="px-4 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
				>
					{#if savingEntry}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{editingEntry ? 'Save Changes' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}
