<script lang="ts">
	type TabType = 'overview' | 'messages' | 'image';

	interface Props {
		activeTab: TabType;
		onTabChange: (tab: TabType) => void;
	}

	let { activeTab, onTabChange }: Props = $props();

	const tabs: { id: TabType; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'messages', label: 'Messages' },
		{ id: 'image', label: 'Edit Image' }
	];
</script>

<div class="border-b border-[var(--border-primary)]">
	<div class="flex px-5">
		{#each tabs as tab}
			<button
				onclick={() => onTabChange(tab.id)}
				class="px-4 py-2.5 font-medium text-sm transition {activeTab === tab.id
					? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]'
					: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>
