<script lang="ts">
	import { slide } from 'svelte/transition';
	import { browser } from '$app/environment';

	// Generic types matching the server
	interface ListItem {
		name: string;
		description: string;
	}

	interface WorldAttribute {
		name: string;
		type: 'text' | 'list';
		value: string | ListItem[];
	}

	interface EntityState {
		attributes: WorldAttribute[];
	}

	interface WorldStateData {
		[entity: string]: EntityState;
	}

	interface Props {
		characterName: string;
		worldState: WorldStateData | null;
		loading: boolean;
		onRegenerate: () => void;
		onLookAtItem: (owner: string, itemName: string, itemDescription: string) => void;
	}

	let { characterName, worldState, loading, onRegenerate, onLookAtItem }: Props = $props();

	let collapsed = $state(browser ? localStorage.getItem('worldPanelCollapsed') === 'true' : false);
	let expandedSections = $state<Set<string>>(new Set(['character']));
	let expandedItems = $state<Set<string>>(new Set());

	// Persist collapsed state
	$effect(() => {
		if (browser) {
			localStorage.setItem('worldPanelCollapsed', String(collapsed));
		}
	});

	function toggleSection(section: string) {
		const newSet = new Set(expandedSections);
		if (newSet.has(section)) {
			newSet.delete(section);
		} else {
			newSet.add(section);
		}
		expandedSections = newSet;
	}

	function isSectionExpanded(section: string): boolean {
		return expandedSections.has(section);
	}

	function toggleItem(key: string) {
		const newSet = new Set(expandedItems);
		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		expandedItems = newSet;
	}

	function isItemExpanded(key: string): boolean {
		return expandedItems.has(key);
	}

	// Get display label for entity
	function getEntityLabel(entityKey: string): string {
		if (entityKey === 'character') return characterName;
		if (entityKey === 'user') return 'You';
		return entityKey.charAt(0).toUpperCase() + entityKey.slice(1);
	}

	// Get icon for known attributes
	function getAttributeIcon(attrName: string): { path: string; color: string } | null {
		const icons: Record<string, { path: string; color: string }> = {
			mood: {
				path: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
				color: 'var(--warning)'
			},
			position: {
				path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
				color: 'var(--accent-primary)'
			},
			clothes: {
				path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
				color: 'var(--text-muted)'
			},
			clothing: {
				path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
				color: 'var(--text-muted)'
			},
			body: {
				path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
				color: 'var(--accent-secondary)'
			}
		};
		return icons[attrName.toLowerCase()] || null;
	}

	// Format attribute name for display
	function formatAttrName(name: string): string {
		return name.charAt(0).toUpperCase() + name.slice(1);
	}

	// Check if entity has any content
	function hasEntityContent(entity: EntityState): boolean {
		return entity.attributes.some(attr => {
			if (attr.type === 'text' && typeof attr.value === 'string') return attr.value.trim() !== '';
			if (attr.type === 'list' && Array.isArray(attr.value)) return attr.value.length > 0;
			return false;
		});
	}
</script>

<div class="{collapsed ? 'w-12' : 'w-72'} flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] flex flex-col overflow-hidden transition-all duration-200">
	<div class="p-3 border-b border-[var(--border-primary)] flex items-center {collapsed ? 'justify-center' : 'justify-between'}">
		{#if !collapsed}
			<h3 class="font-semibold text-[var(--text-primary)]">World</h3>
			<div class="flex items-center gap-1">
				<button
					onclick={onRegenerate}
					disabled={loading}
					class="p-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
					title="Regenerate"
				>
					<svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
					</svg>
				</button>
				<button
					onclick={() => collapsed = true}
					class="p-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
					title="Collapse"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
					</svg>
				</button>
			</div>
		{:else}
			<button
				onclick={() => collapsed = false}
				class="p-1.5 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
				title="Expand World Panel"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
				</svg>
			</button>
		{/if}
	</div>

	{#if !collapsed}
	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="animate-spin rounded-full h-6 w-6 border-2 border-[var(--accent-primary)] border-t-transparent"></div>
				<span class="ml-2 text-sm text-[var(--text-muted)]">Generating...</span>
			</div>
		{:else if worldState && Object.keys(worldState).length > 0}
			{#each Object.entries(worldState) as [entityKey, entity]}
				{#if hasEntityContent(entity)}
					<!-- Entity Section Header -->
					<button
						onclick={() => toggleSection(entityKey)}
						class="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition border-b border-[var(--border-primary)]"
					>
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4 text-[var(--accent-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
							<span class="text-sm font-medium text-[var(--accent-secondary)]">{getEntityLabel(entityKey)}</span>
						</div>
						<svg class="w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 {isSectionExpanded(entityKey) ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>

					{#if isSectionExpanded(entityKey)}
						<div class="py-1" transition:slide={{ duration: 200 }}>
							{#each entity.attributes as attr, attrIdx}
								{@const icon = getAttributeIcon(attr.name)}
								{@const itemKey = `${entityKey}-${attr.name}`}

								{#if attr.type === 'text' && typeof attr.value === 'string' && attr.value.trim()}
									<!-- Text Attribute -->
									<div class="px-3 py-2 flex items-start gap-2">
										{#if icon}
											<svg class="w-4 h-4 flex-shrink-0 mt-0.5" style="color: {icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon.path}/>
											</svg>
										{:else}
											<svg class="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
											</svg>
										{/if}
										<div>
											<span class="text-xs text-[var(--text-muted)] uppercase tracking-wide">{formatAttrName(attr.name)}</span>
											<p class="text-sm text-[var(--text-secondary)]">{attr.value}</p>
										</div>
									</div>

								{:else if attr.type === 'list' && Array.isArray(attr.value) && attr.value.length > 0}
									<!-- List Attribute Header -->
									<div class="px-3 py-2">
										<span class="text-xs text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-2">
											{#if icon}
												<svg class="w-3 h-3" style="color: {icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon.path}/>
												</svg>
											{/if}
											{formatAttrName(attr.name)}
										</span>
									</div>
									<!-- List Items -->
									{#each attr.value as item, itemIdx}
										{@const listItemKey = `${itemKey}-${itemIdx}`}
										<div class="flex items-center px-3 py-1.5 hover:bg-[var(--bg-tertiary)] transition">
											<button
												onclick={() => toggleItem(listItemKey)}
												class="flex-1 text-left flex items-center gap-2"
											>
												<svg class="w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 {isItemExpanded(listItemKey) ? 'rotate-90' : ''}" fill="currentColor" viewBox="0 0 20 20">
													<path d="M6 6L14 10L6 14V6Z"/>
												</svg>
												<span class="text-sm text-[var(--text-secondary)]">{item.name}</span>
											</button>
											<button
												onclick={() => onLookAtItem(getEntityLabel(entityKey), item.name, item.description)}
												class="p-1 hover:bg-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
												title="Look at {item.name}"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
												</svg>
											</button>
										</div>
										{#if isItemExpanded(listItemKey)}
											<div class="px-3 pb-2 pl-8" transition:slide={{ duration: 150 }}>
												<p class="text-sm text-[var(--text-muted)]">{item.description}</p>
											</div>
										{/if}
									{/each}
								{/if}
							{/each}
						</div>
					{/if}
				{/if}
			{/each}
		{:else}
			<div class="text-center py-8">
				<p class="text-sm text-[var(--text-muted)]">No data</p>
				<button
					onclick={onRegenerate}
					class="mt-2 text-sm text-[var(--accent-primary)] hover:underline"
				>
					Generate world state
				</button>
			</div>
		{/if}
	</div>
	{/if}
</div>
