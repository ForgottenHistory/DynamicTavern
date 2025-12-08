import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';

/**
 * Generate a thumbnail from base64 image data
 */
async function generateThumbnail(base64Data: string): Promise<string | null> {
	try {
		// Extract the actual base64 content (remove data:image/...;base64, prefix)
		const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
		if (!matches) return null;

		const imageBuffer = Buffer.from(matches[2], 'base64');

		// Generate thumbnail (128x170 to match character thumbnails)
		const thumbnailBuffer = await sharp(imageBuffer)
			.resize(128, 170, { fit: 'cover' })
			.png({ quality: 80 })
			.toBuffer();

		return `data:image/png;base64,${thumbnailBuffer.toString('base64')}`;
	} catch (error) {
		console.warn('Failed to generate avatar thumbnail:', error);
		return null;
	}
}

// PUT - Update user profile
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { displayName, bio, avatarData } = await request.json();

		if (!displayName || !displayName.trim()) {
			return json({ error: 'Display name is required' }, { status: 400 });
		}

		const updateData: any = {
			displayName: displayName.trim(),
			bio: bio?.trim() || null
		};

		if (avatarData) {
			updateData.avatarData = avatarData;
			// Generate thumbnail for chat messages
			const thumbnail = await generateThumbnail(avatarData);
			if (thumbnail) {
				updateData.avatarThumbnail = thumbnail;
			}
		}

		await db.update(users).set(updateData).where(eq(users.id, parseInt(userId)));

		// Update the cookie
		cookies.set('displayName', displayName.trim(), {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		return json({ success: true });
	} catch (error) {
		console.error('Failed to update profile:', error);
		return json({ error: 'Failed to update profile' }, { status: 500 });
	}
};
