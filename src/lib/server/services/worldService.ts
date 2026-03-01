import fs from 'fs/promises';
import path from 'path';
import type { World, WorldLocation } from '$lib/types/sandbox';

const WORLDS_DIR = 'data/worlds';

class WorldService {
	/**
	 * Ensure the worlds directory exists
	 */
	private async ensureDir(): Promise<void> {
		try {
			await fs.access(WORLDS_DIR);
		} catch {
			await fs.mkdir(WORLDS_DIR, { recursive: true });
		}
	}

	/**
	 * Get all available worlds (basic info only)
	 */
	async getAll(): Promise<Array<{ id: string; name: string; description?: string }>> {
		await this.ensureDir();

		try {
			const files = await fs.readdir(WORLDS_DIR);
			const worlds: Array<{ id: string; name: string; description?: string }> = [];

			for (const file of files) {
				if (!file.endsWith('.json')) continue;

				try {
					const content = await fs.readFile(path.join(WORLDS_DIR, file), 'utf-8');
					const world = JSON.parse(content);
					worlds.push({
						id: file.replace('.json', ''),
						name: world.name || file.replace('.json', ''),
						description: world.description
					});
				} catch (error) {
					console.error(`Failed to parse world file ${file}:`, error);
				}
			}

			return worlds.sort((a, b) => a.name.localeCompare(b.name));
		} catch (error) {
			console.error('Failed to load worlds:', error);
			return [];
		}
	}

	/**
	 * Get a single world by ID (full definition)
	 */
	async get(id: string): Promise<World | null> {
		await this.ensureDir();

		try {
			const filename = id + '.json';
			const content = await fs.readFile(path.join(WORLDS_DIR, filename), 'utf-8');
			const world = JSON.parse(content);

			return {
				id,
				name: world.name,
				description: world.description,
				startLocation: world.startLocation,
				spawnChance: world.spawnChance ?? 0.7,
				locations: world.locations
			};
		} catch (error) {
			console.error(`Failed to load world ${id}:`, error);
			return null;
		}
	}

	/**
	 * Get a specific location from a world
	 */
	getLocation(world: World, locationId: string): WorldLocation | null {
		return world.locations[locationId] || null;
	}

	/**
	 * Get connected locations from a world
	 */
	getConnections(world: World, locationId: string): Array<{ id: string; location: WorldLocation }> {
		const location = world.locations[locationId];
		if (!location) return [];

		return location.connections
			.map((connId) => ({
				id: connId,
				location: world.locations[connId]
			}))
			.filter((conn) => conn.location != null);
	}

	/**
	 * Validate that a location exists in a world
	 */
	isValidLocation(world: World, locationId: string): boolean {
		return locationId in world.locations;
	}

	/**
	 * Check if movement between locations is valid
	 */
	canMoveTo(world: World, fromLocationId: string, toLocationId: string): boolean {
		const fromLocation = world.locations[fromLocationId];
		if (!fromLocation) return false;

		return fromLocation.connections.includes(toLocationId);
	}
}

export const worldService = new WorldService();
