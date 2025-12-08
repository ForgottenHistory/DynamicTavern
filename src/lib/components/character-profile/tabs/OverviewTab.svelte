<script lang="ts">
	import type { Character } from '$lib/server/db/schema';
	import CollapsibleSection from '../CollapsibleSection.svelte';
	import { estimateTokens } from '$lib/utils/tokenCount';

	interface Props {
		character: Character;
		data: {
			description?: string;
			scenario?: string;
			personality?: string;
			creator_notes?: string;
			creator?: string;
			character_version?: string;
		};
		onSave: (field: string, value: string) => Promise<void>;
	}

	let { character, data, onSave }: Props = $props();

	let personalityExpanded = $state(false);
	let creatorNotesExpanded = $state(false);
	let metadataExpanded = $state(false);

	// Edit states
	let editingDescription = $state(false);
	let editingScenario = $state(false);
	let editingPersonality = $state(false);
	let editingCreatorNotes = $state(false);
	let editingCreator = $state(false);
	let editingVersion = $state(false);

	// Edited values
	let editedDescription = $state('');
	let editedScenario = $state('');
	let editedPersonality = $state('');
	let editedCreatorNotes = $state('');
	let editedCreator = $state('');
	let editedVersion = $state('');

	let saving = $state(false);

	// Copy states
	let copiedDescription = $state(false);
	let copiedScenario = $state(false);
	let copiedPersonality = $state(false);
	let copiedCreatorNotes = $state(false);

	async function copyField(field: 'description' | 'scenario' | 'personality' | 'creator_notes') {
		let content = '';
		switch (field) {
			case 'description':
				content = character.description || data.description || '';
				break;
			case 'scenario':
				content = data.scenario || '';
				break;
			case 'personality':
				content = data.personality || '';
				break;
			case 'creator_notes':
				content = data.creator_notes || '';
				break;
		}

		if (!content) return;

		try {
			await navigator.clipboard.writeText(content);
			switch (field) {
				case 'description':
					copiedDescription = true;
					setTimeout(() => (copiedDescription = false), 2000);
					break;
				case 'scenario':
					copiedScenario = true;
					setTimeout(() => (copiedScenario = false), 2000);
					break;
				case 'personality':
					copiedPersonality = true;
					setTimeout(() => (copiedPersonality = false), 2000);
					break;
				case 'creator_notes':
					copiedCreatorNotes = true;
					setTimeout(() => (copiedCreatorNotes = false), 2000);
					break;
			}
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	// Rewrite states
	let rewritingDescription = $state(false);
	let rewritingScenario = $state(false);
	let rewritingPersonality = $state(false);

	async function rewriteField(field: 'description' | 'scenario' | 'personality') {
		let input = '';
		switch (field) {
			case 'description':
				input = editingDescription ? editedDescription : (character.description || data.description || '');
				if (!input.trim()) return;
				rewritingDescription = true;
				break;
			case 'scenario':
				input = editingScenario ? editedScenario : (data.scenario || '');
				if (!input.trim()) return;
				rewritingScenario = true;
				break;
			case 'personality':
				input = editingPersonality ? editedPersonality : (data.personality || '');
				if (!input.trim()) return;
				rewritingPersonality = true;
				break;
		}

		try {
			const response = await fetch('/api/content/rewrite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: field, input })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Rewrite failed');
			}

			const { rewritten } = await response.json();

			// Put rewritten content into edit mode
			switch (field) {
				case 'description':
					editedDescription = rewritten;
					editingDescription = true;
					break;
				case 'scenario':
					editedScenario = rewritten;
					editingScenario = true;
					break;
				case 'personality':
					editedPersonality = rewritten;
					editingPersonality = true;
					personalityExpanded = true;
					break;
			}
		} catch (err: any) {
			console.error(`Failed to rewrite ${field}:`, err);
			alert(`Failed to rewrite: ${err.message}`);
		} finally {
			rewritingDescription = false;
			rewritingScenario = false;
			rewritingPersonality = false;
		}
	}

	function startEditing(field: string) {
		switch (field) {
			case 'description':
				editedDescription = character.description || data.description || '';
				editingDescription = true;
				break;
			case 'scenario':
				editedScenario = data.scenario || '';
				editingScenario = true;
				break;
			case 'personality':
				editedPersonality = data.personality || '';
				editingPersonality = true;
				personalityExpanded = true;
				break;
			case 'creator_notes':
				editedCreatorNotes = data.creator_notes || '';
				editingCreatorNotes = true;
				creatorNotesExpanded = true;
				break;
			case 'creator':
				editedCreator = data.creator || '';
				editingCreator = true;
				metadataExpanded = true;
				break;
			case 'character_version':
				editedVersion = data.character_version || '';
				editingVersion = true;
				metadataExpanded = true;
				break;
		}
	}

	async function saveField(field: string) {
		saving = true;
		try {
			let value = '';
			switch (field) {
				case 'description':
					value = editedDescription;
					break;
				case 'scenario':
					value = editedScenario;
					break;
				case 'personality':
					value = editedPersonality;
					break;
				case 'creator_notes':
					value = editedCreatorNotes;
					break;
				case 'creator':
					value = editedCreator;
					break;
				case 'character_version':
					value = editedVersion;
					break;
			}
			await onSave(field, value);
			// Close edit mode
			switch (field) {
				case 'description':
					editingDescription = false;
					break;
				case 'scenario':
					editingScenario = false;
					break;
				case 'personality':
					editingPersonality = false;
					break;
				case 'creator_notes':
					editingCreatorNotes = false;
					break;
				case 'creator':
					editingCreator = false;
					break;
				case 'character_version':
					editingVersion = false;
					break;
			}
		} finally {
			saving = false;
		}
	}

	function cancelEditing(field: string) {
		switch (field) {
			case 'description':
				editingDescription = false;
				break;
			case 'scenario':
				editingScenario = false;
				break;
			case 'personality':
				editingPersonality = false;
				break;
			case 'creator_notes':
				editingCreatorNotes = false;
				break;
			case 'creator':
				editingCreator = false;
				break;
			case 'character_version':
				editingVersion = false;
				break;
		}
	}
</script>

<div class="space-y-4">
	<h3 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Character Overview</h3>

	<!-- Description -->
	<div>
		<div class="flex items-center justify-between mb-2 group">
			<div class="flex items-center gap-2">
				<h4 class="text-sm font-medium text-[var(--text-secondary)]">Description</h4>
				<span class="text-xs text-[var(--text-muted)]">~{estimateTokens(editingDescription ? editedDescription : (character.description || data.description)).toLocaleString()} tokens</span>
			</div>
			{#if !editingDescription}
				<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
					{#if character.description || data.description}
					<button
						onclick={() => copyField('description')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedDescription}
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
						onclick={() => rewriteField('description')}
						disabled={rewritingDescription || !(character.description || data.description)}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewritingDescription}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
					<button
						onclick={() => startEditing('description')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit description"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
		{#if editingDescription}
			<div class="space-y-2">
				<textarea
					bind:value={editedDescription}
					rows="4"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					placeholder="Enter description..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={() => saveField('description')}
						disabled={saving}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={() => rewriteField('description')}
						disabled={rewritingDescription || !editedDescription.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewritingDescription}
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
						onclick={() => cancelEditing('description')}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if character.description || data.description}
			<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
				{character.description || data.description}
			</div>
		{:else}
			<p class="text-[var(--text-muted)] italic">No description available</p>
		{/if}
	</div>

	<!-- Scenario -->
	<div class="mt-6">
		<div class="flex items-center justify-between mb-2 group">
			<div class="flex items-center gap-2">
				<h4 class="text-sm font-medium text-[var(--text-secondary)]">Scenario</h4>
				<span class="text-xs text-[var(--text-muted)]">~{estimateTokens(editingScenario ? editedScenario : data.scenario).toLocaleString()} tokens</span>
			</div>
			{#if !editingScenario}
				<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
					{#if data.scenario}
					<button
						onclick={() => copyField('scenario')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedScenario}
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
						onclick={() => rewriteField('scenario')}
						disabled={rewritingScenario || !data.scenario}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewritingScenario}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
					<button
						onclick={() => startEditing('scenario')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit scenario"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
		{#if editingScenario}
			<div class="space-y-2">
				<textarea
					bind:value={editedScenario}
					rows="4"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					placeholder="Enter scenario..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={() => saveField('scenario')}
						disabled={saving}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={() => rewriteField('scenario')}
						disabled={rewritingScenario || !editedScenario.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewritingScenario}
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
						onclick={() => cancelEditing('scenario')}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if data.scenario}
			<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
				{data.scenario}
			</div>
		{:else}
			<p class="text-[var(--text-muted)] italic">No scenario available</p>
		{/if}
	</div>

	<!-- Collapsible: Personality -->
	<CollapsibleSection
		title="Personality"
		badge="~{estimateTokens(editingPersonality ? editedPersonality : data.personality).toLocaleString()} tokens"
		expanded={personalityExpanded}
		onToggle={() => (personalityExpanded = !personalityExpanded)}
	>
		{#if editingPersonality}
			<div class="space-y-2">
				<textarea
					bind:value={editedPersonality}
					rows="6"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					placeholder="Enter personality..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={() => saveField('personality')}
						disabled={saving}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={() => rewriteField('personality')}
						disabled={rewritingPersonality || !editedPersonality.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewritingPersonality}
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
						onclick={() => cancelEditing('personality')}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-2 group">
				<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed flex-1">
					{data.personality || 'No personality defined'}
				</div>
				<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
					{#if data.personality}
					<button
						onclick={() => copyField('personality')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedPersonality}
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
						onclick={() => rewriteField('personality')}
						disabled={rewritingPersonality || !data.personality}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewritingPersonality}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
					<button
						onclick={() => startEditing('personality')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit personality"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</CollapsibleSection>

	<!-- Collapsible: Creator Notes -->
	<CollapsibleSection
		title="Creator Notes"
		expanded={creatorNotesExpanded}
		onToggle={() => (creatorNotesExpanded = !creatorNotesExpanded)}
	>
		{#if editingCreatorNotes}
			<div class="space-y-2">
				<textarea
					bind:value={editedCreatorNotes}
					rows="6"
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"
					placeholder="Enter creator notes..."
				></textarea>
				<div class="flex gap-2">
					<button
						onclick={() => saveField('creator_notes')}
						disabled={saving}
						class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={() => cancelEditing('creator_notes')}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-start justify-between gap-2 group">
				<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed flex-1">
					{data.creator_notes || 'No creator notes available'}
				</div>
				<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
					{#if data.creator_notes}
					<button
						onclick={() => copyField('creator_notes')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copiedCreatorNotes}
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
						onclick={() => startEditing('creator_notes')}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						aria-label="Edit creator notes"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</CollapsibleSection>

	<!-- Collapsible: Metadata -->
	<CollapsibleSection
		title="Metadata"
		expanded={metadataExpanded}
		onToggle={() => (metadataExpanded = !metadataExpanded)}
	>
		<div class="space-y-4">
			<!-- Creator -->
			<div>
				{#if editingCreator}
					<div class="space-y-2">
						<label class="text-sm font-medium text-[var(--text-secondary)]">Creator</label>
						<input
							type="text"
							bind:value={editedCreator}
							class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
							placeholder="Enter creator name..."
						/>
						<div class="flex gap-2">
							<button
								onclick={() => saveField('creator')}
								disabled={saving}
								class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
							<button
								onclick={() => cancelEditing('creator')}
								class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between group">
						<div>
							<span class="text-sm font-medium text-[var(--text-secondary)]">Creator:</span>
							<span class="ml-2 text-sm text-[var(--text-primary)]">{data.creator || 'Not specified'}</span>
						</div>
						<button
							onclick={() => startEditing('creator')}
							class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
							aria-label="Edit creator"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
							</svg>
						</button>
					</div>
				{/if}
			</div>

			<!-- Version -->
			<div>
				{#if editingVersion}
					<div class="space-y-2">
						<label class="text-sm font-medium text-[var(--text-secondary)]">Version</label>
						<input
							type="text"
							bind:value={editedVersion}
							class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
							placeholder="Enter version..."
						/>
						<div class="flex gap-2">
							<button
								onclick={() => saveField('character_version')}
								disabled={saving}
								class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
							<button
								onclick={() => cancelEditing('character_version')}
								class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-between group">
						<div>
							<span class="text-sm font-medium text-[var(--text-secondary)]">Version:</span>
							<span class="ml-2 text-sm text-[var(--text-primary)]">{data.character_version || 'Not specified'}</span>
						</div>
						<button
							onclick={() => startEditing('character_version')}
							class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
							aria-label="Edit version"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
							</svg>
						</button>
					</div>
				{/if}
			</div>
		</div>
	</CollapsibleSection>
</div>
