import type { Character } from '$lib/server/db/schema';

// Module-level state that persists across navigation (client-side only)
let charactersCache: Character[] = [];
let loaded = false;

export function getCharactersCache(): Character[] {
	return charactersCache;
}

export function setCharactersCache(characters: Character[]): void {
	charactersCache = characters;
	loaded = true;
}

export function isCharactersCacheLoaded(): boolean {
	return loaded;
}
