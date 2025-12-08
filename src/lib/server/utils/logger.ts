import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Simple server logger that writes to server.log
 * Log file is overwritten on each server start
 */
class Logger {
	private logFilePath: string;

	constructor() {
		// Create log file in project root
		const projectRoot = path.join(__dirname, '../../../..');
		this.logFilePath = path.join(projectRoot, 'server.log');

		console.log('📋 Logger initialized, log file path:', this.logFilePath);

		// Clear/create log file on initialization
		this.initializeLogFile();
	}

	/**
	 * Initialize log file (overwrites existing file)
	 */
	private initializeLogFile() {
		try {
			const now = new Date().toISOString();
			const header = `=== Server Log ===\nStarted: ${now}\n\n`;
			fs.writeFileSync(this.logFilePath, header, 'utf8');
			console.log(`📋 Server log initialized: ${this.logFilePath}`);
		} catch (error) {
			console.error('Failed to initialize server log:', error);
		}
	}

	/**
	 * Write a log entry to server.log
	 */
	private writeLog(level: string, message: string, data?: any) {
		try {
			const timestamp = new Date().toISOString();
			let logEntry = `[${timestamp}] [${level}] ${message}`;

			if (data) {
				logEntry += `\n${JSON.stringify(data, null, 2)}`;
			}

			logEntry += '\n';

			fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
		} catch (error) {
			console.error('Failed to write to server log:', error);
		}
	}

	/**
	 * Log info message
	 */
	info(message: string, data?: any) {
		console.log(`ℹ️  ${message}`, data || '');
		this.writeLog('INFO', message, data);
	}

	/**
	 * Log warning message
	 */
	warn(message: string, data?: any) {
		console.warn(`⚠️  ${message}`, data || '');
		this.writeLog('WARN', message, data);
	}

	/**
	 * Log error message
	 */
	error(message: string, data?: any) {
		console.error(`❌ ${message}`, data || '');
		this.writeLog('ERROR', message, data);
	}

	/**
	 * Log success message
	 */
	success(message: string, data?: any) {
		console.log(`✅ ${message}`, data || '');
		this.writeLog('SUCCESS', message, data);
	}

	/**
	 * Log debug message
	 */
	debug(message: string, data?: any) {
		console.log(`🐛 ${message}`, data || '');
		this.writeLog('DEBUG', message, data);
	}
}

export const logger = new Logger();
