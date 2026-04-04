export type SandboxMode = 'scene' | 'dynamic';

export interface CharacterFilters {
	preferTags?: string[];
	excludeTags?: string[];
}

export interface WorldLocation {
	name: string;
	description: string;
	connections: string[];
	characterFilters?: CharacterFilters | null;
}

export interface World {
	id: string;
	name: string;
	description?: string;
	startLocation: string;
	spawnChance?: number; // Default 0.7 - chance to spawn a character
	locations: Record<string, WorldLocation>;
}

export interface DynamicLocation {
	name: string;
	description: string;
}

export interface LocationHistoryEntry {
	name: string;
	description: string;
	enteredAt: string; // ISO date string
}
