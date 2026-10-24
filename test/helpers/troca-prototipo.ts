import { runInDurableObject } from "cloudflare:test";

type Restaurar = () => void;

const pilha: Restaurar[] = [];

/**
 * Troca um método no protótipo da classe do bundle. A RPC só enxerga o
 * protótipo, não propriedade própria da instância. O restaurador volta o
 * descriptor original e sai da pilha; `restaurarPrototipos()` desfaz o resto.
 */
export async function trocarNoPrototipo(
	stub: DurableObjectStub,
	metodo: string,
	novo: (...args: unknown[]) => unknown,
): Promise<Restaurar> {
	const desfazer = await runInDurableObject(stub, (inst) =>
		trocar(Object.getPrototypeOf(inst) as object, metodo, novo),
	);
	return empilhar(desfazer);
}

/** Troca todos os métodos próprios do protótipo, menos o `constructor`. */
export async function trocarTodosNoPrototipo(
	stub: DurableObjectStub,
	novo: (...args: unknown[]) => unknown,
): Promise<Restaurar> {
	const desfazer = await runInDurableObject(stub, (inst) => {
		const proto = Object.getPrototypeOf(inst) as object;
		const desfazeres = Object.getOwnPropertyNames(proto)
			.filter((nome) => nome !== "constructor" && typeof Object.getOwnPropertyDescriptor(proto, nome)?.value === "function")
			.map((nome) => trocar(proto, nome, novo));
		return () => {
			for (const d of desfazeres.reverse()) d();
		};
	});
	return empilhar(desfazer);
}

/** Para o `afterEach`: desfaz as trocas pendentes, da mais nova à mais antiga. */
export function restaurarPrototipos(): void {
	while (pilha.length > 0) pilha.at(-1)!();
}

function trocar(proto: object, metodo: string, novo: (...args: unknown[]) => unknown): Restaurar {
	const original = Object.getOwnPropertyDescriptor(proto, metodo);
	Object.defineProperty(proto, metodo, {
		value: novo,
		writable: true,
		configurable: true,
		enumerable: original?.enumerable ?? false,
	});
	return () => {
		if (original) Object.defineProperty(proto, metodo, original);
		else delete (proto as Record<string, unknown>)[metodo];
	};
}

function empilhar(desfazer: Restaurar): Restaurar {
	const restaurar = () => {
		const i = pilha.indexOf(restaurar);
		if (i === -1) return;
		pilha.splice(i, 1);
		desfazer();
	};
	pilha.push(restaurar);
	return restaurar;
}
