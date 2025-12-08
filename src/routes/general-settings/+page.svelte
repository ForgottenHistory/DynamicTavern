<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();

	let saving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let chatLayout = $state<'bubbles' | 'discord'>('bubbles');
	let avatarStyle = $state<'circle' | 'rounded'>('circle');
	let loading = $state(true);

	// Load settings on mount
	$effect(() => {
		loadSettings();
	});

	async function loadSettings() {
		try {
			const res = await fetch('/api/settings');
			if (res.ok) {
				const data = await res.json();
				chatLayout = data.chatLayout || 'bubbles';
				avatarStyle = data.avatarStyle || 'circle';
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
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chatLayout, avatarStyle })
			});

			if (res.ok) {
				message = { type: 'success', text: 'Settings saved successfully!' };
				// Dispatch event so chat components can react
				window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { chatLayout, avatarStyle } }));
			} else {
				const data = await res.json();
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
	<title>General Settings | AI Chat</title>
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
