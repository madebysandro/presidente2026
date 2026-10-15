import { defineMiddleware } from "void";

/** CSP base da spec (D9) — envolve HTML/assets servidos pelo Worker. */
const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' https://resultados.tse.jus.br",
	"media-src 'self'",
	"font-src 'self'",
	"connect-src 'self'",
	"frame-ancestors 'none'",
].join("; ");

export default defineMiddleware(async (c, next) => {
	await next();
	c.header("content-security-policy", CSP);
	c.header("x-frame-options", "DENY");
});
