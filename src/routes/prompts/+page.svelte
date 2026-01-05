<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SavePresetDialog from '$lib/components/settings/SavePresetDialog.svelte';
	import { estimateTokens } from '$lib/utils/tokenCount';

	let { data }: { data: PageData } = $props();

	// Tab state
	type PromptsTab = 'chat' | 'impersonate' | 'decision' | 'content' | 'image' | 'action' | 'world';
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
		{ id: 'chat' as const, label: 'Chat', description: 'Prompts for character conversations and writing style' },
		{ id: 'impersonate' as const, label: 'Impersonate', description: 'Prompts for AI-generated user messages in different tones' },
		{ id: 'action' as const, label: 'Action', description: 'Prompts for narrator actions (look, enter, leave, etc.)' },
		{ id: 'world' as const, label: 'World', description: 'Prompts for world state generation (mood, clothes, position)' },
		{ id: 'decision' as const, label: 'Decision', description: 'Prompts for decision-making before sending content' },
		{ id: 'content' as const, label: 'Content', description: 'Prompts for content creation and character card cleaning' },
		{ id: 'image' as const, label: 'Image', description: 'Prompts for image tag generation' }
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
				description: 'Default prompt for generating a message as the user',
				default: `Write the next message as {{user}} in this roleplay chat with {{char}}.

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`
			},
			writing_style: {
				title: 'Writing Style',
				description: 'Global writing style guide applied to all prompts via {{writing_style}}',
				default: `# Writing Style

Write naturally and casually, like real people actually talk. Avoid purple prose and overly dramatic descriptions.

- Use casual, conversational dialogue - contractions, interruptions, trailing off, simple words
- Keep descriptions short and punchy, not flowery or poetic
- Characters should react like normal people, not dramatic novel protagonists
- Actions can be brief: *shrugs* *laughs* *rolls eyes* - not every gesture needs elaborate description
- Let silence and simple moments exist without filling them with prose
- Dialogue should feel natural - people say "yeah" and "uh" and don't always speak in complete sentences
- Less is more - don't over-describe emotions the reader can already infer`
			}
		},
		impersonate: {
			serious: {
				title: 'Serious Tone',
				description: 'Impersonation prompt for serious, measured responses',
				default: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a SERIOUS tone. Be direct, thoughtful, and measured. Avoid jokes or playful language. Focus on the matter at hand with sincerity and gravity.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `
			},
			sarcastic: {
				title: 'Sarcastic Tone',
				description: 'Impersonation prompt for witty, ironic responses',
				default: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a SARCASTIC tone. Use dry wit, irony, and subtle mockery. Be clever and sharp-tongued while still engaging with the conversation.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `
			},
			flirty: {
				title: 'Flirty Tone',
				description: 'Impersonation prompt for playful, charming responses',
				default: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a FLIRTY tone. Be playful, charming, and subtly suggestive. Use teasing language, compliments, and show romantic interest in {{char}}.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `
			}
		},
		action: {
			scene_intro: {
				title: 'Scene Introduction',
				description: 'Sets the stage when a new scene/conversation starts',
				default: `You are a narrator setting the stage for a roleplay scene.

Scenario: {{scenario}}

Characters:
{{character_descriptions}}

Player: {{user}}
{{user_description}}

Describe the scene opening based on the scenario above in 2-3 sentences. Set the atmosphere and describe the setting as specified in the scenario.`
			},
			enter_scene: {
				title: 'Character Enters',
				description: 'Narrates when a character enters the scene',
				default: `You are a narrator. {{character_name}} has just entered the scene.

Scenario: {{scenario}}

Character: {{character_descriptions}}

Briefly describe their entrance in 1-2 sentences. Be dramatic but concise.`
			},
			leave_scene: {
				title: 'Character Leaves',
				description: 'Narrates when a character leaves the scene',
				default: `You are a narrator. {{character_name}} is leaving the scene.

Scenario: {{scenario}}

Briefly describe their departure in 1-2 sentences. Be natural and concise.`
			},
			look_character: {
				title: 'Look at Character',
				description: 'Describes a character\'s current appearance when observed',
				default: `{{writing_style}}

You are a narrator describing a scene. Write a brief, vivid description of {{char}}'s current appearance, expression, and body language as observed by {{user}}.

Character Description:
{{description}}

{{#if world_sidebar}}
Current State:
- Mood: {{char_mood}}
- Position: {{char_position}}
- Wearing: {{char_clothes}}
{{/if}}

{{world}}

Conversation so far:
{{history}}

Keep it to 2-3 sentences. Focus only on what can be visually observed. Do not include dialogue or thoughts. Use the same roleplay format as the conversation (e.g. *action text*).
{{#if world_sidebar}}
Incorporate their current mood, position, and clothing into the description.
{{/if}}

System:`
			},
			look_scene: {
				title: 'Look at Scene',
				description: 'Describes the current environment and atmosphere',
				default: `{{writing_style}}

You are a narrator describing a scene. Write a brief, atmospheric description of the current environment and surroundings as observed by {{user}}.

{{world}}

Conversation so far:
{{history}}

Keep it to 2-3 sentences. Include sensory details like lighting, sounds, or mood. Use the same roleplay format as the conversation (e.g. *action text*).

System: `
			},
			look_item: {
				title: 'Look at Item',
				description: 'Describes a specific item in detail',
				default: `{{writing_style}}

You are a narrator describing a scene. Write a vivid, detailed description of {{item_owner}}'s {{item_name}} as observed by {{user}}.

Item details: {{item_description}}

{{world}}

Conversation so far:
{{history}}

Write 2-4 sentences focusing on this specific item. Describe how it looks, fits, or moves in the current moment. Use the same roleplay format as the conversation (e.g. *action text*).

System:`
			},
			narrate: {
				title: 'General Narration',
				description: 'Third-person narration of the current scene',
				default: `{{writing_style}}

You are a narrator. Write a brief narration of what is currently happening in the scene between {{user}} and {{char}}.

Character Description:
{{description}}

{{world}}

Conversation so far:
{{history}}

Keep it to 2-3 sentences. Describe the atmosphere and any ongoing actions from a third-person perspective. Use the same roleplay format as the conversation (e.g. *action text*).

System: `
			},
			explore_scene: {
				title: 'Explore Scene',
				description: 'Describes something new the user discovers while exploring',
				default: `You are a narrator describing a scene exploration.

{{user}} looks around and explores the environment. Describe something interesting they notice or discover - an object, detail, or feature of the scene they hadn't focused on before. This could be:
- A small detail that adds atmosphere
- Something that hints at the location's history
- An object that could be interacted with
- A sensory detail (sound, smell, texture)

Keep it to 2-3 sentences. Be vivid but concise.

Context:
{{scenario}}

{{world}}

Recent events:
{{history}}
`
			}
		},
		world: {
			generation: {
				title: 'World State Generation',
				description: 'Generates character mood, position, clothes, and body attributes',
				default: `Generate the current state for {{char}}.

Character: {{char}}
Description: {{description}}
Scenario: {{scenario}}

Recent conversation:
{{history}}

Output format:
{{char}}:
mood: [1-3 words]
thinking: [inner monologue, can be expressive]
position: [location, posture]
clothes:
  [item]: [color/style keywords]
body:
  [feature]: [brief description]

Example output:
Sakura:
mood: cheerful, nervous
thinking: I wonder if he noticed my new dress... I spent so long picking it out
position: bedroom, sitting on bed edge
clothes:
  dress: pink floral sundress, white trim
  sandals: white strappy wedges
  earrings: cherry blossom studs
body:
  hair: pink, long, loosely tied
  expression: smiling, slight blush
  skin: flushed cheeks

Guidelines:
- Keep values SHORT - use keywords, not sentences (except thinking)
- Mood: 1-3 emotion words (cheerful, anxious, relaxed)
- Thinking: Character's inner voice, can be expressive/conversational
- Position: Location + posture, comma-separated
- Clothes: 3-5 items, color/style keywords only
- Body: 2-4 features, descriptive keywords
- NO prose for objective fields (mood, position, clothes, body)
- Base state on conversation context
`
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
			},
			scenario_greeting: {
				title: 'Scenario Greeting Generator',
				description: 'Generates a new greeting for a specific scenario',
				default: `{{writing_style}}

You are a creative writer generating an opening message for a roleplay scenario.

CHARACTER INFORMATION:
Name: {{char}}
Description: {{description}}
Personality: {{personality}}

SCENARIO:
{{scenario}}

USER NAME: {{user}}

Write an engaging opening message from {{char}}'s perspective that:
- Sets up the scenario naturally
- Shows {{char}}'s personality through their voice and actions
- Includes both dialogue and scene-setting actions (use *asterisks* for actions)
- Creates an inviting hook for {{user}} to respond to
- Is 2-4 paragraphs long

Write ONLY the opening message, nothing else. Do not include any meta-commentary or explanations.

Scenario: `
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
			{ name: '{{scenario}}', description: 'Roleplay scenario' },
			{ name: '{{world}}', description: 'Formatted world state info' },
			{ name: '{{history}}', description: 'Conversation history' },
			{ name: '{{post_history}}', description: 'Extra character instructions' },
			{ name: '{{writing_style}}', description: 'Global writing style guide' }
		],
		impersonate: [
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{user}}', description: 'Your display name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{world}}', description: 'Formatted world state info' },
			{ name: '{{history}}', description: 'Conversation history' },
			{ name: '{{writing_style}}', description: 'Global writing style guide' }
		],
		action: [
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{user}}', description: 'Your display name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{scenario}}', description: 'Roleplay scenario' },
			{ name: '{{world}}', description: 'Formatted world state info' },
			{ name: '{{history}}', description: 'Conversation history' },
			{ name: '{{writing_style}}', description: 'Global writing style guide' },
			{ name: '{{character_name}}', description: 'Name of entering/leaving character' },
			{ name: '{{character_descriptions}}', description: 'Descriptions of all characters' },
			{ name: '{{user_description}}', description: 'User/player description' },
			{ name: '{{item_owner}}', description: 'Owner of the item being described' },
			{ name: '{{item_name}}', description: 'Name of item being described' },
			{ name: '{{item_description}}', description: 'Description of the item' },
			{ name: '{{#if world_sidebar}}', description: 'Conditional: show if world state exists' },
			{ name: '{{char_mood}}', description: 'Character\'s current mood' },
			{ name: '{{char_position}}', description: 'Character\'s location/posture' },
			{ name: '{{char_clothes}}', description: 'Character\'s current clothing' }
		],
		world: [
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{scenario}}', description: 'Roleplay scenario' },
			{ name: '{{history}}', description: 'Conversation history' }
		],
		decision: [],
		content: [
			{ name: '{{input}}', description: 'The original text to be rewritten' },
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{user}}', description: 'Your display name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{personality}}', description: 'Character personality' },
			{ name: '{{scenario}}', description: 'Roleplay scenario' },
			{ name: '{{writing_style}}', description: 'Global writing style guide' }
		],
		image: [
			{ name: '{{char}}', description: 'Character name' },
			{ name: '{{user}}', description: 'Your display name' },
			{ name: '{{description}}', description: 'Character description' },
			{ name: '{{scenario}}', description: 'Roleplay scenario' },
			{ name: '{{history}}', description: 'Conversation context' },
			{ name: '{{image_tags}}', description: 'Character\'s base appearance tags' },
			{ name: '{{contextual_tags}}', description: 'Tags relevant to current scene' },
			{ name: '{{tag_library}}', description: 'Valid Danbooru tags' },
			{ name: '{{char_clothes}}', description: 'Character\'s clothing from world state' },
			{ name: '{{user_clothes}}', description: 'User\'s clothing from world state' },
			{ name: '{{world}}', description: 'World state context' }
		]
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

	function exportPrompts() {
		const exportData = {
			name: 'Exported Prompts',
			exportedAt: new Date().toISOString(),
			prompts
		};
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `prompts-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		message = { type: 'success', text: 'Prompts exported!' };
		setTimeout(() => (message = null), 3000);
	}

	let fileInput: HTMLInputElement;
	let importing = $state(false);

	async function importPrompts(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importing = true;
		try {
			const text = await file.text();
			const data = JSON.parse(text);

			if (!data.prompts || typeof data.prompts !== 'object') {
				throw new Error('Invalid prompt file format');
			}

			// Prompt for preset name
			const presetName = prompt('Enter a name for the imported preset:', data.name || 'Imported Prompts');
			if (!presetName) {
				importing = false;
				input.value = '';
				return;
			}

			// Create preset from imported data
			const response = await fetch('/api/prompt-presets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: presetName, prompts: data.prompts })
			});

			if (response.ok) {
				const result = await response.json();
				// Load the imported prompts into the editor
				prompts = { ...data.prompts };
				if (result.preset?.id) {
					selectedPresetId = String(result.preset.id);
				}
				await loadPresets();
				message = { type: 'success', text: `Imported as preset: ${presetName}` };
			} else {
				const err = await response.json();
				throw new Error(err.error || 'Failed to save preset');
			}
		} catch (error) {
			console.error('Import failed:', error);
			message = { type: 'error', text: error instanceof Error ? error.message : 'Failed to import prompts' };
		} finally {
			importing = false;
			input.value = '';
			setTimeout(() => (message = null), 3000);
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

	// Custom file paths for prompts that don't follow {category}_{name}.txt pattern
	const CUSTOM_FILE_PATHS: Record<string, Record<string, string>> = {
		chat: {
			writing_style: 'writing_style'
		}
	};

	function getFilePath(category: string, name: string): string {
		const customPath = CUSTOM_FILE_PATHS[category]?.[name];
		if (customPath) {
			return `${customPath}.txt`;
		}
		return `${category}_${name}.txt`;
	}
</script>

<svelte:head>
	<title>Prompts | DynamicTavern</title>
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
					<div class="flex items-center gap-2">
						<button
							onclick={exportPrompts}
							class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] font-medium rounded-xl transition border border-[var(--border-primary)] flex items-center gap-2"
							title="Export current prompts to JSON file"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
							</svg>
							Export
						</button>
						<input
							type="file"
							accept=".json"
							class="hidden"
							bind:this={fileInput}
							onchange={importPrompts}
						/>
						<button
							onclick={() => fileInput.click()}
							disabled={importing}
							class="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] text-[var(--text-primary)] font-medium rounded-xl transition border border-[var(--border-primary)] flex items-center gap-2 disabled:opacity-50"
							title="Import prompts from JSON file"
						>
							{#if importing}
								<div class="w-4 h-4 border-2 border-[var(--text-primary)] border-t-transparent rounded-full animate-spin"></div>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
								</svg>
							{/if}
							Import
						</button>
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
										File: <code class="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">data/prompts/{getFilePath(activeTab, name)}</code>
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
