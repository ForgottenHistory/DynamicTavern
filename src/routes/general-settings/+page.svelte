<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let chatLayout = $state<'bubbles' | 'discord'>('bubbles');
	let avatarStyle = $state<'circle' | 'rounded'>('circle');
	let textCleanupEnabled = $state(true);
	let autoWrapActions = $state(false);
	let randomNarrationEnabled = $state(false);
	let randomNarrationMinMessages = $state(3);
	let randomNarrationMaxMessages = $state(8);
	let worldSidebarEnabled = $state(false);
	let writingStyle = $state('');
	let loading = $state(true);

	// Load settings on mount
	$effect(() => {
		loadSettings();
	});

	async function loadSettings() {
		try {
			const [settingsRes, writingStyleRes] = await Promise.all([
				fetch('/api/settings'),
				fetch('/api/writing-style')
			]);

			if (settingsRes.ok) {
				const data = await settingsRes.json();
				chatLayout = data.chatLayout || 'bubbles';
				avatarStyle = data.avatarStyle || 'circle';
				textCleanupEnabled = data.textCleanupEnabled ?? true;
				autoWrapActions = data.autoWrapActions ?? false;
				randomNarrationEnabled = data.randomNarrationEnabled ?? false;
				randomNarrationMinMessages = data.randomNarrationMinMessages ?? 3;
				randomNarrationMaxMessages = data.randomNarrationMaxMessages ?? 8;
				worldSidebarEnabled = data.worldSidebarEnabled ?? false;
			}

			if (writingStyleRes.ok) {
				const data = await writingStyleRes.json();
				writingStyle = data.content || '';
			}
		} catch (err) {
			console.error('Failed to load settings:', err);
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		saving = true;
		message = null;

		try {
			const [settingsRes, writingStyleRes] = await Promise.all([
				fetch('/api/settings', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ chatLayout, avatarStyle, textCleanupEnabled, autoWrapActions, randomNarrationEnabled, randomNarrationMinMessages, randomNarrationMaxMessages, worldSidebarEnabled })
				}),
				fetch('/api/writing-style', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content: writingStyle })
				})
			]);

			if (settingsRes.ok && writingStyleRes.ok) {
				message = { type: 'success', text: 'Settings saved successfully!' };
				// Dispatch event so chat components can react
				window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { chatLayout, avatarStyle, textCleanupEnabled, autoWrapActions, randomNarrationEnabled, randomNarrationMinMessages, randomNarrationMaxMessages, worldSidebarEnabled } }));
			} else {
				const data = await settingsRes.json();
				message = { type: 'error', text: data.error || 'Failed to save settings' };
			}
		} catch (err) {
			message = { type: 'error', text: 'Failed to save settings' };
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>General Settings | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/general-settings">
	<div class="h-full overflow-y-auto">
		<div class="max-w-5xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-[var(--text-primary)]">General Settings</h1>
				<p class="text-[var(--text-secondary)] mt-2">Configure application preferences</p>
			</div>

			<!-- Messages -->
			{#if message}
				<div
					class="mb-6 p-4 rounded-xl {message.type === 'success'
						? 'bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)]'
						: 'bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)]'}"
				>
					{message.text}
				</div>
			{/if}

			<!-- Settings Content -->
			<div class="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
				{#if loading}
					<div class="text-center py-12 text-[var(--text-muted)]">
						<div class="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
						<p>Loading settings...</p>
					</div>
				{:else}
					<div class="space-y-8">
						<!-- Chat Layout Section -->
						<div>
							<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Chat Layout</h2>
							<p class="text-sm text-[var(--text-muted)] mb-4">
								Choose how messages are displayed in conversations
							</p>

							<div class="grid grid-cols-2 gap-4">
								<!-- Bubbles Option -->
								<button
									type="button"
									onclick={() => chatLayout = 'bubbles'}
									class="relative p-4 rounded-xl border-2 transition-all {chatLayout === 'bubbles'
										? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
										: 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}"
								>
									{#if chatLayout === 'bubbles'}
										<div class="absolute top-3 right-3">
											<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
											</svg>
										</div>
									{/if}
									<!-- Preview: Bubble style -->
									<div class="mb-4 p-3 bg-[var(--bg-primary)] rounded-lg">
										<div class="space-y-2">
											<div class="flex justify-start">
												<div class="w-3/4 h-4 bg-[var(--accent-secondary)]/30 rounded-full"></div>
											</div>
											<div class="flex justify-end">
												<div class="w-2/3 h-4 bg-[var(--accent-primary)]/30 rounded-full"></div>
											</div>
											<div class="flex justify-start">
												<div class="w-1/2 h-4 bg-[var(--accent-secondary)]/30 rounded-full"></div>
											</div>
										</div>
									</div>
									<div class="text-left">
										<p class="font-medium text-[var(--text-primary)]">Chat App</p>
										<p class="text-xs text-[var(--text-muted)] mt-1">
											Bubble style with AI on left, user on right
										</p>
									</div>
								</button>

								<!-- Discord Option -->
								<button
									type="button"
									onclick={() => chatLayout = 'discord'}
									class="relative p-4 rounded-xl border-2 transition-all {chatLayout === 'discord'
										? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
										: 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}"
								>
									{#if chatLayout === 'discord'}
										<div class="absolute top-3 right-3">
											<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
											</svg>
										</div>
									{/if}
									<!-- Preview: Discord style with avatars -->
									<div class="mb-4 p-3 bg-[var(--bg-primary)] rounded-lg">
										<div class="space-y-2">
											<!-- Message row 1 -->
											<div class="flex items-start gap-2">
												<div class="w-4 h-4 rounded-full bg-[var(--accent-secondary)]/40 flex-shrink-0"></div>
												<div class="flex-1">
													<div class="w-1/4 h-2 bg-[var(--accent-secondary)]/50 rounded mb-1"></div>
													<div class="w-full h-3 bg-[var(--text-muted)]/20 rounded"></div>
												</div>
											</div>
											<!-- Message row 2 -->
											<div class="flex items-start gap-2">
												<div class="w-4 h-4 rounded-full bg-[var(--accent-primary)]/40 flex-shrink-0"></div>
												<div class="flex-1">
													<div class="w-1/4 h-2 bg-[var(--accent-primary)]/50 rounded mb-1"></div>
													<div class="w-3/4 h-3 bg-[var(--text-muted)]/20 rounded"></div>
												</div>
											</div>
											<!-- Message row 3 -->
											<div class="flex items-start gap-2">
												<div class="w-4 h-4 rounded-full bg-[var(--accent-secondary)]/40 flex-shrink-0"></div>
												<div class="flex-1">
													<div class="w-1/4 h-2 bg-[var(--accent-secondary)]/50 rounded mb-1"></div>
													<div class="w-2/3 h-3 bg-[var(--text-muted)]/20 rounded"></div>
												</div>
											</div>
										</div>
									</div>
									<div class="text-left">
										<p class="font-medium text-[var(--text-primary)]">Discord</p>
										<p class="text-xs text-[var(--text-muted)] mt-1">
											Full-width rows with avatars and timestamps
										</p>
									</div>
								</button>
							</div>
						</div>

						<!-- Avatar Style Section (only show for Discord layout) -->
						{#if chatLayout === 'discord'}
							<div>
								<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Avatar Style</h2>
								<p class="text-sm text-[var(--text-muted)] mb-4">
									Choose the shape of avatars in Discord layout
								</p>

								<div class="grid grid-cols-2 gap-4">
									<!-- Circle Option -->
									<button
										type="button"
										onclick={() => avatarStyle = 'circle'}
										class="relative p-4 rounded-xl border-2 transition-all {avatarStyle === 'circle'
											? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
											: 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}"
									>
										{#if avatarStyle === 'circle'}
											<div class="absolute top-3 right-3">
												<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
												</svg>
											</div>
										{/if}
										<!-- Preview: Circle avatar -->
										<div class="mb-4 flex justify-center">
											<div class="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]"></div>
										</div>
										<div class="text-left">
											<p class="font-medium text-[var(--text-primary)]">Circle</p>
											<p class="text-xs text-[var(--text-muted)] mt-1">
												Round avatars like Discord
											</p>
										</div>
									</button>

									<!-- Rounded Square Option -->
									<button
										type="button"
										onclick={() => avatarStyle = 'rounded'}
										class="relative p-4 rounded-xl border-2 transition-all {avatarStyle === 'rounded'
											? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
											: 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]'}"
									>
										{#if avatarStyle === 'rounded'}
											<div class="absolute top-3 right-3">
												<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
												</svg>
											</div>
										{/if}
										<!-- Preview: Rounded square avatar -->
										<div class="mb-4 flex justify-center">
											<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]"></div>
										</div>
										<div class="text-left">
											<p class="font-medium text-[var(--text-primary)]">Rounded Square</p>
											<p class="text-xs text-[var(--text-muted)] mt-1">
												Rounded corners like the sidebar
											</p>
										</div>
									</button>
								</div>
							</div>
						{/if}

						<!-- Text Processing Section -->
						<div>
							<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Text Processing</h2>
							<p class="text-sm text-[var(--text-muted)] mb-4">
								Configure how message text is processed and displayed
							</p>

							<div class="space-y-3">
								<label class="flex items-center justify-between p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition cursor-pointer">
									<div>
										<p class="font-medium text-[var(--text-primary)]">Text Cleanup</p>
										<p class="text-sm text-[var(--text-muted)] mt-1">
											Normalize quotes and balance asterisks for consistent RP formatting
										</p>
									</div>
									<button
										type="button"
										role="switch"
										aria-checked={textCleanupEnabled}
										aria-label="Toggle text cleanup"
										onclick={() => textCleanupEnabled = !textCleanupEnabled}
										class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {textCleanupEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}"
									>
										<span
											class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {textCleanupEnabled ? 'translate-x-6' : 'translate-x-1'}"
										></span>
									</button>
								</label>

								<!-- Nested option: Auto-wrap actions (only visible when text cleanup is enabled) -->
								{#if textCleanupEnabled}
									<label class="flex items-center justify-between p-4 ml-6 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition cursor-pointer bg-[var(--bg-primary)]/50">
										<div>
											<p class="font-medium text-[var(--text-primary)]">Auto-wrap Plain Text</p>
											<p class="text-sm text-[var(--text-muted)] mt-1">
												Wrap text that isn't in quotes or asterisks with *asterisks*
											</p>
										</div>
										<button
											type="button"
											role="switch"
											aria-checked={autoWrapActions}
											aria-label="Toggle auto-wrap plain text"
											onclick={() => autoWrapActions = !autoWrapActions}
											class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {autoWrapActions ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}"
										>
											<span
												class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {autoWrapActions ? 'translate-x-6' : 'translate-x-1'}"
											></span>
										</button>
									</label>
								{/if}
							</div>
						</div>

						<!-- Random Narration Section -->
						<div>
							<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Random Narration</h2>
							<p class="text-sm text-[var(--text-muted)] mb-4">
								Automatically trigger narrator interjections during chat
							</p>

							<div class="space-y-4">
								<label class="flex items-center justify-between p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition cursor-pointer">
									<div>
										<p class="font-medium text-[var(--text-primary)]">Enable Random Narration</p>
										<p class="text-sm text-[var(--text-muted)] mt-1">
											Randomly trigger "Look at" or scene narration during conversations
										</p>
									</div>
									<button
										type="button"
										role="switch"
										aria-checked={randomNarrationEnabled}
										aria-label="Toggle random narration"
										onclick={() => randomNarrationEnabled = !randomNarrationEnabled}
										class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {randomNarrationEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}"
									>
										<span
											class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {randomNarrationEnabled ? 'translate-x-6' : 'translate-x-1'}"
										></span>
									</button>
								</label>

								<!-- Frequency settings (only visible when enabled) -->
								{#if randomNarrationEnabled}
									<div class="ml-6 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]/50">
										<p class="font-medium text-[var(--text-primary)] mb-3">Frequency Range</p>
										<p class="text-sm text-[var(--text-muted)] mb-4">
											Narration will trigger randomly between this range of messages
										</p>

										<div class="flex items-center gap-4">
											<div class="flex-1">
												<label class="text-sm text-[var(--text-secondary)] mb-1 block">Minimum</label>
												<input
													type="number"
													min="1"
													max="50"
													bind:value={randomNarrationMinMessages}
													onchange={() => {
														if (randomNarrationMinMessages > randomNarrationMaxMessages) {
															randomNarrationMaxMessages = randomNarrationMinMessages;
														}
													}}
													class="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
												/>
											</div>
											<span class="text-[var(--text-muted)] pt-6">to</span>
											<div class="flex-1">
												<label class="text-sm text-[var(--text-secondary)] mb-1 block">Maximum</label>
												<input
													type="number"
													min="1"
													max="50"
													bind:value={randomNarrationMaxMessages}
													onchange={() => {
														if (randomNarrationMaxMessages < randomNarrationMinMessages) {
															randomNarrationMinMessages = randomNarrationMaxMessages;
														}
													}}
													class="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
												/>
											</div>
											<span class="text-[var(--text-muted)] pt-6">messages</span>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<!-- World Sidebar Section -->
						<div>
							<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">World Sidebar</h2>
							<p class="text-sm text-[var(--text-muted)] mb-4">
								Show a sidebar panel with world state information during chat
							</p>

							<label class="flex items-center justify-between p-4 rounded-xl border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition cursor-pointer">
								<div>
									<p class="font-medium text-[var(--text-primary)]">Enable World Sidebar</p>
									<p class="text-sm text-[var(--text-muted)] mt-1">
										Display a collapsible panel with clothing, items, and other world state
									</p>
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={worldSidebarEnabled}
									aria-label="Toggle world sidebar"
									onclick={() => worldSidebarEnabled = !worldSidebarEnabled}
									class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {worldSidebarEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}"
								>
									<span
										class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {worldSidebarEnabled ? 'translate-x-6' : 'translate-x-1'}"
									></span>
								</button>
							</label>
						</div>

						<!-- Writing Style Section -->
						<div>
							<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Writing Style</h2>
							<p class="text-sm text-[var(--text-muted)] mb-4">
								Instructions for how the AI should write responses. This applies to all characters.
							</p>

							<textarea
								bind:value={writingStyle}
								placeholder="Example: Write detailed, immersive responses with vivid descriptions. Focus on emotional reactions and body language. Keep responses between 2-4 paragraphs."
								class="w-full h-32 bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl border border-[var(--border-primary)] p-4 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-sm"
							></textarea>
							<p class="text-xs text-[var(--text-muted)] mt-2">
								Use {"{{writing_style}}"} in your prompts to include this text. Saved to <code class="bg-[var(--bg-tertiary)] px-1 rounded">data/prompts/writing_style.txt</code>
							</p>
						</div>

						<!-- Save Button -->
						<div class="pt-4 border-t border-[var(--border-primary)]">
							<button
								onclick={saveSettings}
								disabled={saving}
								class="px-6 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if saving}
									<span class="flex items-center gap-2">
										<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
										Saving...
									</span>
								{:else}
									Save Changes
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</MainLayout>
