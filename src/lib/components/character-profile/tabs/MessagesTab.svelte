<script lang="ts">
	import CollapsibleSection from '../CollapsibleSection.svelte';
	import EditableTextField from '../EditableTextField.svelte';
	import GreetingsList from '../GreetingsList.svelte';
	import { estimateTokens } from '$lib/utils/tokenCount';

	interface Props {
		data: {
			first_mes?: string;
			mes_example?: string;
			alternate_greetings?: string[];
		};
		originalData?: {
			first_mes?: string;
			mes_example?: string;
			alternate_greetings?: string[];
		} | null;
		onSave: (field: string, value: string | string[]) => Promise<void>;
	}

	let { data, originalData, onSave }: Props = $props();

	// Section expansion states
	let mesExampleExpanded = $state(false);
	let alternateGreetingsExpanded = $state(false);

	// Rewrite states
	let rewritingFirstMes = $state(false);
	let rewritingMesExample = $state(false);

	// References to editable fields
	let firstMesField: EditableTextField;
	let mesExampleField: EditableTextField;

	async function rewriteContent(type: 'greeting' | 'message_example', input: string): Promise<string | null> {
		if (!input.trim()) return null;

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
			console.error('Failed to rewrite:', err);
			alert(`Failed to rewrite: ${err.message}`);
			return null;
		}
	}

	async function handleRewriteFirstMes() {
		const currentValue = data.first_mes || '';
		if (!currentValue.trim()) return;

		rewritingFirstMes = true;
		try {
			const rewritten = await rewriteContent('greeting', currentValue);
			if (rewritten) {
				firstMesField?.setEditValue(rewritten);
			}
		} finally {
			rewritingFirstMes = false;
		}
	}

	async function handleRewriteMesExample() {
		const currentValue = data.mes_example || '';
		if (!currentValue.trim()) return;

		rewritingMesExample = true;
		try {
			const rewritten = await rewriteContent('message_example', currentValue);
			if (rewritten) {
				mesExampleField?.setEditValue(rewritten);
				mesExampleExpanded = true;
			}
		} finally {
			rewritingMesExample = false;
		}
	}

	async function handleGreetingsSave(greetings: string[]) {
		await onSave('alternate_greetings', greetings);
	}

	// Computed values
	let firstMesValue = $derived(data.first_mes || '');
	let mesExampleValue = $derived(data.mes_example || '');
	let greetings = $derived(data.alternate_greetings || []);

	// Original values for reset functionality
	let originalFirstMes = $derived(originalData?.first_mes);
	let originalMesExample = $derived(originalData?.mes_example);
	let originalGreetings = $derived(originalData?.alternate_greetings);
</script>

<div class="space-y-4">
	<h3 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Character Messages</h3>

	<!-- First Message -->
	<EditableTextField
		bind:this={firstMesField}
		label="First Message"
		value={firstMesValue}
		originalValue={originalFirstMes}
		rows={8}
		showTokenCount={true}
		showRewrite={true}
		rewriting={rewritingFirstMes}
		onSave={(value) => onSave('first_mes', value)}
		onRewrite={handleRewriteFirstMes}
	/>

	<!-- Collapsible: Message Example -->
	<CollapsibleSection
		title="Message Example"
		badge="~{estimateTokens(mesExampleValue).toLocaleString()} tokens"
		expanded={mesExampleExpanded}
		onToggle={() => (mesExampleExpanded = !mesExampleExpanded)}
	>
		<EditableTextField
			bind:this={mesExampleField}
			label="Message Example"
			value={mesExampleValue}
			originalValue={originalMesExample}
			rows={12}
			mono={true}
			showTokenCount={false}
			showRewrite={true}
			rewriting={rewritingMesExample}
			onSave={(value) => onSave('mes_example', value)}
			onRewrite={handleRewriteMesExample}
		/>
	</CollapsibleSection>

	<!-- Collapsible: Alternate Greetings -->
	<CollapsibleSection
		title="Alternate Greetings"
		badge={greetings.length}
		expanded={alternateGreetingsExpanded}
		onToggle={() => (alternateGreetingsExpanded = !alternateGreetingsExpanded)}
	>
		<GreetingsList
			greetings={greetings}
			originalGreetings={originalGreetings}
			onSave={handleGreetingsSave}
		/>
	</CollapsibleSection>
</div>
