<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import { slide } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { createSandboxState } from './sandboxState.svelte';

	let { data }: { data: PageData } = $props();

	// Component references for bind:this - these don't need $state
	// svelte-ignore non_reactive_update
	let chatMessagesRef: ChatMessages | undefined;
	// svelte-ignore non_reactive_update
	let chatInputRef: ChatInput | undefined;

	const state = createSandboxState({
		sessionId: data.sessionId,
		userId: data.user.id,
		userDisplayName: data.user.displayName,
		onScrollToBottom: () => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					chatMessagesRef?.scrollToBottom();
				});
			});
		},
		onSetInput: (content: string) => chatInputRef?.setInput(content)
	});

	onMount(() => {
		state.init();
	});
</script>

<svelte:head>
	<title>{state.world?.name || 'Sandbox'} | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/sandbox">
	<div class="h-full flex flex-col bg-[var(--bg-primary)]">
		{#if state.loading}
			<div class="flex-1 flex items-center justify-center">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
			</div>
		{:else if state.error}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<p class="text-red-500 mb-4">{state.error}</p>
					<button
						onclick={state.loadSession}
						class="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition"
					>
						Retry
					</button>
				</div>
			</div>
		{:else}
			<!-- Header -->
			<div class="flex-shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
				<div class="flex items-center justify-between px-4 py-3">
					<div class="flex items-center gap-3">
						<a
							href="/sandbox"
							class="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition"
							title="Back to worlds"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
							</svg>
						</a>
						<div>
							<h1 class="text-lg font-semibold text-[var(--text-primary)]">{state.world?.name}</h1>
							<p class="text-sm text-[var(--text-muted)]">{state.location?.name}</p>
						</div>
					</div>
					<button
						onclick={state.endSession}
						class="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-tertiary)] rounded-lg transition"
						title="End session"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Main Content -->
			<div class="flex-1 flex min-h-0">
				<!-- Chat Area -->
				<div class="flex-1 flex flex-col min-h-0">
					<!-- Messages -->
					<ChatMessages
						bind:this={chatMessagesRef}
						messages={state.messages}
						loading={false}
						isTyping={state.sending}
						generating={state.generating}
						charName={state.primaryCharacter?.name}
						userName={state.userName || data.user.displayName}
						charAvatar={state.primaryCharacter?.thumbnailData || state.primaryCharacter?.imageData}
						userAvatar={state.userAvatar}
						chatLayout={state.chatLayout}
						avatarStyle={state.avatarStyle}
						textCleanupEnabled={state.textCleanupEnabled}
						autoWrapActions={state.autoWrapActions}
						userBubbleColor={state.userBubbleColor}
						sceneCharacters={state.sceneCharacters}
						onSwipe={state.handleSwipe}
						onSaveEdit={state.handleSaveEdit}
						onDelete={state.handleDelete}
					/>

					<ChatInput
						bind:this={chatInputRef}
						disabled={state.sending || state.generating}
						hasAssistantMessages={state.hasAssistantMessages}
						impersonating={state.impersonating}
						sceneCharacters={state.sceneCharacters}
						onSend={state.sendMessage}
						onGenerate={state.hasCharacters ? state.generate : undefined}
						onRegenerate={state.handleRegenerate}
						onImpersonate={state.hasCharacters ? state.handleImpersonate : undefined}
						onSceneAction={state.handleSceneAction}
					/>
				</div>

				<!-- Right Sidebar - Location & Navigation -->
				<div class="w-80 flex-shrink-0 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-y-auto">
					<!-- Location Info -->
					<div class="p-4 border-b border-[var(--border-primary)]">
						<h2 class="text-lg font-semibold text-[var(--text-primary)] mb-2">{state.location?.name}</h2>
						<p class="text-sm text-[var(--text-muted)]">{state.location?.description}</p>
					</div>

					<!-- Characters Present -->
					<div class="p-4 border-b border-[var(--border-primary)]">
						<div class="flex items-center justify-between mb-3">
							<h3 class="text-sm font-medium text-[var(--text-secondary)]">Present</h3>
							<div class="relative">
								<button
									onclick={state.openCharacterPicker}
									disabled={state.characterPickerLoading}
									class="p-1 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition disabled:opacity-50"
									title="Add character"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
									</svg>
								</button>

								{#if state.showCharacterPicker}
									<!-- Backdrop to close picker -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="fixed inset-0 z-40"
										onclick={state.closeCharacterPicker}
										onkeydown={(e) => { if (e.key === 'Escape') state.closeCharacterPicker(); }}
									></div>

									<!-- Character picker dropdown -->
									<div class="absolute right-0 top-full mt-1 w-64 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-50 overflow-hidden">
										{#if state.characterPickerLoading && state.availableCharacters.length === 0}
											<div class="flex items-center justify-center py-4">
												<div class="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent-primary)] border-t-transparent"></div>
											</div>
										{:else if state.availableCharacters.length === 0}
											<div class="p-3 text-center text-sm text-[var(--text-muted)]">No characters available</div>
										{:else}
											<div class="max-h-64 overflow-y-auto">
												{#each state.availableCharacters as char}
													<button
														onclick={() => state.addCharacter(char.id)}
														disabled={state.characterPickerLoading}
														class="w-full flex items-center gap-3 p-3 hover:bg-[var(--bg-secondary)] transition text-left disabled:opacity-50"
													>
														{#if char.thumbnailData || char.imageData}
															<img
																src={char.thumbnailData || char.imageData}
																alt={char.name}
																class="w-8 h-8 rounded-lg object-cover flex-shrink-0"
															/>
														{:else}
															<div class="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
																<span class="text-sm font-bold text-[var(--accent-primary)]">
																	{char.name.charAt(0)}
																</span>
															</div>
														{/if}
														<span class="text-sm text-[var(--text-primary)] truncate">{char.name}</span>
													</button>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>

						{#if state.hasCharacters}
							<div class="space-y-2">
								{#each state.characters as char}
									<div class="group flex items-center gap-3">
										{#if char.thumbnailData || char.imageData}
											<img
												src={char.thumbnailData || char.imageData}
												alt={char.name}
												class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
											/>
										{:else}
											<div class="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center flex-shrink-0">
												<span class="text-sm font-bold text-[var(--accent-primary)]">
													{char.name.charAt(0)}
												</span>
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<p class="font-medium text-sm text-[var(--text-primary)] truncate">{char.name}</p>
											{#if char.description}
												<p class="text-xs text-[var(--text-muted)] line-clamp-1">{char.description}</p>
											{/if}
										</div>
										<div class="flex items-center gap-1">
											<button
												onclick={() => state.generate(char.id)}
												disabled={state.generating}
												class="p-1 text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] rounded transition disabled:opacity-50"
												title="Prompt {char.name}"
											>
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
												</svg>
											</button>
											<button
												onclick={() => state.removeCharacter(char.id)}
												class="p-1 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-tertiary)] rounded transition"
												title="Remove {char.name}"
											>
												<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-[var(--text-muted)] italic">No one here</p>
						{/if}
					</div>

					<!-- World State -->
					{#if state.worldSidebarEnabled}
						<div class="border-b border-[var(--border-primary)]">
							<div class="flex items-center justify-between p-4">
								<button
									onclick={() => state.worldExpanded = !state.worldExpanded}
									class="flex-1 flex items-center gap-2 text-left"
								>
									<h3 class="text-sm font-medium text-[var(--text-secondary)]">World State</h3>
									<svg class="w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 {state.worldExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
									</svg>
								</button>
								<div class="flex items-center gap-1">
								<button
									onclick={state.clearWorldState}
									disabled={state.worldStateLoading || !state.worldState}
									class="p-1 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 rounded transition disabled:opacity-50"
									title="Clear world state"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
									</svg>
								</button>
								<button
									onclick={state.generateWorldState}
									disabled={state.worldStateLoading}
									class="p-1 hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition disabled:opacity-50"
									title="Regenerate world state"
								>
									<svg class="w-3.5 h-3.5 {state.worldStateLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
									</svg>
								</button>
							</div>
							</div>

							{#if state.worldExpanded}
								<div class="{state.worldStateLoading ? 'opacity-60' : ''}" transition:slide={{ duration: 200 }}>
									{#if state.worldState && Object.keys(state.worldState).length > 0}
										{#each Object.entries(state.worldState) as [entityKey, entity]}
											{#if entity.attributes.some(a => (a.type === 'text' && typeof a.value === 'string' && a.value.trim()) || (a.type === 'list' && Array.isArray(a.value) && a.value.length > 0))}
												<!-- Entity Header -->
												<button
													onclick={() => state.toggleWorldSection(entityKey)}
													class="w-full flex items-center justify-between px-4 py-2 hover:bg-[var(--bg-tertiary)] transition"
												>
													<span class="text-sm font-medium text-[var(--accent-secondary)]">{state.getEntityLabel(entityKey)}</span>
													<svg class="w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 {state.expandedWorldSections.has(entityKey) ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
													</svg>
												</button>

												{#if state.expandedWorldSections.has(entityKey)}
													<div class="pb-2" transition:slide={{ duration: 150 }}>
														{#each entity.attributes as attr}
															{@const icon = state.getAttributeIcon(attr.name)}
															{@const itemKey = `${entityKey}-${attr.name}`}

															{#if attr.type === 'text' && typeof attr.value === 'string' && attr.value.trim()}
																{#if state.editingWorldKey === itemKey}
																	<!-- Editing text attribute -->
																	<div class="px-4 py-1.5">
																		<span class="text-xs text-[var(--text-muted)] uppercase tracking-wide">{attr.name.charAt(0).toUpperCase() + attr.name.slice(1)}</span>
																		<input
																			type="text"
																			bind:value={state.editingWorldValue}
																			onkeydown={(e) => { if (e.key === 'Enter') state.saveTextEdit(entityKey, attr.name); if (e.key === 'Escape') state.cancelEdit(); }}
																			class="w-full mt-1 px-2 py-1 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-[var(--accent-primary)]"
																		/>
																		<div class="flex gap-1 mt-1">
																			<button onclick={() => state.saveTextEdit(entityKey, attr.name)} class="px-2 py-0.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition">Save</button>
																			<button onclick={state.cancelEdit} class="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded hover:text-[var(--text-primary)] transition">Cancel</button>
																		</div>
																	</div>
																{:else}
																	<!-- Display text attribute -->
																	<div class="group px-4 py-1.5 flex items-start gap-2">
																		{#if icon}
																			<svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style="color: {icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon.path}/>
																			</svg>
																		{/if}
																		<div class="flex-1">
																			<span class="text-xs text-[var(--text-muted)] uppercase tracking-wide">{attr.name.charAt(0).toUpperCase() + attr.name.slice(1)}</span>
																			<p class="text-sm text-[var(--text-secondary)]">{attr.value}</p>
																		</div>
																		<button
																			onclick={() => state.startEditText(entityKey, attr.name, String(attr.value))}
																			class="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
																			title="Edit {attr.name}"
																		>
																			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
																			</svg>
																		</button>
																	</div>
																{/if}

															{:else if attr.type === 'list' && Array.isArray(attr.value) && attr.value.length > 0}
																<div class="px-4 py-1.5">
																	<span class="text-xs text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
																		{#if icon}
																			<svg class="w-3 h-3" style="color: {icon.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon.path}/>
																			</svg>
																		{/if}
																		{attr.name.charAt(0).toUpperCase() + attr.name.slice(1)}
																	</span>
																</div>
																{#each attr.value as item, itemIdx}
																	{@const listItemKey = `${itemKey}-${itemIdx}`}
																	{#if state.editingListItem?.entityKey === entityKey && state.editingListItem?.attrName === attr.name && state.editingListItem?.itemIdx === itemIdx}
																		<!-- Editing list item -->
																		<div class="px-4 py-1.5">
																			<input
																				type="text"
																				bind:value={state.editingItemName}
																				onkeydown={(e) => { if (e.key === 'Enter') state.saveListItemEdit(); if (e.key === 'Escape') state.cancelEdit(); }}
																				placeholder="Name"
																				class="w-full px-2 py-1 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-[var(--accent-primary)]"
																			/>
																			<input
																				type="text"
																				bind:value={state.editingItemDescription}
																				onkeydown={(e) => { if (e.key === 'Enter') state.saveListItemEdit(); if (e.key === 'Escape') state.cancelEdit(); }}
																				placeholder="Description"
																				class="w-full mt-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded focus:outline-none focus:border-[var(--accent-primary)]"
																			/>
																			<div class="flex gap-1 mt-1">
																				<button onclick={state.saveListItemEdit} class="px-2 py-0.5 text-xs bg-[var(--accent-primary)] text-white rounded hover:opacity-90 transition">Save</button>
																				<button onclick={state.cancelEdit} class="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded hover:text-[var(--text-primary)] transition">Cancel</button>
																			</div>
																		</div>
																	{:else}
																		<!-- Display list item -->
																		<div class="group flex items-center px-4 py-1 hover:bg-[var(--bg-tertiary)] transition">
																			<button
																				onclick={() => state.toggleWorldItem(listItemKey)}
																				class="flex-1 text-left flex items-center gap-1.5"
																			>
																				<svg class="w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 {state.expandedWorldItems.has(listItemKey) ? 'rotate-90' : ''}" fill="currentColor" viewBox="0 0 20 20">
																					<path d="M6 6L14 10L6 14V6Z"/>
																				</svg>
																				<span class="text-sm text-[var(--text-secondary)]">{item.name}</span>
																			</button>
																			<div class="flex items-center gap-0.5">
																				<button
																					onclick={() => state.startEditListItem(entityKey, attr.name, itemIdx, item)}
																					class="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
																					title="Edit {item.name}"
																				>
																					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
																					</svg>
																				</button>
																				<button
																					onclick={() => state.deleteListItem(entityKey, attr.name, itemIdx)}
																					class="p-1 opacity-0 group-hover:opacity-100 hover:bg-[var(--border-primary)] text-[var(--text-muted)] hover:text-red-400 rounded transition"
																					title="Remove {item.name}"
																				>
																					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
																					</svg>
																				</button>
																				<button
																					onclick={() => state.handleSceneAction('look_item', { owner: state.getEntityLabel(entityKey), itemName: item.name, itemDescription: item.description })}
																					class="p-1 hover:bg-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded transition"
																					title="Look at {item.name}"
																				>
																					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
																						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
																					</svg>
																				</button>
																			</div>
																		</div>
																		{#if state.expandedWorldItems.has(listItemKey)}
																			<div class="px-4 pb-1 pl-9" transition:slide={{ duration: 150 }}>
																				<p class="text-xs text-[var(--text-muted)]">{item.description}</p>
																			</div>
																		{/if}
																	{/if}
																{/each}
															{/if}
														{/each}
													</div>
												{/if}
											{/if}
										{/each}
									{:else if state.worldStateLoading}
										<div class="flex items-center justify-center py-4">
											<div class="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent-primary)] border-t-transparent"></div>
											<span class="ml-2 text-sm text-[var(--text-muted)]">Generating...</span>
										</div>
									{:else}
										<div class="text-center py-4">
											<p class="text-xs text-[var(--text-muted)]">No data</p>
											<button
												onclick={state.generateWorldState}
												class="mt-1 text-xs text-[var(--accent-primary)] hover:underline"
											>
												Generate world state
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Connections -->
					<div class="p-4">
						<h3 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Go to</h3>
						<div class="space-y-2">
							{#each state.connections as connection}
								<button
									onclick={() => state.move(connection.id)}
									disabled={state.moving}
									class="w-full flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--accent-primary)]/10 transition text-left disabled:opacity-50"
								>
									<svg class="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
									</svg>
									<div class="flex-1 min-w-0">
										<p class="font-medium text-[var(--text-primary)] truncate">{connection.location.name}</p>
									</div>
								</button>
							{/each}
						</div>
					</div>

					{#if state.moving}
						<div class="p-4 text-center">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
							<p class="text-sm text-[var(--text-muted)] mt-2">Moving...</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</MainLayout>
