<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		error = '';

		if (!username || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Login failed';
				loading = false;
				return;
			}

			// Success - redirect to home
			goto('/');
		} catch (err) {
			error = 'Network error. Please try again.';
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login | AI Chat</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="text-center text-3xl font-bold text-[var(--text-primary)]">
				AI Chat Template
			</h2>
			<p class="mt-2 text-center text-sm text-[var(--text-secondary)]">
				Sign in to your account
			</p>
		</div>

		<form class="mt-8 space-y-6 bg-[var(--bg-secondary)] p-8 rounded-2xl border border-[var(--border-primary)] shadow-xl" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
			{#if error}
				<div class="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] px-4 py-3 rounded-xl">
					{error}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="username" class="block text-sm font-medium text-[var(--text-secondary)]">
						Username
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						required
						class="mt-1 block w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-[var(--text-secondary)]">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						class="mt-1 block w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
					/>
				</div>
			</div>

			<div>
				<button
					type="submit"
					disabled={loading}
					class="w-full flex justify-center py-3 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-xl font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition"
				>
					{loading ? 'Signing in...' : 'Sign in'}
				</button>
			</div>

			<div class="text-center">
				<a href="/register" class="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition">
					Don't have an account? Sign up
				</a>
			</div>
		</form>
	</div>
</div>
