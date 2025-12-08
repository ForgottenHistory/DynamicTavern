import type { Character } from '$lib/server/db/schema';

export interface OverviewData {
	description?: string;
	scenario?: string;
	personality?: string;
	creator_notes?: string;
	creator?: string;
	character_version?: string;
}

export type FieldName = 'description' | 'scenario' | 'personality' | 'creator_notes' | 'creator' | 'character_version';
export type RewritableField = 'description' | 'scenario' | 'personality';

export function createOverviewState(
	character: Character,
	data: OverviewData,
	onSave: (field: string, value: string) => Promise<void>
) {
	// Rewrite states
	let rewritingDescription = $state(false);
	let rewritingScenario = $state(false);
	let rewritingPersonality = $state(false);

	// Pending rewrite results (to be applied to edit fields)
	let pendingRewrite = $state<{ field: RewritableField; value: string } | null>(null);

	async function rewriteField(field: RewritableField, currentValue: string): Promise<string | null> {
		if (!currentValue.trim()) return null;

		switch (field) {
			case 'description':
				rewritingDescription = true;
				break;
			case 'scenario':
				rewritingScenario = true;
				break;
			case 'personality':
				rewritingPersonality = true;
				break;
		}

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
		} finally {
			rewritingDescription = false;
			rewritingScenario = false;
			rewritingPersonality = false;
		}
	}

	function getFieldValue(field: FieldName): string {
		switch (field) {
			case 'description':
				return character.description || data.description || '';
			case 'scenario':
				return data.scenario || '';
			case 'personality':
				return data.personality || '';
			case 'creator_notes':
				return data.creator_notes || '';
			case 'creator':
				return data.creator || '';
			case 'character_version':
				return data.character_version || '';
		}
	}

	return {
		get rewritingDescription() { return rewritingDescription; },
		get rewritingScenario() { return rewritingScenario; },
		get rewritingPersonality() { return rewritingPersonality; },
		get pendingRewrite() { return pendingRewrite; },
		set pendingRewrite(value: { field: RewritableField; value: string } | null) { pendingRewrite = value; },

		rewriteField,
		getFieldValue,
		saveField: onSave
	};
}
