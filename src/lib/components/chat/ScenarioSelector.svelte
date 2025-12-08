<script lang="ts">
	import type { Character } from '$lib/server/db/schema';

	interface Props {
		character: Character;
		onStart: (conversationId: number) => void;
	}

	let { character, onStart }: Props = $props();

	interface Scenario {
		id: string;
		name: string;
		content: string;
	}

	let scenarios = $state<Scenario[]>([]);
	let loading = $state(true);
	let starting = $state(false);
	let selectedScenarioId = $state<string | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		loadScenarios();
	});

	async function loadScenarios() {
		loading = true;
		try {
			const response = await fetch('/api/scenarios');
			const data = await response.json();
			scenarios = data.scenarios || [];
		} catch (err) {
			console.error('Failed to load scenarios:', err);
		} finally {
			loading = false;
		}
	}

	async function startChat(useStandardGreeting: boolean) {
		if (starting) return;

		starting = true;
		error = null;

		try {
			const response = await fetch(`/api/chat/${character.id}/start`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					useStandardGreeting,
					scenarioId: useStandardGreeting ? null : selectedScenarioId
				})
			});

			const result = await response.json();

			if (response.ok) {
				onStart(result.conversationId);
			} else {
				error = result.error || 'Failed to start chat';
			}
		} catch (err) {
			console.error('Failed to start chat:', err);
			error = 'Failed to start chat';
		} finally {
			starting = false;
		}
	}
</script>

<div class="flex-1 flex min-h-0 gap-4 p-4">
	<!-- Left Side: Character Image -->
	<div class="relative w-80 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-primary)] hidden lg:block">
		{#if character.imageData}
			<img
				src={character.imageData}
				alt={character.name}
				class="w-full h-full object-cover object-center"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center text-[var(--text-muted)] bg-[var(--bg-tertiary)]">
				<svg class="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
				</svg>
			</div>
		{/if}
		<!-- Top gradient fade -->
		<div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/40 via-black/20 to-transparent"></div>
		<!-- Subtle vignette -->
		<div class="absolute inset-0" style="box-shadow: inset 0 0 80px rgba(0,0,0,0.15)"></div>
		<!-- Character name overlay at bottom -->
		<div class="absolute bottom-0 left-0 right-0 h-24">
			<div class="absolute inset-0 backdrop-blur-sm" style="mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%); -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)"></div>
			<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
			<div class="absolute bottom-4 left-4 right-4">
				<h2 class="text-lg font-bold text-white drop-shadow-lg">{character.name}</h2>
			</div>
		</div>
	</div>

	<!-- Right Side: Scenario Selection -->
	<div class="flex-1 flex flex-col min-h-0 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] overflow-hidden">
		<!-- Header -->
		<div class="p-6 border-b border-[var(--border-primary)]">
			<h1 class="text-xl font-bold text-[var(--text-primary)]">Start a conversation</h1>
			<p class="text-sm text-[var(--text-muted)] mt-1">Choose how you'd like to begin with {character.name}</p>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-6 space-y-4">
			{#if error}
				<div class="p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl text-[var(--error)] text-sm">
					{error}
				</div>
			{/if}

			<!-- Standard Greeting Option -->
			<button
				onclick={() => startChat(true)}
				disabled={starting}
				class="w-full p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] border border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50 rounded-xl text-left transition disabled:opacity-50 disabled:cursor-not-allowed group"
			>
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-primary)]/30 transition">
						<svg class="w-6 h-6 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
						</svg>
					</div>
					<div class="flex-1">
						<h3 class="font-semibold text-[var(--text-primary)]">Standard Greeting</h3>
						<p class="text-sm text-[var(--text-muted)]">Use the default opening message from the character card</p>
					</div>
					<svg class="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</div>
			</button>

			<!-- Divider -->
			<div class="flex items-center gap-4 py-2">
				<div class="flex-1 h-px bg-[var(--border-primary)]"></div>
				<span class="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Custom Scenarios</span>
				<div class="flex-1 h-px bg-[var(--border-primary)]"></div>
			</div>

			<!-- Scenarios Section -->
			{#if loading}
				<div class="p-8 text-center text-[var(--text-muted)]">
					<div class="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
					Loading scenarios...
				</div>
			{:else if scenarios.length === 0}
				<div class="p-6 bg-[var(--bg-tertiary)] rounded-xl text-center border border-[var(--border-primary)]">
					<svg class="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
					</svg>
					<p class="text-[var(--text-secondary)] font-medium mb-1">No scenarios available</p>
					<p class="text-sm text-[var(--text-muted)]">Add scenario files to <code class="bg-[var(--bg-primary)] px-1.5 py-0.5 rounded text-xs">data/scenarios/</code></p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each scenarios as scenario}
						<button
							onclick={() => selectedScenarioId = selectedScenarioId === scenario.id ? null : scenario.id}
							disabled={starting}
							class="w-full p-4 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] border rounded-xl text-left transition disabled:opacity-50
								{selectedScenarioId === scenario.id
									? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5'
									: 'border-[var(--border-primary)]'}"
						>
							<div class="flex items-start gap-3">
								<div class="w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
									{selectedScenarioId === scenario.id
										? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
										: 'border-[var(--text-muted)]'}">
									{#if selectedScenarioId === scenario.id}
										<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
										</svg>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="font-medium text-[var(--text-primary)]">{scenario.name}</h4>
									<p class="text-sm text-[var(--text-muted)] mt-1">{scenario.content}</p>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer with action button -->
		{#if selectedScenarioId}
			<div class="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
				<button
					onclick={() => startChat(false)}
					disabled={starting}
					class="w-full py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
				>
					{#if starting}
						<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
						Generating greeting...
					{:else}
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
						</svg>
						Start with Scenario
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>
