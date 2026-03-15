import type { Character, Message } from '$lib/server/db/schema';
import * as api from './sandboxActions';

export interface CharactersContext {
	sessionId: number;
	getCharacters: () => Character[];
	setCharacters: (chars: Character[]) => void;
	setMessages: (msgs: Message[]) => void;
	getSending: () => boolean;
	setSending: (v: boolean) => void;
	getGenerating: () => boolean;
	setError: (err: string | null) => void;
	onScrollToBottom: () => void;
}

export function createCharacters(ctx: CharactersContext) {
	// Character picker
	let showCharacterPicker = $state(false);
	let availableCharacters = $state<Character[]>([]);
	let characterPickerLoading = $state(false);
	let removingCharacterIds = $state<Set<number>>(new Set());

	async function openCharacterPicker() {
		characterPickerLoading = true;
		showCharacterPicker = true;
		try {
			const chars = await api.fetchCharacters(ctx.sessionId);
			availableCharacters = chars;
		} catch (e) {
			console.error('Failed to fetch characters:', e);
			availableCharacters = [];
		} finally {
			characterPickerLoading = false;
		}
	}

	function closeCharacterPicker() {
		showCharacterPicker = false;
		availableCharacters = [];
	}

	async function addCharacter(characterId: number) {
		characterPickerLoading = true;
		try {
			const result = await api.addCharacter(ctx.sessionId, characterId);
			ctx.setCharacters(result.characters);
			ctx.setMessages(result.messages);
			closeCharacterPicker();
			ctx.onScrollToBottom();
		} catch (e) {
			ctx.setError('Failed to add character');
			console.error(e);
		} finally {
			characterPickerLoading = false;
		}
	}

	async function removeCharacter(characterId: number) {
		if (removingCharacterIds.has(characterId)) return;
		removingCharacterIds = new Set([...removingCharacterIds, characterId]);
		try {
			const result = await api.removeCharacter(ctx.sessionId, characterId);
			ctx.setCharacters(result.characters);
			ctx.setMessages(result.messages);
			ctx.onScrollToBottom();
		} catch (e) {
			ctx.setError('Failed to remove character');
			console.error(e);
		} finally {
			const next = new Set(removingCharacterIds);
			next.delete(characterId);
			removingCharacterIds = next;
		}
	}

	async function handleWait() {
		if (ctx.getSending() || ctx.getGenerating()) return;
		ctx.setSending(true);
		ctx.setError(null);

		try {
			const result = await api.wait(ctx.sessionId);
			ctx.setCharacters(result.characters);
			ctx.setMessages(result.messages);
			ctx.onScrollToBottom();
		} catch (e: any) {
			ctx.setError(e.message || 'Failed to wait');
			console.error(e);
		} finally {
			ctx.setSending(false);
		}
	}

	return {
		get showCharacterPicker() { return showCharacterPicker; },
		get availableCharacters() { return availableCharacters; },
		get characterPickerLoading() { return characterPickerLoading; },
		get removingCharacterIds() { return removingCharacterIds; },

		openCharacterPicker,
		closeCharacterPicker,
		addCharacter,
		removeCharacter,
		handleWait
	};
}
