import { defineDurableObject } from "void/durable";
import { Pesquisas as PesquisasClass } from "../src/pesquisas/pesquisas";

/** Binding `PESQUISAS`, classe exportada `PesquisasDurableObject`. */
export const Pesquisas = defineDurableObject({
	name: "pesquisas",
	class: PesquisasClass,
});

export default Pesquisas;
