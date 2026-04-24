import * as api from './sandboxActions';
import type { SandboxImageRow } from './sandboxActions';
import {
	initSocket,
	joinSandbox,
	leaveSandbox,
	onSandboxImageUpdate,
	offSandboxImageUpdate,
	onSandboxImageDelete,
	offSandboxImageDelete
} from '$lib/stores/socket';

export interface SandboxImagesContext {
	sessionId: number;
}

export function createSandboxImages(ctx: SandboxImagesContext) {
	let images = $state<SandboxImageRow[]>([]);
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

	function start() {
		if (joined) return;
		initSocket();
		joinSandbox(ctx.sessionId);
		onSandboxImageUpdate(handleUpdate);
		onSandboxImageDelete(handleDelete);
		joined = true;
	}

	function dispose() {
		if (!joined) return;
		offSandboxImageUpdate();
		offSandboxImageDelete();
		leaveSandbox(ctx.sessionId);
		joined = false;
	}

	return {
		get images() {
			return images;
		},
		refresh,
		remove,
		start,
		dispose
	};
}
