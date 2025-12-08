<script lang="ts">
	import { estimateTokens } from '$lib/utils/tokenCount';

	interface Props {
		label: string;
		value: string;
		originalValue?: string;
		placeholder?: string;
		rows?: number;
		showTokenCount?: boolean;
		showCopy?: boolean;
		showRewrite?: boolean;
		rewriting?: boolean;
		mono?: boolean;
		inputType?: 'textarea' | 'input';
		onSave: (value: string) => Promise<void>;
		onRewrite?: () => Promise<void>;
	}

	let {
		label,
		value,
		originalValue,
		placeholder = '',
		rows = 4,
		showTokenCount = false,
		showCopy = true,
		showRewrite = false,
		rewriting = false,
		mono = false,
		inputType = 'textarea',
		onSave,
		onRewrite
	}: Props = $props();

	let resetting = $state(false);

	// Check if current value differs from original
	let canReset = $derived(originalValue !== undefined && value !== originalValue);

	async function resetToOriginal() {
		if (originalValue === undefined) return;
		resetting = true;
		try {
			await onSave(originalValue);
		} finally {
			resetting = false;
		}
	}

	let editing = $state(false);
	let editValue = $state('');
	let saving = $state(false);
	let copied = $state(false);

	function startEditing() {
		editValue = value || '';
		editing = true;
	}

	async function save() {
		saving = true;
		try {
			await onSave(editValue);
			editing = false;
		} finally {
			saving = false;
		}
	}

	function cancel() {
		editing = false;
		editValue = '';
	}

	async function copy() {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	async function handleRewrite() {
		if (onRewrite) {
			await onRewrite();
			// If we have an editValue after rewrite, enter edit mode
			if (editValue) {
				editing = true;
			}
		}
	}

	// Allow parent to set editValue for rewrite results
	export function setEditValue(newValue: string) {
		editValue = newValue;
		editing = true;
	}

	let displayValue = $derived(editing ? editValue : value);
	let tokenCount = $derived(showTokenCount ? estimateTokens(displayValue) : 0);
</script>

<div>
	<div class="flex items-center justify-between mb-2 group">
		<div class="flex items-center gap-2">
			<h4 class="text-sm font-medium text-[var(--text-secondary)]">{label}</h4>
			{#if showTokenCount}
				<span class="text-xs text-[var(--text-muted)]">~{tokenCount.toLocaleString()} tokens</span>
			{/if}
		</div>
		{#if !editing}
			<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
				{#if showCopy && value}
					<button
						onclick={copy}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="Copy to clipboard"
					>
						{#if copied}
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
				{#if showRewrite && onRewrite}
					<button
						onclick={handleRewrite}
						disabled={rewriting || !value}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
						title="Rewrite with AI"
					>
						{#if rewriting}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
						{/if}
					</button>
				{/if}
				{#if canReset}
					<button
						onclick={resetToOriginal}
						disabled={resetting}
						class="p-1.5 text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-[var(--warning)]/10 rounded-lg transition disabled:opacity-50"
						title="Reset to original"
					>
						{#if resetting}
							<div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
							</svg>
						{/if}
					</button>
				{/if}
				<button
					onclick={startEditing}
					class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
					aria-label="Edit {label.toLowerCase()}"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	{#if editing}
		<div class="space-y-2">
			{#if inputType === 'textarea'}
				<textarea
					bind:value={editValue}
					{rows}
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none {mono ? 'font-mono text-sm' : ''}"
					placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
				></textarea>
			{:else}
				<input
					type="text"
					bind:value={editValue}
					class="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
				/>
			{/if}
			<div class="flex gap-2">
				<button
					onclick={save}
					disabled={saving}
					class="px-3 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
				{#if showRewrite && onRewrite}
					<button
						onclick={handleRewrite}
						disabled={rewriting || !editValue.trim()}
						class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--accent-primary)] text-sm rounded-lg hover:bg-[var(--accent-primary)]/10 transition disabled:opacity-50 flex items-center gap-1.5"
					>
						{#if rewriting}
							<div class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
							Rewriting...
						{:else}
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
							</svg>
							Rewrite
						{/if}
					</button>
				{/if}
				<button
					onclick={cancel}
					class="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--border-primary)] transition"
				>
					Cancel
				</button>
			</div>
		</div>
	{:else if value}
		<div class="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed {mono ? 'font-mono text-sm' : ''}">
			{value}
		</div>
	{:else}
		<p class="text-[var(--text-muted)] italic">No {label.toLowerCase()} available</p>
	{/if}
</div>
