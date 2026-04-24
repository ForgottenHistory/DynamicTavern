import * as api from './sandboxActions';
import type { SandboxImageRow } from './sandboxActions';
import {
	initSocket,
	joinSandbox,
	leaveSandbox,
	onSandboxImageUpdate,
	offSandboxImageUpdate,
	onSandboxImageDelete,
	offSandboxImageDelete,
	onSandboxGmStatus,
	offSandboxGmStatus,
	onSandboxWorldState,
	offSandboxWorldState
} from '$lib/stores/socket';

export interface SandboxImagesContext {
	sessionId: number;
	onWorldStateUpdate?: (worldState: any) => void;
}

export function createSandboxImages(ctx: SandboxImagesContext) {
	let images = $state<SandboxImageRow[]>([]);
	let gmBusy = $state(false);
	let gmReason = $state<string | null>(null);
	let joined = false;

	async function refresh() {
		images = await api.fetchSandboxImages(ctx.sessionId);
	}

	function handleUpdate(incoming: SandboxImageRow) {
		if (!incoming || incoming.sandboxSessionId !== ctx.sessionId) return;
		const idx = images.findIndex((img) => img.id === incoming.id);
		if (idx === -1) {
			// Newest first
			images = [incoming, ...images];
		} else {
			const next = images.slice();
			next[idx] = incoming;
			images = next;
		}
	}

	function handleDelete(imageId: number) {
		images = images.filter((img) => img.id !== imageId);
	}

	async function remove(imageId: number) {
		// Optimistic — socket event will confirm for other tabs.
		const prev = images;
		images = images.filter((img) => img.id !== imageId);
		const ok = await api.deleteSandboxImage(imageId);
		if (!ok) {
			images = prev;
		}
	}

	function handleGmStatus(status: { busy: boolean; reason: string | null }) {
		gmBusy = status.busy;
		gmReason = status.reason;
	}

	function handleWorldState(ws: any) {
		ctx.onWorldStateUpdate?.(ws);
	}

	function start() {
		if (joined) return;
		initSocket();
		joinSandbox(ctx.sessionId);
		onSandboxImageUpdate(handleUpdate);
		onSandboxImageDelete(handleDelete);
		onSandboxGmStatus(handleGmStatus);
		onSandboxWorldState(handleWorldState);
		joined = true;
	}

	function dispose() {
		if (!joined) return;
		offSandboxImageUpdate();
		offSandboxImageDelete();
		offSandboxGmStatus();
		offSandboxWorldState();
		leaveSandbox(ctx.sessionId);
		joined = false;
	}

	return {
		get images() {
			return images;
		},
		get gmBusy() {
			return gmBusy;
		},
		get gmReason() {
			return gmReason;
		},
		refresh,
		remove,
		start,
		dispose
	};
}
