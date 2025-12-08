<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import LLMSettingsForm from '$lib/components/settings/LLMSettingsForm.svelte';
	import PresetsSection from '$lib/components/settings/PresetsSection.svelte';
	import SavePresetDialog from '$lib/components/settings/SavePresetDialog.svelte';
	import SettingsLoadingSkeleton from '$lib/components/settings/SettingsLoadingSkeleton.svelte';

	let { data }: { data: PageData } = $props();

	// Tab state
	type SettingsTab = 'chat' | 'decision' | 'content' | 'image';
	let activeTab = $state<SettingsTab>('chat');

	// Default settings structure
	const defaultLlmSettings = {
		provider: 'openrouter',
		model: 'anthropic/claude-3.5-sonnet',
		temperature: 0.7,
		maxTokens: 500,
		topP: 1.0,
		frequencyPenalty: 0.0,
		presencePenalty: 0.0,
		contextWindow: 8000,
		reasoningEnabled: false
	};

	// Chat LLM settings
	let chatSettings = $state({ ...defaultLlmSettings });

	// Decision Engine settings
	let decisionSettings = $state({
		...defaultLlmSettings,
		temperature: 0.3,
		maxTokens: 200,
		contextWindow: 4000
	});

	// Content LLM settings
	let contentSettings = $state({
		...defaultLlmSettings,
		temperature: 0.8,
		maxTokens: 2000,
		contextWindow: 16000
	});

	// Image LLM settings
	let imageSettings = $state({
		...defaultLlmSettings,
		model: 'openai/dall-e-3',
		temperature: 1.0,
		maxTokens: 1000,
		contextWindow: 4000
	});

	let loading = $state(true);
	let saving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let containerRef: HTMLDivElement | null = null;

	// Preset management
	let presets = $state<any[]>([]);
	let showSavePresetDialog = $state(false);
	let savingPreset = $state(false);
	let deletingPresetId = $state<number | null>(null);

	onMount(() => {
		loadSettings();
		loadPresets();
	});

	async function loadSettings() {
		loading = true;
		try {
			const [chatRes, decisionRes, contentRes, imageRes] = await Promise.all([
				fetch('/api/llm/settings'),
				fetch('/api/llm/decision-settings'),
				fetch('/api/llm/content-settings'),
				fetch('/api/llm/image-settings')
			]);

			const chatData = await chatRes.json();
			if (chatData.settings) {
				chatSettings = chatData.settings;
			}

			const decisionData = await decisionRes.json();
			if (decisionData.settings) {
				decisionSettings = decisionData.settings;
			}

			const contentData = await contentRes.json();
			if (contentData.settings) {
				contentSettings = contentData.settings;
			}

			const imageData = await imageRes.json();
			if (imageData.settings) {
				imageSettings = imageData.settings;
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
		} finally {
			loading = false;
		}
	}

	async function saveSettings(endpoint: string, settings: any, successMessage: string) {
		saving = true;
		message = null;
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			const data = await response.json();

			if (response.ok) {
				message = { type: 'success', text: successMessage };
				scrollToTop();
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: data.error || 'Failed to save settings' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Network error. Please try again.' };
		} finally {
			saving = false;
		}
	}

	const saveChatSettings = () => saveSettings('/api/llm/settings', chatSettings, 'Chat settings saved successfully!');
	const saveDecisionSettings = () => saveSettings('/api/llm/decision-settings', decisionSettings, 'Decision engine settings saved successfully!');
	const saveContentSettings = () => saveSettings('/api/llm/content-settings', contentSettings, 'Content LLM settings saved successfully!');
	const saveImageSettings = () => saveSettings('/api/llm/image-settings', imageSettings, 'Image LLM settings saved successfully!');

	function scrollToTop() {
		if (containerRef) {
			containerRef.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	async function loadPresets() {
		try {
			const response = await fetch('/api/llm-presets');
			const data = await response.json();
			presets = data.presets || [];
		} catch (error) {
			console.error('Failed to load presets:', error);
		}
	}

	async function savePreset(name: string) {
		savingPreset = true;
		try {
			// Get current tab's settings
			let currentSettings;
			switch (activeTab) {
				case 'chat':
					currentSettings = chatSettings;
					break;
				case 'decision':
					currentSettings = decisionSettings;
					break;
				case 'content':
					currentSettings = contentSettings;
					break;
				case 'image':
					currentSettings = imageSettings;
					break;
			}

			const response = await fetch('/api/llm-presets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					...currentSettings
				})
			});

			if (response.ok) {
				const data = await response.json();
				message = { type: 'success', text: 'Preset saved successfully!' };
				showSavePresetDialog = false;
				// Select the newly created preset
				if (data.preset?.id) {
					localStorage.setItem('selectedPresetId', String(data.preset.id));
				}
				await loadPresets();
				setTimeout(() => (message = null), 3000);
			} else {
				const data = await response.json();
				message = { type: 'error', text: data.error || 'Failed to save preset' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to save preset' };
		} finally {
			savingPreset = false;
		}
	}

	function loadPresetSettings(preset: any) {
		const settings = {
			provider: preset.provider,
			model: preset.model,
			temperature: preset.temperature,
			maxTokens: preset.maxTokens,
			topP: preset.topP,
			frequencyPenalty: preset.frequencyPenalty,
			presencePenalty: preset.presencePenalty,
			contextWindow: preset.contextWindow,
			reasoningEnabled: preset.reasoningEnabled ?? false
		};

		// Apply preset to the currently active tab's settings
		switch (activeTab) {
			case 'chat':
				chatSettings = settings;
				break;
			case 'decision':
				decisionSettings = settings;
				break;
			case 'content':
				contentSettings = settings;
				break;
			case 'image':
				imageSettings = settings;
				break;
		}

		message = { type: 'success', text: `Loaded preset: ${preset.name}` };
		setTimeout(() => (message = null), 3000);
		scrollToTop();
	}

	async function deletePreset(presetId: number) {
		if (!confirm('Delete this preset?')) return;

		deletingPresetId = presetId;
		try {
			const response = await fetch(`/api/llm-presets/${presetId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				message = { type: 'success', text: 'Preset deleted successfully!' };
				await loadPresets();
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: 'Failed to delete preset' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to delete preset' };
		} finally {
			deletingPresetId = null;
		}
	}

	const tabs = [
		{ id: 'chat' as const, label: 'Chat', description: 'Configure the model for character conversations' },
		{ id: 'decision' as const, label: 'Decision', description: 'Configure the model that makes decisions before sending content' },
		{ id: 'content' as const, label: 'Content', description: 'Configure the model for content creation and generation' },
		{ id: 'image' as const, label: 'Image', description: 'Configure the model for image generation' }
	];
</script>

<svelte:head>
	<title>Settings | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/settings">
	<div bind:this={containerRef} class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-5xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">LLM Settings</h1>
				<p class="text-[var(--text-secondary)]">
					Configure your language model preferences
				</p>
			</div>

			<!-- Success/Error Message -->
			{#if message}
				<div
					class="mb-6 p-4 rounded-xl border {message.type === 'success'
						? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]'
						: 'bg-[var(--error)]/10 border-[var(--error)]/30 text-[var(--error)]'}"
				>
					{message.text}
				</div>
			{/if}

			<!-- Tabs -->
			<div class="flex flex-wrap gap-2 mb-6">
				{#each tabs as tab}
					<button
						onclick={() => (activeTab = tab.id)}
						class="px-5 py-2.5 rounded-xl font-medium transition-all {activeTab === tab.id
							? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-lg'
							: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)]'}"
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<!-- Tab Description -->
			<p class="text-sm text-[var(--text-muted)] mb-6">
				{tabs.find(t => t.id === activeTab)?.description}
			</p>

			<!-- Global Presets Section -->
			<PresetsSection
				{presets}
				onLoadPreset={loadPresetSettings}
				onDeletePreset={deletePreset}
				{deletingPresetId}
			/>

			<!-- Chat Tab -->
			{#if activeTab === 'chat'}
				<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
					{#if loading}
						<SettingsLoadingSkeleton />
					{:else}
						<LLMSettingsForm
							bind:settings={chatSettings}
							{saving}
							onSave={saveChatSettings}
							onSavePreset={() => (showSavePresetDialog = true)}
							onReload={loadSettings}
						/>
					{/if}
				</div>
			{/if}

			<!-- Decision Engine Tab -->
			{#if activeTab === 'decision'}
				<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
					{#if loading}
						<SettingsLoadingSkeleton />
					{:else}
						<LLMSettingsForm
							bind:settings={decisionSettings}
							{saving}
							onSave={saveDecisionSettings}
							onSavePreset={() => (showSavePresetDialog = true)}
							onReload={loadSettings}
						/>
					{/if}
				</div>
			{/if}

			<!-- Content LLM Tab -->
			{#if activeTab === 'content'}
				<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
					{#if loading}
						<SettingsLoadingSkeleton />
					{:else}
						<LLMSettingsForm
							bind:settings={contentSettings}
							{saving}
							onSave={saveContentSettings}
							onSavePreset={() => (showSavePresetDialog = true)}
							onReload={loadSettings}
						/>
					{/if}
				</div>
			{/if}

			<!-- Image LLM Tab -->
			{#if activeTab === 'image'}
				<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
					{#if loading}
						<SettingsLoadingSkeleton />
					{:else}
						<LLMSettingsForm
							bind:settings={imageSettings}
							{saving}
							onSave={saveImageSettings}
							onSavePreset={() => (showSavePresetDialog = true)}
							onReload={loadSettings}
						/>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<SavePresetDialog
		bind:show={showSavePresetDialog}
		saving={savingPreset}
		onSave={savePreset}
	/>
</MainLayout>
