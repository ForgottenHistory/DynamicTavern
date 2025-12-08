import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { username, password } = await request.json();

		// Validation
		if (!username || !password) {
			return json({ error: 'All fields are required' }, { status: 400 });
		}

		// Authenticate
		const user = await authenticateUser(username, password);

		if (!user) {
			return json({ error: 'Invalid username or password' }, { status: 401 });
		}

		// Set session cookie (simple approach for now)
		cookies.set('userId', user.id.toString(), {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7 // 1 week
		});

		return json({ user }, { status: 200 });
	} catch (error) {
		console.error('Login error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
