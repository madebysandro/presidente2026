/**
 * Rate Limiting binding (D8 / #15).
 * Sem o binding — testes e dev — devolve true e o contador do DO decide.
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
