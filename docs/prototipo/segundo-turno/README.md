# Protótipo descartável: 2º turno (25/10/2026)

> **Protótipo. Não mergear na `main`.** Branch: `prototipo/segundo-turno`. Nada aqui altera `src/`, `public/` ou o wrangler.
> Os números do 2º turno são **dados de exemplo** (fictícios), e há uma faixa rosa avisando isso em todas as telas.

## A pergunta

Como o Painel de produção acompanha o 2º turno, que no site é **só Presidente, com foco nacional**? A ideia é fazer isso sem redesign: o mesmo tema escuro, os mesmos cartões `.db-*` e o mesmo movimento, só com os deltas necessários. O que o protótipo precisa mostrar:

- o duelo de 2 candidatos: placar grande, vantagem, % dos válidos, votos e % apurado;
- a comparação com o 1º turno: delta de cada candidato e para onde foram os votos de "outros" e da abstenção, **como estimativa**;
- as viradas e a vantagem ao longo da apuração;
- o placar por UF e por região, com as UFs que mudaram de líder em relação ao 1º turno;
- os maiores colégios eleitorais (os 10 municípios com mais eleitores), com o resultado do 2º turno e o do 1º;
- o exterior como bloco próprio;
- comparecimento e abstenção, 1º × 2º turno.

**Decisão (Sandro, 11/10): foco só nacional.** Saíram o cartão do Pará ("decidido no 1º turno"), qualquer destaque do Pará (KPIs, destaques, links) e a Tela 2 (arquivo do 1º turno no Pará: Governador, Senado e proporcionais), junto com a navegação por abas e o código que só ela usava. O Pará aparece só como uma das 27 UFs, sem destaque.

## Como rodar

```bash
cd docs/prototipo/segundo-turno
python3 -m http.server 8765
# http://localhost:8765/?variant=parcial
```

Para trocar de estado, use as setas ← → ou a barra rosa flutuante. Só existe uma tela. A barra rosa e a faixa "DADOS DE EXEMPLO" **não fazem parte do design**.

## Estados (`?variant=`)

| `variant` | Momento | O que mostra |
|---|---|---|
| `pre` | antes das 17h | O arquivo oficial do 2º turno já está publicado e zerado. A faixa diz "Aguardando 17h · Primeiros resultados às 17:00". Placar 0,00% × 0,00%, gráfico vazio, comparação só com a linha do 1º turno e o mapa cinza, com o placar de UFs do 1º turno. |
| `parcial` | ~35% apurado, 17:53 | Ao vivo. 22 na frente (Sul, Sudeste e Centro-Oeste apuram primeiro). Análise "para virar" e tendência. |
| `virada` | ~76% apurado, 18:46 | Logo depois da troca de liderança: chip "↻ virada às 18:43", marco no gráfico, linha destacada em "Momentos da noite" e resumo na faixa ("mudou a liderança em Presidente"). |
| `encerrado` | 100% | A faixa diz "Encerrada" com o carimbo "Resultado final · 2º turno", o selo "✓ Eleito" aparece e a análise passa a mostrar o resultado (comparecimento, brancos e nulos, número de viradas). |

Se não houver `variant`, o padrão é `parcial`.

## O que é real e o que é exemplo

**Todo número do 2º turno é exemplo** (fictício), e a faixa rosa "DADOS DE EXEMPLO" avisa isso em todos os estados. Os números do 1º turno são reais.

| Dado | Real ou exemplo | Fonte |
|---|---|---|
| Presidente 1º turno: Brasil e 27 UFs + exterior (votos, %, eleitorado, seções) | **real** | `dados/estado-1t.json`: snapshot de `https://apuracao.madebysandro.app/api/apuracao` em 11/10/2026, recortado para Presidente + UFs |
| Comparecimento e abstenção do 1º turno (Brasil e exterior), maiores colégios no 1º turno (eleitorado, comparecimento, válidos, brancos, nulos, votos de 22 e 13) | **real** | `dados/colegios-1t.json`, gerado dos arquivos oficiais do TSE (eleição 6257, dg 05/10/2026): `…/ele2026/6257/dados/br/br-c0001-e006257-u.json`, `…/dados/zz/zz-c0001-e006257-u.json` e `…/dados/<uf>/<uf><cód. TSE do município>-c0001-e006257-u.json` (a URL de cada um está no próprio JSON). Os % de comparecimento e abstenção são os do TSE (`pcn`/`pan`, sobre o eleitorado das seções instaladas). |
| Quais são os 10 maiores colégios | **real** | `te` dos arquivos municipais acima; candidatos verificados: as capitais e as maiores cidades (Guarulhos, Campinas, São Gonçalo, Duque de Caxias e outras). Top 10: São Paulo, Rio de Janeiro, Brasília, Belo Horizonte, Salvador, Fortaleza, Manaus, Curitiba, Recife e Porto Alegre. O 11º é Belém. Os códigos dos municípios vêm de `…/6257/config/mun-e006257-cm.json` |
| Candidatos, fotos, eleitorado (150.238.779) e seções (469.329) do 2º turno | **real** | `dados/br-c0001-e006258-u.json` (arquivo oficial, eleição 6258, dg 10/10/2026) e `…/6258/fotos/br/{sqcand}.jpeg` |
| Votos, %, % apurado, horários e viradas do 2º turno (Brasil, UFs, regiões, exterior e municípios) | **exemplo** | `js/mock-2t.js` |
| Comparecimento do 2º turno (o do 1º turno + 0,6 p.p. em todo lugar) e brancos e nulos (4,2%) | **exemplo** | `js/mock-2t.js` (`COMP_PP`, `BN_2T`) |

O vencedor do exemplo (Lula, com 51,6%) é **arbitrário**: serve para exercitar a virada. O gerador parte da divisão F/(F+L) do 1º turno em cada UF e em cada município, aplica um deslocamento uniforme e faz cada UF apurar numa janela de tempo (o município segue a janela da sua UF; o exterior apura por último). O resultado é determinístico, e o formato imita `/api/apuracao` + `/api/historico`. Algumas UFs têm roteiro próprio (AM, MG e TO) para que haja viradas em relação ao 1º turno nos dois sentidos.

Para regenerar `dados/colegios-1t.json`, basta ler os arquivos do TSE listados acima. O script de uma vez ficou fora do repositório: ele só baixa os JSONs e copia `e.te`, `e.c`, `e.a`, `e.pcn`, `e.pan`, `v.vv`, `v.vb`, `v.tvn` e `vap` de 22 e 13.

## Arquivos

- `index.html`: cópia da página de produção (faixa de status igual), com o caminho relativo.
- `css/tokens.css` e `css/tema.css`: **cópia literal** da produção. `css/proto-2t.css` traz só os blocos novos (`.t2-*`), o estado "aguardando" da faixa, a barra e a faixa do protótipo.
- `js/tela1-util.js`, `js/arquivo.js`, `js/pontos-hist.js` e `js/movimento/{calmo,faixa-status,flip,fluxo-barras}.js`: cópia da produção. Os únicos patches estão marcados com `PROTO-2T`:
  - `arquivo.js`: modo "aguardando" e carimbo vindo do estado;
  - `movimento/faixa-status.js`: classe `.aguardando`.
- `js/app-2t.js`: entrada, que substitui o `app.js`. `js/tela-2t.js`: os cartões. `js/mock-2t.js`: os dados de exemplo. `js/proto-switcher.js`: a barra.
- Removidos com a Tela 2: `tela1-cartao.js`, `tela2-proporcionais.js`, `tela1-painel.js`, `tela1-grafico.js`, `movimento/abas.js`, `movimento/revela-grafico.js` e `movimento/memoria.js`.
- `smoke.cjs`: o smoke com Playwright.

## Verificação

Com o servidor de pé, rode `node smoke.cjs`. Ele procura o Playwright em `$PW` ou em `/tmp/pw`, e `SHOTS=<dir>` salva as capturas. O smoke abre `?variant=pre|parcial|virada|encerrado` a 1440 px e a 390 px e confere:

- que não há erro no console nem `pageerror`;
- que não aparece nenhum texto "Falha", `undefined`, `NaN`, "Pará" ou "Tela 2". A tabela neutra "Todas as UFs", que lista as 27 UFs pelo nome, fica fora dessa busca;
- que os blocos estão presentes: duelo, exterior, comparecimento, comparação, estados e colégios (com 10 linhas). A tabela de UFs tem 28 linhas, e não há abas nem `data-tela`;
- que a faixa "DADOS DE EXEMPLO" aparece;
- que não há rolagem horizontal na página.

Resultado em 11/10/2026: **8/8 casos ok**. As capturas ficaram em `/tmp/proto2t-shots/`, fora do repositório.

## Decisões e perguntas em aberto

Estão em [DESIGN-NOTAS.md](DESIGN-NOTAS.md).

## Módulo de pesquisas (branch `prototipo/pesquisas`, 15/10/2026)

Pergunta: como a página mostra as pesquisas antes das 17h, ao lado da apuração ao vivo e no "Pesquisas × urnas"?

```bash
python3 -m http.server 8766 -d docs/prototipo/segundo-turno
# http://localhost:8766/?variant=A&momento=pre
```

- `?variant=A|B|C`, setas ← → ou a barra: **A · Placar** (média como placar de duelo, tabela, "Vêm aí" na lateral), **B · Linha do tempo** (gráfico até 25/10 como herói, feed cronológico; ao vivo a média vira marca no cabo de guerra e linha no gráfico da apuração), **C · Por instituto** (tabela de institutos que liga/desliga o gráfico; no fim, ranking).
- `?momento=pre|aovivo|encerrado`, botões da barra ou tecla `m`.
- Dados reais: `dados/pesquisas.json` = 33 registros nacionais do CSV de dados abertos do TSE (15/10) + 5 pesquisas com números da imprensa. A média é calculada em 15/10 em todos os momentos; a apuração continua fictícia (`js/mock-2t.js`).
- Código: `js/pesquisas.js`, `css/proto-pesq.css`; patches marcados `PROTO-PESQ` em `js/app-2t.js` e `js/tela-2t.js`.
