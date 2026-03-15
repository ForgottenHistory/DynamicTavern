import type { Message } from '$lib/server/db/schema';
import * as api from './sandboxActions';

export interface MessageActionsContext {
	sessionId: number;
	getMessages: () => Message[];
	setMessages: (msgs: Message[]) => void;
	getGenerating: () => boolean;
	setGenerating: (v: boolean) => void;
}

function applyRegeneration(msg: Message, newContent: string, newReasoning?: string): Message {
	const updatedSwipes = msg.swipes ? JSON.parse(msg.swipes) : [msg.content];
	updatedSwipes.push(newContent);
	return {
		...msg,
		content: newContent,
		swipes: JSON.stringify(updatedSwipes),
		currentSwipe: updatedSwipes.length - 1,
		reasoning: newReasoning
			? JSON.stringify([
					...(msg.reasoning ? (() => { try { const a = JSON.parse(msg.reasoning!); return Array.isArray(a) ? a : new Array(updatedSwipes.length - 1).fill(null); } catch { return new Array(updatedSwipes.length - 1).fill(null); } })() : new Array(updatedSwipes.length - 1).fill(null)),
					newReasoning
				])
			: msg.reasoning
	};
}

export function createMessageActions(ctx: MessageActionsContext) {
	async function handleSwipe(messageId: number, direction: 'left' | 'right') {
		const messages = ctx.getMessages();
		const message = messages.find((m) => m.id === messageId);
		if (!message) return;

		const swipes: string[] = message.swipes ? JSON.parse(message.swipes) : [message.content];
		const currentIndex = message.currentSwipe ?? 0;

		if (direction === 'right' && currentIndex >= swipes.length - 1) {
			ctx.setGenerating(true);
			try {
				const result = await api.regenerateMessage(ctx.sessionId, messageId);
				ctx.setMessages(ctx.getMessages().map((m) =>
					m.id === messageId ? applyRegeneration(m, result.content, result.reasoning) : m
				));
			} catch (e) {
				console.error('Failed to regenerate:', e);
			} finally {
				ctx.setGenerating(false);
			}
			return;
		}

		const newIndex =
			direction === 'left'
				? Math.max(0, currentIndex - 1)
				: Math.min(swipes.length - 1, currentIndex + 1);

		if (newIndex === currentIndex) return;

		try {
			const ok = await api.swipeMessage(ctx.sessionId, messageId, newIndex);
			if (ok) {
				ctx.setMessages(ctx.getMessages().map((m) =>
					m.id === messageId ? { ...m, content: swipes[newIndex], currentSwipe: newIndex } : m
				));
			}
		} catch (e) {
			console.error('Failed to swipe:', e);
		}
	}

	async function handleSaveEdit(messageId: number, _index: number, content: string) {
		try {
			const result = await api.editMessage(ctx.sessionId, messageId, content);
			ctx.setMessages(ctx.getMessages().map((m) => (m.id === messageId ? result.message : m)));
		} catch (e) {
			console.error('Failed to edit message:', e);
		}
	}

	async function handleDelete(messageId: number, _index: number) {
		try {
			const ok = await api.deleteMessage(ctx.sessionId, messageId);
			if (ok) {
				ctx.setMessages(ctx.getMessages().filter((m) => m.id < messageId));
			}
		} catch (e) {
			console.error('Failed to delete message:', e);
		}
	}

	async function handleRegenerate() {
		const messages = ctx.getMessages();
		const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'narrator');
		if (!lastAssistant) return;

		ctx.setGenerating(true);
		try {
			const result = await api.regenerateMessage(ctx.sessionId, lastAssistant.id);
			ctx.setMessages(ctx.getMessages().map((m) =>
				m.id === lastAssistant.id ? applyRegeneration(m, result.content, result.reasoning) : m
			));
		} catch (e) {
			console.error('Failed to regenerate:', e);
		} finally {
			ctx.setGenerating(false);
		}
	}

	return {
		handleSwipe,
		handleSaveEdit,
		handleDelete,
		handleRegenerate
	};
}
