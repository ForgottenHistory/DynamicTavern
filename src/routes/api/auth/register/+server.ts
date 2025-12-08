import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, findUserByUsername } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { username, displayName, password } = await request.json();

		// Validation
		if (!username || !displayName || !password) {
			return json({ error: 'All fields are required' }, { status: 400 });
		}

		if (username.length < 3) {
			return json({ error: 'Username must be at least 3 characters' }, { status: 400 });
		}

		if (password.length < 6) {
			return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
		}

		// Check if user exists
		const existingUser = await findUserByUsername(username);
		if (existingUser) {
			return json({ error: 'Username already taken' }, { status: 400 });
		}

		// Create user
		const user = await createUser(username, displayName, password);

		// Return user without password
		const { passwordHash, ...userWithoutPassword } = user;

		return json({ user: userWithoutPassword }, { status: 201 });
	} catch (error) {
		console.error('Registration error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
