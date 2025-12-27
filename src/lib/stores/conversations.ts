// Module-level state that persists across navigation (client-side only)

interface ConversationInfo {
	id: number;
	characterId: number | null;
	primaryCharacterId: number | null;
	name: string | null;
	createdAt: Date;
	character: {
		id: number;
		name: string;
		thumbnailData: string | null;
		imageData: string | null;
	} | null;
	lastMessage: {
		content: string;
		role: string;
		createdAt: Date;
	} | null;
	messageCount: number;
}

let conversationsCache: ConversationInfo[] = [];
let loaded = false;

export function getConversationsCache(): ConversationInfo[] {
	return conversationsCache;
}

export function setConversationsCache(conversations: ConversationInfo[]): void {
	conversationsCache = conversations;
	loaded = true;
}

export function isConversationsCacheLoaded(): boolean {
	return loaded;
}

export function invalidateConversationsCache(): void {
	loaded = false;
}
