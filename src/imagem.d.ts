declare module "jpeg-js" {
	export function decode(
		jpeg: Uint8Array,
		opts?: { useTArray?: boolean; formatAsRGBA?: boolean },
	): { width: number; height: number; data: Uint8Array };
}
