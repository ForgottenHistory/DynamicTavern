import type { Character } from '$lib/server/db/schema';
import type { WorldStateData } from '$lib/server/services/worldInfoService';
import * as api from './sandboxActions';

export interface WorldStateContext {
	sessionId: number;
	getPrimaryCharacter: () => Character | null;
}

export function createWorldState(ctx: WorldStateContext) {
	// World state data
	let worldState = $state<WorldStateData | null>(null);
	let worldStateLoading = $state(false);
	let worldSidebarEnabled = $state(false);

	// Display state
	let worldExpanded = $state(true);
	let expandedWorldSections = $state<Set<string>>(new Set(['character']));
	let expandedWorldItems = $state<Set<string>>(new Set());

	// Editing state
	let editingWorldKey = $state<string | null>(null);
	let editingWorldValue = $state<string>('');
	let editingListItem = $state<{ entityKey: string; attrName: string; itemIdx: number } | null>(null);
	let editingItemName = $state('');
	let editingItemDescription = $state('');

	// --- Load ---

	async function load() {
		try {
			worldState = await api.getWorldState(ctx.sessionId);
		} catch (e) {
			console.error('Failed to load world state:', e);
		}
	}

	// --- Actions ---

	async function generate() {
		worldStateLoading = true;
		try {
			worldState = await api.generateWorldState(ctx.sessionId);
		} catch (e) {
			console.error('Failed to generate world state:', e);
		} finally {
			worldStateLoading = false;
		}
	}

	async function clear() {
		try {
			await api.clearWorldState(ctx.sessionId);
			worldState = null;
		} catch (e) {
			console.error('Failed to clear world state:', e);
		}
	}

	function reset() {
		worldState = null;
	}

	// --- Display helpers ---

	function getEntityLabel(entityKey: string): string {
		if (entityKey === 'user') return 'You';
		if (entityKey === 'character') return ctx.getPrimaryCharacter()?.name ?? 'Character';
		return entityKey;
	}

	function getAttributeIcon(attrName: string): { path: string; color: string } | null {
		const icons: Record<string, { path: string; color: string }> = {
			mood: { path: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'var(--warning)' },
			position: { path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', color: 'var(--accent-primary)' },
			clothes: { path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'var(--text-muted)' },
			clothing: { path: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'var(--text-muted)' },
			body: { path: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'var(--accent-secondary)' },
			thinking: { path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', color: 'var(--text-secondary)' }
		};
		return icons[attrName.toLowerCase()] || null;
	}

	function toggleWorldSection(section: string) {
		const newSet = new Set(expandedWorldSections);
		if (newSet.has(section)) newSet.delete(section); else newSet.add(section);
		expandedWorldSections = newSet;
	}

	function toggleWorldItem(key: string) {
		const newSet = new Set(expandedWorldItems);
		if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
		expandedWorldItems = newSet;
	}

	// --- Editing ---

	function startEditText(entityKey: string, attrName: string, currentValue: string) {
		editingWorldKey = `${entityKey}-${attrName}`;
		editingWorldValue = currentValue;
		editingListItem = null;
	}

	function startEditListItem(entityKey: string, attrName: string, itemIdx: number, item: { name: string; description: string }) {
		editingListItem = { entityKey, attrName, itemIdx };
		editingItemName = item.name;
		editingItemDescription = item.description;
		editingWorldKey = null;
	}

	function cancelEdit() {
		editingWorldKey = null;
		editingListItem = null;
	}

	async function saveTextEdit(entityKey: string, attrName: string) {
		const updated = await api.updateWorldState(ctx.sessionId, entityKey, attrName, editingWorldValue);
		if (updated) worldState = updated;
		editingWorldKey = null;
	}

	async function saveListItemEdit() {
		if (!editingListItem || !worldState) return;
		const { entityKey, attrName, itemIdx } = editingListItem;
		const entity = worldState[entityKey];
		if (!entity) return;

		const attr = entity.attributes.find(a => a.name === attrName);
		if (!attr || attr.type !== 'list' || !Array.isArray(attr.value)) return;

		const newList = [...attr.value];
		newList[itemIdx] = { name: editingItemName, description: editingItemDescription };

		const updated = await api.updateWorldState(ctx.sessionId, entityKey, attrName, newList);
		if (updated) worldState = updated;
		editingListItem = null;
	}

	async function deleteListItem(entityKey: string, attrName: string, itemIdx: number) {
		if (!worldState) return;
		const entity = worldState[entityKey];
		if (!entity) return;

		const attr = entity.attributes.find(a => a.name === attrName);
		if (!attr || attr.type !== 'list' || !Array.isArray(attr.value)) return;

		const newList = attr.value.filter((_: unknown, i: number) => i !== itemIdx);
		const updated = await api.updateWorldState(ctx.sessionId, entityKey, attrName, newList);
		if (updated) worldState = updated;
	}

	function setSidebarEnabled(v: boolean) {
		worldSidebarEnabled = v;
	}

	return {
		get worldState() { return worldState; },
		get worldStateLoading() { return worldStateLoading; },
		get worldSidebarEnabled() { return worldSidebarEnabled; },
		get worldExpanded() { return worldExpanded; },
		set worldExpanded(v: boolean) { worldExpanded = v; },
		get expandedWorldSections() { return expandedWorldSections; },
		get expandedWorldItems() { return expandedWorldItems; },
		get editingWorldKey() { return editingWorldKey; },
		get editingWorldValue() { return editingWorldValue; },
		set editingWorldValue(v: string) { editingWorldValue = v; },
		get editingListItem() { return editingListItem; },
		get editingItemName() { return editingItemName; },
		set editingItemName(v: string) { editingItemName = v; },
		get editingItemDescription() { return editingItemDescription; },
		set editingItemDescription(v: string) { editingItemDescription = v; },

		load,
		generate,
		clear,
		reset,
		setSidebarEnabled,
		getEntityLabel,
		getAttributeIcon,
		toggleWorldSection,
		toggleWorldItem,
		startEditText,
		startEditListItem,
		cancelEdit,
		saveTextEdit,
		saveListItemEdit,
		deleteListItem
	};
}
