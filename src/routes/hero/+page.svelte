<svelte:head>
	<title>AI Chat Template</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			-webkit-font-smoothing: antialiased;
			-moz-osx-font-smoothing: grayscale;
		}
		.gradient-text {
			background: linear-gradient(90deg, #6366f1, #8b5cf6);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			color: transparent;
		}
	</style>
</svelte:head>

<div style="width: 1280px; height: 640px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);">
	<div style="text-align: center; padding: 0 64px; max-width: 100%;">
		<!-- Main Title -->
		<h1 style="font-size: 96px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 16px;">
			<span class="gradient-text">AI Chat</span>
			<span style="color: white;">Template</span>
		</h1>

		<!-- Tagline -->
		<p style="font-size: 24px; color: #cbd5e1; margin-bottom: 48px;">
			Open-source character chat application with multi-LLM support and image generation
		</p>

		<!-- Features -->
		<div style="display: flex; align-items: center; justify-content: center; gap: 24px; font-size: 18px; font-weight: 600; color: #cbd5e1; flex-wrap: wrap;">
			<div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
				<svg style="width: 24px; height: 24px; color: #a855f7;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
				</svg>
				<span>Character Cards</span>
			</div>
			<span style="color: #475569;">•</span>
			<div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
				<svg style="width: 24px; height: 24px; color: #3b82f6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
				<span>Multi-LLM</span>
			</div>
			<span style="color: #475569;">•</span>
			<div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
				<svg style="width: 24px; height: 24px; color: #22c55e;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
				<span>Lorebooks</span>
			</div>
			<span style="color: #475569;">•</span>
			<div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
				<svg style="width: 24px; height: 24px; color: #f97316;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<span>Stable Diffusion</span>
			</div>
		</div>
	</div>
</div>
