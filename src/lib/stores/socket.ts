import { writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import { browser } from '$app/environment';

let socket: Socket | null = null;

/**
 * Initialize Socket.IO client connection
 */
export function initSocket() {
	if (!browser) return null;
	if (socket?.connected) return socket;

	socket = io({
		path: '/socket.io'
	});

	socket.on('connect', () => {
		console.log('✅ Socket.IO connected');
	});

	socket.on('disconnect', () => {
		console.log('❌ Socket.IO disconnected');
	});

	return socket;
}

/**
 * Get Socket.IO client instance
 */
export function getSocket(): Socket | null {
	return socket;
}

/**
 * Join a conversation room
 */
export function joinConversation(conversationId: number) {
	if (!socket) return;
	socket.emit('join-conversation', conversationId);
	console.log(`🔌 Joined conversation ${conversationId}`);
}

/**
 * Leave a conversation room
 */
export function leaveConversation(conversationId: number) {
	if (!socket) return;
	socket.emit('leave-conversation', conversationId);
	console.log(`🔌 Left conversation ${conversationId}`);
}

/**
 * Listen for new messages
 */
export function onNewMessage(callback: (message: any) => void) {
	if (!socket) return;
	socket.on('new-message', callback);
}

/**
 * Listen for typing indicator
 */
export function onTyping(callback: (isTyping: boolean) => void) {
	if (!socket) return;
	socket.on('typing', callback);
}

/**
 * Join a sandbox session room
 */
export function joinSandbox(sessionId: number) {
	if (!socket) return;
	socket.emit('join-sandbox', sessionId);
}

/**
 * Leave a sandbox session room
 */
export function leaveSandbox(sessionId: number) {
	if (!socket) return;
	socket.emit('leave-sandbox', sessionId);
}

/**
 * Listen for sandbox image updates
 */
export function onSandboxImageUpdate(callback: (image: any) => void) {
	if (!socket) return;
	socket.on('sandbox-image-update', callback);
}

/**
 * Stop listening for sandbox image updates
 */
export function offSandboxImageUpdate() {
	if (!socket) return;
	socket.off('sandbox-image-update');
}

/**
 * Listen for sandbox image deletions
 */
export function onSandboxImageDelete(callback: (imageId: number) => void) {
	if (!socket) return;
	socket.on('sandbox-image-delete', callback);
}

/**
 * Stop listening for sandbox image deletions
 */
export function offSandboxImageDelete() {
	if (!socket) return;
	socket.off('sandbox-image-delete');
}

/**
 * Remove all listeners
 */
export function removeAllListeners() {
	if (!socket) return;
	socket.off('new-message');
	socket.off('typing');
}
