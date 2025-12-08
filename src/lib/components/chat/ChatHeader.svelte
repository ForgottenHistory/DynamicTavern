<script lang="ts">
	import type { Character } from '$lib/server/db/schema';
	import { browser } from '$app/environment';

	interface Props {
		character: Character | null;
		conversationId: number | null;
		branchCount?: number;
		onReset: () => void;
		onBack: () => void;
		onToggleBranches?: () => void;
	}

	let { character, conversationId, branchCount = 0, onReset, onBack, onToggleBranches }: Props = $props();

	// Load collapsed state from localStorage
	let collapsed = $state(browser ? localStorage.getItem('chatHeaderCollapsed') !== 'false' : true);
	let showMenu = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });

	// Persist collapsed state to localStorage
	$effect(() => {
		if (browser) {
			localStorage.setItem('chatHeaderCollapsed', String(collapsed));
		}
	});

	function handleMenuClick(e: MouseEvent) {
		if (!showMenu) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			menuPosition = { x: rect.right - 180, y: rect.bottom + 8 };
		}
		showMenu = !showMenu;
	}

	async function exportConversation() {
		if (!conversationId || !character) return;

		try {
			const response = await fetch(`/api/chat/${conversationId}/export`);
			if (!response.ok) {
				alert('Failed to export conversation');
				return;
			}

			const data = await response.json();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${character.name}_conversation_${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to export conversation:', error);
			alert('Failed to export conversation');
		}
	}
</script>

{#if character}
	<div class="relative flex-shrink-0">
		<!-- Banner Image -->
		<div
			class="relative overflow-hidden transition-all duration-300 {collapsed ? 'h-16' : 'h-52'}"
		>
			{#if character.imageData}
				<img
					src={character.imageData}
					alt={character.name}
					class="w-full h-full object-cover"
				/>
			{:else}
				<div class="w-full h-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)]"></div>
			{/if}
			<div
				class="absolute inset-0 bg-gradient-to-b from-black/20 via-[var(--accent-secondary)]/30 to-black/70"
			></div>

			<!-- Top Right Buttons -->
			<div class="absolute top-4 right-4 z-30 flex items-center gap-2">
				<!-- Branches Button -->
				{#if onToggleBranches}
					<button
						onclick={onToggleBranches}
						class="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20 relative"
						title="View branches"
					>
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="18" cy="18" r="3"/>
							<circle cx="6" cy="6" r="3"/>
							<circle cx="6" cy="18" r="3"/>
							<path d="M6 9v9"/>
							<path d="M18 15V9a3 3 0 0 0-3-3H9"/>
						</svg>
						{#if branchCount > 1}
							<span class="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent-primary)] text-white text-xs font-bold rounded-full flex items-center justify-center">
								{branchCount}
							</span>
						{/if}
					</button>
				{/if}

				<!-- Collapse/Expand Button -->
				<button
					onclick={() => (collapsed = !collapsed)}
					class="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
					title={collapsed ? 'Expand banner' : 'Collapse banner'}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						{#if collapsed}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M19 9l-7 7-7-7"
							/>
						{:else}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2.5"
								d="M5 15l7-7 7 7"
							/>
						{/if}
					</svg>
				</button>

				<!-- Menu Button -->
				<button
					onclick={handleMenuClick}
					class="p-2.5 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 hover:scale-110 transition-all shadow-lg border border-white/20"
					title="Menu"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
						/>
					</svg>
				</button>
			</div>

			<!-- Character Info Overlay -->
			{#if collapsed}
				<!-- Compact mode -->
				<div
					class="absolute bottom-0 left-0 right-0 px-6 py-3 text-white flex items-center justify-between"
				>
					<div class="flex items-center gap-3">
						<h2 class="text-lg font-bold drop-shadow-2xl">{character.name}</h2>
					</div>
				</div>
			{:else}
				<!-- Full mode -->
				<div class="absolute bottom-0 left-0 right-0 p-6 text-white">
					<div class="flex items-center gap-4">
						<!-- Avatar -->
						<div class="relative flex-shrink-0">
							<div
								class="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-2xl blur-lg opacity-60"
							></div>
							<div class="relative p-1 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-2xl">
								{#if character.imageData}
									<img
										src={character.imageData}
										alt={character.name}
										class="w-24 h-32 rounded-xl object-cover border-4 border-white shadow-2xl"
									/>
								{:else}
									<div
										class="w-24 h-32 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold text-3xl border-4 border-white shadow-2xl"
									>
										{character.name.charAt(0).toUpperCase()}
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1">
							<h2 class="text-2xl font-bold drop-shadow-2xl">{character.name}</h2>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Dropdown Menu (portal-style) -->
{#if showMenu}
	<div class="fixed inset-0 z-[998]" onclick={() => (showMenu = false)}></div>
	<div
		class="fixed bg-[var(--bg-secondary)] backdrop-blur-md border border-[var(--border-primary)] rounded-xl shadow-xl py-1 min-w-[180px] z-[999]"
		style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
	>
		<button
			onclick={() => {
				showMenu = false;
				exportConversation();
			}}
			class="w-full text-left px-4 py-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all font-medium flex items-center gap-2"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
				/>
			</svg>
			Export Conversation
		</button>
		<button
			onclick={() => {
				showMenu = false;
				onReset();
			}}
			class="w-full text-left px-4 py-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all font-medium flex items-center gap-2"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			Reset Conversation
		</button>
		<button
			onclick={() => {
				showMenu = false;
				onBack();
			}}
			class="w-full text-left px-4 py-2.5 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all font-medium flex items-center gap-2"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 19l-7-7 7-7"
				/>
			</svg>
			Back to Library
		</button>
	</div>
{/if}
