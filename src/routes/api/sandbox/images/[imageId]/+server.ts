import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sandboxImages, sandboxSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolveSandboxImagePath, sandboxImageService } from '$lib/server/services/sandboxImageService';
import { emitSandboxImageDelete } from '$lib/server/socket';
import fs from 'fs/promises';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) throw error(401, 'Not authenticated');

	const imageId = parseInt(params.imageId!);
	if (isNaN(imageId)) throw error(400, 'Invalid image ID');

	const [row] = await db
		.select({
			imagePath: sandboxImages.imagePath,
			sessionUserId: sandboxSessions.userId
		})
		.from(sandboxImages)
		.innerJoin(sandboxSessions, eq(sandboxSessions.id, sandboxImages.sandboxSessionId))
		.where(eq(sandboxImages.id, imageId))
		.limit(1);

	if (!row) throw error(404, 'Image not found');
	if (row.sessionUserId !== parseInt(userId)) throw error(403, 'Forbidden');
	if (!row.imagePath) throw error(404, 'Image file not ready');

	const abs = resolveSandboxImagePath(row.imagePath);
	const buf = await fs.readFile(abs);

	return new Response(new Uint8Array(buf), {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) throw error(401, 'Not authenticated');

	const imageId = parseInt(params.imageId!);
	if (isNaN(imageId)) throw error(400, 'Invalid image ID');

	const sessionId = await sandboxImageService.deleteImage(imageId, parseInt(userId));
	if (sessionId === null) throw error(404, 'Image not found');

	emitSandboxImageDelete(sessionId, imageId);
	return json({ success: true });
};
