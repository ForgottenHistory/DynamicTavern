<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SavePresetDialog from '$lib/components/settings/SavePresetDialog.svelte';
	import { estimateTokens } from '$lib/utils/tokenCount';

	let { data }: { data: PageData } = $props();

	// Tab state
	type PromptsTab = 'chat' | 'decision' | 'content' | 'image';
	let activeTab = $state<PromptsTab>('chat');

	let prompts = $state<Record<string, Record<string, string>>>({});
	let loading = $state(true);
	let saving = $state<string | null>(null);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Preset management
	let presets = $state<any[]>([]);
	let selectedPresetId = $state<string>('');
	let showSavePresetDialog = $state(false);
	let savingPreset = $state(false);
	let deletingPresetId = $state<number | null>(null);

	const tabs = [
		{ id: 'chat' as const, label: 'Chat', description: 'Prompts for character conversations' },
		{ id: 'decision' as const, label: 'Decision', description: 'Prompts for decision-making before sending content' },
		{ id: 'content' as const, label: 'Content', description: 'Prompts for content creation and generation' },
		{ id: 'image' as const, label: 'Image', description: 'Prompts for image generation' }
	];

	const PROMPT_CONFIG: Record<string, Record<string, { title: string; description: string; default: string }>> = {
		chat: {
			system: {
				title: 'System Prompt',
				description: 'The main prompt sent to the LLM for character responses',
				default: `You are {{char}}.

{{description}}

Personality: {{personality}}

Scenario: {{scenario}}

Write your next reply as {{char}} in this roleplay chat with {{user}}.`
			},
			impersonate: {
				title: 'Impersonate Prompt',
				description: 'Used when generating a message as the user',
				default: `Write the next message as {{user}} in this roleplay chat with {{char}}.

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`
			}
		},
		decision: {
			system: {
				title: 'Decision Engine Prompt',
				description: 'Analyzes conversations to decide if the character should send an image',
				default: `You are a decision engine that analyzes roleplay conversations to determine if the character should send an image.

Analyze the recent conversation and decide if this is an appropriate moment for the character to send an image/photo of themselves.

Consider:
- Did the user ask to see the character or request a photo?
- Is there a natural moment where the character would share how they look?
- Has it been a while since an image was sent and the conversation warrants one?
- Would sending an image enhance the roleplay experience at this moment?

Do NOT send an image if:
- The conversation is purely dialogue/text focused
- An image was just sent recently
- The scene doesn't call for visual content

Respond with key-value pairs, one per line:
send_image: true/false
reason: brief explanation for your decision`
			}
		},
		content: {
			description: {
				title: 'Description Rewriter',
				description: 'Cleans up character descriptions from imported cards',
				default: `Rewrite the following character description to be clean, well-formatted, and suitable for roleplay.

Guidelines:
- Remove any meta-instructions, placeholders, or formatting artifacts
- Keep the core character traits, appearance, and background
- Write in third person
- Use clear, concise prose

Original description:
{{input}}

Rewritten description:`
			},
			personality: {
				title: 'Personality Rewriter',
				description: 'Cleans up character personality traits',
				default: `Rewrite the following character personality to be clean and well-structured.

Guidelines:
- Extract key personality traits
- Remove redundant or contradictory information
- Format as a clear, readable list or prose

Original personality:
{{input}}

Rewritten personality:`
			},
			scenario: {
				title: 'Scenario Rewriter',
				description: 'Cleans up roleplay scenarios',
				default: `Rewrite the following roleplay scenario to be clean and engaging.

Guidelines:
- Set up a clear starting situation
- Establish the relationship between the character and user
- Keep it open-ended enough for roleplay to develop

Original scenario:
{{input}}

Rewritten scenario:`
			},
			message_example: {
				title: 'Message Example Rewriter',
				description: 'Cleans up example messages that show character voice',
				default: `Rewrite the following example messages to demonstrate the character's voice and style.

Guidelines:
- Show how the character speaks and acts
- Include a mix of dialogue and actions
- Format actions with asterisks (*action*)

Original examples:
{{input}}

Rewritten examples:`
			},
			greeting: {
				title: 'Greeting Rewriter',
				description: 'Cleans up character greeting/first messages',
				default: `Rewrite the following greeting message to be clean and engaging.

Guidelines:
- Create an inviting opening for roleplay
- Show the character's personality
- Include both dialogue and scene-setting actions

Original greeting:
{{input}}

Rewritten greeting:`
			}
		},
		image: {
			character: {
				title: 'Character Tags Prompt',
				description: 'Instructions for generating tags describing the character (expression, pose, clothing, actions)',
				default: `Generate Danbooru tags for the CHARACTER in this scene.

Focus on:
- Expression (smiling, blushing, angry, crying, etc.)
- Pose and body position (standing, sitting, lying down, etc.)
- Actions they're doing (reading, eating, waving, etc.)
- Clothing details with COLOR + TYPE (white shirt, black jacket, blue dress)
- Accessories (glasses, jewelry, hat, etc.)

Output ONLY comma-separated tags for the character, no explanations.`
			},
			user: {
				title: 'User Tags Prompt',
				description: 'Instructions for generating tags related to user presence/POV in the scene',
				default: `Generate Danbooru tags for the USER's perspective/presence in this scene.

Focus on:
- POV tags if applicable (pov, pov hands, first-person view)
- User's actions toward the character (holding hands, hugging, etc.)
- User presence indicators (1boy, 1other, etc. if visible)

If the user is not visible or relevant to the image, output: none

Output ONLY comma-separated tags, no explanations.`
			},
			scene: {
				title: 'Scene Tags Prompt',
				description: 'Instructions for generating tags for composition, environment, and atmosphere',
				default: `Generate Danbooru tags for the SCENE/ENVIRONMENT.

Focus on:
- Composition/framing (close-up, upper body, cowboy shot, full body, portrait)
- Location (indoors, outdoors, bedroom, cafe, park, etc.)
- Time of day (day, night, sunset, etc.)
- Lighting (soft lighting, dramatic lighting, backlighting, etc.)
- Atmosphere/mood (warm colors, dark atmosphere, etc.)
- Background elements (window, bed, table, trees, etc.)

**ALWAYS include a composition tag** (close-up, upper body, cowboy shot, full body, portrait)

Output ONLY comma-separated tags, no explanations.`
			}
		}
	};

	const VARIABLES: Record<string, { name: string; description: string }[]> = {
		chat: [
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{user}}', description: 'Your display name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{personality}}', description: 'Character personality' },
			{ name: '{{scenario}}', description: 'Roleplay scenario' }
		],
		decision: [],
		content: [
			{ name: '{{input}}', description: 'The original text to be rewritten' }
		],
		image: []
	};

	onMount(() => {
		loadPrompts();
		loadPresets();
	});

	async function loadPrompts() {
		loading = true;
		try {
			const response = await fetch('/api/prompts');
			const data = await response.json();
			if (data.prompts) {
				prompts = data.prompts;
			}
		} catch (error) {
			console.error('Failed to load prompts:', error);
		} finally {
			loading = false;
		}
	}

	async function loadPresets() {
		try {
			const response = await fetch('/api/prompt-presets');
			const data = await response.json();
			presets = data.presets || [];
		} catch (error) {
			console.error('Failed to load presets:', error);
		}
	}

	async function savePreset(name: string) {
		savingPreset = true;
		try {
			const response = await fetch('/api/prompt-presets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, prompts })
			});

			const data = await response.json();

			if (response.ok) {
				message = { type: 'success', text: 'Preset saved successfully!' };
				showSavePresetDialog = false;
				if (data.preset?.id) {
					selectedPresetId = String(data.preset.id);
				}
				await loadPresets();
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: data.error || 'Failed to save preset' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to save preset' };
		} finally {
			savingPreset = false;
		}
	}

	function loadPresetSettings(preset: any) {
		// Apply all prompts from preset
		prompts = { ...preset.prompts };
		message = { type: 'success', text: `Loaded preset: ${preset.name}` };
		setTimeout(() => (message = null), 3000);
	}

	async function deletePreset(presetId: number) {
		if (!confirm('Delete this preset?')) return;

		deletingPresetId = presetId;
		try {
			const response = await fetch(`/api/prompt-presets/${presetId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				message = { type: 'success', text: 'Preset deleted successfully!' };
				selectedPresetId = '';
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

	async function savePrompt(category: string, name: string) {
		const key = `${category}_${name}`;
		saving = key;
		message = null;
		try {
			const response = await fetch('/api/prompts', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ category, name, content: prompts[category]?.[name] })
			});

			const data = await response.json();

			if (response.ok) {
				message = { type: 'success', text: `Saved to data/prompts/${data.file}` };
				setTimeout(() => (message = null), 3000);
			} else {
				message = { type: 'error', text: data.error || 'Failed to save prompt' };
			}
		} catch (error) {
			message = { type: 'error', text: 'Failed to save prompt' };
		} finally {
			saving = null;
		}
	}

	function resetToDefault(category: string, name: string) {
		const config = PROMPT_CONFIG[category]?.[name];
		if (config) {
			if (!prompts[category]) prompts[category] = {};
			prompts[category][name] = config.default;
		}
	}

	function getPromptValue(category: string, name: string): string {
		return prompts[category]?.[name] || '';
	}

	function setPromptValue(category: string, name: string, value: string) {
		if (!prompts[category]) prompts[category] = {};
		prompts[category][name] = value;
	}
</script>

<svelte:head>
	<title>Prompts | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/prompts">
	<div class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-5xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Prompts</h1>
				<p class="text-[var(--text-secondary)]">
					Customize the prompts used for each LLM type
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

			<!-- Presets Section -->
			<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] p-6 mb-6">
				<div class="flex items-center justify-between mb-4">
					<div>
						<h2 class="text-lg font-semibold text-[var(--text-primary)]">Prompt Presets</h2>
						<p class="text-sm text-[var(--text-muted)]">Save and load all prompts across all categories</p>
					</div>
					<button
						onclick={() => (showSavePresetDialog = true)}
						class="px-4 py-2 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium rounded-xl hover:opacity-90 transition flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Save Preset
					</button>
				</div>
				{#if presets.length > 0}
					<div class="flex items-center gap-3">
						<select
							bind:value={selectedPresetId}
							onchange={(e) => {
								const presetId = parseInt(e.currentTarget.value);
								if (presetId) {
									const preset = presets.find((p) => p.id === presetId);
									if (preset) loadPresetSettings(preset);
								}
							}}
							class="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
						>
							<option value="" disabled>Select a preset to load...</option>
							{#each presets as preset}
								<option value={String(preset.id)}>{preset.name}</option>
							{/each}
						</select>
						<button
							onclick={() => {
								const presetId = parseInt(selectedPresetId);
								if (presetId) deletePreset(presetId);
							}}
							disabled={!selectedPresetId || deletingPresetId !== null}
							class="px-4 py-3 text-[var(--error)] hover:bg-[var(--error)]/10 disabled:opacity-50 rounded-xl transition border border-[var(--error)]/30 hover:border-[var(--error)]/50"
							title="Delete selected preset"
						>
							{#if deletingPresetId !== null}
								<div class="w-5 h-5 border-2 border-[var(--error)] border-t-transparent rounded-full animate-spin"></div>
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							{/if}
						</button>
					</div>
				{:else}
					<p class="text-sm text-[var(--text-muted)] italic">No presets saved yet</p>
				{/if}
			</div>

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

			<div class="grid grid-cols-1 {(VARIABLES[activeTab] || []).length > 0 ? 'lg:grid-cols-3' : ''} gap-6">
				<!-- Stacked Prompt Editors -->
				<div class="{(VARIABLES[activeTab] || []).length > 0 ? 'lg:col-span-2' : ''} space-y-6">
					{#each Object.entries(PROMPT_CONFIG[activeTab] || {}) as [name, config]}
						{@const key = `${activeTab}_${name}`}
						<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
							<div class="p-6">
								{#if loading}
									<div class="space-y-4">
										<div class="h-6 bg-[var(--bg-tertiary)] rounded animate-pulse w-1/3"></div>
										<div class="h-48 bg-[var(--bg-tertiary)] rounded-xl animate-pulse"></div>
										<div class="h-10 bg-[var(--bg-tertiary)] rounded-xl animate-pulse w-1/4"></div>
									</div>
								{:else}
									<div class="mb-4">
										<h3 class="text-lg font-semibold text-[var(--text-primary)]">{config.title}</h3>
										<p class="text-sm text-[var(--text-muted)]">{config.description}</p>
									</div>

									<textarea
										value={getPromptValue(activeTab, name)}
										oninput={(e) => setPromptValue(activeTab, name, e.currentTarget.value)}
										rows="10"
										placeholder={config.default}
										class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono text-sm resize-y"
									></textarea>

									<div class="flex items-center justify-between mt-2">
										<span class="text-xs text-[var(--text-muted)]">
											~{estimateTokens(getPromptValue(activeTab, name) || config.default).toLocaleString()} tokens
										</span>
									</div>

									<div class="flex items-center gap-3 mt-3">
										<button
											onclick={() => savePrompt(activeTab, name)}
											disabled={saving !== null}
											class="px-6 py-2.5 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
										>
											{#if saving === key}
												<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
												Saving...
											{:else}
												Save
											{/if}
										</button>
										<button
											onclick={() => resetToDefault(activeTab, name)}
											class="px-6 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] rounded-xl transition border border-[var(--border-primary)]"
										>
											Reset to Default
										</button>
									</div>

									<p class="text-xs text-[var(--text-muted)] mt-3">
										File: <code class="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">data/prompts/{activeTab}_{name}.txt</code>
									</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- Variables Sidebar (only shown when there are variables) -->
				{#if (VARIABLES[activeTab] || []).length > 0}
					<div class="lg:col-span-1">
						<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden sticky top-8">
							<div class="p-6">
								<h3 class="text-lg font-semibold text-[var(--text-primary)] mb-4">Available Variables</h3>
								<p class="text-sm text-[var(--text-secondary)] mb-4">
									These variables are replaced with actual data when generating responses.
								</p>
								<div class="space-y-2">
									{#each VARIABLES[activeTab] || [] as variable}
										<div
											class="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]"
										>
											<code class="text-[var(--accent-primary)] font-mono text-sm">
												{variable.name}
											</code>
											<p class="text-xs text-[var(--text-muted)] mt-1">{variable.description}</p>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</MainLayout>

<SavePresetDialog
	bind:show={showSavePresetDialog}
	saving={savingPreset}
	onSave={savePreset}
/>
