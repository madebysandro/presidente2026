declare module "jpeg-js" {
	export function decode(
		jpeg: Uint8Array,
		opts?: { useTArray?: boolean; formatAsRGBA?: boolean },
	): { width: number; height: number; data: Uint8Array };
}

declare module "@shuding/opentype.js" {
	export type ComandoOt = {
		type: string;
		x: number;
		y: number;
		x1?: number;
		y1?: number;
		x2?: number;
		y2?: number;
	};

	export type FonteOt = {
		getPath(
			texto: string,
			x: number,
			y: number,
			tamanho: number,
			opcoes?: { letterSpacing?: number; kerning?: boolean },
		): { commands: ComandoOt[] };
	};

	export function parse(buffer: ArrayBuffer): FonteOt;
}
