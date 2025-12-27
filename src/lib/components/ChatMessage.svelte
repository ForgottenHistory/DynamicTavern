<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		content: string;
		role: 'user' | 'assistant';
		charName?: string;
		userName?: string;
		textCleanupEnabled?: boolean;
		autoWrapActions?: boolean;
	}

	let { content, role, charName = 'Character', userName = 'User', textCleanupEnabled = true, autoWrapActions = false }: Props = $props();

	// Check if this is an SD image message (reactive to content changes)
	let sdImageMatch = $derived(content.match(/^\[SD_IMAGE\](.+?)\|(.+?)\[\/SD_IMAGE\]$/s));
	let isImageMessage = $derived(!!sdImageMatch);
	let imageSrc = $derived(sdImageMatch?.[1] || '');
	let imagePrompt = $derived(sdImageMatch?.[2] || '');

	// Lightbox state
	let showLightbox = $state(false);

	// Normalize asterisks per line - ensure balanced pairs
	function normalizeAsterisks(line: string): string {
		// Count asterisks (not inside quotes)
		let inQuote = false;
		let asteriskCount = 0;
		for (let i = 0; i < line.length; i++) {
			if (line[i] === '"' && (i === 0 || line[i-1] !== '\\')) {
				inQuote = !inQuote;
			} else if (line[i] === '*' && !inQuote) {
				asteriskCount++;
			}
		}

		// If odd number of asterisks, we need to fix it
		if (asteriskCount % 2 !== 0) {
			// Check if line starts or ends with asterisk
			const startsWithAsterisk = /^\*+/.test(line);
			const endsWithAsterisk = /\*+$/.test(line);

			if (endsWithAsterisk && !startsWithAsterisk) {
				// Remove trailing asterisk
				line = line.replace(/\*+$/, (match) => {
					return match.length > 1 ? '*'.repeat(match.length - 1) : '';
				});
			} else if (startsWithAsterisk && !endsWithAsterisk) {
				// Add closing asterisk
				line = line + '*';
			} else if (startsWithAsterisk && endsWithAsterisk) {
				// Both ends have asterisks but count is odd - normalize ending
				line = line.replace(/\*+$/, (match) => {
					const startMatch = line.match(/^\*+/);
					const startCount = startMatch ? startMatch[0].length : 0;
					// Match the start count
					return '*'.repeat(startCount);
				});
			}
		}

		return line;
	}

	// Auto-wrap plain text with asterisks
	// Plain text = text not inside quotes or asterisks
	function autoWrapPlainText(text: string): string {
		const lines = text.split('\n');
		return lines.map(line => {
			// Skip empty lines
			if (!line.trim()) return line;

			let result = '';
			let i = 0;
			let plainTextStart = -1;

			while (i < line.length) {
				const char = line[i];

				// Check for quote start
				if (char === '"') {
					// Flush any accumulated plain text
					if (plainTextStart !== -1) {
						const plainText = line.slice(plainTextStart, i).trim();
						if (plainText) {
							result += `*${plainText}* `;
						}
						plainTextStart = -1;
					}
					// Find matching quote
					const endQuote = line.indexOf('"', i + 1);
					if (endQuote !== -1) {
						result += line.slice(i, endQuote + 1);
						i = endQuote + 1;
					} else {
						result += line.slice(i);
						break;
					}
					continue;
				}

				// Check for asterisk start
				if (char === '*') {
					// Flush any accumulated plain text
					if (plainTextStart !== -1) {
						const plainText = line.slice(plainTextStart, i).trim();
						if (plainText) {
							result += `*${plainText}* `;
						}
						plainTextStart = -1;
					}
					// Find matching asterisk(s)
					// Check for double asterisk
					if (line[i + 1] === '*') {
						const endDouble = line.indexOf('**', i + 2);
						if (endDouble !== -1) {
							result += line.slice(i, endDouble + 2);
							i = endDouble + 2;
						} else {
							result += line.slice(i);
							break;
						}
					} else {
						const endSingle = line.indexOf('*', i + 1);
						if (endSingle !== -1) {
							result += line.slice(i, endSingle + 1);
							i = endSingle + 1;
						} else {
							result += line.slice(i);
							break;
						}
					}
					continue;
				}

				// Start tracking plain text if not already
				if (plainTextStart === -1 && char !== ' ') {
					plainTextStart = i;
				} else if (plainTextStart === -1 && char === ' ') {
					result += char;
				}

				i++;
			}

			// Flush remaining plain text
			if (plainTextStart !== -1) {
				const plainText = line.slice(plainTextStart).trim();
				if (plainText) {
					result += `*${plainText}*`;
				}
			}

			return result;
		}).join('\n');
	}

	// Build list of name parts to highlight (full name + individual words)
	function getNameParts(name: string): string[] {
		const parts: string[] = [];
		const trimmed = name.trim();
		if (trimmed) {
			parts.push(trimmed); // Full name first
			// Add individual words if multi-word name
			const words = trimmed.split(/\s+/);
			if (words.length > 1) {
				words.forEach(word => {
					if (word.length > 1) { // Skip single letters
						parts.push(word);
					}
				});
			}
		}
		return parts;
	}

	// Highlight names in text (called after markdown processing)
	function highlightNames(html: string): string {
		const charParts = getNameParts(charName);
		const userParts = getNameParts(userName);

		// Create regex patterns - match whole words only, case-insensitive
		// Process longer names first to avoid partial replacements
		const allParts: { name: string; isChar: boolean }[] = [
			...charParts.map(p => ({ name: p, isChar: true })),
			...userParts.map(p => ({ name: p, isChar: false }))
		].sort((a, b) => b.name.length - a.name.length);

		let result = html;
		for (const { name, isChar } of allParts) {
			// Word boundary regex - escape special chars in name
			const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
			const className = isChar ? 'rp-char-name' : 'rp-user-name';

			// Only replace if not already inside a tag or span
			result = result.replace(regex, (match, captured, offset) => {
				// Check if we're inside an HTML tag
				const before = result.slice(0, offset);
				const openTags = (before.match(/<[^>]*$/g) || []).length;
				if (openTags > 0) return match;

				// Check if already wrapped in our name span
				const recentHtml = result.slice(Math.max(0, offset - 50), offset);
				if (recentHtml.includes('rp-char-name') || recentHtml.includes('rp-user-name')) {
					// Could be inside a span, do simple check
					const lastOpenSpan = recentHtml.lastIndexOf('<span');
					const lastCloseSpan = recentHtml.lastIndexOf('</span>');
					if (lastOpenSpan > lastCloseSpan) return match;
				}

				return `<span class="${className}">${captured}</span>`;
			});
		}

		return result;
	}

	// Custom renderer for RP-style formatting
	function renderMessage(text: string): string {
		// Replace template variables (case-insensitive)
		let processed = text
			.replace(/\{\{char\}\}/gi, charName)
			.replace(/\{\{user\}\}/gi, userName);

		// Apply text cleanup if enabled
		if (textCleanupEnabled) {
			// Normalize curly/smart quotes to straight quotes
			processed = processed
				.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Various double quotes
				.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Various single quotes

			// Normalize asterisks per line
			processed = processed.split('\n').map(normalizeAsterisks).join('\n');

			// Auto-wrap plain text with asterisks if enabled
			if (autoWrapActions) {
				processed = autoWrapPlainText(processed);
			}
		}

		// Step 1: Handle double-asterisk dialogue (e.g., **"text"** or **text**)
		// Convert to dialogue style instead of bold
		const boldDialogues: string[] = [];

		// Helper to process asterisks in dialogue content (bold emphasis, not action style)
		const processAsterisksInDialogue = (content: string): string => {
			let result = content;
			let prev = '';
			while (prev !== result) {
				prev = result;
				result = result.replace(/\*([^*]+)\*/g, (m, c) => {
					return `<span class="rp-dialogue-emphasis">${c.trim()}</span>`;
				});
			}
			return result;
		};

		processed = processed.replace(/\*\*"([^"]+)"\*\*/g, (match, content) => {
			boldDialogues.push(processAsterisksInDialogue(content));
			return `%%BOLD_DIALOGUE_${boldDialogues.length - 1}%%`;
		});
		// Also handle **text** without quotes as dialogue (non-greedy, allows internal asterisks)
		processed = processed.replace(/\*\*(.+?)\*\*/g, (match, content) => {
			boldDialogues.push(processAsterisksInDialogue(content));
			return `%%BOLD_DIALOGUE_${boldDialogues.length - 1}%%`;
		});

		// Step 2: Protect regular quoted dialogue by replacing with placeholders
		// Process asterisks within dialogue content NOW, before markdown parsing
		const dialogues: string[] = [];
		processed = processed.replace(/"([^"]*)"/g, (match, content) => {
			dialogues.push(processAsterisksInDialogue(content));
			return `%%DIALOGUE_${dialogues.length - 1}%%`;
		});

		// Step 3: Process single asterisks for actions (outside of dialogue)
		// Use non-greedy match to handle nested cases better
		processed = processed.replace(/\*(.+?)\*/g, (match, content) => {
			// Skip if it looks like it's part of a double asterisk that wasn't caught
			if (content.startsWith('*') || content.endsWith('*')) {
				return match;
			}
			return `%%ACTION_START%%${content.trim()}%%ACTION_END%%`;
		});

		// Configure marked for safe rendering
		marked.setOptions({
			breaks: true,
			gfm: true
		});

		// Parse markdown
		let html = marked.parse(processed, { async: false }) as string;

		// Step 4: Restore bold dialogues as dialogue style (asterisks already processed)
		boldDialogues.forEach((content, i) => {
			const placeholder = new RegExp(`%%BOLD_DIALOGUE_${i}%%`, 'g');
			html = html.replace(placeholder, `<span class="rp-dialogue">"${content}"</span>`);
		});

		// Step 5: Restore regular dialogues (asterisks already processed)
		dialogues.forEach((content, i) => {
			const placeholder = new RegExp(`%%DIALOGUE_${i}%%`, 'g');
			html = html.replace(placeholder, `<span class="rp-dialogue">"${content}"</span>`);
		});

		// Step 6: Convert action placeholders to styled spans
		html = html.replace(/%%ACTION_START%%/g, '<span class="rp-action">');
		html = html.replace(/%%ACTION_END%%/g, '</span>');

		// Clean up any leftover <em> or <strong> tags from markdown
		html = html.replace(/<em>([^<]+)<\/em>/g, '<span class="rp-action">$1</span>');
		html = html.replace(/<strong>([^<]+)<\/strong>/g, '<span class="rp-dialogue">"$1"</span>');

		// Highlight character and user names
		html = highlightNames(html);

		return html;
	}

	let renderedContent = $derived(renderMessage(content));
</script>

{#if isImageMessage}
	<!-- SD Generated Image -->
	<button
		type="button"
		class="sd-image-thumbnail"
		onclick={() => showLightbox = true}
	>
		<img src={imageSrc} alt="" />
	</button>

	<!-- Lightbox -->
	{#if showLightbox}
		<div
			class="lightbox"
			onclick={() => showLightbox = false}
			onkeydown={(e) => e.key === 'Escape' && (showLightbox = false)}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<button
				type="button"
				class="lightbox-close"
				onclick={() => showLightbox = false}
				aria-label="Close image"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
			<img src={imageSrc} alt="" class="lightbox-image" />
			<p class="lightbox-prompt">{imagePrompt}</p>
		</div>
	{/if}
{:else}
	<div class="chat-message {role}">
		{@html renderedContent}
	</div>
{/if}

<style>
	.chat-message {
		line-height: 1.6;
	}

	.chat-message :global(p) {
		margin: 0 0 0.5em 0;
	}

	.chat-message :global(p:last-child) {
		margin-bottom: 0;
	}

	.chat-message :global(.rp-action) {
		color: var(--text-muted);
		font-style: italic;
	}

	.chat-message :global(.rp-dialogue) {
		color: var(--accent-hover);
	}

	.chat-message :global(.rp-dialogue-emphasis) {
		color: var(--accent-hover);
		font-weight: 600;
	}

	.chat-message :global(.rp-char-name) {
		color: var(--accent-secondary);
		font-weight: 600;
	}

	.chat-message :global(.rp-user-name) {
		color: var(--accent-user);
		font-weight: 600;
	}

	.chat-message :global(strong) {
		font-weight: 700;
	}

	.chat-message :global(em) {
		font-style: italic;
	}

	.chat-message :global(code) {
		background: rgba(255, 255, 255, 0.1);
		padding: 0.1em 0.3em;
		border-radius: 0.25em;
		font-family: monospace;
		font-size: 0.9em;
	}

	.chat-message :global(pre) {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.75em;
		border-radius: 0.5em;
		overflow-x: auto;
		margin: 0.5em 0;
	}

	.chat-message :global(pre code) {
		background: none;
		padding: 0;
	}

	.chat-message :global(ul),
	.chat-message :global(ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}

	.chat-message :global(li) {
		margin: 0.25em 0;
	}

	.chat-message :global(blockquote) {
		border-left: 3px solid var(--text-muted);
		padding-left: 0.75em;
		margin: 0.5em 0;
		color: var(--text-secondary);
	}

	.chat-message :global(img) {
		max-width: 100%;
		border-radius: 0.75rem;
		margin: 0.5em 0;
	}

	.chat-message :global(p:has(img)) {
		margin: 0;
	}

	/* SD Image Thumbnail */
	.sd-image-thumbnail {
		cursor: pointer;
		border: none;
		padding: 0;
		background: none;
		border-radius: 0.75rem;
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.sd-image-thumbnail:hover {
		transform: scale(1.02);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.sd-image-thumbnail img {
		display: block;
		width: 256px;
		height: auto;
		border-radius: 0.75rem;
	}

	/* Lightbox */
	.lightbox {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.9);
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		gap: 1rem;
	}

	.lightbox-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: white;
		padding: 0.5rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	.lightbox-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.lightbox-image {
		max-width: 90vw;
		max-height: 80vh;
		object-fit: contain;
		border-radius: 0.5rem;
	}

	.lightbox-prompt {
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.875rem;
		text-align: center;
		max-width: 80vw;
		line-height: 1.5;
		margin: 0;
	}
</style>
