import { db } from '$lib/server/db';
import { sandboxImages, sandboxSessions, characters as charactersTable, type SandboxImage } from '$lib/server/db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';
import { imageTagGenerationService } from './imageTagGenerationService';
import { sdService } from './sdService';
import { sdSettingsService } from './sdSettingsService';
import { sandboxService } from './sandboxService';
import { emitSandboxImageUpdate } from '../socket';
import fs from 'fs/promises';
import path from 'path';

const STALE_PENDING_MS = 10 * 60 * 1000; // 10 minutes
const IMAGES_ROOT = path.resolve('data', 'sandbox_images');

export function resolveSandboxImagePath(relPath: string): string {
	// Prevent path escape
	const full = path.resolve(IMAGES_ROOT, relPath);
	if (!full.startsWith(IMAGES_ROOT)) {
		throw new Error('Invalid image path');
	}
	return full;
}

class SandboxImageService {
	/**
	 * Mark any `pending` rows older than STALE_PENDING_MS as failed.
	 * Handles the case where the server restarted mid-generation and the
	 * in-flight Promise was lost. Safe to call repeatedly.
	 */
	async reapStalePending(): Promise<void> {
		const cutoff = new Date(Date.now() - STALE_PENDING_MS);
		await db
			.update(sandboxImages)
			.set({ status: 'failed', error: 'Generation interrupted (server restart or timeout)' })
			.where(and(eq(sandboxImages.status, 'pending'), lt(sandboxImages.createdAt, cutoff)));
	}

	async list(sessionId: number): Promise<SandboxImage[]> {
		// Opportunistically clean up stuck rows whenever the sidebar fetches.
		await this.reapStalePending();
		return db
			.select()
			.from(sandboxImages)
			.where(eq(sandboxImages.sandboxSessionId, sessionId))
			.orderBy(desc(sandboxImages.createdAt));
	}

	async createPending(params: {
		sessionId: number;
		characterId: number;
		characterName: string;
		reason?: string;
	}): Promise<SandboxImage> {
		const [row] = await db
			.insert(sandboxImages)
			.values({
				sandboxSessionId: params.sessionId,
				characterId: params.characterId,
				characterName: params.characterName,
				status: 'pending',
				reason: params.reason ?? null
			})
			.returning();
		emitSandboxImageUpdate(params.sessionId, row);
		return row;
	}

	private async markReady(sessionId: number, id: number, imagePath: string, tags: string) {
		const [row] = await db
			.update(sandboxImages)
			.set({ status: 'ready', imagePath, tags })
			.where(eq(sandboxImages.id, id))
			.returning();
		if (row) emitSandboxImageUpdate(sessionId, row);
	}

	private async writeImageFile(sessionId: number, imageId: number, base64: string): Promise<string> {
		const relDir = String(sessionId);
		const absDir = path.join(IMAGES_ROOT, relDir);
		await fs.mkdir(absDir, { recursive: true });
		const filename = `${imageId}.png`;
		const relPath = path.posix.join(relDir, filename);
		const absPath = path.join(absDir, filename);
		await fs.writeFile(absPath, Buffer.from(base64, 'base64'));
		return relPath;
	}

	/**
	 * Delete a single image (DB row + on-disk file). Returns the session id so
	 * callers can emit a socket event.
	 */
	async deleteImage(imageId: number, userId: number): Promise<number | null> {
		const [row] = await db
			.select({
				id: sandboxImages.id,
				sandboxSessionId: sandboxImages.sandboxSessionId,
				imagePath: sandboxImages.imagePath,
				sessionUserId: sandboxSessions.userId
			})
			.from(sandboxImages)
			.innerJoin(sandboxSessions, eq(sandboxSessions.id, sandboxImages.sandboxSessionId))
			.where(eq(sandboxImages.id, imageId))
			.limit(1);

		if (!row) return null;
		if (row.sessionUserId !== userId) return null;

		await db.delete(sandboxImages).where(eq(sandboxImages.id, imageId));

		if (row.imagePath) {
			try {
				await fs.unlink(resolveSandboxImagePath(row.imagePath));
			} catch (error: any) {
				if (error?.code !== 'ENOENT') {
					console.error(`Failed to delete image file ${row.imagePath}:`, error);
				}
			}
		}

		return row.sandboxSessionId;
	}

	/**
	 * Delete all on-disk image files for a session. Safe to call even if the
	 * directory doesn't exist. DB rows are removed separately via FK cascade.
	 */
	async deleteSessionFiles(sessionId: number): Promise<void> {
		const dir = path.join(IMAGES_ROOT, String(sessionId));
		try {
			await fs.rm(dir, { recursive: true, force: true });
		} catch (error) {
			console.error(`Failed to delete sandbox image dir ${dir}:`, error);
		}
	}

	private async markFailed(sessionId: number, id: number, error: string) {
		const [row] = await db
			.update(sandboxImages)
			.set({ status: 'failed', error })
			.where(eq(sandboxImages.id, id))
			.returning();
		if (row) emitSandboxImageUpdate(sessionId, row);
	}

	/**
	 * Generate an image for a character in a sandbox session.
	 * Fire-and-forget: writes progress into the sandbox_images row.
	 */
	async generateForCharacter(params: {
		imageRowId: number;
		sessionId: number;
		userId: number;
		characterId: number;
	}): Promise<void> {
		const { imageRowId, sessionId, userId, characterId } = params;
		try {
			const [character] = await db
				.select()
				.from(charactersTable)
				.where(eq(charactersTable.id, characterId))
				.limit(1);

			if (!character) {
				await this.markFailed(sessionId, imageRowId, 'Character not found');
				return;
			}

			let characterData: any = {};
			try {
				const parsed = JSON.parse(character.cardData);
				characterData = parsed.data || parsed;
			} catch {
				// ignore
			}

			// Build conversation context from recent sandbox messages
			const allMessages = await sandboxService.getMessages(sessionId);
			const recent = allMessages.slice(-10);
			const conversationContext = recent
				.map((m) => `${m.senderName || m.role}: ${m.content}`)
				.join('\n\n');

			// Generate tags (character-only: one character per image)
			const tagResult = await imageTagGenerationService.generateTags({
				conversationContext,
				characterName: character.name,
				characterDescription: character.description || characterData.description || '',
				characterScenario: characterData.scenario || '',
				imageTags: character.imageTags || '',
				contextualTags: character.contextualTags || '',
				type: 'character',
				userId
			});

			const characterTags = [tagResult.alwaysTags, tagResult.generatedTags]
				.filter((t) => t && t.trim())
				.join(', ');

			const sdUserSettings = await sdSettingsService.getUserSettings(userId);

			const sdResult = await sdService.generateImage({
				characterTags,
				settings: sdUserSettings as any
			});

			if (!sdResult.success || !sdResult.imageBase64) {
				await this.markFailed(sessionId, imageRowId, sdResult.error || 'SD generation failed');
				return;
			}

			const relPath = await this.writeImageFile(sessionId, imageRowId, sdResult.imageBase64);
			await this.markReady(sessionId, imageRowId, relPath, characterTags);
		} catch (error: any) {
			console.error('Sandbox image generation failed:', error);
			await this.markFailed(sessionId, imageRowId, error?.message || 'Unknown error');
		}
	}
}

export const sandboxImageService = new SandboxImageService();
