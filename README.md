# Hoobox — API de pedidos assíncronos

API NestJS que persiste pedidos como `PENDING`, enfileira processamento em **BullMQ + Redis** e atualiza status após debitar estoque. Contrato HTTP em [openapi.yaml](./openapi.yaml).

## Pré-requisitos

- **Docker** (Compose e testes e2e)
- **Node.js 22+** e npm (desenvolvimento e testes unitários locais)

## Rodar com um comando (stack completa)

Sobe **API + MySQL 8.4 + Redis 7** (migrate, seed e API em modo produção):

```bash
npm run compose:up
# equivalente: docker compose up --build
```

- Health: `GET http://localhost:3333/`
- Criar pedido: `POST http://localhost:3333/orders` (ver exemplos no OpenAPI)
- Parar: `npm run compose:down`

A fila usa **Redis** (não RabbitMQ). Jobs ficam na fila `orders`; falhas definitivas viram `FAILED` + `failureReason` no MySQL (sem fila DLQ separada).

## Desenvolvimento local (opcional)

1. Copie variáveis: `cp .env.example .env`
2. Suba só infraestrutura ou use instâncias locais de MySQL/Redis.
3. Com MySQL/Redis acessíveis em `localhost`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Para subir **apenas** MySQL e Redis via Compose (API no host):

```bash
docker compose up mysql redis
```

## Testes

### Pirâmide

| Camada | O que prova |
|--------|-------------|
| **Unitários** | Total do pedido (`order-total`), opções de retry/backoff Bull (`order-queue-options`), decisão de marcar `FAILED` só após esgotar tentativas (`order-created.processor` / `onFailed`). |
| **E2e** | Nest + Prisma + Redis + worker **sem mock**: enfileiramento real (`order.created`, `attempts: 3`, backoff), `PENDING` após POST, `PROCESSED` com débito de estoque, falha de estoque **sem retry** (job removido após conclusão única; pedido `FAILED`), falha simulada com **3 tentativas** (`attemptsMade === 3`, `customerName` com `fail`). |

Testcontainers (e2e) sobe MySQL/Redis automaticamente. Docker Compose é para rodar/demo manual da stack.

```bash
npm run prisma:generate
npm test                    # unitários (sem Docker)
npm run test:cov            # cobertura 100% nos módulos de lógica pura (ver vitest.config.ts)
npm run test:e2e            # requer Docker em execução
npm run test:all            # unit + e2e
```

Variáveis usadas nos e2e (definidas em `test/global-setup.e2e.ts` / setup):

- `ORDER_PROCESSING_DELAY_MS` — delay artificial do worker (ex.: 3000 no teste POST→`PENDING`)
- `ORDER_QUEUE_BACKOFF_MS` — backoff entre retries Bull (50 nos e2e rápidos)

### Comportamento de falha (referência)

- **Estoque insuficiente:** `markFailed` dentro do repositório; job Bull **conclui** (1 tentativa).
- **Nome com `fail`:** `ForcedProcessingError` propaga; Bull **retenta** (`attempts: 3`); na última falha, `onFailed` chama `markFailed`.

## Decisões de arquitetura

```text
POST /orders → MySQL (PENDING) → Redis (job order.created)
                                      ↓
                              Worker (OrderCreatedProcessor)
                                      ↓
                         transação: lock, estoque, PROCESSED ou FAILED
```

- **POST síncrono, processamento assíncrono:** resposta imediata `{ status: "ok" }`; status final via `GET /orders/:id`.
- **Dinheiro em centavos** e limite de total (`order-total`) para evitar overflow e valores inválidos.
- **Retry:** configurado no job (`attempts: 3`, backoff exponencial). Falhas de negócio tratadas no repo (estoque) não disparam retry.
- **“DLQ”:** pedido `FAILED` + `failureReason` (até 255 chars) no banco, não uma segunda fila Redis.
- **Demo de falha técnica:** substring `fail` no nome do cliente (case insensitive).

## Com mais tempo

- Fila dead-letter dedicada (`orders-failed`) ou replay manual de jobs.
- Idempotência explícita no worker após retries parciais.
- Métricas/tracing de fila (lag, taxa de falha, tempo de processamento).
- CI (GitHub Actions): lint, unit, e2e com Testcontainers.
- Testes de carga no POST e no consumer.
- Limpar dependências não usadas no código (`typeorm`, `amqplib`, etc.).

## Licença

UNLICENSED (projeto privado).
