/**
 * SHA-256 iguala o tamanho antes do `timingSafeEqual`.
 * Tamanhos diferentes de chave não chegam na comparação byte a byte.
 */
export async function chaveConfere(apresentada: string, segredo: string): Promise<boolean> {
	const [a, b] = await Promise.all([
		crypto.subtle.digest("SHA-256", new TextEncoder().encode(apresentada)),
		crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo)),
	]);
	if (segredo.length === 0) return false;
	return crypto.subtle.timingSafeEqual(a, b);
}
