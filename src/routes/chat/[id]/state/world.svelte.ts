import * as api from '../chatActions';

export interface WorldState {
	worldState: api.WorldStateData | null;
	worldStateLoading: boolean;
}

export interface WorldActions {
	generateWorldState: () => Promise<void>;
	loadWorldState: () => Promise<void>;
}

export function createWorldActions(
	getState: () => WorldState,
	setState: (updates: Partial<WorldState>) => void,
	options: {
		characterId: number;
	}
): WorldActions {

	async function generateWorldState() {
		if (getState().worldStateLoading) return;
		setState({ worldStateLoading: true });

		try {
			const result = await api.generateWorldState(options.characterId);
			if (result) {
				setState({ worldState: result });
			}
		} finally {
			setState({ worldStateLoading: false });
		}
	}

	async function loadWorldState() {
		const result = await api.getWorldState(options.characterId);
		if (result) {
			setState({ worldState: result });
		}
	}

	return {
		generateWorldState,
		loadWorldState
	};
}

// Backwards compatibility aliases
export type ClothesState = WorldState;
export type ClothesActions = WorldActions;
export const createClothesActions = createWorldActions;
