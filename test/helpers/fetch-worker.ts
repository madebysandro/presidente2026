import { SELF } from "cloudflare:test";

/** Dispara o Worker Void (WorkerEntrypoint) como um fetch de produção. */
export function fetchWorker(input: RequestInfo | URL, init?: RequestInit) {
	return SELF.fetch(input, init);
}
