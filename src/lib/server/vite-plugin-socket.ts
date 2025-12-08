import type { Plugin } from 'vite';
import type { ViteDevServer } from 'vite';
import { initSocketServer } from './socket';

/**
 * Vite plugin to initialize Socket.IO server
 */
export function socketPlugin(): Plugin {
	return {
		name: 'vite-plugin-socketio',
		configureServer(server: ViteDevServer) {
			if (!server.httpServer) {
				console.error('❌ HTTP server not available');
				return;
			}

			// Wait for server to be listening before initializing Socket.IO
			server.httpServer.once('listening', () => {
				initSocketServer(server.httpServer!);
			});
		}
	};
}
