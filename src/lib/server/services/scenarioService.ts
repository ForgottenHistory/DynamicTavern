import fs from 'fs/promises';
import path from 'path';

const SCENARIOS_DIR = 'data/scenarios';

export interface Scenario {
	id: string;
	name: string;
	content: string;
}

class ScenarioService {
	/**
	 * Ensure the scenarios directory exists
	 */
	private async ensureDir(): Promise<void> {
		try {
			await fs.access(SCENARIOS_DIR);
		} catch {
			await fs.mkdir(SCENARIOS_DIR, { recursive: true });
		}
	}

	/**
	 * Convert filename to display name
	 * e.g., "stuck_in_room.txt" -> "Stuck In Room"
	 */
	private filenameToName(filename: string): string {
		return filename
			.replace('.txt', '')
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Convert display name to filename
	 * e.g., "Stuck In Room" -> "stuck_in_room.txt"
	 */
	private nameToFilename(name: string): string {
		return name.toLowerCase().replace(/\s+/g, '_') + '.txt';
	}

	/**
	 * Get all scenarios
	 */
	async getAll(): Promise<Scenario[]> {
		await this.ensureDir();

		try {
			const files = await fs.readdir(SCENARIOS_DIR);
			const scenarios: Scenario[] = [];

			for (const file of files) {
				if (!file.endsWith('.txt')) continue;

				const content = await fs.readFile(path.join(SCENARIOS_DIR, file), 'utf-8');
				scenarios.push({
					id: file.replace('.txt', ''),
					name: this.filenameToName(file),
					content: content.trim()
				});
			}

			return scenarios.sort((a, b) => a.name.localeCompare(b.name));
		} catch (error) {
			console.error('Failed to load scenarios:', error);
			return [];
		}
	}

	/**
	 * Get a single scenario by ID
	 */
	async get(id: string): Promise<Scenario | null> {
		await this.ensureDir();

		try {
			const filename = id + '.txt';
			const content = await fs.readFile(path.join(SCENARIOS_DIR, filename), 'utf-8');
			return {
				id,
				name: this.filenameToName(filename),
				content: content.trim()
			};
		} catch (error) {
			console.error(`Failed to load scenario ${id}:`, error);
			return null;
		}
	}

	/**
	 * Create or update a scenario
	 */
	async save(id: string, content: string): Promise<Scenario> {
		await this.ensureDir();

		const filename = id + '.txt';
		await fs.writeFile(path.join(SCENARIOS_DIR, filename), content.trim(), 'utf-8');

		return {
			id,
			name: this.filenameToName(filename),
			content: content.trim()
		};
	}

	/**
	 * Delete a scenario
	 */
	async delete(id: string): Promise<boolean> {
		try {
			const filename = id + '.txt';
			await fs.unlink(path.join(SCENARIOS_DIR, filename));
			return true;
		} catch (error) {
			console.error(`Failed to delete scenario ${id}:`, error);
			return false;
		}
	}

	/**
	 * Apply scenario template variables
	 */
	applyVariables(content: string, variables: { char?: string; user?: string }): string {
		let result = content;
		if (variables.char) {
			result = result.replace(/\{\{char\}\}/gi, variables.char);
		}
		if (variables.user) {
			result = result.replace(/\{\{user\}\}/gi, variables.user);
		}
		return result;
	}
}

export const scenarioService = new ScenarioService();
