<script lang="ts">
	import type { Character } from '$lib/server/db/schema';
	import CollapsibleSection from '../CollapsibleSection.svelte';
	import EditableTextField from '../EditableTextField.svelte';
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
		originalData?: {
			description?: string;
			scenario?: string;
			personality?: string;
			creator_notes?: string;
			creator?: string;
			character_version?: string;
		} | null;
		onSave: (field: string, value: string) => Promise<void>;
	}

	let { character, data, originalData, onSave }: Props = $props();

	// Section expansion states
	let personalityExpanded = $state(false);
	let creatorNotesExpanded = $state(false);
	let metadataExpanded = $state(false);

	// Rewrite states
	let rewritingDescription = $state(false);
	let rewritingScenario = $state(false);
	let rewritingPersonality = $state(false);

	// References to editable fields for setting values after rewrite
	let descriptionField: EditableTextField;
	let scenarioField: EditableTextField;
	let personalityField: EditableTextField;

	async function rewriteField(field: 'description' | 'scenario' | 'personality', currentValue: string): Promise<string | null> {
		if (!currentValue.trim()) return null;

		try {
			const response = await fetch('/api/content/rewrite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: field, input: currentValue })
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Rewrite failed');
			}

			const { rewritten } = await response.json();
			return rewritten;
		} catch (err: any) {
			console.error(`Failed to rewrite ${field}:`, err);
			alert(`Failed to rewrite: ${err.message}`);
			return null;
		}
	}

	async function handleRewriteDescription() {
		const currentValue = character.description || data.description || '';
		if (!currentValue.trim()) return;

		rewritingDescription = true;
		try {
			const rewritten = await rewriteField('description', currentValue);
			if (rewritten) {
				descriptionField?.setEditValue(rewritten);
			}
		} finally {
			rewritingDescription = false;
		}
	}

	async function handleRewriteScenario() {
		const currentValue = data.scenario || '';
		if (!currentValue.trim()) return;

		rewritingScenario = true;
		try {
			const rewritten = await rewriteField('scenario', currentValue);
			if (rewritten) {
				scenarioField?.setEditValue(rewritten);
			}
		} finally {
			rewritingScenario = false;
		}
	}

	async function handleRewritePersonality() {
		const currentValue = data.personality || '';
		if (!currentValue.trim()) return;

		rewritingPersonality = true;
		try {
			const rewritten = await rewriteField('personality', currentValue);
			if (rewritten) {
				personalityField?.setEditValue(rewritten);
				personalityExpanded = true;
			}
		} finally {
			rewritingPersonality = false;
		}
	}

	// Computed values
	let descriptionValue = $derived(character.description || data.description || '');
	let scenarioValue = $derived(data.scenario || '');
	let personalityValue = $derived(data.personality || '');
	let creatorNotesValue = $derived(data.creator_notes || '');
	let creatorValue = $derived(data.creator || '');
	let versionValue = $derived(data.character_version || '');

	// Original values for reset functionality
	let originalDescription = $derived(originalData?.description);
	let originalScenario = $derived(originalData?.scenario);
	let originalPersonality = $derived(originalData?.personality);
	let originalCreatorNotes = $derived(originalData?.creator_notes);
	let originalCreator = $derived(originalData?.creator);
	let originalVersion = $derived(originalData?.character_version);
</script>

<div class="space-y-4">
	<h3 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Character Overview</h3>

	<!-- Description -->
	<EditableTextField
		bind:this={descriptionField}
		label="Description"
		value={descriptionValue}
		originalValue={originalDescription}
		showTokenCount={true}
		showRewrite={true}
		rewriting={rewritingDescription}
		onSave={(value) => onSave('description', value)}
		onRewrite={handleRewriteDescription}
	/>

	<!-- Scenario -->
	<div class="mt-6">
		<EditableTextField
			bind:this={scenarioField}
			label="Scenario"
			value={scenarioValue}
			originalValue={originalScenario}
			showTokenCount={true}
			showRewrite={true}
			rewriting={rewritingScenario}
			onSave={(value) => onSave('scenario', value)}
			onRewrite={handleRewriteScenario}
		/>
	</div>

	<!-- Collapsible: Personality -->
	<CollapsibleSection
		title="Personality"
		badge="~{estimateTokens(personalityValue).toLocaleString()} tokens"
		expanded={personalityExpanded}
		onToggle={() => (personalityExpanded = !personalityExpanded)}
	>
		<EditableTextField
			bind:this={personalityField}
			label="Personality"
			value={personalityValue}
			originalValue={originalPersonality}
			rows={6}
			showTokenCount={false}
			showRewrite={true}
			rewriting={rewritingPersonality}
			onSave={(value) => onSave('personality', value)}
			onRewrite={handleRewritePersonality}
		/>
	</CollapsibleSection>

	<!-- Collapsible: Creator Notes -->
	<CollapsibleSection
		title="Creator Notes"
		expanded={creatorNotesExpanded}
		onToggle={() => (creatorNotesExpanded = !creatorNotesExpanded)}
	>
		<EditableTextField
			label="Creator Notes"
			value={creatorNotesValue}
			originalValue={originalCreatorNotes}
			rows={6}
			onSave={(value) => onSave('creator_notes', value)}
		/>
	</CollapsibleSection>

	<!-- Collapsible: Metadata -->
	<CollapsibleSection
		title="Metadata"
		expanded={metadataExpanded}
		onToggle={() => (metadataExpanded = !metadataExpanded)}
	>
		<div class="space-y-4">
			<EditableTextField
				label="Creator"
				value={creatorValue}
				originalValue={originalCreator}
				inputType="input"
				onSave={(value) => onSave('creator', value)}
			/>
			<EditableTextField
				label="Version"
				value={versionValue}
				originalValue={originalVersion}
				inputType="input"
				onSave={(value) => onSave('character_version', value)}
			/>
		</div>
	</CollapsibleSection>
</div>
