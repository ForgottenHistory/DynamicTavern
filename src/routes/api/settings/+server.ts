import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { personaService } from '$lib/server/services/personaService';

export const GET: RequestHandler = async ({ cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, parseInt(userId))
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	// Get active persona info (name, description, avatar)
	const activeUserInfo = await personaService.getActiveUserInfo(parseInt(userId));

	return json({
		chatLayout: user.chatLayout || 'bubbles',
		avatarStyle: user.avatarStyle || 'circle',
		userAvatar: activeUserInfo.avatarData || null,
		userName: activeUserInfo.name
	});
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { chatLayout, avatarStyle } = body;

	// Validate chatLayout
	if (chatLayout && !['bubbles', 'discord'].includes(chatLayout)) {
		return json({ error: 'Invalid chat layout value' }, { status: 400 });
	}

	// Validate avatarStyle
	if (avatarStyle && !['circle', 'rounded'].includes(avatarStyle)) {
		return json({ error: 'Invalid avatar style value' }, { status: 400 });
	}

	const updateData: { chatLayout?: string; avatarStyle?: string } = {};
	if (chatLayout) updateData.chatLayout = chatLayout;
	if (avatarStyle) updateData.avatarStyle = avatarStyle;

	await db.update(users).set(updateData).where(eq(users.id, parseInt(userId)));

	return json({ success: true, chatLayout, avatarStyle });
};
