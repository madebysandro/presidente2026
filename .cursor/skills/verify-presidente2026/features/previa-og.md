# Prévia OG

`GET /og.png` devolve o cartão de 1200×630 usado no link, em PNG.

## Sub-features

- `og-png` baixa a imagem e confere o tamanho.

## How to get to it (user POV)

- Abrir `/og.png`.

## Driving it with verificar

Preconditions:

- `doctor` ok em `http://127.0.0.1:5273/`.

- **Baixar.** Run `node .cursor/skills/verify-presidente2026/verificar.mjs drive previa-og`. O status é 200, a assinatura é PNG e o IHDR mede 1200×630. A cópia fica em `og.png` na pasta `prova`.

## Gotchas

- A imagem passa pelo mesmo import e pelo poller que a página. Se `/` falhou no doctor, esta rota não é um atalho.
- Não compare pixel a pixel com a produção. A prova é formato e tamanho.
