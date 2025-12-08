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
 * Remove all listeners
 */
export function removeAllListeners() {
	if (!socket) return;
	socket.off('new-message');
	socket.off('typing');
}
