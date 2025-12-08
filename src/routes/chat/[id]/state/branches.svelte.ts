import * as api from '../chatActions';
import { leaveConversation } from '$lib/stores/socket';

export interface Branch {
	id: number;
	name: string | null;
	isActive: boolean;
	createdAt: Date;
}

export interface BranchState {
	branches: Branch[];
	activeBranchId: number | null;
	showBranchPanel: boolean;
	creatingBranch: boolean;
}

export interface BranchActions {
	createBranch: (messageId: number, name?: string) => Promise<void>;
	switchBranch: (branchId: number) => Promise<void>;
	deleteBranch: (branchId: number) => Promise<void>;
}

export function createBranchActions(
	getState: () => BranchState,
	setState: (updates: Partial<BranchState>) => void,
	options: {
		characterId: number;
		conversationId: () => number | null;
		loadConversation: () => Promise<void>;
	}
): BranchActions {

	async function createBranch(messageId: number, name?: string) {
		if (getState().creatingBranch) return;
		setState({ creatingBranch: true });

		try {
			const success = await api.createBranch(options.characterId, messageId, name);
			if (success) {
				const convId = options.conversationId();
				if (convId) {
					leaveConversation(convId);
				}
				await options.loadConversation();
			} else {
				alert('Failed to create branch');
			}
		} finally {
			setState({ creatingBranch: false });
		}
	}

	async function switchBranch(branchId: number) {
		if (branchId === getState().activeBranchId) return;

		const success = await api.switchBranch(options.characterId, branchId);
		if (success) {
			const convId = options.conversationId();
			if (convId) {
				leaveConversation(convId);
			}
			await options.loadConversation();
		} else {
			alert('Failed to switch branch');
		}
	}

	async function deleteBranch(branchId: number) {
		if (!confirm('Delete this branch? All messages will be lost.')) return;

		const success = await api.deleteBranch(options.characterId, branchId);
		if (success) {
			const state = getState();
			if (branchId === state.activeBranchId) {
				const convId = options.conversationId();
				if (convId) {
					leaveConversation(convId);
				}
			}
			await options.loadConversation();
		} else {
			alert('Failed to delete branch');
		}
	}

	return {
		createBranch,
		switchBranch,
		deleteBranch
	};
}
