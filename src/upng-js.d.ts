declare module "upng-js" {
	interface PngDecodificado {
		width: number;
		height: number;
	}

	interface Upng {
		decode(buf: ArrayBuffer): PngDecodificado;
		toRGBA8(img: PngDecodificado): ArrayBuffer[];
		encode(bufs: ArrayBuffer[], w: number, h: number, cores?: number): ArrayBuffer;
	}

	const UPNG: Upng;
	export default UPNG;
}
