<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/">
	<div class="h-full overflow-y-auto">
		<div class="max-w-7xl mx-auto px-8 py-8">
			<div class="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-primary)] shadow-xl p-8">
				<h2 class="text-2xl font-semibold mb-4 text-[var(--text-primary)]">Welcome!</h2>
				<p class="text-[var(--text-secondary)] mb-6">
					Manage your AI characters, configure settings, and organize your character library.
				</p>

				<div class="grid grid-cols-2 gap-6 mt-8">
					<a
						href="/library"
						class="p-6 border-2 border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-primary)] hover:shadow-lg transition group bg-[var(--bg-tertiary)]"
					>
						<div class="flex items-center gap-3 mb-3">
							<div class="p-3 bg-[var(--accent-primary)]/20 rounded-lg group-hover:bg-[var(--accent-primary)] transition">
								<svg
									class="w-6 h-6 text-[var(--accent-primary)] group-hover:text-white transition"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
									/>
								</svg>
							</div>
							<h3 class="text-lg font-semibold text-[var(--text-primary)]">Character Library</h3>
						</div>
						<p class="text-sm text-[var(--text-secondary)]">
							Import and manage your character cards. Upload PNG character files.
						</p>
					</a>

					<a
						href="/settings"
						class="p-6 border-2 border-[var(--border-primary)] rounded-xl hover:border-[var(--accent-secondary)] hover:shadow-lg transition group bg-[var(--bg-tertiary)]"
					>
						<div class="flex items-center gap-3 mb-3">
							<div class="p-3 bg-[var(--accent-secondary)]/20 rounded-lg group-hover:bg-[var(--accent-secondary)] transition">
								<svg
									class="w-6 h-6 text-[var(--accent-secondary)] group-hover:text-white transition"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
								</svg>
							</div>
							<h3 class="text-lg font-semibold text-[var(--text-primary)]">LLM Settings</h3>
						</div>
						<p class="text-sm text-[var(--text-secondary)]">
							Configure your AI models and generation parameters.
						</p>
					</a>
				</div>
			</div>
		</div>
	</div>
</MainLayout>
