<script lang="ts">
	interface Branch {
		id: number;
		name: string | null;
		isActive: boolean;
		createdAt: Date;
	}

	interface Props {
		branches: Branch[];
		activeBranchId: number | null;
		onSwitch: (branchId: number) => void;
		onDelete: (branchId: number) => void;
		onClose: () => void;
	}

	let { branches, activeBranchId, onSwitch, onDelete, onClose }: Props = $props();
</script>

<div class="w-72 flex-shrink-0 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg flex flex-col overflow-hidden">
	<div class="flex items-center justify-between p-3 border-b border-[var(--border-primary)]">
		<h3 class="font-semibold text-[var(--text-primary)]">Branches</h3>
		<button
			onclick={onClose}
			class="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
			title="Close panel"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
			</svg>
		</button>
	</div>
	<div class="flex-1 overflow-y-auto p-2 space-y-2">
		{#each branches as branch (branch.id)}
			<div
				class="group p-3 rounded-lg cursor-pointer transition {branch.id === activeBranchId ? 'bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-transparent'}"
				onclick={() => onSwitch(branch.id)}
				onkeydown={(e) => e.key === 'Enter' && onSwitch(branch.id)}
				tabindex="0"
				role="button"
			>
				<div class="flex items-center justify-between">
					<span class="font-medium text-[var(--text-primary)] truncate flex-1">
						{branch.name || 'Main'}
					</span>
					{#if branch.id === activeBranchId}
						<span class="text-xs text-[var(--accent-primary)] font-medium ml-2">Active</span>
					{/if}
				</div>
				<div class="flex items-center justify-between mt-1">
					<span class="text-xs text-[var(--text-muted)]">
						{new Date(branch.createdAt).toLocaleDateString()}
					</span>
					{#if branches.length > 1}
						<button
							onclick={(e) => { e.stopPropagation(); onDelete(branch.id); }}
							class="p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition opacity-0 group-hover:opacity-100"
							title="Delete branch"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
							</svg>
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
