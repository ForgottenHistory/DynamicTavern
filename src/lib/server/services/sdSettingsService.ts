import { db } from '../db';
import { sdSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { SdSettings } from '../db/schema';

const DEFAULT_SETTINGS = {
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

class SdSettingsService {
	async getUserSettings(userId: number): Promise<SdSettings> {
		const settings = await db
			.select()
			.from(sdSettings)
			.where(eq(sdSettings.userId, userId))
			.limit(1);

		if (settings[0]) {
			return settings[0];
		}

		return {
			id: 0,
			userId,
			...DEFAULT_SETTINGS
		};
	}

	async updateUserSettings(
		userId: number,
		settings: Partial<Omit<SdSettings, 'id' | 'userId'>>
	): Promise<SdSettings> {
		const existing = await db
			.select()
			.from(sdSettings)
			.where(eq(sdSettings.userId, userId))
			.limit(1);

		if (existing[0]) {
			const updated = await db
				.update(sdSettings)
				.set(settings)
				.where(eq(sdSettings.userId, userId))
				.returning();
			return updated[0];
		} else {
			const created = await db
				.insert(sdSettings)
				.values({
					userId,
					...DEFAULT_SETTINGS,
					...settings
				})
				.returning();
			return created[0];
		}
	}

	getDefaultSettings() {
		return { ...DEFAULT_SETTINGS };
	}
}

export const sdSettingsService = new SdSettingsService();
