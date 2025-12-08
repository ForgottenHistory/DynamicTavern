import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET - List all branches for a character
export const GET: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const branches = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			)
			.orderBy(desc(conversations.createdAt));

		// Get message count for each branch
		const branchesWithCounts = await Promise.all(
			branches.map(async (branch) => {
				const msgs = await db
					.select()
					.from(messages)
					.where(eq(messages.conversationId, branch.id));
				return {
					...branch,
					messageCount: msgs.length
				};
			})
		);

		return json({ branches: branchesWithCounts });
	} catch (error) {
		console.error('Failed to fetch branches:', error);
		return json({ error: 'Failed to fetch branches' }, { status: 500 });
	}
};

// POST - Create a new branch from a message
export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	if (isNaN(characterId)) {
		return json({ error: 'Invalid character ID' }, { status: 400 });
	}

	try {
		const { messageId, name } = await request.json();

		if (!messageId) {
			return json({ error: 'Message ID is required' }, { status: 400 });
		}

		// Get the message to branch from
		const [branchPoint] = await db
			.select()
			.from(messages)
			.where(eq(messages.id, messageId))
			.limit(1);

		if (!branchPoint) {
			return json({ error: 'Message not found' }, { status: 404 });
		}

		// Get the parent conversation
		const [parentConversation] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.id, branchPoint.conversationId),
					eq(conversations.userId, parseInt(userId))
				)
			)
			.limit(1);

		if (!parentConversation) {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		// Deactivate all other branches for this character
		await db
			.update(conversations)
			.set({ isActive: false })
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			);

		// Create the new branch
		const [newBranch] = await db
			.insert(conversations)
			.values({
				userId: parseInt(userId),
				characterId,
				name: name || `Branch from message ${messageId}`,
				parentConversationId: parentConversation.id,
				branchPointMessageId: messageId,
				isActive: true
			})
			.returning();

		// Copy messages up to and including the branch point
		const messagesToCopy = await db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, parentConversation.id))
			.orderBy(messages.createdAt);

		// Find index of branch point message
		const branchPointIndex = messagesToCopy.findIndex((m) => m.id === messageId);

		// Copy messages up to and including branch point
		for (let i = 0; i <= branchPointIndex; i++) {
			const msg = messagesToCopy[i];
			await db.insert(messages).values({
				conversationId: newBranch.id,
				role: msg.role,
				content: msg.content,
				swipes: msg.swipes,
				currentSwipe: msg.currentSwipe,
				senderName: msg.senderName,
				senderAvatar: msg.senderAvatar,
				reasoning: msg.reasoning
			});
		}

		return json({ branch: newBranch }, { status: 201 });
	} catch (error) {
		console.error('Failed to create branch:', error);
		return json({ error: 'Failed to create branch' }, { status: 500 });
	}
};
