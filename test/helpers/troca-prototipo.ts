import { runInDurableObject } from "cloudflare:test";

type Restaurar = () => void;

/**
 * Troca um método no protótipo da classe do bundle. A RPC só enxerga o
 * protótipo, não propriedade própria da instância.
 */
export async function trocarNoPrototipo(
	stub: DurableObjectStub,
	metodo: string,
	novo: (...args: unknown[]) => unknown,
): Promise<Restaurar> {
	return runInDurableObject(stub, (inst) => {
		const proto = Object.getPrototypeOf(inst) as Record<string, unknown>;
		const original = proto[metodo];
		proto[metodo] = novo;
		return () => {
			proto[metodo] = original;
		};
	});
}
