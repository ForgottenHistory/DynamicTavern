<script lang="ts">
	import CollapsibleSection from '../CollapsibleSection.svelte';
	import { estimateTokens } from '$lib/utils/tokenCount';

	interface Props {
		data: {
			first_mes?: string;
			mes_example?: string;
			alternate_greetings?: string[];
		};
		onSave: (field: string, value: string | string[]) => Promise<void>;
	}

	let { data, onSave }: Props = $props();

	let mesExampleExpanded = $state(false);
	let alternateGreetingsExpanded = $state(false);

	// Edit states
	let editingFirstMes = $state(false);
	let editingMesExample = $state(false);
	let editingGreetingIndex = $state<number | null>(null);

	// Edit values
	let editFirstMes = $state('');
	let editMesExample = $state('');
	let editGreeting = $state('');

	// Saving states
	let savingFirstMes = $state(false);
	let savingMesExample = $state(false);
	let savingGreeting = $state(false);
	let addingGreeting = $state(false);
	let deletingGreetingIndex = $state<number | null>(null);

	// Copy states
	let copiedFirstMes = $state(false);
	let copiedMesExample = $state(false);
	let copiedGreetingIndex = $state<number | null>(null);

	async function copyField(field: 'first_mes' | 'mes_example' | 'greeting', index?: number) {
		let content = '';
		switch (field) {
			case 'first_mes':
				content = data.first_mes || '';
				break;
			case 'mes_example':
				content = data.mes_example || '';
				break;
			case 'greeting':
				content = data.alternate_greetings?.[index!] || '';
				break;
		}

		if (!content) return;

		try {
			await navigator.clipboard.writeText(content);
			switch (field) {
				case 'first_mes':
					copiedFirstMes = true;
					setTimeout(() => (copiedFirstMes = false), 2000);
					break;
				case 'mes_example':
					copiedMesExample = true;
					setTimeout(() => (copiedMesExample = false), 2000);
					break;
				case 'greeting':
					copiedGreetingIndex = index!;
					setTimeout(() => (copiedGreetingIndex = null), 2000);
					break;
			}
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	// Rewrite states
	let rewritingFirstMes = $state(false);
	let rewritingMesExample = $state(false);
	let rewritingGreetingIndex = $state<number | null>(null);

	async function rewriteContent(type: 'greeting' | 'message_example', input: string, greetingIndex?: number) {
		if (!input.trim()) return;

		try {
			const response = await fetch('/api/content/rewrite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, input })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Rewrite failed');
			}

			const { rewritten } = await response.json();
			return rewritten;
		} catch (err: any) {
			console.error(`Failed to rewrite:`, err);
			alert(`Failed to rewrite: ${err.message}`);
			return null;
		}
	}

	async function rewriteFirstMes() {
		const input = editingFirstMes ? editFirstMes : (data.first_mes || '');
		if (!input.trim()) return;

		rewritingFirstMes = true;
		try {
			const rewritten = await rewriteContent('greeting', input);
			if (rewritten) {
				editFirstMes = rewritten;
				editingFirstMes = true;
			}
		} finally {
			rewritingFirstMes = false;
		}
	}

	async function rewriteMesExample() {
		const input = editingMesExample ? editMesExample : (data.mes_example || '');
		if (!input.trim()) return;

		rewritingMesExample = true;
		try {
			const rewritten = await rewriteContent('message_example', input);
			if (rewritten) {
				editMesExample = rewritten;
				editingMesExample = true;
				mesExampleExpanded = true;
			}
		} finally {
			rewritingMesExample = false;
		}
	}

	async function rewriteGreeting(index: number) {
		const input = editingGreetingIndex === index ? editGreeting : (data.alternate_greetings?.[index] || '');
		if (!input.trim()) return;

		rewritingGreetingIndex = index;
		try {
			const rewritten = await rewriteContent('greeting', input);
			if (rewritten) {
				editGreeting = rewritten;
				editingGreetingIndex = index;
				alternateGreetingsExpanded = true;
			}
		} finally {
			rewritingGreetingIndex = null;
		}
	}

	function startEditingFirstMes() {
		editFirstMes = data.first_mes || '';
		editingFirstMes = true;
	}

	function startEditingMesExample() {
		editMesExample = data.mes_example || '';
		editingMesExample = true;
		mesExampleExpanded = true;
	}

	function startEditingGreeting(index: number) {
		editGreeting = data.alternate_greetings?.[index] || '';
		editingGreetingIndex = index;
		alternateGreetingsExpanded = true;
	}

	async function saveFirstMes() {
		savingFirstMes = true;
		try {
			await onSave('first_mes', editFirstMes);
			editingFirstMes = false;
		} catch (err) {
			console.error('Failed to save first message:', err);
		} finally {
			savingFirstMes = false;
		}
	}

	async function saveMesExample() {
		savingMesExample = true;
		try {
			await onSave('mes_example', editMesExample);
			editingMesExample = false;
		} catch (err) {
			console.error('Failed to save message example:', err);
		} finally {
			savingMesExample = false;
		}
	}

	async function saveGreeting() {
		if (editingGreetingIndex === null) return;
		savingGreeting = true;
		try {
			const updatedGreetings = [...(data.alternate_greetings || [])];
			updatedGreetings[editingGreetingIndex] = editGreeting;
			await onSave('alternate_greetings', updatedGreetings);
			editingGreetingIndex = null;
		} catch (err) {
			console.error('Failed to save greeting:', err);
		} finally {
			savingGreeting = false;
		}
	}

	function cancelEdit(field: 'first_mes' | 'mes_example' | 'greeting') {
		if (field === 'first_mes') {
			editingFirstMes = false;
			editFirstMes = '';
		} else if (field === 'mes_example') {
			editingMesExample = false;
			editMesExample = '';
		} else if (field === 'greeting') {
			editingGreetingIndex = null;
			editGreeting = '';
		}
	}

	async function addGreeting() {
		addingGreeting = true;
		try {
			const updatedGreetings = [...(data.alternate_greetings || []), ''];
			await onSave('alternate_greetings', updatedGreetings);
			// Start editing the new greeting
			alternateGreetingsExpanded = true;
			editGreeting = '';
			editingGreetingIndex = updatedGreetings.length - 1;
		} catch (err) {
			console.error('Failed to add greeting:', err);
		} finally {
			addingGreeting = false;
		}
	}

	async function deleteGreeting(index: number) {
		deletingGreetingIndex = index;
		try {
			const updatedGreetings = [...(data.alternate_greetings || [])];
			updatedGreetings.splice(index, 1);
			await onSave('alternate_greetings', updatedGreetings);
			// Reset edit state if we were editing this greeting
			if (editingGreetingIndex === index) {
				editingGreetingIndex = null;
				editGreeting = '';
			} else if (editingGreetingIndex !== null && editingGreetingIndex > index) {
				// Adjust index if we were editing a later greeting
				editingGreetingIndex = editingGreetingIndex - 1;
			}
		} catch (err) {
			console.error('Failed to delete greeting:', err);
		} finally {
			deletingGreetingIndex = null;
		}
	}
</script>

<div class="space-y-4">
	<h3 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Character Messages</h3>

	<!-- First Message (always visible) -->
	<div>
		<div class="flex items-center justify-between mb-2 group">
			<div class="flex items-center gap-2">
				<h4 class="text-sm font-medium text-[var(--text-secondary)]">First Message</h4>
				<span class="text-xs text-[var(--text-muted)]">~{estimateTokens(editingFirstMes ? editFirstMes : data.first_mes).toLocaleString()} tokens</span>
			</div>
			{#if !editingFirstMes}
				<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
					{#if data.first_mes}
					<button
						onclick={() => copyField('first_mes')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedFirstMes}
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
						onclick={rewriteFirstMes}
						disabled={rewritingFirstMes || !data.first_mes}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewritingFirstMes}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
					<button
						onclick={startEditingFirstMes}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit first message"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
		{#if editingFirstMes}
			<div class="space-y-2">
				<textarea
					bind:value={editFirstMes}
					rows="8"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					placeholder="Enter first message..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={saveFirstMes}
						disabled={savingFirstMes}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{savingFirstMes ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={rewriteFirstMes}
						disabled={rewritingFirstMes || !editFirstMes.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewritingFirstMes}
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
						onclick={() => cancelEdit('first_mes')}
						disabled={savingFirstMes}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if data.first_mes}
			<div
				class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)]"
			>
				{data.first_mes}
			</div>
		{:else}
			<p class="text-[var(--text-muted)] italic">No first message available</p>
		{/if}
	</div>

	<!-- Collapsible: Message Example -->
	<CollapsibleSection
		title="Message Example"
		badge="~{estimateTokens(editingMesExample ? editMesExample : data.mes_example).toLocaleString()} tokens"
		expanded={mesExampleExpanded}
		onToggle={() => (mesExampleExpanded = !mesExampleExpanded)}
	>
		{#if editingMesExample}
			<div class="space-y-2">
				<textarea
					bind:value={editMesExample}
					rows="12"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none font-mono text-sm"
					placeholder="Enter message example..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={saveMesExample}
						disabled={savingMesExample}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{savingMesExample ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={rewriteMesExample}
						disabled={rewritingMesExample || !editMesExample.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewritingMesExample}
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
						onclick={() => cancelEdit('mes_example')}
						disabled={savingMesExample}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-2 group">
				<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed font-mono text-sm flex-1">
					{data.mes_example || 'No message example available'}
				</div>
				<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
					{#if data.mes_example}
					<button
						onclick={() => copyField('mes_example')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedMesExample}
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
						onclick={rewriteMesExample}
						disabled={rewritingMesExample || !data.mes_example}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewritingMesExample}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
					<button
						onclick={startEditingMesExample}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit message example"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</CollapsibleSection>

	<!-- Collapsible: Alternate Greetings -->
	<CollapsibleSection
		title="Alternate Greetings"
		badge={data.alternate_greetings?.length || 0}
		expanded={alternateGreetingsExpanded}
		onToggle={() => (alternateGreetingsExpanded = !alternateGreetingsExpanded)}
	>
		<div class="space-y-3">
			{#if data.alternate_greetings && data.alternate_greetings.length > 0}
				{#each data.alternate_greetings as greeting, index}
					<div class="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg">
						<div class="flex items-center justify-between mb-2 group">
							<div class="flex items-center gap-2">
								<span class="text-xs font-medium text-[var(--text-muted)]">Greeting {index + 2}</span>
								<span class="text-xs text-[var(--text-muted)]">~{estimateTokens(editingGreetingIndex === index ? editGreeting : greeting).toLocaleString()} tokens</span>
							</div>
							{#if editingGreetingIndex !== index}
								<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
									{#if greeting}
									<button
										onclick={() => copyField('greeting', index)}
										class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
										title="Copy to clipboard"
									>
										{#if copiedGreetingIndex === index}
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
										onclick={() => rewriteGreeting(index)}
										disabled={rewritingGreetingIndex === index || !greeting}
										class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
										title="Rewrite with AI"
									>
										{#if rewritingGreetingIndex === index}
											<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
											</svg>
										{/if}
									</button>
									<button
										onclick={() => startEditingGreeting(index)}
										class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
										aria-label="Edit greeting {index + 2}"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
										</svg>
									</button>
									<button
										onclick={() => deleteGreeting(index)}
										disabled={deletingGreetingIndex === index}
										class="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition disabled:opacity-50"
										aria-label="Delete greeting {index + 2}"
									>
										{#if deletingGreetingIndex === index}
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
						{#if editingGreetingIndex === index}
							<div class="space-y-2">
								<textarea
									bind:value={editGreeting}
									rows="6"
									class="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
									placeholder="Enter greeting..."
								></textarea>
								<div class="flex gap-2">
									<button
										onclick={saveGreeting}
										disabled={savingGreeting}
										class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
									>
										{savingGreeting ? 'Saving...' : 'Save'}
									</button>
									<button
										onclick={() => rewriteGreeting(index)}
										disabled={rewritingGreetingIndex === index || !editGreeting.trim()}
										class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
									>
										{#if rewritingGreetingIndex === index}
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
										onclick={() => cancelEdit('greeting')}
										disabled={savingGreeting}
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
				disabled={addingGreeting}
				class="w-full p-3 border-2 border-dashed border-[var(--border-primary)] hover:border-[var(--accent-primary)] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition flex items-center justify-center gap-2 disabled:opacity-50"
			>
				{#if addingGreeting}
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
	</CollapsibleSection>
</div>
