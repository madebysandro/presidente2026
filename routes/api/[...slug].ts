import { defineHandler } from "void";

/** /api/* desconhecido → 404 curto (comportamento do esqueleto #7). */
export const GET = defineHandler(() => new Response("não achei", { status: 404 }));
export const POST = defineHandler(() => new Response("não achei", { status: 404 }));
export const PUT = defineHandler(() => new Response("não achei", { status: 404 }));
export const PATCH = defineHandler(() => new Response("não achei", { status: 404 }));
export const DELETE = defineHandler(() => new Response("não achei", { status: 404 }));
