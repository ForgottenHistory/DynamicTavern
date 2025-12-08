import * as api from '../chatActions';

export interface ClothesState {
	clothes: api.ClothesData | null;
	clothesLoading: boolean;
}

export interface ClothesActions {
	generateClothes: () => Promise<void>;
	loadClothes: () => Promise<void>;
}

export function createClothesActions(
	getState: () => ClothesState,
	setState: (updates: Partial<ClothesState>) => void,
	options: {
		characterId: number;
	}
): ClothesActions {

	async function generateClothes() {
		if (getState().clothesLoading) return;
		setState({ clothesLoading: true });

		try {
			const result = await api.generateClothes(options.characterId);
			if (result) {
				setState({ clothes: result });
			}
		} finally {
			setState({ clothesLoading: false });
		}
	}

	async function loadClothes() {
		const result = await api.getClothes(options.characterId);
		if (result) {
			setState({ clothes: result });
		}
	}

	return {
		generateClothes,
		loadClothes
	};
}
