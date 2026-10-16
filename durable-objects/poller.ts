import { defineDurableObject } from "void/durable";
import { PollerApuracao } from "../src/poller/poller";

/**
 * Binding `POLLER`, classe exportada `PollerDurableObject` (convenção Void).
 * Instâncias continuam `ele-6258` via Poller.get(nome).
 */
export const Poller = defineDurableObject({
	name: "poller",
	class: PollerApuracao,
});

export default Poller;
