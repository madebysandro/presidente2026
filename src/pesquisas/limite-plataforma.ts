/**
 * Rate Limiting binding (D8 / #15).
 * Sem o binding — escolha do repo, testes e dev — devolve true
 * e o contador do DO decide. A ausência não é bug aberto do Void 1.1.11:
 * a #462 fechou e o void@1.2.1 trata `rate-limit`. Os nomes ficam opcionais (#64).
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
