<script lang="ts">
	import type { SafeUser, Character } from '$lib/server/db/schema';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { getCharactersCache, setCharactersCache, isCharactersCacheLoaded } from '$lib/stores/characters';
	import { getConversationsCache, setConversationsCache, isConversationsCacheLoaded, invalidateConversationsCache } from '$lib/stores/conversations';
	import Sidebar from './layout/Sidebar.svelte';
	import TopNavBar from './layout/TopNavBar.svelte';

	interface Props {
		user: SafeUser;
		currentPath: string;
		children: Snippet;
	}

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

	let { user, currentPath, children }: Props = $props();

	let sidebarCollapsed = $state(false);
	let characters = $state<Character[]>(getCharactersCache());
	let conversations = $state<ConversationInfo[]>(getConversationsCache());
	let activePersona = $state<ActivePersonaInfo | null>(null);

	onMount(() => {
		// Load sidebar collapsed state from localStorage
		const savedState = localStorage.getItem('sidebarCollapsed');
		if (savedState !== null) {
			sidebarCollapsed = savedState === 'true';
		}

		// Load conversations for sidebar (only if not cached)
		if (!isConversationsCacheLoaded()) {
			loadConversations();
		}

		// Load characters for cache
		if (!isCharactersCacheLoaded()) {
			loadCharacters();
		}

		// Load active persona
		loadActivePersona();

		// Listen for character updates from other components
		const handleCharacterUpdate = () => {
			loadCharacters();
		};
		window.addEventListener('characterUpdated', handleCharacterUpdate);

		// Listen for conversation updates
		const handleConversationUpdate = () => {
			invalidateConversationsCache();
			loadConversations();
		};
		window.addEventListener('conversationUpdated', handleConversationUpdate);

		// Listen for persona updates
		const handlePersonaUpdate = () => {
			loadActivePersona();
		};
		window.addEventListener('personaUpdated', handlePersonaUpdate);

		return () => {
			window.removeEventListener('characterUpdated', handleCharacterUpdate);
			window.removeEventListener('conversationUpdated', handleConversationUpdate);
			window.removeEventListener('personaUpdated', handlePersonaUpdate);
		};
	});

	async function loadActivePersona() {
		try {
			const response = await fetch('/api/personas/active');
			if (response.ok) {
				activePersona = await response.json();
			}
		} catch (error) {
			console.error('Failed to load active persona:', error);
		}
	}

	async function loadConversations() {
		try {
			const response = await fetch('/api/conversations');
			const result = await response.json();
			conversations = result.conversations || [];
			setConversationsCache(conversations);
		} catch (error) {
			console.error('Failed to load conversations:', error);
		}
	}

	// Save sidebar state when it changes
	$effect(() => {
		localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
	});

	async function loadCharacters() {
		try {
			const response = await fetch('/api/characters');
			const result = await response.json();
			characters = result.characters || [];
			setCharactersCache(characters);
		} catch (error) {
			console.error('Failed to load characters:', error);
		}
	}

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}
</script>

<div class="flex h-screen bg-[var(--bg-primary)]">
	<!-- Left Sidebar -->
	<Sidebar
		{user}
		{conversations}
		{activePersona}
		collapsed={sidebarCollapsed}
	/>

	<!-- Sidebar Toggle Button -->
	<button
		onclick={toggleSidebar}
		class="fixed left-{sidebarCollapsed
			? '0'
			: '[312px]'} top-1/2 -translate-y-1/2 z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] p-2 rounded-r-lg shadow-md hover:bg-[var(--bg-tertiary)] transition"
		title={sidebarCollapsed ? 'Show chats' : 'Hide chats'}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			{#if sidebarCollapsed}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			{/if}
		</svg>
	</button>

	<!-- Main Content Area -->
	<div class="flex-1 flex flex-col">
		<!-- Top Navigation Bar -->
		<TopNavBar {currentPath} />

		<!-- Page Content -->
		<div class="flex-1 overflow-hidden">
			{@render children()}
		</div>
	</div>
</div>
