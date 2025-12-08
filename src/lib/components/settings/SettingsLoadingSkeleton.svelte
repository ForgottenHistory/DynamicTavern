<script lang="ts">
</script>

<div class="p-6">
	<div class="space-y-6">
		<div>
			<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Provider</label>
			<div class="w-full h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse"></div>
		</div>
		<div>
			<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Model</label>
			<div class="w-full h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse"></div>
		</div>
		<div>
			<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Temperature: 0.7</label>
			<div class="w-full h-2 bg-[var(--bg-tertiary)] rounded animate-pulse"></div>
		</div>
		<div>
			<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Max Tokens</label>
			<div class="w-full h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse"></div>
		</div>
		<div>
			<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Context Window</label>
			<div class="w-full h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse"></div>
		</div>
	</div>
	<div class="mt-6 flex items-center gap-3">
		<button
			disabled
			class="px-8 py-3 bg-gradient-to-r from-[var(--accent-primary)]/50 to-[var(--accent-secondary)]/50 text-white font-semibold rounded-xl shadow-lg cursor-not-allowed"
		>
			Save Settings
		</button>
		<button
			disabled
			class="px-8 py-3 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-xl font-semibold shadow-lg cursor-not-allowed"
		>
			Reload
		</button>
	</div>
</div>
