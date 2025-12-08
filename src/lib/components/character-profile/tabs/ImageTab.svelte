<script lang="ts">
	import type { Character } from '$lib/server/db/schema';

	interface Props {
		character: Character;
		imagePreview: string | null;
		changingImage: boolean;
		error: string | null;
		success: string | null;
		onImageChange: (event: Event) => void;
		onUpdate?: () => void;
	}

	let { character, imagePreview, changingImage, error, success, onImageChange, onUpdate }: Props = $props();

	// Image generation settings (local state)
	let imageTags = $state(character.imageTags || '');
	let contextualTags = $state(character.contextualTags || '');
	let mainPromptOverride = $state(character.mainPromptOverride || '');
	let negativePromptOverride = $state(character.negativePromptOverride || '');

	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state<string | null>(null);

	// Copy states
	let copiedImageTags = $state(false);
	let copiedContextualTags = $state(false);
	let copiedMainPrompt = $state(false);
	let copiedNegativePrompt = $state(false);

	async function copyField(field: 'imageTags' | 'contextualTags' | 'mainPrompt' | 'negativePrompt') {
		let content = '';
		switch (field) {
			case 'imageTags':
				content = imageTags;
				break;
			case 'contextualTags':
				content = contextualTags;
				break;
			case 'mainPrompt':
				content = mainPromptOverride;
				break;
			case 'negativePrompt':
				content = negativePromptOverride;
				break;
		}

		if (!content) return;

		try {
			await navigator.clipboard.writeText(content);
			switch (field) {
				case 'imageTags':
					copiedImageTags = true;
					setTimeout(() => (copiedImageTags = false), 2000);
					break;
				case 'contextualTags':
					copiedContextualTags = true;
					setTimeout(() => (copiedContextualTags = false), 2000);
					break;
				case 'mainPrompt':
					copiedMainPrompt = true;
					setTimeout(() => (copiedMainPrompt = false), 2000);
					break;
				case 'negativePrompt':
					copiedNegativePrompt = true;
					setTimeout(() => (copiedNegativePrompt = false), 2000);
					break;
			}
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	// Reset state when character changes
	$effect(() => {
		imageTags = character.imageTags || '';
		contextualTags = character.contextualTags || '';
		mainPromptOverride = character.mainPromptOverride || '';
		negativePromptOverride = character.negativePromptOverride || '';
	});

	async function handleSave() {
		saving = true;
		saveError = null;
		saveSuccess = null;

		try {
			const response = await fetch(`/api/characters/${character.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageTags: imageTags.trim() || null,
					contextualTags: contextualTags.trim() || null,
					mainPromptOverride: mainPromptOverride.trim() || null,
					negativePromptOverride: negativePromptOverride.trim() || null
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to save');
			}

			saveSuccess = 'Image settings saved successfully!';
			setTimeout(() => (saveSuccess = null), 3000);

			if (onUpdate) {
				onUpdate();
			}
		} catch (err: any) {
			console.error('Failed to save image settings:', err);
			saveError = err.message || 'Failed to save settings';
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Character Portrait Section -->
	<div class="space-y-4">
		<h3 class="text-lg font-semibold text-[var(--text-primary)]">Character Portrait</h3>

		<div class="flex items-start gap-4">
			<!-- Current Image Preview -->
			<div class="flex-shrink-0">
				<div
					class="w-32 h-32 rounded-xl overflow-hidden bg-[var(--bg-tertiary)] border-2 border-[var(--border-primary)]"
				>
					<img
						src={imagePreview || character.imageData || ''}
						alt={character.name}
						class="w-full h-full object-cover"
					/>
				</div>
			</div>

			<!-- Upload Button -->
			<div class="flex-1">
				<p class="text-sm text-[var(--text-secondary)] mb-3">
					Change your character's portrait image by uploading a new file.
				</p>
				<label
					class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:opacity-90 text-white font-medium rounded-xl cursor-pointer transition-colors"
				>
					<input
						type="file"
						accept="image/*"
						onchange={onImageChange}
						disabled={changingImage}
						class="hidden"
					/>
					{#if changingImage}
						<div
							class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
						></div>
						Uploading...
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
						Upload Image
					{/if}
				</label>
			</div>
		</div>
	</div>

	{#if error}
		<div
			class="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl p-4 text-[var(--error)] text-sm"
		>
			{error}
		</div>
	{/if}

	{#if success}
		<div
			class="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl p-4 text-[var(--success)] text-sm"
		>
			{success}
		</div>
	{/if}

	<!-- Divider -->
	<div class="border-t border-[var(--border-primary)]"></div>

	<!-- AI-Generated Images Section -->
	<div class="space-y-4">
		<div>
			<h3 class="text-lg font-semibold text-[var(--text-primary)]">AI-Generated Images</h3>
			<p class="text-sm text-[var(--text-secondary)] mt-1">
				Configure Danbooru-style tags for AI-generated character images during roleplay.
			</p>
		</div>
	</div>

	{#if saveError}
		<div
			class="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl p-4 text-[var(--error)] text-sm"
		>
			{saveError}
		</div>
	{/if}

	{#if saveSuccess}
		<div
			class="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl p-4 text-[var(--success)] text-sm"
		>
			{saveSuccess}
		</div>
	{/if}

	<!-- Always Needed Tags -->
	<div class="space-y-2 group">
		<div class="flex items-center justify-between">
			<label class="block text-sm font-medium text-[var(--text-secondary)]">
				Always Needed Tags (Character Appearance)
			</label>
			{#if imageTags}
			<button
				onclick={() => copyField('imageTags')}
				class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
				title="Copy to clipboard"
			>
				{#if copiedImageTags}
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
		</div>
		<p class="text-xs text-[var(--text-muted)]">
			These tags are ALWAYS included in every generated image (e.g., hair color, eye color, body type)
		</p>
		<textarea
			bind:value={imageTags}
			placeholder="e.g., blue hair, red eyes, long hair, twin tails"
			rows="3"
			class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] font-mono text-sm"
		></textarea>
	</div>

	<!-- Contextual Tags -->
	<div class="space-y-2 group">
		<div class="flex items-center justify-between">
			<label class="block text-sm font-medium text-[var(--text-secondary)]">
				Contextual Tags (Character-Specific Options)
			</label>
			{#if contextualTags}
			<button
				onclick={() => copyField('contextualTags')}
				class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
				title="Copy to clipboard"
			>
				{#if copiedContextualTags}
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
		</div>
		<p class="text-xs text-[var(--text-muted)]">
			AI chooses from these tags based on conversation context (e.g., clothing, common poses, settings)
		</p>
		<textarea
			bind:value={contextualTags}
			placeholder="e.g., smiling, casual clothes, bedroom, sitting, looking at viewer, school uniform"
			rows="3"
			class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] font-mono text-sm"
		></textarea>
	</div>

	<!-- Divider -->
	<div class="border-t border-[var(--border-primary)]"></div>

	<!-- Prompt Overrides Section -->
	<div class="space-y-4">
		<div>
			<h3 class="text-lg font-semibold text-[var(--text-primary)]">Prompt Overrides (Optional)</h3>
			<p class="text-sm text-[var(--text-secondary)] mt-1">
				Override global prompt settings for this character only. Leave empty to use global defaults.
			</p>
		</div>
	</div>

	<!-- Main Prompt Override -->
	<div class="space-y-2 group">
		<div class="flex items-center justify-between">
			<label class="block text-sm font-medium text-[var(--text-secondary)]">
				Main Prompt Override
			</label>
			{#if mainPromptOverride}
			<button
				onclick={() => copyField('mainPrompt')}
				class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
				title="Copy to clipboard"
			>
				{#if copiedMainPrompt}
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
		</div>
		<p class="text-xs text-[var(--text-muted)]">
			Replaces the global main prompt (default: "masterpiece, best quality, amazing quality, 1girl, solo")
		</p>
		<textarea
			bind:value={mainPromptOverride}
			placeholder="e.g., masterpiece, best quality, 1boy, solo, photorealistic"
			rows="2"
			class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] font-mono text-sm"
		></textarea>
	</div>

	<!-- Negative Prompt Override -->
	<div class="space-y-2 group">
		<div class="flex items-center justify-between">
			<label class="block text-sm font-medium text-[var(--text-secondary)]">
				Negative Prompt Override
			</label>
			{#if negativePromptOverride}
			<button
				onclick={() => copyField('negativePrompt')}
				class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition opacity-0 group-hover:opacity-100"
				title="Copy to clipboard"
			>
				{#if copiedNegativePrompt}
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
		</div>
		<p class="text-xs text-[var(--text-muted)]">
			Replaces the global negative prompt (things to avoid in generated images)
		</p>
		<textarea
			bind:value={negativePromptOverride}
			placeholder="e.g., lowres, bad anatomy, bad hands, text, error, cropped"
			rows="2"
			class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-muted)] font-mono text-sm"
		></textarea>
	</div>

	<!-- Save Button -->
	<button
		onclick={handleSave}
		disabled={saving}
		class="w-full px-6 py-3 bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
	>
		{#if saving}
			<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
			Saving...
		{:else}
			Save Image Settings
		{/if}
	</button>

	<!-- Info Box -->
	<div class="bg-[var(--accent-primary)]/10 rounded-xl p-4 border border-[var(--accent-primary)]/20">
		<p class="text-sm font-semibold text-[var(--text-primary)] mb-2">How Image Generation Works:</p>
		<div class="space-y-2 text-sm text-[var(--text-secondary)]">
			<p>1. <strong>Base prompt:</strong> Uses global Image Gen Settings (or override above)</p>
			<p>2. <strong>Always Needed Tags:</strong> Your character's appearance (forced into every image)</p>
			<p>3. <strong>AI-Chosen Tags:</strong> AI analyzes conversation and selects appropriate tags from:
				<span class="block ml-4 mt-1">- Global tag library (Tags page)</span>
				<span class="block ml-4">- Your contextual tags (character-specific options)</span>
			</p>
			<p class="text-xs italic mt-2">Final prompt = Base + Always Needed + AI-Chosen Tags</p>
		</div>
	</div>
</div>
