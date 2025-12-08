<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';

	let { data }: { data: PageData } = $props();

	let settings = $state({
		mainPrompt: 'masterpiece, best quality, amazing quality, 1girl, solo',
		negativePrompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, speech bubble, multiple views',
		model: '',
		steps: 30,
		cfgScale: 7.0,
		sampler: 'DPM++ 2M',
		scheduler: 'Karras',
		enableHr: true,
		hrScale: 1.5,
		hrUpscaler: 'Latent',
		hrSteps: 15,
		hrCfg: 5.0,
		denoisingStrength: 0.7,
		enableAdetailer: false,
		adetailerModel: 'face_yolov8n.pt'
	});

	let loading = $state(true);
	let saving = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let sdStatus = $state<{ available: boolean; message: string } | null>(null);
	let containerRef: HTMLDivElement | null = null;

	onMount(() => {
		loadSettings();
		checkSdStatus();
	});

	async function loadSettings() {
		loading = true;
		try {
			const response = await fetch('/api/sd/settings');
			const data = await response.json();
			if (data.settings) {
				settings = data.settings;
			}
		} catch (error) {
			console.error('Failed to load settings:', error);
		} finally {
			loading = false;
		}
	}

	async function checkSdStatus() {
		try {
			const response = await fetch('/api/image/sd-status');
			sdStatus = await response.json();
		} catch (error) {
			sdStatus = { available: false, message: 'Failed to check SD status' };
		}
	}

	async function saveSettings() {
		saving = true;
		message = null;
		try {
			const response = await fetch('/api/sd/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});

			const data = await response.json();

			if (response.ok) {
				message = { type: 'success', text: 'Settings saved successfully!' };
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

	function resetToDefaults() {
		settings = {
			mainPrompt: 'masterpiece, best quality, amazing quality, 1girl, solo',
			negativePrompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, speech bubble, multiple views',
			model: '',
			steps: 30,
			cfgScale: 7.0,
			sampler: 'DPM++ 2M',
			scheduler: 'Karras',
			enableHr: true,
			hrScale: 1.5,
			hrUpscaler: 'Latent',
			hrSteps: 15,
			hrCfg: 5.0,
			denoisingStrength: 0.7,
			enableAdetailer: false,
			adetailerModel: 'face_yolov8n.pt'
		};
		message = { type: 'success', text: 'Reset to defaults (not saved yet)' };
		setTimeout(() => (message = null), 3000);
	}

	function scrollToTop() {
		if (containerRef) {
			containerRef.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

</script>

<svelte:head>
	<title>Image Generation Settings | AI Chat</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/image-settings">
	<div bind:this={containerRef} class="h-full overflow-y-auto bg-[var(--bg-primary)]">
		<div class="max-w-5xl mx-auto px-8 py-8">
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-[var(--text-primary)] mb-2">Image Generation Settings</h1>
				<p class="text-[var(--text-secondary)]">
					Configure Stable Diffusion parameters for image generation
				</p>
			</div>

			<!-- SD Status -->
			{#if sdStatus}
				<div class="mb-6 p-4 rounded-xl border {sdStatus.available
					? 'bg-[var(--success)]/10 border-[var(--success)]/30'
					: 'bg-[var(--error)]/10 border-[var(--error)]/30'}">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full {sdStatus.available ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}"></div>
						<span class="{sdStatus.available ? 'text-[var(--success)]' : 'text-[var(--error)]'}">
							{sdStatus.message}
						</span>
					</div>
				</div>
			{/if}

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

			<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md border border-[var(--border-primary)] overflow-hidden">
				{#if loading}
					<div class="p-6">
						<div class="flex justify-center py-12">
							<div class="w-12 h-12 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
						</div>
					</div>
				{:else}
					<form
						class="p-6 space-y-6"
						onsubmit={(e) => {
							e.preventDefault();
							saveSettings();
						}}
					>
						<!-- Main Prompt -->
						<div>
							<label class="block text-sm font-semibold text-[var(--text-primary)] mb-2">
								Main Prompt
							</label>
							<textarea
								bind:value={settings.mainPrompt}
								rows={3}
								class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
								placeholder="Tags added to the beginning of every image generation"
							></textarea>
							<p class="text-xs text-[var(--text-muted)] mt-1">
								These tags are added to the start of every image prompt
							</p>
						</div>

						<!-- Negative Prompt -->
						<div>
							<label class="block text-sm font-semibold text-[var(--text-primary)] mb-2">
								Negative Prompt
							</label>
							<textarea
								bind:value={settings.negativePrompt}
								rows={4}
								class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
								placeholder="Tags to avoid in image generation"
							></textarea>
							<p class="text-xs text-[var(--text-muted)] mt-1">
								These tags tell Stable Diffusion what to avoid
							</p>
						</div>

						<!-- Model -->
						<div>
							<label class="block text-sm font-semibold text-[var(--text-primary)] mb-2">
								Stable Diffusion Model
							</label>
							<input
								type="text"
								bind:value={settings.model}
								class="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
								placeholder="Leave empty to use default model"
							/>
							<p class="text-xs text-[var(--text-muted)] mt-1">
								The checkpoint/model name to use. Leave empty for currently loaded model.
							</p>
						</div>

						<!-- Base Generation Section -->
						<div class="space-y-4 pt-4 border-t border-[var(--border-primary)]">
							<h3 class="text-lg font-semibold text-[var(--text-primary)]">Base Generation</h3>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
										Sampling Steps
									</label>
									<input
										type="number"
										bind:value={settings.steps}
										min={1}
										max={150}
										class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
									/>
								</div>

								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
										CFG Scale
									</label>
									<input
										type="number"
										bind:value={settings.cfgScale}
										min={1}
										max={30}
										step={0.5}
										class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
										Sampler
									</label>
									<input
										type="text"
										bind:value={settings.sampler}
										placeholder="e.g., DPM++ 2M, Euler a"
										class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
									/>
								</div>

								<div>
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
										Scheduler
									</label>
									<input
										type="text"
										bind:value={settings.scheduler}
										placeholder="e.g., Karras, Exponential"
										class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
									/>
								</div>
							</div>
						</div>

						<!-- Highres Fix Section -->
						<div class="space-y-4 pt-4 border-t border-[var(--border-primary)]">
							<div class="flex items-center justify-between">
								<h3 class="text-lg font-semibold text-[var(--text-primary)]">Highres Fix</h3>
								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										bind:checked={settings.enableHr}
										class="sr-only peer"
									/>
									<div class="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-primary)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
								</label>
							</div>

							{#if settings.enableHr}
								<div class="space-y-4 pl-4 border-l-2 border-[var(--accent-primary)]/50">
									<div class="grid grid-cols-2 gap-4">
										<div>
											<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
												Upscale Factor
											</label>
											<input
												type="number"
												bind:value={settings.hrScale}
												min={1.0}
												max={2.0}
												step={0.1}
												class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
												Upscaler
											</label>
											<input
												type="text"
												bind:value={settings.hrUpscaler}
												placeholder="e.g., Latent, ESRGAN_4x"
												class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
											/>
										</div>
									</div>

									<div class="grid grid-cols-3 gap-4">
										<div>
											<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
												Highres Steps
											</label>
											<input
												type="number"
												bind:value={settings.hrSteps}
												min={0}
												max={150}
												class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
												Highres CFG
											</label>
											<input
												type="number"
												bind:value={settings.hrCfg}
												min={1}
												max={30}
												step={0.5}
												class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
											/>
										</div>

										<div>
											<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
												Denoising Strength
											</label>
											<input
												type="number"
												bind:value={settings.denoisingStrength}
												min={0}
												max={1}
												step={0.05}
												class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
											/>
										</div>
									</div>
								</div>
							{/if}
						</div>

						<!-- ADetailer Section -->
						<div class="space-y-4 pt-4 border-t border-[var(--border-primary)]">
							<div class="flex items-center justify-between">
								<h3 class="text-lg font-semibold text-[var(--text-primary)]">ADetailer</h3>
								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										bind:checked={settings.enableAdetailer}
										class="sr-only peer"
									/>
									<div class="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[var(--accent-primary)]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--border-primary)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
								</label>
							</div>

							{#if settings.enableAdetailer}
								<div class="pl-4 border-l-2 border-[var(--accent-primary)]/50">
									<label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
										Detection Model
									</label>
									<input
										type="text"
										bind:value={settings.adetailerModel}
										placeholder="e.g., face_yolov8n.pt"
										class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
									/>
								</div>
							{/if}
						</div>

						<!-- Action Buttons -->
						<div class="flex items-center gap-3 pt-4 border-t border-[var(--border-primary)]">
							<button
								type="submit"
								disabled={saving}
								class="flex-1 px-8 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
							>
								{#if saving}
									<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									Saving...
								{:else}
									Save Settings
								{/if}
							</button>
							<button
								type="button"
								onclick={resetToDefaults}
								disabled={saving}
								class="px-8 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl transition font-semibold shadow-lg hover:shadow-xl border border-[var(--border-primary)]"
							>
								Reset to Defaults
							</button>
							<button
								type="button"
								onclick={loadSettings}
								disabled={saving}
								class="px-8 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] rounded-xl transition font-semibold shadow-lg hover:shadow-xl border border-[var(--border-primary)]"
							>
								Reload
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	</div>
</MainLayout>
