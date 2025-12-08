<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		content: string;
		role: 'user' | 'assistant';
		charName?: string;
		userName?: string;
	}

	let { content, role, charName = 'Character', userName = 'User' }: Props = $props();

	// Check if this is an SD image message (reactive to content changes)
	let sdImageMatch = $derived(content.match(/^\[SD_IMAGE\](.+?)\|(.+?)\[\/SD_IMAGE\]$/s));
	let isImageMessage = $derived(!!sdImageMatch);
	let imageSrc = $derived(sdImageMatch?.[1] || '');
	let imagePrompt = $derived(sdImageMatch?.[2] || '');

	// Lightbox state
	let showLightbox = $state(false);

	// Custom renderer for RP-style formatting
	function renderMessage(text: string): string {
		// Replace template variables (case-insensitive)
		let processed = text
			.replace(/\{\{char\}\}/gi, charName)
			.replace(/\{\{user\}\}/gi, userName);

		// Normalize curly/smart quotes to straight quotes
		processed = processed
			.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // Various double quotes
			.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'"); // Various single quotes

		// Step 1: Protect quoted dialogue by replacing with placeholders
		// Match opening quote, then everything until closing quote (including newlines, asterisks, etc.)
		const dialogues: string[] = [];
		processed = processed.replace(/"([^"]*)"/g, (match, content) => {
			dialogues.push(content);
			return `%%DIALOGUE_${dialogues.length - 1}%%`;
		});

		// Step 2: Normalize and process asterisks for actions (outside of dialogue)
		processed = processed.replace(/\*(\s*)([^*]+?)(\s*)\*/g, (match, leadingSpace, content, trailingSpace) => {
			return `%%ACTION_START%%${content.trim()}%%ACTION_END%%`;
		});

		// Configure marked for safe rendering
		marked.setOptions({
			breaks: true,
			gfm: true
		});

		// Parse markdown
		let html = marked.parse(processed, { async: false }) as string;

		// Step 3: Restore dialogues - process any asterisks inside them too
		dialogues.forEach((content, i) => {
			// Process asterisks within dialogue
			let processedContent = content.replace(/\*(\s*)([^*]+?)(\s*)\*/g, (m, ls, c, ts) => {
				return `<span class="rp-action">${c.trim()}</span>`;
			});
			// Use regex to ensure we find the placeholder even if marked modified surrounding text
			const placeholder = new RegExp(`%%DIALOGUE_${i}%%`, 'g');
			html = html.replace(placeholder, `<span class="rp-dialogue">"${processedContent}"</span>`);
		});

		// Step 4: Convert action placeholders to styled spans
		html = html.replace(/%%ACTION_START%%/g, '<span class="rp-action">');
		html = html.replace(/%%ACTION_END%%/g, '</span>');

		// Clean up any leftover <em> tags from markdown that weren't caught
		html = html.replace(/<em>([^<]+)<\/em>/g, '<span class="rp-action">$1</span>');

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
		<img src={imageSrc} alt="Generated image" />
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
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
			<img src={imageSrc} alt="Generated image full size" class="lightbox-image" />
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
