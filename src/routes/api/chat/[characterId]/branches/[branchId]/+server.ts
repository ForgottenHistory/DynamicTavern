import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT - Switch to this branch (make it active)
export const PUT: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	const branchId = parseInt(params.branchId!);
	if (isNaN(characterId) || isNaN(branchId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	try {
		// Verify the branch belongs to this user and character
		const [branch] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.id, branchId),
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			)
			.limit(1);

		if (!branch) {
			return json({ error: 'Branch not found' }, { status: 404 });
		}

		// Deactivate all branches for this character
		await db
			.update(conversations)
			.set({ isActive: false })
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			);

		// Activate the selected branch
		const [updated] = await db
			.update(conversations)
			.set({ isActive: true })
			.where(eq(conversations.id, branchId))
			.returning();

		return json({ branch: updated });
	} catch (error) {
		console.error('Failed to switch branch:', error);
		return json({ error: 'Failed to switch branch' }, { status: 500 });
	}
};

// PATCH - Rename branch
export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	const branchId = parseInt(params.branchId!);
	if (isNaN(characterId) || isNaN(branchId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	try {
		const { name } = await request.json();

		const [updated] = await db
			.update(conversations)
			.set({ name })
			.where(
				and(
					eq(conversations.id, branchId),
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			)
			.returning();

		if (!updated) {
			return json({ error: 'Branch not found' }, { status: 404 });
		}

		return json({ branch: updated });
	} catch (error) {
		console.error('Failed to rename branch:', error);
		return json({ error: 'Failed to rename branch' }, { status: 500 });
	}
};

// DELETE - Delete a branch
export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const characterId = parseInt(params.characterId!);
	const branchId = parseInt(params.branchId!);
	if (isNaN(characterId) || isNaN(branchId)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	try {
		// Check if this is the only branch
		const allBranches = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			);

		if (allBranches.length <= 1) {
			return json({ error: 'Cannot delete the only conversation branch' }, { status: 400 });
		}

		// Check if deleting active branch
		const [branch] = await db
			.select()
			.from(conversations)
			.where(
				and(
					eq(conversations.id, branchId),
					eq(conversations.userId, parseInt(userId)),
					eq(conversations.characterId, characterId)
				)
			)
			.limit(1);

		if (!branch) {
			return json({ error: 'Branch not found' }, { status: 404 });
		}

		// Delete the branch (messages cascade)
		await db.delete(conversations).where(eq(conversations.id, branchId));

		// If deleted branch was active, activate another one
		if (branch.isActive) {
			const [nextBranch] = await db
				.select()
				.from(conversations)
				.where(
					and(
						eq(conversations.userId, parseInt(userId)),
						eq(conversations.characterId, characterId)
					)
				)
				.limit(1);

			if (nextBranch) {
				await db
					.update(conversations)
					.set({ isActive: true })
					.where(eq(conversations.id, nextBranch.id));
			}
		}

		return json({ success: true });
	} catch (error) {
		console.error('Failed to delete branch:', error);
		return json({ error: 'Failed to delete branch' }, { status: 500 });
	}
};
