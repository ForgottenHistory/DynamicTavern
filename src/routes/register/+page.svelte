<script lang="ts">
	import { goto } from '$app/navigation';

	let username = $state('');
	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleRegister() {
		error = '';

		if (!username || !displayName || !password || !confirmPassword) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, displayName, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Registration failed';
				loading = false;
				return;
			}

			// Success - redirect to login
			goto('/login');
		} catch (err) {
			error = 'Network error. Please try again.';
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Register | AI Chat</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="text-center text-3xl font-bold text-[var(--text-primary)]">
				AI Chat Template
			</h2>
			<p class="mt-2 text-center text-sm text-[var(--text-secondary)]">
				Create your account
			</p>
		</div>

		<form class="mt-8 space-y-6 bg-[var(--bg-secondary)] p-8 rounded-2xl border border-[var(--border-primary)] shadow-xl" onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
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
					<label for="displayName" class="block text-sm font-medium text-[var(--text-secondary)]">
						Display Name
					</label>
					<input
						id="displayName"
						type="text"
						bind:value={displayName}
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

				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-[var(--text-secondary)]">
						Confirm Password
					</label>
					<input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
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
					{loading ? 'Creating account...' : 'Sign up'}
				</button>
			</div>

			<div class="text-center">
				<a href="/login" class="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition">
					Already have an account? Sign in
				</a>
			</div>
		</form>
	</div>
</div>
