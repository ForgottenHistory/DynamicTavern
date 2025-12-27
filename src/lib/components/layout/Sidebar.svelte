<script lang="ts">
	import type { SafeUser } from '$lib/server/db/schema';

	interface ActivePersonaInfo {
		name: string;
		description: string | null;
		avatarData: string | null;
		personaId: number | null;
	}

	interface ConversationInfo {
		id: number;
		characterId: number | null;
		primaryCharacterId: number | null;
		name: string | null;
		createdAt: Date;
		character: {
			id: number;
			name: string;
			thumbnailData: string | null;
			imageData: string | null;
		} | null;
		lastMessage: {
			content: string;
			role: string;
			createdAt: Date;
		} | null;
		messageCount: number;
	}

	interface Props {
		user: SafeUser;
		conversations: ConversationInfo[];
		activePersona: ActivePersonaInfo | null;
		collapsed: boolean;
	}

	let { user, conversations, activePersona, collapsed }: Props = $props();

	let searchQuery = $state('');
	let isSearching = $state(false);
	let searchInputRef = $state<HTMLInputElement | null>(null);

	let filteredConversations = $derived(
		searchQuery.trim()
			? conversations.filter(c =>
				c.character?.name.toLowerCase().includes(searchQuery.toLowerCase())
			)
			: conversations
	);

	function startSearch() {
		isSearching = true;
		setTimeout(() => searchInputRef?.focus(), 0);
	}

	function endSearch() {
		if (!searchQuery.trim()) {
			isSearching = false;
		}
	}

	function clearSearch() {
		searchQuery = '';
		isSearching = false;
	}
</script>

<div
	class="bg-[var(--sidebar-bg)] border-r border-[var(--border-primary)] shadow-lg flex flex-col transition-all duration-300 flex-shrink-0 {collapsed
		? 'w-0'
		: 'w-80'} overflow-hidden"
>
	<!-- Logo/Brand -->
	<div class="p-6 border-b border-[var(--border-primary)]">
		<h1 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]">
			DynamicTavern
		</h1>
	</div>

	<!-- Chats List -->
	<div class="flex-1 overflow-y-auto">
		<div class="p-5">
			<!-- Start Chat Button -->
			<a
				href="/chat"
				class="w-full mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Start a Chat
			</a>

			<!-- Chats Header / Search Toggle -->
			<div class="mb-4">
				{#if isSearching}
					<div class="relative">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
						</svg>
						<input
							bind:this={searchInputRef}
							type="text"
							bind:value={searchQuery}
							onblur={endSearch}
							onkeydown={(e) => e.key === 'Escape' && clearSearch()}
							placeholder="Search chats..."
							class="w-full pl-10 pr-8 py-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition"
						/>
						<button
							onmousedown={(e) => e.preventDefault()}
							onclick={clearSearch}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
							aria-label="Clear search"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						</button>
					</div>
				{:else}
					<button
						onclick={startSearch}
						class="w-full px-4 py-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/40 transition-all group cursor-pointer"
					>
						<div class="flex items-center justify-between">
							<h2 class="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider">
								Chats ({conversations.length})
							</h2>
							<svg class="w-4 h-4 text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
							</svg>
						</div>
					</button>
				{/if}
			</div>

			{#if conversations.length === 0}
				<div class="text-center py-12 px-4">
					<div
						class="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center shadow-lg"
					>
						<svg
							class="w-10 h-10 text-[var(--accent-primary)]"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>
					<p class="text-[var(--text-primary)] font-semibold text-sm mb-1">No chats yet</p>
					<p class="text-[var(--text-muted)] text-xs">Start a chat to begin!</p>
				</div>
			{:else if filteredConversations.length === 0}
				<div class="text-center py-8 px-4">
					<svg class="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<p class="text-[var(--text-secondary)] text-sm mb-1">No matches found</p>
					<p class="text-[var(--text-muted)] text-xs">Try a different search term</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredConversations as conv}
						<a
							href="/chat/{conv.character?.id || conv.characterId}"
							class="group relative flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50 hover:shadow-lg hover:scale-[1.02] cursor-pointer transition-all duration-300"
						>
							<!-- Avatar -->
							<div class="relative flex-shrink-0">
								<div
									class="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity"
								></div>
								<div class="relative bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-xl p-0.5">
									{#if conv.character?.thumbnailData || conv.character?.imageData}
										<img
											src={conv.character.thumbnailData || conv.character.imageData}
											alt={conv.character.name}
											class="w-12 h-16 rounded-lg object-cover"
										/>
									{:else}
										<div
											class="w-12 h-16 rounded-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold text-xl"
										>
											{(conv.character?.name || '?').charAt(0).toUpperCase()}
										</div>
									{/if}
								</div>
							</div>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between mb-0.5">
									<h3 class="font-bold text-[var(--text-primary)] truncate">
										{conv.character?.name || 'Unknown'}
									</h3>
									<span class="text-xs text-[var(--text-muted)] flex-shrink-0 ml-2">
										{conv.messageCount} msgs
									</span>
								</div>
								{#if conv.lastMessage}
									<p class="text-xs text-[var(--text-muted)] truncate">
										{conv.lastMessage.content.slice(0, 50)}{conv.lastMessage.content.length > 50 ? '...' : ''}
									</p>
								{/if}
							</div>

							<!-- Chevron indicator -->
							<svg
								class="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- User Profile at Bottom -->
	<div class="border-t border-[var(--border-primary)] p-4 bg-[var(--bg-secondary)]">
		<div class="flex items-center gap-1 p-3 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
			<a href="/profile" class="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition">
				<div class="relative">
					<div
						class="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-full blur-sm opacity-50"
					></div>
					{#if activePersona?.avatarData}
						<img
							src={activePersona.avatarData}
							alt={activePersona.name}
							class="relative w-10 h-10 rounded-full object-cover shadow-md"
						/>
					{:else if (user.avatarThumbnail || user.avatarData) && !activePersona?.personaId}
						<img
							src={user.avatarThumbnail || user.avatarData}
							alt={user.displayName}
							class="relative w-10 h-10 rounded-full object-cover shadow-md"
						/>
					{:else}
						<div
							class="relative w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold shadow-md"
						>
							{(activePersona?.name || user.displayName).charAt(0).toUpperCase()}
						</div>
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="font-bold text-[var(--text-primary)] truncate text-sm">{activePersona?.name || user.displayName}</h3>
					<p class="text-xs text-[var(--text-muted)] truncate">{activePersona?.personaId ? 'Persona' : user.username}</p>
				</div>
			</a>
			<a
				href="/image-settings"
				class="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition"
				title="Image Generation Settings"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</a>
			<a
				href="/settings"
				class="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition"
				title="LLM Settings"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
					/>
				</svg>
			</a>
			<a
				href="/general-settings"
				class="p-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition"
				title="General Settings"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</a>
		</div>
	</div>
</div>
