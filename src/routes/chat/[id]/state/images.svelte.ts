import * as api from '../chatActions';

export interface ImageState {
	generatingImage: boolean;
	generatingSD: boolean;
	showImageModal: boolean;
	imageModalLoading: boolean;
	imageModalTags: string;
	imageModalType: 'character' | 'user' | 'scene' | 'raw';
}

export interface ImageActions {
	generateImage: (type: 'character' | 'user' | 'scene' | 'raw') => Promise<void>;
	handleImageGenerate: (tags: string) => Promise<void>;
	handleImageCancel: () => void;
	handleImageRegenerate: () => Promise<void>;
}

export function createImageActions(
	getState: () => ImageState,
	setState: (updates: Partial<ImageState>) => void,
	options: {
		characterId: number;
		conversationId: () => number | null;
		onScrollToBottom: () => void;
	}
): ImageActions {

	async function generateImage(type: 'character' | 'user' | 'scene' | 'raw') {
		if (getState().generatingImage || !options.conversationId()) return;

		setState({
			imageModalType: type,
			imageModalTags: '',
			showImageModal: true
		});

		if (type === 'raw') {
			setState({ imageModalLoading: false });
			return;
		}

		setState({ imageModalLoading: true, generatingImage: true });

		try {
			const tags = await api.generateImageTags(options.characterId, type);
			if (tags) {
				setState({ imageModalTags: tags });
			} else {
				alert('Failed to generate tags');
				setState({ showImageModal: false });
			}
		} finally {
			setState({ imageModalLoading: false, generatingImage: false });
		}
	}

	async function handleImageGenerate(tags: string) {
		if (getState().generatingSD) return;
		setState({ generatingSD: true });

		try {
			const success = await api.generateSDImage(options.characterId, tags);
			if (success) {
				setState({ showImageModal: false, imageModalTags: '' });
				setTimeout(() => options.onScrollToBottom(), 100);
			} else {
				alert('Failed to generate image');
			}
		} finally {
			setState({ generatingSD: false });
		}
	}

	function handleImageCancel() {
		setState({ imageModalTags: '' });
	}

	async function handleImageRegenerate() {
		setState({ imageModalTags: '', imageModalLoading: true });

		try {
			const tags = await api.generateImageTags(options.characterId, getState().imageModalType);
			if (tags) {
				setState({ imageModalTags: tags });
			} else {
				alert('Failed to regenerate tags');
			}
		} finally {
			setState({ imageModalLoading: false });
		}
	}

	return {
		generateImage,
		handleImageGenerate,
		handleImageCancel,
		handleImageRegenerate
	};
}
