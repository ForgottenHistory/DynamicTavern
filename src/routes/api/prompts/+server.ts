import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'data', 'prompts');

// Prompt types organized by LLM category
const DEFAULT_PROMPTS: Record<string, Record<string, string>> = {
	chat: {
		system: `You are {{char}}.

{{description}}

Personality: {{personality}}

Scenario: {{scenario}}

Write your next reply as {{char}} in this roleplay chat with {{user}}.`,
		impersonate: `Write the next message as {{user}} in this roleplay chat with {{char}}.

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`,
		writing_style: `# Writing Style

Write naturally and casually, like real people actually talk. Avoid purple prose and overly dramatic descriptions.

- Use casual, conversational dialogue - contractions, interruptions, trailing off, simple words
- Keep descriptions short and punchy, not flowery or poetic
- Characters should react like normal people, not dramatic novel protagonists
- Actions can be brief: *shrugs* *laughs* *rolls eyes* - not every gesture needs elaborate description
- Let silence and simple moments exist without filling them with prose
- Dialogue should feel natural - people say "yeah" and "uh" and don't always speak in complete sentences
- Less is more - don't over-describe emotions the reader can already infer`
	},
	impersonate: {
		serious: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a SERIOUS tone. Be direct, thoughtful, and measured. Avoid jokes or playful language. Focus on the matter at hand with sincerity and gravity.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `,
		sarcastic: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a SARCASTIC tone. Use dry wit, irony, and subtle mockery. Be clever and sharp-tongued while still engaging with the conversation.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `,
		flirty: `{{writing_style}}

Write the next message as {{user}} in this roleplay chat with {{char}}.

{{description}}

{{world}}

Conversation so far:
{{history}}

Write {{user}}'s response in a FLIRTY tone. Be playful, charming, and subtly suggestive. Use teasing language, compliments, and show romantic interest in {{char}}.

Write 2-6 sentences. Stay in character as {{user}}.

{{user}}: `
	},
	decision: {
		system: `You are a decision engine that analyzes roleplay conversations to determine if the character should send an image.

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
	},
	content: {
		description: `Rewrite the following character description to be clean, well-formatted, and suitable for roleplay.

Guidelines:
- Remove any meta-instructions, placeholders, or formatting artifacts
- Keep the core character traits, appearance, and background
- Write in third person
- Use clear, concise prose

Original description:
{{input}}

Rewritten description:`,
		personality: `Rewrite the following character personality to be clean and well-structured.

Guidelines:
- Extract key personality traits
- Remove redundant or contradictory information
- Format as a clear, readable list or prose

Original personality:
{{input}}

Rewritten personality:`,
		scenario: `Rewrite the following roleplay scenario to be clean and engaging.

Guidelines:
- Set up a clear starting situation
- Establish the relationship between the character and user
- Keep it open-ended enough for roleplay to develop

Original scenario:
{{input}}

Rewritten scenario:`,
		message_example: `Rewrite the following example messages to demonstrate the character's voice and style.

Guidelines:
- Show how the character speaks and acts
- Include a mix of dialogue and actions
- Format actions with asterisks (*action*)

Original examples:
{{input}}

Rewritten examples:`,
		greeting: `Rewrite the following greeting message to be clean and engaging.

Guidelines:
- Create an inviting opening for roleplay
- Show the character's personality
- Include both dialogue and scene-setting actions

Original greeting:
{{input}}

Rewritten greeting:`,
		scenario_greeting: `{{writing_style}}

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
	},
	image: {
		character: `Generate Danbooru tags for the CHARACTER in this scene.

Focus on:
- Expression (smiling, blushing, angry, crying, etc.)
- Pose and body position (standing, sitting, lying down, etc.)
- Actions they're doing (reading, eating, waving, etc.)
- Clothing details with COLOR + TYPE (white shirt, black jacket, blue dress)
- Accessories (glasses, jewelry, hat, etc.)

Output ONLY comma-separated tags for the character, no explanations.`,
		user: `Generate Danbooru tags for the USER's perspective/presence in this scene.

Focus on:
- POV tags if applicable (pov, pov hands, first-person view)
- User's actions toward the character (holding hands, hugging, etc.)
- User presence indicators (1boy, 1other, etc. if visible)

If the user is not visible or relevant to the image, output: none

Output ONLY comma-separated tags, no explanations.`,
		scene: `Generate Danbooru tags for the SCENE/ENVIRONMENT.

Focus on:
- Composition/framing (close-up, upper body, cowboy shot, full body, portrait)
- Location (indoors, outdoors, bedroom, cafe, park, etc.)
- Time of day (day, night, sunset, etc.)
- Lighting (soft lighting, dramatic lighting, backlighting, etc.)
- Atmosphere/mood (warm colors, dark atmosphere, etc.)
- Background elements (window, bed, table, trees, etc.)

**ALWAYS include a composition tag** (close-up, upper body, cowboy shot, full body, portrait)

Output ONLY comma-separated tags, no explanations.`
	},
	action: {
		scene_intro: `You are a narrator setting the stage for a roleplay scene.

Scenario: {{scenario}}

Characters:
{{character_descriptions}}

Player: {{user}}
{{user_description}}

Describe the scene opening based on the scenario above in 2-3 sentences. Set the atmosphere and describe the setting as specified in the scenario.`,
		enter_scene: `You are a narrator. {{character_name}} has just entered the scene.

Scenario: {{scenario}}

Character: {{character_descriptions}}

Briefly describe their entrance in 1-2 sentences. Be dramatic but concise.`,
		leave_scene: `You are a narrator. {{character_name}} is leaving the scene.

Scenario: {{scenario}}

Briefly describe their departure in 1-2 sentences. Be natural and concise.`,
		look_character: `{{writing_style}}

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

System:`,
		look_scene: `{{writing_style}}

You are a narrator describing a scene. Write a brief, atmospheric description of the current environment and surroundings as observed by {{user}}.

{{world}}

Conversation so far:
{{history}}

Keep it to 2-3 sentences. Include sensory details like lighting, sounds, or mood. Use the same roleplay format as the conversation (e.g. *action text*).

System: `,
		look_item: `{{writing_style}}

You are a narrator describing a scene. Write a vivid, detailed description of {{item_owner}}'s {{item_name}} as observed by {{user}}.

Item details: {{item_description}}

{{world}}

Conversation so far:
{{history}}

Write 2-4 sentences focusing on this specific item. Describe how it looks, fits, or moves in the current moment. Use the same roleplay format as the conversation (e.g. *action text*).

System:`,
		narrate: `{{writing_style}}

You are a narrator. Write a brief narration of what is currently happening in the scene between {{user}} and {{char}}.

Character Description:
{{description}}

{{world}}

Conversation so far:
{{history}}

Keep it to 2-3 sentences. Describe the atmosphere and any ongoing actions from a third-person perspective. Use the same roleplay format as the conversation (e.g. *action text*).

System: `,
		explore_scene: `You are a narrator describing a scene exploration.

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
	},
	world: {
		generation: `Generate the current state for {{char}}.

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
};

// Custom file path mapping for prompts that don't follow {category}_{name}.txt pattern
const CUSTOM_FILE_PATHS: Record<string, Record<string, string>> = {
	chat: {
		writing_style: 'writing_style' // File is writing_style.txt, not chat_writing_style.txt
	}
};

// Get the file key (name without .txt) for a prompt
function getPromptKey(category: string, name: string): string {
	// Check for custom file path
	const customPath = CUSTOM_FILE_PATHS[category]?.[name];
	if (customPath) {
		return customPath;
	}
	return `${category}_${name}`;
}

// Ensure prompts directory exists
async function ensurePromptsDir() {
	try {
		await fs.mkdir(PROMPTS_DIR, { recursive: true });
	} catch (error) {
		// Directory already exists
	}
}

// Read a prompt file with fallback to default
async function readPromptFile(category: string, name: string): Promise<string> {
	const key = getPromptKey(category, name);
	const filePath = path.join(PROMPTS_DIR, `${key}.txt`);
	try {
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		// File doesn't exist, create with default
		const defaultContent = DEFAULT_PROMPTS[category]?.[name] || '';
		if (defaultContent) {
			await fs.writeFile(filePath, defaultContent, 'utf-8');
		}
		return defaultContent;
	}
}

// GET - Read all prompts from files
export const GET: RequestHandler = async ({ cookies, url }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		await ensurePromptsDir();

		const category = url.searchParams.get('category');

		// If category specified, return only that category's prompts
		if (category && DEFAULT_PROMPTS[category]) {
			const prompts: Record<string, string> = {};
			for (const name of Object.keys(DEFAULT_PROMPTS[category])) {
				prompts[name] = await readPromptFile(category, name);
			}
			return json({ prompts, category });
		}

		// Return all prompts organized by category
		const allPrompts: Record<string, Record<string, string>> = {};
		for (const cat of Object.keys(DEFAULT_PROMPTS)) {
			allPrompts[cat] = {};
			for (const name of Object.keys(DEFAULT_PROMPTS[cat])) {
				allPrompts[cat][name] = await readPromptFile(cat, name);
			}
		}

		return json({ prompts: allPrompts });
	} catch (error) {
		console.error('Failed to read prompts:', error);
		return json({ error: 'Failed to read prompts' }, { status: 500 });
	}
};

// PUT - Write a prompt to file
export const PUT: RequestHandler = async ({ request, cookies }) => {
	const userId = cookies.get('userId');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	try {
		const { category, name, content } = await request.json();

		if (!category || !DEFAULT_PROMPTS[category]) {
			return json({ error: 'Invalid prompt category' }, { status: 400 });
		}

		if (!name || !DEFAULT_PROMPTS[category].hasOwnProperty(name)) {
			return json({ error: 'Invalid prompt name' }, { status: 400 });
		}

		await ensurePromptsDir();
		const key = getPromptKey(category, name);
		const filePath = path.join(PROMPTS_DIR, `${key}.txt`);
		await fs.writeFile(filePath, content || DEFAULT_PROMPTS[category][name], 'utf-8');

		return json({ success: true, file: `${key}.txt` });
	} catch (error) {
		console.error('Failed to save prompt:', error);
		return json({ error: 'Failed to save prompt' }, { status: 500 });
	}
};
