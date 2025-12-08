import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getUserById } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies }) => {
	const userId = cookies.get('userId');

	if (!userId) {
		throw redirect(303, '/login');
	}

	const user = await getUserById(parseInt(userId));

	if (!user) {
		cookies.delete('userId', { path: '/' });
		throw redirect(303, '/login');
	}

	return {
		user
	};
};
