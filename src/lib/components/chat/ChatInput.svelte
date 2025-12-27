<script lang="ts">
	import type { SceneActionType, ImpersonateStyle } from '$lib/types/chat';

	export type { SceneActionType, ImpersonateStyle };

	interface SceneCharacter {
		id: number;
		name: string;
		thumbnailData: string | null;
		imageData: string | null;
	}

	interface Props {
		disabled: boolean;
		hasAssistantMessages: boolean;
		impersonating: boolean;
		generatingImage: boolean;
		sceneCharacters?: SceneCharacter[];
		onSend: (message: string) => void;
		onGenerate: () => void;
		onRegenerate: () => void;
		onImpersonate: (style: ImpersonateStyle) => void;
		onGenerateImage: (type: 'character' | 'user' | 'scene' | 'raw') => void;
		onSceneAction: (type: SceneActionType, context?: { characterId?: number; characterName?: string }) => void;
	}

	let { disabled, hasAssistantMessages, impersonating, generatingImage, sceneCharacters = [], onSend, onGenerate, onRegenerate, onImpersonate, onGenerateImage, onSceneAction }: Props = $props();

	let input = $state('');
	let showImageDropdown = $state(false);
	let showActionsDropdown = $state(false);
	let showImpersonateDropdown = $state(false);
	let textareaRef: HTMLTextAreaElement;

	export function setInput(text: string) {
		input = text;
		// Trigger resize after setting input
		requestAnimationFrame(() => resizeTextarea());
	}

	function resizeTextarea() {
		if (!textareaRef) return;
		// Reset to minimum height to get accurate scrollHeight
		textareaRef.style.height = '0px';
		const maxHeight = 200; // Max height in pixels (roughly 8 lines)
		const newHeight = Math.min(textareaRef.scrollHeight, maxHeight);
		textareaRef.style.height = newHeight + 'px';
		// Enable scrolling only when at max height
		textareaRef.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
	}

	function handleInput() {
		resizeTextarea();
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
			// Reset textarea height
			if (textareaRef) {
				textareaRef.style.height = 'auto';
			}
		} else {
			onGenerate();
		}
	}

	function handleImageGenerate(type: 'character' | 'user' | 'scene' | 'raw') {
		showImageDropdown = false;
		onGenerateImage(type);
	}

	function handleSceneAction(type: SceneActionType, context?: { characterId?: number; characterName?: string }) {
		showActionsDropdown = false;
		onSceneAction(type, context);
	}

	function handleImpersonate(style: ImpersonateStyle) {
		showImpersonateDropdown = false;
		onImpersonate(style);
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.image-dropdown-container')) {
			showImageDropdown = false;
		}
		if (!target.closest('.actions-dropdown-container')) {
			showActionsDropdown = false;
		}
		if (!target.closest('.impersonate-dropdown-container')) {
			showImpersonateDropdown = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="bg-[var(--bg-secondary)] border-t border-[var(--border-primary)] px-6 py-4">
	<div class="max-w-4xl mx-auto flex items-end gap-3">
		<div class="flex items-center">
			<!-- Impersonate Dropdown -->
			<div class="relative impersonate-dropdown-container">
				<button
					onclick={() => (showImpersonateDropdown = !showImpersonateDropdown)}
					disabled={disabled || impersonating}
					class="p-3 text-[var(--text-muted)] hover:text-[var(--accent-user)] disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-[var(--bg-tertiary)]"
					title="Impersonate (AI writes as you)"
				>
					{#if impersonating}
						<div class="w-5 h-5 border-2 border-[var(--accent-user)] border-t-transparent rounded-full animate-spin"></div>
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
						</svg>
					{/if}
				</button>
				{#if showImpersonateDropdown}
					<div class="absolute bottom-full left-0 mb-2 w-44 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden z-50">
						<button
							onclick={() => handleImpersonate('serious')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Serious
						</button>
						<button
							onclick={() => handleImpersonate('sarcastic')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Sarcastic
						</button>
						<button
							onclick={() => handleImpersonate('flirty')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
							</svg>
							Flirty
						</button>
						<button
							onclick={() => handleImpersonate('impersonate')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
							Impersonate
						</button>
					</div>
				{/if}
			</div>
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
			<!-- Scene Actions Dropdown -->
			<div class="relative actions-dropdown-container">
				<button
					onclick={() => (showActionsDropdown = !showActionsDropdown)}
					{disabled}
					class="p-3 text-[var(--text-muted)] hover:text-[var(--warning)] disabled:opacity-30 disabled:cursor-not-allowed transition rounded-lg hover:bg-[var(--bg-tertiary)]"
					title="Scene Actions"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
					</svg>
				</button>
				{#if showActionsDropdown}
					<div class="absolute bottom-full left-0 mb-2 w-48 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
						<!-- Character-specific Look buttons -->
						{#if sceneCharacters.length > 0}
							{#each sceneCharacters as char (char.id)}
								<button
									onclick={() => handleSceneAction('look_character', { characterId: char.id, characterName: char.name })}
									class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
								>
									<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
									</svg>
									<span class="truncate">Look at {char.name}</span>
								</button>
							{/each}
							<div class="border-t border-[var(--border-primary)]"></div>
						{/if}
						<button
							onclick={() => handleSceneAction('look_scene')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Look at Scene
						</button>
						<button
							onclick={() => handleSceneAction('narrate')}
							class="w-full px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition flex items-center gap-3"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
							</svg>
							Narrate Scene
						</button>
					</div>
				{/if}
			</div>
		</div>
		<textarea
			bind:this={textareaRef}
			bind:value={input}
			oninput={handleInput}
			onkeydown={handleKeydown}
			placeholder={impersonating ? "Generating..." : "Type a message..."}
			disabled={impersonating}
			rows="1"
			class="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none disabled:opacity-50"
			style="scrollbar-width: none; -ms-overflow-style: none;"
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
