<script lang="ts">
	import { estimateTokens } from '$lib/utils/tokenCount';

	interface Props {
		greetings: string[];
		originalGreetings?: string[];
		onSave: (greetings: string[]) => Promise<void>;
	}

	let { greetings, originalGreetings, onSave }: Props = $props();

	// Edit state
	let editingIndex = $state<number | null>(null);
	let editValue = $state('');

	// Operation states
	let savingIndex = $state<number | null>(null);
	let deletingIndex = $state<number | null>(null);
	let adding = $state(false);
	let copiedIndex = $state<number | null>(null);
	let rewritingIndex = $state<number | null>(null);
	let resettingIndex = $state<number | null>(null);

	// Check if a greeting can be reset (differs from original)
	function canReset(index: number): boolean {
		if (!originalGreetings || index >= originalGreetings.length) return false;
		return greetings[index] !== originalGreetings[index];
	}

	async function resetGreeting(index: number) {
		if (!originalGreetings || index >= originalGreetings.length) return;
		resettingIndex = index;
		try {
			const updated = [...greetings];
			updated[index] = originalGreetings[index];
			await onSave(updated);
		} finally {
			resettingIndex = null;
		}
	}

	function startEditing(index: number) {
		editValue = greetings[index] || '';
		editingIndex = index;
	}

	async function save() {
		if (editingIndex === null) return;
		savingIndex = editingIndex;
		try {
			const updated = [...greetings];
			updated[editingIndex] = editValue;
			await onSave(updated);
			editingIndex = null;
			editValue = '';
		} finally {
			savingIndex = null;
		}
	}

	function cancel() {
		editingIndex = null;
		editValue = '';
	}

	async function addGreeting() {
		adding = true;
		try {
			const updated = [...greetings, ''];
			await onSave(updated);
			// Start editing the new greeting
			editValue = '';
			editingIndex = updated.length - 1;
		} finally {
			adding = false;
		}
	}

	async function deleteGreeting(index: number) {
		deletingIndex = index;
		try {
			const updated = [...greetings];
			updated.splice(index, 1);
			await onSave(updated);
			// Reset edit state if needed
			if (editingIndex === index) {
				editingIndex = null;
				editValue = '';
			} else if (editingIndex !== null && editingIndex > index) {
				editingIndex = editingIndex - 1;
			}
		} finally {
			deletingIndex = null;
		}
	}

	async function copy(index: number) {
		const content = greetings[index];
		if (!content) return;
		try {
			await navigator.clipboard.writeText(content);
			copiedIndex = index;
			setTimeout(() => (copiedIndex = null), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	async function rewrite(index: number) {
		const input = editingIndex === index ? editValue : greetings[index];
		if (!input?.trim()) return;

		rewritingIndex = index;
		try {
			const response = await fetch('/api/content/rewrite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'greeting', input })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Rewrite failed');
			}

			const { rewritten } = await response.json();
			if (rewritten) {
				editValue = rewritten;
				editingIndex = index;
			}
		} catch (err: any) {
			console.error('Failed to rewrite:', err);
			alert(`Failed to rewrite: ${err.message}`);
		} finally {
			rewritingIndex = null;
		}
	}
</script>

<div class="space-y-3">
	{#if greetings.length > 0}
		{#each greetings as greeting, index}
			<div class="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg">
				<div class="flex items-center justify-between mb-2 group">
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium text-[var(--text-muted)]">Greeting {index + 2}</span>
						<span class="text-xs text-[var(--text-muted)]">
							~{estimateTokens(editingIndex === index ? editValue : greeting).toLocaleString()} tokens
						</span>
					</div>
					{#if editingIndex !== index}
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
							{#if greeting}
								<button
									onclick={() => copy(index)}
									class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
									title="Copy to clipboard"
								>
									{#if copiedIndex === index}
										<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
										</svg>
									{:else}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
									{/if}
								</button>
							{/if}
							<button
								onclick={() => rewrite(index)}
								disabled={rewritingIndex === index || !greeting}
								class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
								title="Rewrite with AI"
							>
								{#if rewritingIndex === index}
									<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
								{/if}
							</button>
							{#if canReset(index)}
								<button
									onclick={() => resetGreeting(index)}
									disabled={resettingIndex === index}
									class="p-1.5 text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-[var(--warning)]/10 rounded-lg transition disabled:opacity-50"
									title="Reset to original"
								>
									{#if resettingIndex === index}
										<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
									{:else}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
										</svg>
									{/if}
								</button>
							{/if}
							<button
								onclick={() => startEditing(index)}
								class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
								aria-label="Edit greeting {index + 2}"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
								</svg>
							</button>
							<button
								onclick={() => deleteGreeting(index)}
								disabled={deletingIndex === index}
								class="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition disabled:opacity-50"
								aria-label="Delete greeting {index + 2}"
							>
								{#if deletingIndex === index}
									<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								{/if}
							</button>
						</div>
					{/if}
				</div>
				{#if editingIndex === index}
					<div class="space-y-2">
						<textarea
							bind:value={editValue}
							rows={6}
							class="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
							placeholder="Enter greeting..."
						></textarea>
						<div class="flex gap-2">
							<button
								onclick={save}
								disabled={savingIndex === index}
								class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
							>
								{savingIndex === index ? 'Saving...' : 'Save'}
							</button>
							<button
								onclick={() => rewrite(index)}
								disabled={rewritingIndex === index || !editValue.trim()}
								class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
							>
								{#if rewritingIndex === index}
									<div class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
									Rewriting...
								{:else}
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
									</svg>
									Rewrite
								{/if}
							</button>
							<button
								onclick={cancel}
								disabled={savingIndex === index}
								class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
						{greeting || '(Empty greeting)'}
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		<p class="text-[var(--text-muted)] italic">No alternate greetings available</p>
	{/if}

	<!-- Add Greeting Button -->
	<button
		onclick={addGreeting}
		disabled={adding}
		class="w-full p-3 border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition flex items-center justify-center gap-2 disabled:opacity-50"
	>
		{#if adding}
			<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
			Adding...
		{:else}
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Add Greeting
		{/if}
	</button>
</div>
