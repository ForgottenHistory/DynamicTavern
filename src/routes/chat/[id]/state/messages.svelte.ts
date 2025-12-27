import type { Message } from '$lib/server/db/schema';
import * as api from '../chatActions';

export interface MessageState {
	messages: Message[];
	sending: boolean;
	regenerating: boolean;
	impersonating: boolean;
}

export interface MessageActions {
	sendMessage: (userMessage: string) => Promise<void>;
	generateResponse: () => Promise<void>;
	impersonate: (style?: api.ImpersonateStyle) => Promise<void>;
	handleSceneAction: (actionType: api.SceneActionType, context?: { characterId?: number; characterName?: string } | api.ItemContext) => Promise<void>;
	swipeMessage: (messageId: number, direction: 'left' | 'right') => Promise<void>;
	regenerateLastMessage: () => Promise<void>;
	deleteMessageAndBelow: (messageId: number, messageIndex: number) => Promise<void>;
	saveMessageEdit: (messageId: number, messageIndex: number, content: string) => Promise<void>;
}

export function createMessageActions(
	getState: () => MessageState,
	setState: (updates: Partial<MessageState>) => void,
	options: {
		characterId: number;
		conversationId: () => number | null;
		onSetInput: (content: string) => void;
		loadConversation: () => Promise<void>;
	}
): MessageActions {

	async function sendMessage(userMessage: string) {
		if (getState().sending) return;
		setState({ sending: true });

		try {
			const success = await api.sendMessage(options.characterId, userMessage);
			if (!success) {
				alert('Failed to send message');
			}
		} finally {
			setState({ sending: false });
		}
	}

	async function generateResponse() {
		if (getState().sending) return;
		setState({ sending: true });

		try {
			const success = await api.generateResponse(options.characterId);
			if (!success) {
				alert('Failed to generate response');
			}
		} finally {
			setState({ sending: false });
		}
	}

	async function impersonate(style: api.ImpersonateStyle = 'impersonate') {
		const state = getState();
		if (state.sending || state.impersonating) return;
		setState({ impersonating: true });

		try {
			const content = await api.impersonate(options.characterId, style);
			if (content) {
				options.onSetInput(content);
			} else {
				alert('Failed to impersonate');
			}
		} finally {
			setState({ impersonating: false });
		}
	}

	async function handleSceneAction(
		actionType: api.SceneActionType,
		context?: { characterId?: number; characterName?: string } | api.ItemContext
	) {
		const convId = options.conversationId();
		if (getState().sending || !convId) return;
		setState({ sending: true });

		try {
			// Determine if this is item context or character context
			let itemContext: api.ItemContext | undefined;
			let characterContext: api.CharacterContext | undefined;

			if (context && 'itemName' in context) {
				itemContext = context as api.ItemContext;
			} else if (context && 'characterId' in context && context.characterId && context.characterName) {
				characterContext = { characterId: context.characterId, characterName: context.characterName };
			}

			const success = await api.triggerSceneAction(options.characterId, actionType, itemContext, characterContext, convId);
			if (!success) {
				alert('Failed to execute action');
			}
		} finally {
			setState({ sending: false });
		}
	}

	async function swipeMessage(messageId: number, direction: 'left' | 'right') {
		const { messages } = getState();
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		const message = messages[messageIndex];
		const swipes = api.getSwipes(message);
		const currentIndex = api.getCurrentSwipeIndex(message);
		const isFirstMessage = messageIndex === 0;

		if (direction === 'right') {
			const nextIndex = currentIndex + 1;

			if (nextIndex < swipes.length) {
				await updateSwipeIndex(messageId, messageIndex, message, swipes, nextIndex);
			} else if (!isFirstMessage) {
				await regenerateMessage(messageId);
			} else {
				await updateSwipeIndex(messageId, messageIndex, message, swipes, 0);
			}
		} else {
			let newIndex = currentIndex - 1;
			if (newIndex < 0) {
				newIndex = swipes.length - 1;
			}
			await updateSwipeIndex(messageId, messageIndex, message, swipes, newIndex);
		}
	}

	async function updateSwipeIndex(messageId: number, messageIndex: number, message: Message, swipes: string[], newIndex: number) {
		const success = await api.updateSwipeIndex(messageId, newIndex);
		if (success) {
			const { messages } = getState();
			const updatedMessage = {
				...message,
				content: swipes[newIndex],
				currentSwipe: newIndex
			};
			const newMessages = [...messages];
			newMessages[messageIndex] = updatedMessage;
			setState({ messages: newMessages });
		}
	}

	async function regenerateMessage(messageId: number) {
		const { messages } = getState();
		const messageIndex = messages.findIndex(m => m.id === messageId);
		if (messageIndex === -1) return;

		setState({ regenerating: true });

		try {
			const result = await api.regenerateMessage(messageId);
			if (result) {
				const currentMessages = getState().messages;
				const message = currentMessages[messageIndex];
				const swipes = api.getSwipes(message);
				swipes.push(result.content);

				const newMessages = [...currentMessages];
				newMessages[messageIndex] = {
					...message,
					content: result.content,
					swipes: JSON.stringify(swipes),
					currentSwipe: swipes.length - 1
				};
				setState({ messages: newMessages });
			} else {
				alert('Failed to regenerate message');
			}
		} finally {
			setState({ regenerating: false });
		}
	}

	async function regenerateLastMessage() {
		const { messages } = getState();
		const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
		if (!lastAssistantMessage) return;

		const messageIndex = messages.findIndex(m => m.id === lastAssistantMessage.id);
		if (messageIndex !== -1) {
			setState({ messages: messages.slice(0, messageIndex) });
		}

		const success = await api.regenerateFresh(lastAssistantMessage.id);
		if (!success) {
			await options.loadConversation();
			alert('Failed to regenerate message');
		}
	}

	async function deleteMessageAndBelow(messageId: number, messageIndex: number) {
		const { messages } = getState();
		const messagesBelow = messages.length - messageIndex;
		const confirmed = confirm(`Delete this message and ${messagesBelow > 1 ? `${messagesBelow - 1} message(s) below it` : 'no messages below'}?`);
		if (!confirmed) return;

		const success = await api.deleteMessageAndBelow(messageId);
		if (success) {
			setState({ messages: messages.slice(0, messageIndex) });
		} else {
			alert('Failed to delete messages');
		}
	}

	async function saveMessageEdit(messageId: number, messageIndex: number, content: string) {
		const result = await api.saveMessageEdit(messageId, content);
		if (result) {
			const { messages } = getState();
			const newMessages = [...messages];
			newMessages[messageIndex] = result;
			setState({ messages: newMessages });
		} else {
			alert('Failed to save edit');
		}
	}

	return {
		sendMessage,
		generateResponse,
		impersonate,
		handleSceneAction,
		swipeMessage,
		regenerateLastMessage,
		deleteMessageAndBelow,
		saveMessageEdit
	};
}
