/**
 * Queue service for managing concurrent LLM requests
 * Prevents rate limiting by controlling how many requests run simultaneously per provider
 */

interface QueueItem {
	fn: () => Promise<any>;
	resolve: (value: any) => void;
	reject: (error: any) => void;
}

class QueueService {
	private queues: Map<string, QueueItem[]>;
	private running: Map<string, number>;
	private maxConcurrent: Map<string, number>;

	constructor() {
		this.queues = new Map();
		this.running = new Map();
		this.maxConcurrent = new Map();

		// Set default concurrency limits per provider
		this.maxConcurrent.set('openrouter', 3);
		this.maxConcurrent.set('featherless', 3);
	}

	/**
	 * Add a request to the queue and execute when slot available
	 */
	async enqueue<T>(provider: string, fn: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			// Initialize queue for provider if needed
			if (!this.queues.has(provider)) {
				this.queues.set(provider, []);
				this.running.set(provider, 0);
			}

			// Add to queue
			this.queues.get(provider)!.push({ fn, resolve, reject });

			// Try to process immediately
			this.processQueue(provider);
		});
	}

	/**
	 * Process the next item in queue if slots available
	 */
	private async processQueue(provider: string): Promise<void> {
		const queue = this.queues.get(provider)!;
		const running = this.running.get(provider)!;
		const maxConcurrent = this.maxConcurrent.get(provider) || 3;

		// Check if we can process more items
		if (running >= maxConcurrent || queue.length === 0) {
			return;
		}

		// Take next item from queue
		const item = queue.shift()!;
		this.running.set(provider, running + 1);

		try {
			const result = await item.fn();
			item.resolve(result);
		} catch (error) {
			item.reject(error);
		} finally {
			// Decrement running count and process next
			this.running.set(provider, this.running.get(provider)! - 1);
			this.processQueue(provider);
		}
	}

	/**
	 * Set max concurrent requests for a provider
	 */
	setMaxConcurrent(provider: string, max: number): void {
		this.maxConcurrent.set(provider, max);
	}

	/**
	 * Get queue stats for debugging
	 */
	getStats(provider: string) {
		return {
			queued: this.queues.get(provider)?.length || 0,
			running: this.running.get(provider) || 0,
			maxConcurrent: this.maxConcurrent.get(provider) || 3
		};
	}
}

export const queueService = new QueueService();
