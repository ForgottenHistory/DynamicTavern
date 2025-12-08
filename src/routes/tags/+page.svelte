<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();

	let tagLibraryContent = $state('');
	let isSaving = $state(false);
	let isResetting = $state(false);
	let lastSaved = $state<Date | null>(null);
	let isLoading = $state(true);
	let selectedText = $state('');
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let containerRef: HTMLDivElement | null = null;

	// Load tag library on mount
	$effect(() => {
		loadTagLibrary();
	});

	// Calculate approximate token count (1 token ≈ 4 characters)
	function calculateTokens(): number {
		return Math.ceil(tagLibraryContent.length / 4);
	}

	async function loadTagLibrary() {
		try {
			isLoading = true;
			const response = await fetch('/api/tag-library');
			if (response.ok) {
				const library = await response.json();
				tagLibraryContent = library.content || '';
				if (library.updatedAt) {
					lastSaved = new Date(library.updatedAt);
				}
			}
		} catch (error) {
			console.error('Failed to load tag library:', error);
			showMessage('error', 'Failed to load tag library');
		} finally {
			isLoading = false;
		}
	}

	async function saveTagLibrary() {
		try {
			isSaving = true;
			const response = await fetch('/api/tag-library', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ content: tagLibraryContent })
			});

			if (response.ok) {
				const library = await response.json();
				lastSaved = new Date(library.updatedAt);
				showMessage('success', 'Tag library saved successfully!');
				// Scroll to top of container
				if (containerRef) {
					containerRef.scrollTo({ top: 0, behavior: 'smooth' });
				}
			} else {
				showMessage('error', 'Failed to save tag library');
			}
		} catch (error) {
			console.error('Failed to save tag library:', error);
			showMessage('error', 'Failed to save tag library');
		} finally {
			isSaving = false;
		}
	}

	async function resetToDefault() {
		if (!confirm('Are you sure you want to reset to default tags? This will replace all your current tags.')) {
			return;
		}

		try {
			isResetting = true;
			const response = await fetch('/api/tag-library/default');
			if (response.ok) {
				const data = await response.json();
				tagLibraryContent = data.content;

				// Save the default tags
				const saveResponse = await fetch('/api/tag-library', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content: tagLibraryContent })
				});

				if (saveResponse.ok) {
					const library = await saveResponse.json();
					lastSaved = new Date(library.updatedAt);
					showMessage('success', 'Reset to default tags and saved!');
				} else {
					showMessage('error', 'Failed to save default tags');
				}

				if (containerRef) {
					containerRef.scrollTo({ top: 0, behavior: 'smooth' });
				}
			} else {
				showMessage('error', 'Failed to load default tags');
			}
		} catch (error) {
			console.error('Failed to reset to default:', error);
			showMessage('error', 'Failed to reset to default tags');
		} finally {
			isResetting = false;
		}
	}

	function showMessage(type: 'success' | 'error', text: string) {
		message = { type, text };
		setTimeout(() => {
			message = null;
		}, 3000);
	}

	function formatLastSaved() {
		if (!lastSaved) return 'Never';
		const now = new Date();
		const diff = now.getTime() - lastSaved.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (seconds < 60) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return lastSaved.toLocaleDateString();
	}

	// Text selection tracking
	function handleTextSelection(event: Event) {
		const textarea = event.target as HTMLTextAreaElement;
		const selected = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
		selectedText = selected;
	}

	// Formatting utilities
	function formatToCommaSeparated() {
		if (!selectedText) {
			showMessage('error', 'Please select text to format');
			return;
		}

		const formatted = selectedText
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith('#'))
			.join(', ');

		replaceSelection(formatted);
		showMessage('success', 'Formatted to comma-separated');
	}

	function convertToLowercase() {
		if (!selectedText) {
			showMessage('error', 'Please select text to convert');
			return;
		}

		replaceSelection(selectedText.toLowerCase());
		showMessage('success', 'Converted to lowercase');
	}

	function removeDuplicates() {
		if (!selectedText) {
			showMessage('error', 'Please select comma-separated tags to deduplicate');
			return;
		}

		const tags = selectedText
			.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);

		const unique = [...new Set(tags)];
		const formatted = unique.join(', ');

		replaceSelection(formatted);
		showMessage('success', `Removed ${tags.length - unique.length} duplicates`);
	}

	function sortAlphabetically() {
		if (!selectedText) {
			showMessage('error', 'Please select comma-separated tags to sort');
			return;
		}

		const sorted = selectedText
			.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0)
			.sort()
			.join(', ');

		replaceSelection(sorted);
		showMessage('success', 'Sorted alphabetically');
	}

	function replaceSelection(newText: string) {
		const textarea = document.getElementById('tag-editor') as HTMLTextAreaElement;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		tagLibraryContent =
			tagLibraryContent.substring(0, start) + newText + tagLibraryContent.substring(end);

		// Reset selection after a small delay to allow DOM to update
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start, start + newText.length);
		}, 0);
	}
</script>

<svelte:head>
	<title>Tags | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/tags">
	<div bind:this={containerRef} class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-5xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Tag Library</h1>
				<p class="text-[var(--text-secondary)]">
					Manage your collection of tags for image generation
				</p>
			</div>

			<!-- Tag Library -->
			<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
					<div class="p-6">
						{#if isLoading}
							<!-- Loading State with Same Layout -->
							<div class="mb-6 p-4 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<div class="w-5 h-5 bg-[var(--accent-primary)]/30 rounded animate-pulse"></div>
										<span class="font-semibold text-[var(--accent-primary)]">Tag Library Tokens:</span>
										<span class="text-[var(--accent-primary)] font-mono">~0</span>
									</div>
									<div class="text-sm text-[var(--text-muted)]">
										Last saved: Never
									</div>
								</div>
							</div>

							<div class="mb-6 flex flex-wrap gap-3">
								<button disabled class="px-5 py-2.5 bg-[var(--accent-secondary)]/50 text-white rounded-xl text-sm font-medium shadow-md cursor-not-allowed">
									Lines → Comma-separated
								</button>
								<button disabled class="px-5 py-2.5 bg-[var(--accent-primary)]/50 text-white rounded-xl text-sm font-medium shadow-md cursor-not-allowed">
									Lowercase
								</button>
								<button disabled class="px-5 py-2.5 bg-amber-500/50 text-white rounded-xl text-sm font-medium shadow-md cursor-not-allowed">
									Remove Duplicates
								</button>
								<button disabled class="px-5 py-2.5 bg-[var(--success)]/50 text-white rounded-xl text-sm font-medium shadow-md cursor-not-allowed">
									Sort A-Z
								</button>
							</div>

							<div class="w-full h-[600px] px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl flex items-center justify-center">
								<div class="text-center">
									<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)] mx-auto mb-2"></div>
									<p class="text-[var(--text-muted)] text-sm">Loading...</p>
								</div>
							</div>

							<div class="mt-6 flex items-center gap-3">
								<button disabled class="px-8 py-3 bg-gradient-to-r from-[var(--accent-primary)]/50 to-[var(--accent-secondary)]/50 text-white font-semibold rounded-xl shadow-lg cursor-not-allowed">
									Save Settings
								</button>
								<button disabled class="px-8 py-3 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-xl font-semibold shadow-lg cursor-not-allowed">
									Reload
								</button>
							</div>
						{:else}
							<!-- Token Counter -->
							<div
								class="mb-6 p-4 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl"
							>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<svg
											class="w-5 h-5 text-[var(--accent-primary)]"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
											/>
										</svg>
										<span class="font-semibold text-[var(--accent-primary)]">Tag Library Tokens:</span>
										<span class="text-[var(--accent-primary)] font-mono">~{calculateTokens().toLocaleString()}</span>
									</div>
									<div class="text-sm text-[var(--text-muted)]">
										Last saved: {formatLastSaved()}
									</div>
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

							<!-- Formatting Tools -->
							<div class="mb-6 flex flex-wrap gap-3">
								<button
									onclick={formatToCommaSeparated}
									class="px-5 py-2.5 bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/80 text-white rounded-xl transition text-sm font-medium shadow-md hover:shadow-lg"
									title="Convert selected lines to comma-separated format"
								>
									Lines → Comma-separated
								</button>
								<button
									onclick={convertToLowercase}
									class="px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white rounded-xl transition text-sm font-medium shadow-md hover:shadow-lg"
									title="Convert selected text to lowercase"
								>
									Lowercase
								</button>
								<button
									onclick={removeDuplicates}
									class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition text-sm font-medium shadow-md hover:shadow-lg"
									title="Remove duplicate tags from selected comma-separated list"
								>
									Remove Duplicates
								</button>
								<button
									onclick={sortAlphabetically}
									class="px-5 py-2.5 bg-[var(--success)] hover:bg-[var(--success)]/80 text-white rounded-xl transition text-sm font-medium shadow-md hover:shadow-lg"
									title="Sort selected comma-separated tags alphabetically"
								>
									Sort A-Z
								</button>
							</div>

							<!-- Editor -->
							<textarea
								id="tag-editor"
								bind:value={tagLibraryContent}
								onselect={handleTextSelection}
								onmouseup={handleTextSelection}
								onkeyup={handleTextSelection}
								class="w-full h-[600px] px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-y font-mono text-sm"
								placeholder="Enter tags here... Examples:&#10;1girl, blonde hair, blue eyes&#10;fantasy, medieval, armor&#10;smile, happy, outdoors"
								spellcheck="false"
							></textarea>

							<!-- Action Buttons -->
							<div class="mt-6 flex items-center gap-3">
								<button
									onclick={saveTagLibrary}
									disabled={isSaving}
									class="px-8 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center gap-2"
								>
									{#if isSaving}
										<div
											class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
										></div>
										Saving...
									{:else}
										Save Settings
									{/if}
								</button>
								<button
									onclick={loadTagLibrary}
									disabled={isLoading || isSaving}
									class="px-8 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl transition font-semibold shadow-lg hover:shadow-xl border border-[var(--border-primary)]"
								>
									Reload
								</button>
								<button
									onclick={resetToDefault}
									disabled={isResetting || isSaving}
									class="px-8 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl transition font-semibold shadow-lg hover:shadow-xl flex items-center gap-2"
								>
									{#if isResetting}
										<div
											class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
										></div>
										Loading...
									{:else}
										Reset to Default
									{/if}
								</button>
							</div>

							<!-- Help Text -->
							<div
								class="mt-8 p-6 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl"
							>
								<h3 class="font-semibold text-[var(--accent-primary)] mb-3 text-lg">How to use:</h3>
								<ul class="text-sm text-[var(--accent-primary)]/80 space-y-2 list-disc list-inside">
									<li>Select text you want to format</li>
									<li>Click a formatting button to transform the selected text</li>
									<li>
										Use "Lines → Comma-separated" to convert newline-separated items to comma format
									</li>
									<li>Use "Lowercase" to normalize capitalization</li>
									<li>Use "Remove Duplicates" to clean up repeated tags</li>
									<li>Use "Sort A-Z" to alphabetically order tags</li>
									<li>Click "Save Settings" when done editing</li>
								</ul>
							</div>
						{/if}
					</div>
			</div>
		</div>
	</div>
</MainLayout>
