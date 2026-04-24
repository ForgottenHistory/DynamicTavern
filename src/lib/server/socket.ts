import { Server as SocketIOServer } from 'socket.io';
import type { Server } from 'http';
import { logger } from './utils/logger';

// Use global to persist Socket.IO instance across hot reloads
declare global {
	var __socketio: SocketIOServer | undefined;
}

let io: SocketIOServer | null = global.__socketio || null;

/**
 * Initialize Socket.IO server
 */
export function initSocketServer(httpServer: Server) {
	if (io) {
		logger.warn('Socket.IO server already initialized');
		return io;
	}

	io = new SocketIOServer(httpServer, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		}
	});

	// Store in global for persistence across hot reloads
	global.__socketio = io;

	io.on('connection', (socket) => {
		logger.info(`Socket connected: ${socket.id}`);

		socket.on('disconnect', () => {
			logger.info(`Socket disconnected: ${socket.id}`);
		});

		// Join a conversation room
		socket.on('join-conversation', (conversationId: number) => {
			socket.join(`conversation-${conversationId}`);
			logger.debug(`Socket ${socket.id} joined conversation ${conversationId}`);
		});

		// Leave a conversation room
		socket.on('leave-conversation', (conversationId: number) => {
			socket.leave(`conversation-${conversationId}`);
			logger.debug(`Socket ${socket.id} left conversation ${conversationId}`);
		});

		// Join a sandbox session room
		socket.on('join-sandbox', (sessionId: number) => {
			socket.join(`sandbox-${sessionId}`);
			logger.debug(`Socket ${socket.id} joined sandbox ${sessionId}`);
		});

		// Leave a sandbox session room
		socket.on('leave-sandbox', (sessionId: number) => {
			socket.leave(`sandbox-${sessionId}`);
			logger.debug(`Socket ${socket.id} left sandbox ${sessionId}`);
		});
	});

	logger.success('Socket.IO server initialized');
	console.log('🔍 Socket.IO instance stored in global:', global.__socketio ? 'YES' : 'NO');
	return io;
}

/**
 * Get Socket.IO server instance
 */
export function getSocketServer(): SocketIOServer | null {
	return io;
}

/**
 * Emit a new message to a conversation room
 */
export function emitMessage(conversationId: number, message: any) {
	// Try to get from global if not set
	if (!io && global.__socketio) {
		io = global.__socketio;
		console.log('🔍 Retrieved Socket.IO from global');
	}

	console.log('🔍 emitMessage called, io instance:', io ? 'EXISTS' : 'NULL');
	console.log('🔍 global.__socketio:', global.__socketio ? 'EXISTS' : 'NULL');

	if (!io) {
		logger.warn('Socket.IO not initialized, cannot emit message');
		return;
	}

	io.to(`conversation-${conversationId}`).emit('new-message', message);
	logger.info(`Emitted message to conversation ${conversationId}`);
}

/**
 * Emit typing indicator to a conversation room
 */
export function emitTyping(conversationId: number, isTyping: boolean) {
	// Try to get from global if not set
	if (!io && global.__socketio) {
		io = global.__socketio;
	}

	if (!io) return;
	io.to(`conversation-${conversationId}`).emit('typing', isTyping);
	logger.debug(`Emitted typing=${isTyping} to conversation ${conversationId}`);
}

/**
 * Emit a sandbox image update (created / status change) to a sandbox room.
 */
export function emitSandboxImageUpdate(sessionId: number, image: any) {
	if (!io && global.__socketio) {
		io = global.__socketio;
	}
	if (!io) return;
	io.to(`sandbox-${sessionId}`).emit('sandbox-image-update', image);
	logger.debug(`Emitted sandbox-image-update to sandbox ${sessionId} (image ${image?.id}, ${image?.status})`);
}

/**
 * Emit a sandbox image deletion to a sandbox room.
 */
export function emitSandboxImageDelete(sessionId: number, imageId: number) {
	if (!io && global.__socketio) {
		io = global.__socketio;
	}
	if (!io) return;
	io.to(`sandbox-${sessionId}`).emit('sandbox-image-delete', imageId);
	logger.debug(`Emitted sandbox-image-delete to sandbox ${sessionId} (image ${imageId})`);
}

/**
 * Emit Game Master busy/idle status to a sandbox room so the client can
 * lock action buttons while the GM is thinking.
 */
export function emitSandboxGmStatus(sessionId: number, busy: boolean, reason?: string) {
	if (!io && global.__socketio) {
		io = global.__socketio;
	}
	if (!io) return;
	io.to(`sandbox-${sessionId}`).emit('sandbox-gm-status', { busy, reason: reason ?? null });
	logger.debug(`Emitted sandbox-gm-status to sandbox ${sessionId} (busy=${busy})`);
}

/**
 * Emit a fresh world state snapshot to a sandbox room so the client sidebar
 * can update without re-fetching.
 */
export function emitSandboxWorldState(sessionId: number, worldState: any) {
	if (!io && global.__socketio) {
		io = global.__socketio;
	}
	if (!io) return;
	io.to(`sandbox-${sessionId}`).emit('sandbox-world-state', worldState);
	logger.debug(`Emitted sandbox-world-state to sandbox ${sessionId}`);
}
