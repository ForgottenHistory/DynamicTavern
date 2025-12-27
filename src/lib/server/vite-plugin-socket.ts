import type { Plugin } from 'vite';
import type { ViteDevServer } from 'vite';
import type { Server as HttpServer } from 'http';
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
			// Cast to HttpServer since Socket.IO expects this type
			const httpServer = server.httpServer as HttpServer;
			httpServer.once('listening', () => {
				initSocketServer(httpServer);
			});
		}
	};
}
