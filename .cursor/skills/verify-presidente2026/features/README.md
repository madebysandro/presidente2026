# Mapa de verificação do presidente2026

Este diretório é a fonte do comportamento que o visitante vê. Ler o índice antes de dirigir o site e seguir o arquivo da feature.

## Baseline preconditions

- Servidor local em `http://127.0.0.1:5173`, subido por `node .cursor/skills/verify-presidente2026/verificar.mjs launch --port 5173`.
- Esse comando é `npm run dev` (Vite + Void/Miniflare). Não é `wrangler` e não fala com a conta Cloudflare.
- Estado em `.void/` nesta árvore. Não subir outra instância no mesmo diretório.
- `node .cursor/skills/verify-presidente2026/verificar.mjs doctor --base http://127.0.0.1:5173` com `ok: true`.
- Node `>= 24.21` e Chrome em `CHROME_PATH` ou `/usr/bin/google-chrome`.

## Driving conventions

- Começar do estado que o `npm run dev` entrega. Não injetar fase, relógio nem banco por fora.
- Preferir papel ARIA e nome acessível.
- Tratar cada comando como literal.
- O helper de navegador é `node .cursor/skills/verify-presidente2026/verificar.mjs`.
- A API pública se dirige com `curl` contra a mesma origem.
- A limpeza não apaga `artifacts/verify-presidente2026/`.

## Proof and skip reporting

- Registrar a ação e o estado que ela deixou.
- A prova de UI leva captura em 390 px e 1280 px, com a marca `Presidente 2026, 2º turno` visível, e o `relatorio.json`.
- A prova de API leva status, `content-type` e o JSON.
- Um entry point que não deu para alcançar fica com o comando tentado e a precondição que faltou. Outro caminho não conta como prova dele.

## Features

- [Página de pesquisas](./pagina-pesquisas.md) é a superfície `/` enquanto `data-fase` é `pesquisas`.
- [Calendário](./calendario.md) é a seção de dias na mesma página.
- [Gráfico da vantagem](./grafico-vantagem.md) é a seção da média e dos institutos.
- [API de pesquisas](./api-pesquisas.md) é o `GET /api/pesquisas`.
- [API de apuração](./api-apuracao.md) é o `GET /api/apuracao`.
