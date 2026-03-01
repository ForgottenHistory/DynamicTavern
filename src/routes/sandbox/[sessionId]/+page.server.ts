import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		throw redirect(302, '/login');
	}

	const user = await getUserById(parseInt(userId));

	if (!user) {
		cookies.delete('userId', { path: '/' });
		throw redirect(302, '/login');
	}

	const sessionId = parseInt(params.sessionId);
	if (isNaN(sessionId)) {
		throw redirect(302, '/sandbox');
	}

	return {
		user,
		sessionId
	};
};
