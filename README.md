# Hoobox — API de pedidos assíncronos

API NestJS que aceita pedidos como `PENDING`, publica `order.created` via **transactional outbox** em uma fila **BullMQ (Redis)** e processa no worker, reservando estoque no **MySQL** de forma atômica. Documentação interativa em `/docs` (Swagger).

## Pré-requisitos

- Docker (Compose e testes e2e)
- Node.js 22+ e npm (desenvolvimento e testes unitários)

## Rodar com um comando

```bash
docker compose up --build
```

Sobe MySQL 8.4, Redis 7 e a API (migrations e seed automáticos) em `http://localhost:3333`.

| Recurso | URL |
|---|---|
| Swagger | `http://localhost:3333/docs` |
| Health | `GET /health` |

Usuários de teste:

| username | senha | role |
|---|---|---|
| `admin` | `admin123` | ADMIN |
| `user` | `user123` | USER |

Produtos do seed (estoque inicial 5): Camiseta, Calça Jeans, Tênis Esportivo, Boné, Moletom, Meia Kit 3, Jaqueta, Shorts, Mochila, Relógio.

## Endpoints

| Método | Rota | Acesso | Resposta |
|---|---|---|---|
| POST | `/auth/login` | público | `200 { accessToken }` |
| POST | `/orders` | USER, ADMIN | `202 { id, status: PENDING, correlationId }` |
| GET | `/orders/:id` | USER, ADMIN | pedido com itens, status, `failureReason`, `correlationId` |
| GET | `/orders?page&limit` | USER, ADMIN | `{ data, page, limit, total, totalPages }` (limit ≤ 100) |
| POST | `/orders/:id/reprocess` | ADMIN | `202`; `409` se não estiver FAILED |
| GET | `/health` | público | `{ status: "ok" }` |

## Desenvolvimento local

```bash
cp .env.example .env
docker compose up -d mysql redis
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev        # logs legíveis via pino-pretty
```

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | — | conexão MySQL |
| `REDIS_HOST` / `REDIS_PORT` | `127.0.0.1` / `6379` | BullMQ |
| `JWT_SECRET` | — (obrigatória) | assinatura HS256 |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | validade do token |
| `LOG_LEVEL` | `info` | nível do Pino |
| `OUTBOX_POLL_MS` | `500` | intervalo do relay do outbox |
| `OUTBOX_PUBLISH_TIMEOUT_MS` | `5000` | tempo máximo de uma publicação na fila antes de contar como falha |
| `ORDER_WORKER_CONCURRENCY` | `1` | jobs simultâneos no worker |
| `ORDER_PROCESSING_DELAY_MS` | aleatório 1000–2000 | simulação de processamento |
| `ORDER_QUEUE_BACKOFF_MS` | `1000` | backoff exponencial entre retries |

## Arquitetura

Camadas do módulo `orders`:

- `domain/`: cálculo de total, `OrderCreatedEvent`, erros, agregação de itens para reserva, contrato do repositório.
- `application/`: `CreateOrderUseCase`, `ProcessOrderUseCase`, `ReprocessOrderUseCase`, `OrderQueries`.
- `infra/`: repositório Prisma, processor BullMQ, relay do outbox, opções da fila.
- `http/`: controller e DTOs.

### O que foi implementado

- **Outbox:** o pedido e o evento `order.created` são salvos na mesma transação. Um relay lê a tabela `outbox_events` e publica na fila. Se o Redis cair, o evento fica pendente e é publicado quando ele voltar, sem perder pedido.
- **Idempotência:** o worker trava o pedido com `SELECT ... FOR UPDATE` e só processa se ele ainda estiver `PENDING`. Retry ou mensagem duplicada não debitam o estoque duas vezes.
- **Estoque:** cada produto é debitado com `UPDATE ... WHERE stock >= quantidade`, em ordem de `productId` para evitar deadlock. Se faltar algum item, a transação inteira volta e o pedido fica `FAILED` com "estoque insuficiente". Um `CHECK (stock >= 0)` garante que o estoque nunca fica negativo.
- **Retry:** erro de processamento (nome com "fail") é tentado 3 vezes com backoff exponencial. Depois disso o pedido vira `FAILED` com o motivo e o job fica no failed set do BullMQ. Falta de estoque não é retentada.
- **Reprocessamento:** `POST /orders/:id/reprocess` (ADMIN) volta um pedido `FAILED` para `PENDING` e gera um novo evento.
- **Auth:** o login gera um JWT com a role do usuário. Todas as rotas exigem token, exceto login, health e docs, e o reprocessamento exige `ADMIN`.
- **Logs:** Pino em JSON com correlation ID. O ID vem do header `x-correlation-id` (ou é gerado), fica salvo no pedido e segue no evento até o worker.
- **Modelagem:** nomes de produto e cliente únicos, índices para a listagem e para o outbox, valores em centavos.

### Justificativa da estratégia de concorrência

update condicional simples verificando se o estoque e maior ou igual que a quantidade do pedido ja garante que workers simultaneos nao atualizem pra um estoque negativo. 

### Trade-offs

api e worker estao rodando juntos por simplicidade mas o ideal seria separar

## Observabilidade na prática

Todo pedido tem um `correlationId`, que aparece nos logs da API e do worker. Se um pedido ficou PENDING por 10 minutos:

1. Consulto o pedido e pego o `correlationId`.
2. Olho a linha dele em `outbox_events`. Se `published_at` está vazio, o evento não chegou na fila: o problema está no relay ou no Redis (`last_error` mostra o motivo).
3. Se foi publicado, procuro o job `outbox-{id}` no BullMQ para ver se está esperando, ativo ou falhou.
4. Filtro os logs pelo `correlationId` para ver até onde o worker chegou.

## Integração com SSO (Keycloak/Auth0)

O login sairia da API e passaria para o Keycloak. A API só validaria o token: troca o HS256 com segredo por RS256, usando a chave pública do JWKS em cache e conferindo `iss` e `aud`. As roles viriam de uma claim do token (`realm_access.roles` no Keycloak) e o `RolesGuard` continua igual. Com o JWKS em cache, se o Keycloak cair, quem já tem token continua usando a API; só login e refresh param.

## Testes

```bash
npm test               # unitários (sem Docker)
npm run test:cov       # cobertura 100% nos módulos de lógica pura
npm run test:e2e       # Testcontainers: MySQL + Redis reais (requer Docker)
npm run test:all
```

| Suíte | Cobre |
|---|---|
| Unit | total do pedido, decisões do `ProcessOrderUseCase`, retry/falha no processor, relay do outbox (falha de publicação), `RolesGuard`, correlation ID, reprocessamento |
| `orders.e2e` | POST→PENDING, outbox→job, PROCESSED com débito, estoque insuficiente sem retry, falha simulada com 3 tentativas, paginação, clientes simultâneos |
| `stock-concurrency.e2e` | 10 reservas simultâneas com estoque 5, ausência de deadlock com ordens inversas, retry e entregas duplicadas sem débito duplo, fluxo HTTP concorrente |
| `outbox.e2e` | evento órfão (crash entre commit e fila) é publicado e processado |
| `reprocess.e2e` | reprocessamento ADMIN, 403, 404, 409 e corrida entre dois reprocessamentos |
| `auth.e2e` | login, 401 sem token, token forjado, expirado e `alg: none` |
| `schema.e2e` | CHECKs, unicidade e estoque inicial |

## Com mais tempo

- Separar API e worker em dois serviços.
- Um job para encontrar pedidos presos em PENDING e republicar o evento.
- Limite de tentativas no outbox, com dead-letter para eventos que nunca publicam.
- Métricas e tracing com OpenTelemetry.
- Cada usuário ver só os próprios pedidos.
- CI rodando os testes a cada push.

## Perguntas de arquitetura

Ver [RESPOSTAS.md](./RESPOSTAS.md).
