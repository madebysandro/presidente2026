/**
 * Rate Limiting binding (D8 / #15).
 * Sem o binding — produção no Void 1.1.11, testes e dev — devolve true
 * e o contador do DO decide. Os bindings voltam quando o Void suportar
 * rate limit com pinned secrets (#64).
 * Com o binding, a plataforma também precisa deixar passar.
 */
export async function bindingDeixaPassar(
	binding: RateLimit | undefined,
	chave: string,
): Promise<boolean> {
	if (!binding) return true;
	const resultado = await binding.limit({ key: chave });
	return resultado.success;
}
