<script lang="ts">
	import type { PageData } from './$types';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ChatHeader from '$lib/components/chat/ChatHeader.svelte';
	import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import ChatCharacterImage from '$lib/components/chat/ChatCharacterImage.svelte';
	import ChatBranchPanel from '$lib/components/chat/ChatBranchPanel.svelte';
	import ChatClothesPanel from '$lib/components/chat/ChatClothesPanel.svelte';
	import ImageGenerateModal from '$lib/components/chat/ImageGenerateModal.svelte';
	import ScenarioSelector from '$lib/components/chat/ScenarioSelector.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { createChatState } from './chatState.svelte';

	let { data }: { data: PageData } = $props();

	let chatMessages: ChatMessages;
	let chatInput: ChatInput;

	const state = createChatState({
		characterId: data.characterId,
		userId: data.user?.id ?? 0,
		userDisplayName: data.user?.displayName ?? 'User',
		onScrollToBottom: () => chatMessages?.scrollToBottom(),
		onSetInput: (content: string) => chatInput?.setInput(content)
	});

	onMount(() => {
		state.setupSocket();
		state.loadSettings();

		window.addEventListener('keydown', state.handleKeydown);
		window.addEventListener('settingsUpdated', state.handleSettingsUpdate as EventListener);
		window.addEventListener('personaUpdated', state.loadSettings);

		return () => {
			window.removeEventListener('keydown', state.handleKeydown);
			window.removeEventListener('settingsUpdated', state.handleSettingsUpdate as EventListener);
			window.removeEventListener('personaUpdated', state.loadSettings);
		};
	});

	$effect(() => {
		state.handleCharacterChange(data.characterId);
	});

	onDestroy(() => {
		state.cleanup();
	});
</script>

<svelte:head>
	<title>{state.character?.name ?? 'Chat'} | DynamicTavern</title>
</svelte:head>

<MainLayout user={data.user} currentPath="/chat">
	<div class="h-full flex flex-col bg-[var(--bg-primary)]">
		{#if state.isNewChat && state.character}
			<!-- Scenario Selection for New Chat -->
			<ScenarioSelector character={state.character} onStart={state.handleScenarioStart} />
		{:else}
			<ChatHeader
				character={state.character}
				conversationId={state.conversationId}
				branchCount={state.branches.length}
				onReset={state.resetConversation}
				onBack={() => window.location.href = '/library'}
				onToggleBranches={() => state.showBranchPanel = !state.showBranchPanel}
			/>

			<!-- Main content area with World sidebar -->
			<div class="flex-1 flex min-h-0">
				<!-- Left: Chat area (header area, messages, input) -->
				<div class="flex-1 flex flex-col min-h-0">
					<!-- Chat Area with Character Image -->
					<div class="flex-1 flex min-h-0 gap-4 p-4">
						<!-- Left Side: Character Image -->
						{#if state.character}
							<ChatCharacterImage
								character={state.character}
								show={state.showCharacterImage}
								onToggle={(show) => state.showCharacterImage = show}
							/>
						{/if}

						<!-- Messages Area -->
						<ChatMessages
							bind:this={chatMessages}
							messages={state.messages}
							loading={state.loading}
							isTyping={state.isTyping}
							generating={state.regenerating}
							charName={state.character?.name}
							userName={state.userName || data.user?.displayName}
							charAvatar={state.character?.thumbnailData || state.character?.imageData}
							userAvatar={state.userAvatar}
							chatLayout={state.chatLayout}
							avatarStyle={state.avatarStyle}
							textCleanupEnabled={state.textCleanupEnabled}
							autoWrapActions={state.autoWrapActions}
							onSwipe={state.swipeMessage}
							onSaveEdit={state.saveMessageEdit}
							onDelete={state.deleteMessageAndBelow}
							onBranch={state.createBranch}
						/>

						<!-- Branch Panel -->
						{#if state.showBranchPanel}
							<ChatBranchPanel
								branches={state.branches}
								activeBranchId={state.activeBranchId}
								onSwitch={state.switchBranch}
								onDelete={state.deleteBranch}
								onClose={() => state.showBranchPanel = false}
							/>
						{/if}
					</div>

					<ChatInput
						bind:this={chatInput}
						disabled={state.sending || state.regenerating}
						hasAssistantMessages={state.hasAssistantMessages}
						impersonating={state.impersonating}
						generatingImage={state.generatingImage}
						onSend={state.sendMessage}
						onGenerate={state.generateResponse}
						onRegenerate={state.regenerateLastMessage}
						onImpersonate={state.impersonate}
						onGenerateImage={state.generateImage}
						onSceneAction={state.handleSceneAction}
					/>
				</div>

				<!-- Right: World Panel (full height) -->
				<ChatClothesPanel
					characterName={state.character?.name ?? 'Character'}
					userName={state.userName || data.user?.displayName || 'User'}
					clothes={state.clothes}
					loading={state.clothesLoading}
					onRegenerate={state.generateClothes}
					onLookAtItem={(owner, itemName, itemDescription) => state.handleSceneAction('look_item', { owner, itemName, itemDescription })}
				/>
			</div>
		{/if}
	</div>
</MainLayout>

<ImageGenerateModal
	bind:show={state.showImageModal}
	loading={state.imageModalLoading}
	generating={state.generatingSD}
	tags={state.imageModalTags}
	type={state.imageModalType}
	onGenerate={state.handleImageGenerate}
	onRegenerate={state.handleImageRegenerate}
	onCancel={state.handleImageCancel}
/>
