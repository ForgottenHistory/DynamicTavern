<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data }: { data: PageData } = $props();

	// What's selected in the right panel: 'default' for user profile, or persona id
	let selectedItem = $state<'default' | number>('default');
	let isEditing = $state(false);

	// Profile editing state
	let displayName = $state(data.user.displayName);
	let bio = $state(data.user.bio || '');
	let avatarPreview = $state<string | null>(null);
	let saving = $state(false);
	let error = $state('');
	let success = $state('');

	// Persona state
	interface Persona {
		id: number;
		name: string;
		description: string | null;
		avatarData: string | null;
		createdAt: Date;
	}
	let personas = $state<Persona[]>([]);
	let activePersonaId = $state<number | null>(null);
	let loadingPersonas = $state(true);
	let isCreatingPersona = $state(false);
	let newPersonaName = $state('');
	let newPersonaDescription = $state('');
	let newPersonaAvatar = $state<string | null>(null);
	let savingPersona = $state(false);

	// Derived: get the currently selected persona
	let selectedPersona = $derived(
		selectedItem === 'default' ? null : personas.find(p => p.id === selectedItem) || null
	);

	// Editing persona state (copy to avoid mutating original)
	let editingName = $state('');
	let editingDescription = $state('');
	let editingAvatar = $state<string | null>(null);

	// When selection changes, reset editing state
	$effect(() => {
		if (selectedPersona) {
			editingName = selectedPersona.name;
			editingDescription = selectedPersona.description || '';
			editingAvatar = selectedPersona.avatarData;
		}
		isEditing = false;
	});

	// Update fields when data changes
	$effect(() => {
		displayName = data.user.displayName;
		bio = data.user.bio || '';
	});

	onMount(() => {
		loadPersonas();
	});

	async function loadPersonas() {
		loadingPersonas = true;
		try {
			const response = await fetch('/api/personas');
			const result = await response.json();
			personas = result.personas || [];
			activePersonaId = result.activePersonaId;
		} catch (err) {
			console.error('Failed to load personas:', err);
		} finally {
			loadingPersonas = false;
		}
	}

	async function setActivePersona(personaId: number | null) {
		try {
			const response = await fetch('/api/personas/active', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ personaId })
			});

			if (response.ok) {
				activePersonaId = personaId;
				success = personaId ? 'Persona activated!' : 'Switched to default profile';
				// Notify MainLayout to update
				window.dispatchEvent(new CustomEvent('personaUpdated'));
				setTimeout(() => (success = ''), 3000);
			} else {
				const result = await response.json();
				error = result.error || 'Failed to set persona';
			}
		} catch (err) {
			error = 'Failed to set persona';
		}
	}

	async function createPersona() {
		if (!newPersonaName.trim()) {
			error = 'Persona name is required';
			return;
		}

		savingPersona = true;
		error = '';

		try {
			const response = await fetch('/api/personas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newPersonaName.trim(),
					description: newPersonaDescription.trim() || null,
					avatarData: newPersonaAvatar
				})
			});

			if (response.ok) {
				success = 'Persona created!';
				isCreatingPersona = false;
				newPersonaName = '';
				newPersonaDescription = '';
				newPersonaAvatar = null;
				await loadPersonas();
				window.dispatchEvent(new CustomEvent('personaUpdated'));
				setTimeout(() => (success = ''), 3000);
			} else {
				const result = await response.json();
				error = result.error || 'Failed to create persona';
			}
		} catch (err) {
			error = 'Failed to create persona';
		} finally {
			savingPersona = false;
		}
	}

	async function updatePersona() {
		if (!selectedPersona) return;

		saving = true;
		error = '';

		try {
			const response = await fetch(`/api/personas/${selectedPersona.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: editingName,
					description: editingDescription || null,
					avatarData: editingAvatar
				})
			});

			if (response.ok) {
				success = 'Persona updated!';
				isEditing = false;
				await loadPersonas();
				window.dispatchEvent(new CustomEvent('personaUpdated'));
				setTimeout(() => (success = ''), 3000);
			} else {
				const result = await response.json();
				error = result.error || 'Failed to update persona';
			}
		} catch (err) {
			error = 'Failed to update persona';
		} finally {
			saving = false;
		}
	}

	async function deletePersona(personaId: number) {
		if (!confirm('Delete this persona?')) return;

		try {
			const response = await fetch(`/api/personas/${personaId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				success = 'Persona deleted!';
				if (selectedItem === personaId) {
					selectedItem = 'default';
				}
				await loadPersonas();
				window.dispatchEvent(new CustomEvent('personaUpdated'));
				setTimeout(() => (success = ''), 3000);
			} else {
				const result = await response.json();
				error = result.error || 'Failed to delete persona';
			}
		} catch (err) {
			error = 'Failed to delete persona';
		}
	}

	function handlePersonaAvatarSelect(e: Event, isNew: boolean = false) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be less than 5MB';
			return;
		}

		if (!file.type.startsWith('image/')) {
			error = 'File must be an image';
			return;
		}

		const reader = new FileReader();
		reader.onloadend = () => {
			if (isNew) {
				newPersonaAvatar = reader.result as string;
			} else {
				editingAvatar = reader.result as string;
			}
		};
		reader.readAsDataURL(file);
		error = '';
	}

	function handleAvatarSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be less than 5MB';
			return;
		}

		if (!file.type.startsWith('image/')) {
			error = 'File must be an image';
			return;
		}

		const reader = new FileReader();
		reader.onloadend = () => {
			avatarPreview = reader.result as string;
		};
		reader.readAsDataURL(file);
		error = '';
	}

	async function handleSave() {
		error = '';
		success = '';
		saving = true;

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName,
					bio,
					avatarData: avatarPreview || undefined
				})
			});

			if (response.ok) {
				// Update local state immediately
				data.user.displayName = displayName;
				data.user.bio = bio;
				if (avatarPreview) {
					data.user.avatarData = avatarPreview;
				}
				// Invalidate and reload all page data
				await invalidateAll();
				success = 'Profile updated successfully!';
				isEditing = false;
				avatarPreview = null;
				window.dispatchEvent(new CustomEvent('personaUpdated'));
				setTimeout(() => (success = ''), 3000);
			} else {
				const result = await response.json();
				error = result.error || 'Failed to update profile';
			}
		} catch (err) {
			error = 'Failed to update profile';
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		displayName = data.user.displayName;
		bio = data.user.bio || '';
		avatarPreview = null;
		isEditing = false;
		error = '';
	}
</script>

<svelte:head>
	<title>Profiles | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/profile">
	<div class="h-full overflow-y-auto">
		<div class="max-w-6xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-[var(--text-primary)]">Profiles</h1>
				<p class="text-[var(--text-secondary)] mt-1">Manage your identity for roleplay</p>
			</div>

			<!-- Messages -->
			{#if error}
				<div class="mb-4 p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl text-[var(--error)]">
					{error}
				</div>
			{/if}
			{#if success}
				<div class="mb-4 p-4 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl text-[var(--success)]">
					{success}
				</div>
			{/if}

			<!-- Side by Side Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
				<!-- Left: Personas List -->
				<div class="space-y-3">
					<h2 class="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide px-1">Personas</h2>

					<!-- Default Profile Item -->
					<button
						onclick={() => { selectedItem = 'default'; isCreatingPersona = false; }}
						class="w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3
							{selectedItem === 'default'
								? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]'
								: 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50'}"
					>
						{#if data.user.avatarThumbnail || data.user.avatarData}
							<img src={data.user.avatarThumbnail || data.user.avatarData} alt="Profile" class="w-10 h-10 rounded-full object-cover flex-shrink-0" />
						{:else}
							<div class="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white font-bold flex-shrink-0">
								{data.user.displayName.charAt(0).toUpperCase()}
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-[var(--text-primary)] truncate">{data.user.displayName}</span>
								{#if activePersonaId === null}
									<span class="px-1.5 py-0.5 text-xs bg-[var(--success)]/20 text-[var(--success)] rounded">Active</span>
								{/if}
							</div>
							<span class="text-xs text-[var(--text-muted)]">Default Profile</span>
						</div>
					</button>

					<!-- Personas -->
					{#if loadingPersonas}
						<div class="text-center py-4 text-[var(--text-muted)] text-sm">Loading...</div>
					{:else}
						{#each personas as persona (persona.id)}
							<button
								onclick={() => { selectedItem = persona.id; isCreatingPersona = false; }}
								class="w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3
									{selectedItem === persona.id
										? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]'
										: 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50'}"
							>
								{#if persona.avatarThumbnail || persona.avatarData}
									<img src={persona.avatarThumbnail || persona.avatarData} alt={persona.name} class="w-10 h-10 rounded-full object-cover flex-shrink-0" />
								{:else}
									<div class="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center text-white font-bold flex-shrink-0">
										{persona.name.charAt(0).toUpperCase()}
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium text-[var(--text-primary)] truncate">{persona.name}</span>
										{#if activePersonaId === persona.id}
											<span class="px-1.5 py-0.5 text-xs bg-[var(--success)]/20 text-[var(--success)] rounded">Active</span>
										{/if}
									</div>
									{#if persona.description}
										<span class="text-xs text-[var(--text-muted)] truncate block">{persona.description}</span>
									{/if}
								</div>
							</button>
						{/each}
					{/if}

					<!-- Create New Button -->
					<button
						onclick={() => { isCreatingPersona = true; selectedItem = 'default'; }}
						class="w-full p-3 border-2 border-dashed border-[var(--border-primary)] rounded-xl text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition flex items-center justify-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						New Persona
					</button>
				</div>

				<!-- Right: Details Panel -->
				<div class="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
					<!-- Create New Persona Form -->
					{#if isCreatingPersona}
						<div class="p-6">
							<h2 class="text-xl font-semibold text-[var(--text-primary)] mb-6">Create New Persona</h2>
							<div class="space-y-5">
								<!-- Avatar -->
								<div class="flex items-center gap-4">
									<label class="cursor-pointer group">
										{#if newPersonaAvatar}
											<img src={newPersonaAvatar} alt="Persona" class="w-20 h-20 rounded-full object-cover border-2 border-[var(--border-primary)] group-hover:opacity-75 transition" />
										{:else}
											<div class="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center text-[var(--text-muted)] group-hover:border-[var(--accent-primary)] transition">
												<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
												</svg>
											</div>
										{/if}
										<input type="file" accept="image/*" class="hidden" onchange={(e) => handlePersonaAvatarSelect(e, true)} />
									</label>
									<div class="text-sm text-[var(--text-muted)]">Click to upload avatar</div>
								</div>

								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
									<input type="text" bind:value={newPersonaName} placeholder="Persona name..." class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" />
								</div>

								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
									<textarea bind:value={newPersonaDescription} rows="4" placeholder="Describe this persona for roleplay..." class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"></textarea>
								</div>

								<div class="flex gap-3 pt-2">
									<button onclick={createPersona} disabled={savingPersona} class="px-6 py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition">
										{savingPersona ? 'Creating...' : 'Create Persona'}
									</button>
									<button onclick={() => { isCreatingPersona = false; newPersonaName = ''; newPersonaDescription = ''; newPersonaAvatar = null; }} disabled={savingPersona} class="px-6 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl font-medium hover:bg-[var(--border-primary)] disabled:opacity-50 transition">
										Cancel
									</button>
								</div>
							</div>
						</div>

					<!-- Default Profile Details -->
					{:else if selectedItem === 'default'}
						<div class="h-24 bg-gradient-to-r from-[var(--accent-primary)] via-[var(--accent-secondary)] to-[var(--accent-primary)]"></div>
						<div class="px-6 pb-6">
							<div class="relative -mt-12 mb-4">
								{#if isEditing}
									<label class="inline-block cursor-pointer group">
										{#if avatarPreview || data.user.avatarThumbnail || data.user.avatarData}
											<img src={avatarPreview || data.user.avatarThumbnail || data.user.avatarData} alt="Profile" class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg object-cover group-hover:opacity-75 transition" />
										{:else}
											<div class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white text-3xl font-bold group-hover:opacity-75 transition">
												{data.user.displayName.charAt(0).toUpperCase()}
											</div>
										{/if}
										<input type="file" accept="image/*" class="hidden" onchange={handleAvatarSelect} />
									</label>
								{:else}
									{#if data.user.avatarThumbnail || data.user.avatarData}
										<img src={data.user.avatarThumbnail || data.user.avatarData} alt="Profile" class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg object-cover" />
									{:else}
										<div class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white text-3xl font-bold">
											{data.user.displayName.charAt(0).toUpperCase()}
										</div>
									{/if}
								{/if}
							</div>

							{#if !isEditing}
								<div class="flex justify-between items-start mb-4">
									<div>
										<h2 class="text-2xl font-bold text-[var(--text-primary)]">{data.user.displayName}</h2>
										<p class="text-[var(--text-muted)]">@{data.user.username}</p>
									</div>
									<div class="flex gap-2">
										{#if activePersonaId !== null}
											<button onclick={() => setActivePersona(null)} class="px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
												Set Active
											</button>
										{/if}
										<button onclick={() => (isEditing = true)} class="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg text-sm font-medium hover:bg-[var(--border-primary)] transition">
											Edit
										</button>
									</div>
								</div>
								{#if data.user.bio}
									<p class="text-[var(--text-secondary)] mb-4">{data.user.bio}</p>
								{:else}
									<p class="text-[var(--text-muted)] italic mb-4">No description</p>
								{/if}
								{#if activePersonaId === null}
									<div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--success)]/10 text-[var(--success)] rounded-full text-sm">
										<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
										Currently Active
									</div>
								{/if}
							{:else}
								<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4">
									<div>
										<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Display Name</label>
										<input type="text" bind:value={displayName} class="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" required />
									</div>
									<div>
										<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
										<textarea bind:value={bio} rows="4" placeholder="Describe yourself for roleplay..." class="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"></textarea>
									</div>
									<div class="flex gap-3">
										<button type="submit" disabled={saving} class="px-5 py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition">
											{saving ? 'Saving...' : 'Save'}
										</button>
										<button type="button" onclick={handleCancel} disabled={saving} class="px-5 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl font-medium hover:bg-[var(--border-primary)] disabled:opacity-50 transition">
											Cancel
										</button>
									</div>
								</form>
							{/if}
						</div>

					<!-- Persona Details -->
					{:else if selectedPersona}
						<div class="h-24 bg-gradient-to-r from-[var(--accent-secondary)] via-[var(--accent-primary)] to-[var(--accent-secondary)]"></div>
						<div class="px-6 pb-6">
							<div class="relative -mt-12 mb-4">
								{#if isEditing}
									<label class="inline-block cursor-pointer group">
										{#if editingAvatar}
											<img src={editingAvatar} alt="Persona" class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg object-cover group-hover:opacity-75 transition" />
										{:else}
											<div class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center text-white text-3xl font-bold group-hover:opacity-75 transition">
												{editingName.charAt(0).toUpperCase()}
											</div>
										{/if}
										<input type="file" accept="image/*" class="hidden" onchange={(e) => handlePersonaAvatarSelect(e, false)} />
									</label>
								{:else}
									{#if selectedPersona.avatarThumbnail || selectedPersona.avatarData}
										<img src={selectedPersona.avatarThumbnail || selectedPersona.avatarData} alt={selectedPersona.name} class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg object-cover" />
									{:else}
										<div class="w-24 h-24 rounded-full border-4 border-[var(--bg-secondary)] shadow-lg bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center text-white text-3xl font-bold">
											{selectedPersona.name.charAt(0).toUpperCase()}
										</div>
									{/if}
								{/if}
							</div>

							{#if !isEditing}
								<div class="flex justify-between items-start mb-4">
									<div>
										<h2 class="text-2xl font-bold text-[var(--text-primary)]">{selectedPersona.name}</h2>
										<p class="text-[var(--text-muted)]">Persona</p>
									</div>
									<div class="flex gap-2">
										{#if activePersonaId !== selectedPersona.id}
											<button onclick={() => setActivePersona(selectedPersona.id)} class="px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition">
												Set Active
											</button>
										{/if}
										<button onclick={() => (isEditing = true)} class="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-lg text-sm font-medium hover:bg-[var(--border-primary)] transition">
											Edit
										</button>
										<button onclick={() => deletePersona(selectedPersona.id)} class="px-4 py-2 bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/30 rounded-lg text-sm font-medium hover:bg-[var(--error)]/20 transition">
											Delete
										</button>
									</div>
								</div>
								{#if selectedPersona.description}
									<p class="text-[var(--text-secondary)] mb-4">{selectedPersona.description}</p>
								{:else}
									<p class="text-[var(--text-muted)] italic mb-4">No description</p>
								{/if}
								{#if activePersonaId === selectedPersona.id}
									<div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--success)]/10 text-[var(--success)] rounded-full text-sm">
										<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
										Currently Active
									</div>
								{/if}
							{:else}
								<form onsubmit={(e) => { e.preventDefault(); updatePersona(); }} class="space-y-4">
									<div>
										<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Name</label>
										<input type="text" bind:value={editingName} class="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]" required />
									</div>
									<div>
										<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Description</label>
										<textarea bind:value={editingDescription} rows="4" placeholder="Describe this persona for roleplay..." class="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none"></textarea>
									</div>
									<div class="flex gap-3">
										<button type="submit" disabled={saving} class="px-5 py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition">
											{saving ? 'Saving...' : 'Save'}
										</button>
										<button type="button" onclick={() => { isEditing = false; if (selectedPersona) { editingName = selectedPersona.name; editingDescription = selectedPersona.description || ''; editingAvatar = selectedPersona.avatarData; } }} disabled={saving} class="px-5 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-xl font-medium hover:bg-[var(--border-primary)] disabled:opacity-50 transition">
											Cancel
										</button>
									</div>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</MainLayout>
