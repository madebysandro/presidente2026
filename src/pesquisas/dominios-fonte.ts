/** Lista fechada. Muda só por commit. Subdomínios entram. */
export const DOMINIOS_FONTE = [
	"folha.uol.com.br",
	"uol.com.br",
	"g1.globo.com",
	"oglobo.globo.com",
	"valor.globo.com",
	"estadao.com.br",
	"poder360.com.br",
	"cnnbrasil.com.br",
	"metropoles.com",
	"sbtnews.sbt.com.br",
	"band.uol.com.br",
	"veja.abril.com.br",
	"exame.com",
	"infomoney.com.br",
	"brasildefato.com.br",
	"gazetadopovo.com.br",
	"correiobraziliense.com.br",
	"agenciabrasil.ebc.com.br",
	"datafolha.folha.uol.com.br",
	"quaest.com.br",
	"atlasintel.org",
	"ipespe.org.br",
	"paranapesquisas.com.br",
	"realtimebigdata.com.br",
	"institutovox.com.br",
	"mdapesquisa.com.br",
] as const;

export function dominioFonteAceito(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/\.$/, "");
	return DOMINIOS_FONTE.some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
}
