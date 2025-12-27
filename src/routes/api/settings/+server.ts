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
		textCleanupEnabled: user.textCleanupEnabled ?? true,
		autoWrapActions: user.autoWrapActions ?? false,
		randomNarrationEnabled: user.randomNarrationEnabled ?? false,
		randomNarrationMinMessages: user.randomNarrationMinMessages ?? 3,
		randomNarrationMaxMessages: user.randomNarrationMaxMessages ?? 8,
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
	const { chatLayout, avatarStyle, textCleanupEnabled, autoWrapActions, randomNarrationEnabled, randomNarrationMinMessages, randomNarrationMaxMessages, writingStyle } = body;

	// Validate chatLayout
	if (chatLayout && !['bubbles', 'discord'].includes(chatLayout)) {
		return json({ error: 'Invalid chat layout value' }, { status: 400 });
	}

	// Validate avatarStyle
	if (avatarStyle && !['circle', 'rounded'].includes(avatarStyle)) {
		return json({ error: 'Invalid avatar style value' }, { status: 400 });
	}

	// Validate random narration range
	if (randomNarrationMinMessages !== undefined && randomNarrationMaxMessages !== undefined) {
		if (randomNarrationMinMessages < 1 || randomNarrationMaxMessages < 1) {
			return json({ error: 'Random narration values must be at least 1' }, { status: 400 });
		}
		if (randomNarrationMinMessages > randomNarrationMaxMessages) {
			return json({ error: 'Minimum messages cannot be greater than maximum' }, { status: 400 });
		}
	}

	const updateData: { chatLayout?: string; avatarStyle?: string; textCleanupEnabled?: boolean; autoWrapActions?: boolean; randomNarrationEnabled?: boolean; randomNarrationMinMessages?: number; randomNarrationMaxMessages?: number; writingStyle?: string } = {};
	if (chatLayout) updateData.chatLayout = chatLayout;
	if (avatarStyle) updateData.avatarStyle = avatarStyle;
	if (typeof textCleanupEnabled === 'boolean') updateData.textCleanupEnabled = textCleanupEnabled;
	if (typeof autoWrapActions === 'boolean') updateData.autoWrapActions = autoWrapActions;
	if (typeof randomNarrationEnabled === 'boolean') updateData.randomNarrationEnabled = randomNarrationEnabled;
	if (typeof randomNarrationMinMessages === 'number') updateData.randomNarrationMinMessages = randomNarrationMinMessages;
	if (typeof randomNarrationMaxMessages === 'number') updateData.randomNarrationMaxMessages = randomNarrationMaxMessages;
	if (typeof writingStyle === 'string') updateData.writingStyle = writingStyle;

	await db.update(users).set(updateData).where(eq(users.id, parseInt(userId)));

	return json({ success: true, chatLayout, avatarStyle, textCleanupEnabled, autoWrapActions, randomNarrationEnabled, randomNarrationMinMessages, randomNarrationMaxMessages, writingStyle });
};
