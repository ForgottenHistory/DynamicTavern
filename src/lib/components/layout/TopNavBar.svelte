<script lang="ts">
	interface Props {
		currentPath: string;
	}

	let { currentPath }: Props = $props();

	function isActive(path: string): boolean {
		return currentPath === path;
	}

	const navItems = [
		{ path: '/', label: 'Home', icon: 'home' },
		{ path: '/library', label: 'Library', icon: 'library' },
		{ path: '/prompts', label: 'Prompts', icon: 'prompts' },
		{ path: '/tags', label: 'Tags', icon: 'tags' },
		{ path: '/lorebooks', label: 'Lorebooks', icon: 'lorebooks' }
	];
</script>

<div class="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] px-6 py-4 shadow-sm">
	<div class="flex items-center justify-between">
		<!-- Left: Nav Buttons -->
		<div class="flex items-center gap-2">
			<a
				href="/"
				class="px-4 py-2 rounded-lg font-medium transition {isActive('/')
					? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}"
			>
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
					Home
				</div>
			</a>

			<a
				href="/library"
				class="px-4 py-2 rounded-lg font-medium transition {isActive('/library')
					? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}"
			>
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
					Library
				</div>
			</a>

			<a
				href="/prompts"
				class="px-4 py-2 rounded-lg font-medium transition {isActive('/prompts')
					? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}"
			>
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Prompts
				</div>
			</a>

			<a
				href="/tags"
				class="px-4 py-2 rounded-lg font-medium transition {isActive('/tags')
					? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}"
			>
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
						/>
					</svg>
					Tags
				</div>
			</a>

			<a
				href="/lorebooks"
				class="px-4 py-2 rounded-lg font-medium transition {isActive('/lorebooks')
					? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}"
			>
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
					Lorebooks
				</div>
			</a>
		</div>

		<!-- Right: Logout -->
		<div class="flex items-center gap-3">
			<form method="POST" action="/api/auth/logout">
				<button
					type="submit"
					class="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
					title="Logout"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
				</button>
			</form>
		</div>
	</div>
</div>
