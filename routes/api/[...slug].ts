import { defineHandler } from "void";

function naoAchei() {
	return Response.json({ error: "não achei" }, { status: 404 });
}

export const GET = defineHandler(() => naoAchei());
export const POST = defineHandler(() => naoAchei());
export const PUT = defineHandler(() => naoAchei());
export const PATCH = defineHandler(() => naoAchei());
export const DELETE = defineHandler(() => naoAchei());
