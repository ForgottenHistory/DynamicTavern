<script lang="ts">
	import type { Character } from '$lib/server/db/schema';
	import ProfileImage from './character-profile/ProfileImage.svelte';
	import ProfileHeader from './character-profile/ProfileHeader.svelte';
	import ProfileTabs from './character-profile/ProfileTabs.svelte';
	import OverviewTab from './character-profile/tabs/OverviewTab.svelte';
	import MessagesTab from './character-profile/tabs/MessagesTab.svelte';
	import ImageTab from './character-profile/tabs/ImageTab.svelte';

	interface Props {
		character: Character | null;
		onClose: () => void;
		onUpdate?: () => void;
	}

	let { character, onClose, onUpdate }: Props = $props();

	// Reactively parse cardData whenever character changes
	const cardData = $derived(character?.cardData ? JSON.parse(character.cardData) : {});
	const data = $derived(cardData.data || {});
	const baseTags = $derived(character?.tags ? JSON.parse(character.tags) : []);

	// Local display state (updates immediately on save)
	let displayName = $state<string | null>(null);
	let displayTags = $state<string[] | null>(null);
	let displayData = $state<Record<string, any> | null>(null);

	// Reset local state when character changes
	$effect(() => {
		if (character) {
			displayName = null;
			displayTags = null;
			displayData = null;
		}
	});

	// Use local state if set, otherwise use prop-derived values
	const currentData = $derived(displayData ?? data);

	// Use local state if set, otherwise use prop-derived values
	const currentName = $derived(displayName ?? character?.name ?? '');
	const currentTags = $derived(displayTags ?? baseTags);

	let activeTab = $state<'overview' | 'messages' | 'image'>('overview');
	let imagePreview = $state<string | null>(null);
	let changingImage = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);
	let saving = $state(false);

	async function handleNameSave(name: string) {
		if (!character) return;

		saving = true;
		try {
			const response = await fetch(`/api/characters/${character.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (!response.ok) throw new Error('Failed to update name');

			displayName = name;
			success = 'Name updated successfully!';
			setTimeout(() => (success = null), 3000);
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error('Failed to save name:', err);
			error = 'Failed to save name';
		} finally {
			saving = false;
		}
	}

	async function handleTagsSave(tags: string[]) {
		if (!character) return;

		saving = true;
		try {
			const response = await fetch(`/api/characters/${character.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tags })
			});

			if (!response.ok) throw new Error('Failed to update tags');

			displayTags = tags;
			success = 'Tags updated successfully!';
			setTimeout(() => (success = null), 3000);
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error('Failed to save tags:', err);
			error = 'Failed to save tags';
		} finally {
			saving = false;
		}
	}

	async function handleOverviewFieldSave(field: string, value: string) {
		if (!character) return;

		try {
			// For description, update directly on character
			if (field === 'description') {
				const response = await fetch(`/api/characters/${character.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ description: value })
				});

				if (!response.ok) throw new Error('Failed to update description');

				// Update local display state
				character.description = value;
			} else {
				// For cardData fields (scenario, personality, creator_notes), update the cardData
				const updatedCardData = { ...cardData };
				if (!updatedCardData.data) updatedCardData.data = {};
				updatedCardData.data[field] = value;

				const response = await fetch(`/api/characters/${character.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cardData: updatedCardData })
				});

				if (!response.ok) throw new Error(`Failed to update ${field}`);

				// Update local display state
				displayData = { ...currentData, [field]: value };
			}

			success = 'Updated successfully!';
			setTimeout(() => (success = null), 3000);
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error(`Failed to save ${field}:`, err);
			error = `Failed to save ${field}`;
			throw err;
		}
	}

	async function handleMessagesFieldSave(field: string, value: string | string[]) {
		if (!character) return;

		try {
			// All message fields are in cardData
			const updatedCardData = { ...cardData };
			if (!updatedCardData.data) updatedCardData.data = {};
			updatedCardData.data[field] = value;

			const response = await fetch(`/api/characters/${character.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cardData: updatedCardData })
			});

			if (!response.ok) throw new Error(`Failed to update ${field}`);

			// Update local display state
			displayData = { ...currentData, [field]: value };

			success = 'Updated successfully!';
			setTimeout(() => (success = null), 3000);
			if (onUpdate) onUpdate();
		} catch (err) {
			console.error(`Failed to save ${field}:`, err);
			error = `Failed to save ${field}`;
			throw err;
		}
	}

	async function handleImageChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Please select a valid image file';
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be smaller than 5MB';
			return;
		}

		try {
			changingImage = true;
			error = null;

			const reader = new FileReader();
			reader.onload = async (e) => {
				const base64Image = e.target?.result as string;

				try {
					const response = await fetch(`/api/characters/${character?.id}/image`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ imageData: base64Image })
					});

					if (!response.ok) throw new Error('Failed to update image');

					imagePreview = base64Image;
					success = 'Character image updated successfully!';
					setTimeout(() => (success = null), 3000);
					if (onUpdate) onUpdate();
				} catch (err) {
					console.error('Failed to save image:', err);
					error = 'Failed to save image';
				} finally {
					changingImage = false;
				}
			};

			reader.onerror = () => {
				error = 'Failed to read image file';
				changingImage = false;
			};

			reader.readAsDataURL(file);
		} catch (err) {
			console.error('Failed to change image:', err);
			error = 'Failed to change image';
			changingImage = false;
		}
	}
</script>

{#if character}
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-[var(--bg-secondary)] rounded-2xl max-w-4xl w-full h-[85vh] overflow-hidden shadow-2xl border border-[var(--border-primary)] flex"
		>
			<!-- Left Side: Character Image -->
			<ProfileImage
				imageData={character.imageData}
				{imagePreview}
				characterName={currentName}
			/>

			<!-- Right Side: Content -->
			<div class="flex-1 flex flex-col min-w-0">
				<ProfileHeader
					name={currentName}
					tags={currentTags}
					{saving}
					onNameSave={handleNameSave}
					onTagsSave={handleTagsSave}
					{onClose}
				/>

				<ProfileTabs
					{activeTab}
					onTabChange={(tab) => (activeTab = tab)}
				/>

				<!-- Scrollable Tab Content -->
				<div class="flex-1 overflow-y-auto p-6">
					{#if activeTab === 'overview'}
						<OverviewTab {character} data={currentData} onSave={handleOverviewFieldSave} />
					{:else if activeTab === 'messages'}
						<MessagesTab data={currentData} onSave={handleMessagesFieldSave} />
					{:else if activeTab === 'image'}
						<ImageTab
							{character}
							{imagePreview}
							{changingImage}
							{error}
							{success}
							onImageChange={handleImageChange}
							{onUpdate}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
