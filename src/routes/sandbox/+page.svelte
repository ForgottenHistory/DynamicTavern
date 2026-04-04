<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	interface WorldInfo {
		id: string;
		name: string;
		description?: string;
	}

	interface SessionInfo {
		id: number;
		mode: string;
		worldFile: string;
		currentLocationId: string;
		updatedAt: string;
		worldName: string;
		locationName: string;
	}

	let worlds = $state<WorldInfo[]>([]);
	let sessions = $state<SessionInfo[]>([]);
	let loading = $state(true);
	let creating = $state<string | null>(null);
	let creatingDynamic = $state(false);
	let deleting = $state<number | null>(null);
	let error = $state<string | null>(null);

	// Dynamic session modal
	let showDynamicModal = $state(false);
	let selectedTheme = $state<string | null>(null);
	let customTheme = $state('');

	const themePresets = [
		{ id: 'fantasy', label: 'Fantasy', description: 'Medieval kingdoms, magic, mythical creatures' },
		{ id: 'modern_day', label: 'Modern Day', description: 'Contemporary urban life, cities, everyday settings' },
		{ id: 'sci_fi', label: 'Sci-Fi', description: 'Space stations, alien worlds, advanced technology' },
		{ id: 'post_apocalyptic', label: 'Post-Apocalyptic', description: 'Ruins of civilization, survival, wastelands' },
		{ id: 'horror', label: 'Horror', description: 'Dark atmospheres, dread, supernatural threats' },
		{ id: 'historical', label: 'Historical', description: 'Past eras, ancient civilizations, period settings' },
	];

	function getThemeValue(): string | undefined {
		if (selectedTheme === 'custom') return customTheme.trim() || undefined;
		return selectedTheme || undefined;
	}

	// Dynamic sessions (no world file)
	let dynamicSessions = $derived(sessions.filter(s => s.mode === 'dynamic'));

	// Sessions grouped: existing sessions for worlds, and worlds without sessions
	let worldsWithSessions = $derived(
		worlds.map(w => ({
			world: w,
			sessions: sessions.filter(s => s.mode !== 'dynamic' && s.worldFile === w.id)
		}))
	);

	let activeSessionWorlds = $derived(worldsWithSessions.filter(w => w.sessions.length > 0));
	let hasActiveSessions = $derived(dynamicSessions.length > 0 || activeSessionWorlds.length > 0);

	$effect(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [worldsRes, sessionsRes] = await Promise.all([
				fetch('/api/sandbox/worlds'),
				fetch('/api/sandbox/sessions')
			]);
			if (!worldsRes.ok) throw new Error('Failed to load worlds');
			if (!sessionsRes.ok) throw new Error('Failed to load sessions');
			const worldsData = await worldsRes.json();
			const sessionsData = await sessionsRes.json();
			worlds = worldsData.worlds;
			sessions = sessionsData.sessions;
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function startSession(worldId: string) {
		creating = worldId;
		error = null;
		try {
			const response = await fetch('/api/sandbox/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ worldFile: worldId })
			});
			if (!response.ok) throw new Error('Failed to create session');
			const data = await response.json();
			goto(`/sandbox/${data.session.id}`);
		} catch (e) {
			error = 'Failed to start session';
			console.error(e);
			creating = null;
		}
	}

	function openDynamicModal() {
		selectedTheme = null;
		customTheme = '';
		showDynamicModal = true;
	}

	async function startDynamicSession() {
		creatingDynamic = true;
		showDynamicModal = false;
		error = null;
		try {
			const response = await fetch('/api/sandbox/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'dynamic', theme: getThemeValue() })
			});
			if (!response.ok) throw new Error('Failed to create session');
			const data = await response.json();
			goto(`/sandbox/${data.session.id}`);
		} catch (e) {
			error = 'Failed to start dynamic session';
			console.error(e);
			creatingDynamic = false;
		}
	}

	let clearingAll = $state(false);

	async function clearAllSessions() {
		const confirmed = confirm(`End all ${sessions.length} active session${sessions.length === 1 ? '' : 's'}? All messages will be lost.`);
		if (!confirmed) return;

		clearingAll = true;
		try {
			await Promise.all(sessions.map(s => fetch(`/api/sandbox/sessions/${s.id}`, { method: 'DELETE' })));
			sessions = [];
		} catch (e) {
			console.error('Failed to clear sessions:', e);
		} finally {
			clearingAll = false;
		}
	}

	async function deleteSession(sessionId: number, event: MouseEvent) {
		event.stopPropagation();
		const confirmed = confirm('End this session? All messages will be lost.');
		if (!confirmed) return;

		deleting = sessionId;
		try {
			await fetch(`/api/sandbox/sessions/${sessionId}`, { method: 'DELETE' });
			sessions = sessions.filter(s => s.id !== sessionId);
		} catch (e) {
			console.error('Failed to delete session:', e);
		} finally {
			deleting = null;
		}
	}

	function formatTime(dateStr: string) {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Sandbox | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/sandbox">
	<div class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-7xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-8">
				<h1 class="text-2xl font-bold text-[var(--text-primary)] mb-2">Sandbox</h1>
				<p class="text-[var(--text-muted)]">
					Explore worlds and encounter characters from your library
				</p>
			</div>

			{#if loading}
				<div class="flex items-center justify-center py-16">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
				</div>
			{:else if error}
				<div class="text-center py-16 bg-[var(--bg-secondary)] rounded-lg border border-red-500/30">
					<svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
					</svg>
					<p class="text-[var(--text-primary)] font-semibold mb-1">{error}</p>
					<button
						onclick={loadData}
						class="mt-4 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition"
					>
						Try Again
					</button>
				</div>
			{:else}
				<!-- Active Sessions -->
				{#if hasActiveSessions}
					<div class="mb-8">
						<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-semibold text-[var(--text-primary)]">Active Sessions</h2>
						<button
							onclick={clearAllSessions}
							disabled={clearingAll}
							class="text-sm text-[var(--text-muted)] hover:text-red-500 transition disabled:opacity-50"
						>
							{clearingAll ? 'Clearing...' : 'Clear all'}
						</button>
					</div>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<!-- Dynamic sessions -->
							{#each dynamicSessions as session}
								<div
									onclick={() => goto(`/sandbox/${session.id}`)}
									onkeydown={(e) => e.key === 'Enter' && goto(`/sandbox/${session.id}`)}
									role="button"
									tabindex="0"
									class="group relative text-left bg-[var(--bg-secondary)] rounded-xl border border-purple-500/30 p-5 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer"
								>
									<div class="absolute top-4 left-4">
										<div class="w-2 h-2 rounded-full bg-purple-500"></div>
									</div>
									<div class="ml-5">
										<h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">Dynamic Adventure</h3>
										<p class="text-sm text-[var(--text-muted)]">{session.locationName}</p>
										<p class="text-xs text-[var(--text-muted)] mt-2">{formatTime(session.updatedAt)}</p>
									</div>
									<div class="absolute top-5 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
										<svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
										</svg>
									</div>
									<button
										onclick={(e) => deleteSession(session.id, e)}
										disabled={deleting === session.id}
										class="absolute top-4 right-4 p-1 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
										title="End session"
									>
										{#if deleting === session.id}
											<div class="w-4 h-4 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin"></div>
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
											</svg>
										{/if}
									</button>
								</div>
							{/each}
							<!-- Scene sessions -->
							{#each activeSessionWorlds as { world, sessions: worldSessions }}
								{#each worldSessions as session}
									<div
										onclick={() => goto(`/sandbox/${session.id}`)}
										onkeydown={(e) => e.key === 'Enter' && goto(`/sandbox/${session.id}`)}
										role="button"
										tabindex="0"
										class="group relative text-left bg-[var(--bg-secondary)] rounded-xl border border-[var(--accent-primary)]/30 p-5 hover:border-[var(--accent-primary)] hover:shadow-lg transition-all cursor-pointer"
									>
										<!-- Active indicator dot -->
										<div class="absolute top-4 left-4">
											<div class="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></div>
										</div>

										<div class="ml-5">
											<h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">{session.worldName}</h3>
											<p class="text-sm text-[var(--text-muted)]">
												{session.locationName}
											</p>
											<p class="text-xs text-[var(--text-muted)] mt-2">
												{formatTime(session.updatedAt)}
											</p>
										</div>

										<!-- Resume arrow -->
										<div class="absolute top-5 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
											<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
											</svg>
										</div>

										<!-- Delete button -->
										<button
											onclick={(e) => deleteSession(session.id, e)}
											disabled={deleting === session.id}
											class="absolute top-4 right-4 p-1 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
											title="End session"
										>
											{#if deleting === session.id}
												<div class="w-4 h-4 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin"></div>
											{:else}
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
												</svg>
											{/if}
										</button>
									</div>
								{/each}
							{/each}
						</div>
					</div>
				{/if}

				<!-- New Session / Available Worlds -->
				<div>
					<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-4">
						{hasActiveSessions ? 'Start New Session' : 'Worlds'}
					</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						<!-- Dynamic Adventure card -->
						<button
							onclick={openDynamicModal}
							disabled={creatingDynamic || creating !== null}
							class="group relative text-left bg-gradient-to-br from-purple-900/20 to-[var(--bg-secondary)] rounded-xl border border-purple-500/30 p-6 hover:border-purple-500/60 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<div class="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-700/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
								<svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
								</svg>
							</div>
							<h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">Dynamic Adventure</h3>
							<p class="text-sm text-[var(--text-muted)] line-clamp-2">AI generates the world as you explore. No predefined locations.</p>
							{#if creatingDynamic}
								<div class="absolute inset-0 bg-[var(--bg-secondary)]/80 rounded-xl flex items-center justify-center">
									<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
								</div>
							{/if}
							<div class="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
								<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
								</svg>
							</div>
						</button>

						{#each worlds as world}
							<button
								onclick={() => startSession(world.id)}
								disabled={creating !== null}
								class="group relative text-left bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6 hover:border-[var(--accent-primary)]/50 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<!-- World Icon -->
								<div class="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
									<svg class="w-6 h-6 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>

								<!-- World Info -->
								<h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">{world.name}</h3>
								{#if world.description}
									<p class="text-sm text-[var(--text-muted)] line-clamp-2">{world.description}</p>
								{/if}

								<!-- Loading Indicator -->
								{#if creating === world.id}
									<div class="absolute inset-0 bg-[var(--bg-secondary)]/80 rounded-xl flex items-center justify-center">
										<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]"></div>
									</div>
								{/if}

								<!-- Explore Arrow -->
								<div class="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
									<svg class="w-5 h-5 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
									</svg>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Dynamic Adventure Theme Modal -->
	{#if showDynamicModal}
		<div
			class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
			onclick={(e) => { if (e.target === e.currentTarget) showDynamicModal = false; }}
			onkeydown={(e) => { if (e.key === 'Escape') showDynamicModal = false; }}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="bg-[var(--bg-secondary)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[var(--border-primary)]">
				<h3 class="text-xl font-bold text-[var(--text-primary)] mb-2">Start Dynamic Adventure</h3>
				<p class="text-sm text-[var(--text-muted)] mb-5">Choose a world theme, or leave empty for a surprise.</p>

				<!-- Theme presets -->
				<div class="grid grid-cols-2 gap-2 mb-4">
					{#each themePresets as preset}
						<button
							onclick={() => { selectedTheme = selectedTheme === preset.id ? null : preset.id; customTheme = ''; }}
							class="text-left p-3 rounded-xl border transition-all {selectedTheme === preset.id
								? 'border-purple-500 bg-purple-500/10'
								: 'border-[var(--border-primary)] bg-[var(--bg-tertiary)] hover:border-[var(--border-secondary)]'}"
						>
							<p class="font-medium text-sm text-[var(--text-primary)]">{preset.label}</p>
							<p class="text-xs text-[var(--text-muted)] mt-0.5">{preset.description}</p>
						</button>
					{/each}
				</div>

				<!-- Custom theme input -->
				<div class="mb-5">
					<input
						type="text"
						bind:value={customTheme}
						onfocus={() => { selectedTheme = 'custom'; }}
						placeholder="Or type a custom theme..."
						class="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
					/>
				</div>

				<!-- Actions -->
				<div class="flex items-center gap-3 justify-end">
					<button
						onclick={() => { showDynamicModal = false; }}
						class="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition text-sm"
					>
						Cancel
					</button>
					<button
						onclick={startDynamicSession}
						disabled={creatingDynamic}
						class="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition text-sm"
					>
						{#if creatingDynamic}
							<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
						{:else}
							Start Adventure
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</MainLayout>
