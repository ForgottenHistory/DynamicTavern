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

Stay in character as {{user}}. Write a natural response that fits the conversation flow.`
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

Rewritten greeting:`
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
	}
};

// Flatten prompts for file paths (e.g., "chat_system", "decision_analyze")
function getPromptKey(category: string, name: string): string {
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
