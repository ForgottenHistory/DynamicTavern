import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LLM Logging Service
 * Saves prompts and responses to file system for debugging
 * Keeps only last 5 logs per message type
 */
class LlmLogService {
	private promptsDir: string;
	private responsesDir: string;

	constructor() {
		// Create logs directories in project root
		const projectRoot = path.join(__dirname, '../../../..');
		this.promptsDir = path.join(projectRoot, 'logs/prompts');
		this.responsesDir = path.join(projectRoot, 'logs/responses');

		// Ensure directories exist
		this.ensureDirectories();
	}

	/**
	 * Ensure log directories exist
	 */
	private ensureDirectories() {
		if (!fs.existsSync(this.promptsDir)) {
			fs.mkdirSync(this.promptsDir, { recursive: true });
		}
		if (!fs.existsSync(this.responsesDir)) {
			fs.mkdirSync(this.responsesDir, { recursive: true });
		}
	}

	/**
	 * Save prompt to log file (keep last 5 per type)
	 * @param messages - Messages array sent to LLM
	 * @param messageType - Type of message (chat, regenerate, swipe)
	 * @param characterName - Name of character
	 * @param userName - Name of user
	 * @returns timestamp ID for matching response log
	 */
	savePromptLog(
		messages: Array<{ role: string; content: string }>,
		messageType: string,
		characterName: string,
		userName: string
	): string | null {
		try {
			// Generate filename with timestamp
			const now = new Date();
			const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
			const filename = `${messageType}-${timestamp}.txt`;
			const filepath = path.join(this.promptsDir, filename);

			// Build log content
			const parts = [
				`PROMPT LOG`,
				`Type: ${messageType}`,
				`Timestamp: ${now.toISOString()}`,
				`Character: ${characterName}`,
				`User: ${userName}`,
				``
			];

			// Add each message
			messages.forEach((msg, index) => {
				if (msg.role === 'system') {
					parts.push(`[SYSTEM MESSAGE ${index > 0 ? index : ''}]:`);
					parts.push(msg.content);
					parts.push('');
				} else if (msg.role === 'user') {
					parts.push(`${userName}: ${msg.content}`);
				} else if (msg.role === 'assistant') {
					parts.push(`${characterName}: ${msg.content}`);
				}
			});

			const logContent = parts.join('\n');

			// Write to file
			fs.writeFileSync(filepath, logContent, 'utf8');

			// Clean up old logs (keep only 5 per type)
			this.cleanupOldLogs(this.promptsDir, messageType);

			logger.info(`Saved prompt log: ${filename}`);
			return timestamp;
		} catch (error) {
			logger.error('Failed to save prompt log', error);
			return null;
		}
	}

	/**
	 * Save response to log file (keep last 5 per type)
	 * @param processedContent - Content after processing/stripping
	 * @param rawContent - Raw content from API
	 * @param messageType - Type of message
	 * @param logId - Matching timestamp from prompt log
	 * @param responseData - Full response data from LLM API
	 */
	saveResponseLog(
		processedContent: string,
		rawContent: string,
		messageType: string,
		logId: string | null,
		responseData: any
	): void {
		try {
			if (!logId) {
				logger.warn('No log ID provided for response log, skipping');
				return;
			}

			// Use same timestamp as prompt for matching filenames
			const filename = `${messageType}-${logId}.txt`;
			const filepath = path.join(this.responsesDir, filename);

			// Extract reasoning if present - check multiple possible locations
			const message = responseData.choices?.[0]?.message;
			const reasoning = message?.reasoning || message?.reasoning_content;
			const reasoningDetails = message?.reasoning_details;
			const reasoningTokens = responseData.usage?.completion_tokens_details?.reasoning_tokens;

			// Build log content
			const parts = [
				`RESPONSE LOG`,
				`Type: ${messageType}`,
				`Timestamp: ${new Date().toISOString()}`,
				`Model: ${responseData.model || 'unknown'}`,
				``
			];

			// Add reasoning section if present (plain text)
			if (reasoning) {
				parts.push(`--- REASONING ---`);
				parts.push(reasoning);
				parts.push(``);
			}

			// Note if reasoning was encrypted (e.g., Grok)
			if (reasoningDetails?.length > 0) {
				const encryptedReasoning = reasoningDetails.find((r: any) => r.type === 'reasoning.encrypted');
				if (encryptedReasoning) {
					parts.push(`--- REASONING (encrypted by provider) ---`);
					parts.push(`Reasoning tokens used: ${reasoningTokens || 'unknown'}`);
					parts.push(`Note: This model encrypts its reasoning output`);
					parts.push(``);
				}
			}

			parts.push(`--- RAW CONTENT (from API) ---`);
			parts.push(rawContent || '(empty)');
			parts.push(``);
			parts.push(`--- PROCESSED CONTENT (after stripping) ---`);
			parts.push(processedContent || '(empty)');
			parts.push(``);
			parts.push(`--- USAGE ---`);
			parts.push(JSON.stringify(responseData.usage || {}, null, 2));

			const logContent = parts.join('\n');

			// Write to file
			fs.writeFileSync(filepath, logContent, 'utf8');

			// Clean up old logs (keep only 5 per type)
			this.cleanupOldLogs(this.responsesDir, messageType);

			logger.info(`Saved response log: ${filename}`);
		} catch (error) {
			logger.error('Failed to save response log', error);
		}
	}

	/**
	 * Clean up old log files, keeping only the 5 most recent per type
	 * @param logsDir - Directory containing logs
	 * @param messageType - Type of message to clean up
	 */
	private cleanupOldLogs(logsDir: string, messageType: string): void {
		try {
			// Get all files for this message type
			const files = fs
				.readdirSync(logsDir)
				.filter((f) => f.startsWith(messageType))
				.map((f) => ({
					name: f,
					path: path.join(logsDir, f),
					mtime: fs.statSync(path.join(logsDir, f)).mtime
				}))
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

			// Delete old files (keep only 5 newest)
			if (files.length > 5) {
				files.slice(5).forEach((file) => {
					fs.unlinkSync(file.path);
					logger.debug(`Deleted old log: ${file.name}`);
				});
			}
		} catch (error) {
			logger.error('Failed to cleanup old logs', error);
		}
	}
}

export const llmLogService = new LlmLogService();
