<script lang="ts">
	interface Props {
		disabled: boolean;
		hasAssistantMessages: boolean;
		impersonating: boolean;
		generatingImage: boolean;
		onSend: (message: string) => void;
		onGenerate: () => void;
		onRegenerate: () => void;
		onImpersonate: () => void;
		onGenerateImage: (type: 'character' | 'user' | 'scene' | 'raw') => void;
	}

	let { disabled, hasAssistantMessages, impersonating, generatingImage, onSend, onGenerate, onRegenerate, onImpersonate, onGenerateImage }: Props = $props();

	let input = $state('');
	let showImageDropdown = $state(false);

	export function setInput(text: string) {
		input = text;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	function handleSubmit() {
		if (disabled) return;

		const message = input.trim();
		if (message) {
			onSend(message);
			input = '';
		} else {
			onGenerate();
		}
	}

	function handleImageGenerate(type: 'character' | 'user' | 'scene' | 'raw') {
		showImageDropdown = false;
		onGenerateImage(type);
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.image-dropdown-container')) {
			showImageDropdown = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] px-6 py-4">
	<div class="max-w-4xl mx-auto flex items-end gap-3">
		<div class="flex items-center">
			<button
				onclick={onImpersonate}
				{disabled}
				class="p-3 text-[var(--text-muted)] hover:text-[var(--accent-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-[var(--bg-tertiary)]"
				title="Impersonate (AI writes as you)"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
				</svg>
			</button>
			<!-- Image Generation Button with Dropdown -->
			<div class="relative image-dropdown-container">
				<button
					onclick={() => (showImageDropdown = !showImageDropdown)}
					disabled={disabled || generatingImage}
					class="p-3 text-[var(--text-muted)] hover:text-[var(--accent-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-[var(--bg-tertiary)]"
					title="Generate Image"
				>
					{#if generatingImage}
						<div class="w-5 h-5 border-2 border-[var(--accent-secondary)] border-t-transparent rounded-full animate-spin"></div>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
						</svg>
					{/if}
				</button>
				{#if showImageDropdown}
					<div class="absolute bottom-full left-0 mb-2 w-44 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden z-50">
						<button
							onclick={() => handleImageGenerate('character')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
							Character
						</button>
						<button
							onclick={() => handleImageGenerate('user')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
							</svg>
							User
						</button>
						<button
							onclick={() => handleImageGenerate('scene')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
							</svg>
							Scene
						</button>
						<div class="border-t border-[var(--border-primary)]"></div>
						<button
							onclick={() => handleImageGenerate('raw')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
							</svg>
							Raw
						</button>
					</div>
				{/if}
			</div>
			<button
				onclick={onRegenerate}
				disabled={disabled || !hasAssistantMessages}
				class="p-3 text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-[var(--bg-tertiary)]"
				title="Regenerate last response"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
				</svg>
			</button>
		</div>
		<textarea
			bind:value={input}
			onkeydown={handleKeydown}
			placeholder={impersonating ? "Generating..." : "Type a message..."}
			disabled={impersonating}
			rows="1"
			class="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none disabled:opacity-50"
		></textarea>
		<button
			onclick={handleSubmit}
			{disabled}
			class="px-6 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
			title={input.trim() ? 'Send message' : 'Generate bot response'}
		>
			{#if input.trim()}
				Send
			{:else}
				Generate
			{/if}
		</button>
	</div>
</div>
