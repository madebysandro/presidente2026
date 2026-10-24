# Aviso de encerramento (#86)

Quando a apuração do 2º turno encerra, as pesquisas congelam. Quem sabe do encerramento é o poller. Quem congela é o DO de pesquisas. O aviso liga os dois.

## Os dois objetos

| DO | Classe | Nome | Binding |
| --- | --- | --- | --- |
| Poller | `PollerApuracao` (`src/poller/poller.ts`) | `ele-6258` | `env.POLLER` |
| Pesquisas | `Pesquisas` (`src/pesquisas/pesquisas.ts`) | `singleton` (`NOME_INSTANCIA`, `src/pesquisas/fontes.ts`) | `env.PESQUISAS` |

## Mensagem

RPC `Pesquisas.congelar(): Promise<{ congelada: true }>`.

- Grava a trava em `ctx.storage.kv`, chave `apuracao_encerrada` (`CHAVE_ENCERRADA`), valor `true`.
- O ack é `{ congelada: true }`. Só sai depois da escrita (output gate do DO). Ack recebido = trava durável.
- Idempotente. Repetir não muda nada e devolve o mesmo ack.
- Monotônica. Só vai de aberta para encerrada. Não existe mensagem de reabertura. Nada no código apaga a trava.
- Fora de ordem é seguro. O aviso pode chegar antes de qualquer import (banco vazio), no meio de um download, depois de uma reconciliação, ou quando o poller nem está mais encerrado. Em todos os casos a trava fica e não volta.

## O que as escritas consultam

Só a trava local, lida de forma síncrona: `this.ctx.storage.kv.get(CHAVE_ENCERRADA) === true`.

Vale para todas as escritas:

- agente: publicar, substituir, suspender, reativar;
- apply do import: cron, primeiro acesso, plano B.

Nenhuma escrita faz RPC ao poller dentro de `blockConcurrencyWhile`. As rotas do agente não falam com o poller. Se o poller cair, a escrita não dá `500` e o DO de pesquisas não reinicia.

Com a trava, a escrita do agente responde `409 {"erro":"apuracao_encerrada"}` e entra na auditoria. O import devolve `congelado`. `POST /api/import` responde o mesmo `409`.

## Envio

No ciclo `consultar()` em que `estado.encerrada` vira `true`, o poller grava o estado (`CHAVE_ESTADO`) e, no mesmo commit, troca o alarme de consulta por um alarme de guarda em `Date.now() + 30 s` (`ESCADA_AVISO[0]`). Logo depois chama `entregarAviso()`. Se o DO cair entre o commit e o ack, o alarme de guarda reentrega. No ack, `entregarAviso()` apaga esse alarme. Como o alarme existe enquanto o aviso está pendente, o `garantirAlarme()` de um `GET /api/apuracao` durante a RPC não agenda uma segunda entrega.

`entregarAviso()` chama `env.PESQUISAS.getByName(NOME_INSTANCIA).congelar()` dentro de try/catch. Nunca lança para fora.

- Ack: grava `avisoPesquisas` = `"entregue"`, apaga `avisoTentativas` e o alarme.
- Falha: soma 1 em `avisoTentativas` e agenda o alarme pela escada.

O aviso está pendente enquanto `estado.encerrada` é `true` e `avisoPesquisas` não é `"entregue"`.

## Reentrega

A escada é `ESCADA_AVISO = [30, 60, 120, 300, 600]`, em segundos. A tentativa `t` que falha agenda o alarme para `Date.now() + ESCADA_AVISO[min(t - 1, 4)] * 1000`:

| Tentativa que falhou | Próxima em |
| --- | --- |
| 1 | 30 s |
| 2 | 60 s |
| 3 | 120 s |
| 4 | 300 s |
| 5 em diante | 600 s |

Com a apuração encerrada, o `alarm()` do poller não consulta o TSE. Se o aviso está pendente, chama `entregarAviso()`. Se já foi entregue, não faz nada. Com a apuração aberta, o `alarm()` consulta como antes.

## Reconciliação

Dois lados, para o caso de o aviso se perder.

- Poller. `garantirAlarme()` roda em `obterEstado()`, ou seja, em todo `GET /api/apuracao`. Com a apuração encerrada, aviso pendente e nenhum alarme, agenda `setAlarm(Date.now())`. Cobre o alarme perdido.
- Pesquisas (pull). Nos três imports (`importarDoTse` no cron, `garantirImportInicial` no primeiro acesso, `receberPlanoB` no plano B), antes do download e fora de `blockConcurrencyWhile`, se não há trava: pergunta `POLLER.apuracaoEncerrada()`. Se `true`, grava a trava. Se o poller lança, loga `trava` com `resultado=erro` e segue sem trava. Nunca `500` por isso. As rotas do agente não fazem esse pull.

## Janela conhecida

Entre o encerramento e o ack, escritas do agente ainda passam.

- Pesquisas no ar: a janela é a própria RPC do ciclo que encerrou. O apply de import que estava no meio recusa.
- Pesquisas fora: a janela dura até a próxima reentrega (no máximo 10 min) ou até o próximo import reconciliar.

## Como conferir no Observability

Cloudflare → Workers & Pages → `presidente2026` → Observability. Filtre `evento = aviso`. O tipo é `EventoLog` em `src/log.ts`.

| Campo | Valor |
| --- | --- |
| `resultado` | `entregue` ou `erro` (o de `erro` sai em nível error) |
| `tentativa` | número da tentativa, a partir de 1 |
| `proximaMs` | espera até a reentrega, em ms (`30000` … `600000`); `null` no `entregue` |
| `erro` | mensagem da falha, só no `erro` |

Esperado num encerramento normal: um `poller` com `encerrada=true` e, logo depois, um `aviso` com `resultado=entregue` e `tentativa=1`.

O DO de pesquisas registra a trava com `evento = trava`:

| Campo | Valor |
| --- | --- |
| `resultado` | `gravada` na primeira gravação (repetir não loga) ou `erro` (nível error) quando o pull ao poller falha |
| `origem` | `aviso` (veio do `congelar()`) ou `reconciliacao` (veio do pull de um import) |
| `erro` | mensagem da falha do pull, só no `erro`; o import segue sem trava |

Um `aviso` com `resultado=erro` diz quando vem a próxima tentativa (`proximaMs`). O caso fecha no primeiro `entregue`. Sem log, a prova da trava é a próxima escrita do agente responder `409`.
