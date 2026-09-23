# Perguntas de arquitetura e sistemas

## 1. Como você garantiria que um evento não seja processado duas vezes pelo consumidor em caso de reentrega da fila?

utilizaria jobid fixo por job pra evitar duplicacao, tambem fazendo FOR UPDATE na transacao de maneira atomica, ou faz tudo ou nada. quando o segundo evento for processado ele ja vai sair pois o pedido estara PROCESSED

## 2. Como você escalaria o worker de consumo de eventos se o volume de pedidos multiplicasse por 10x?

faria replicas horizontais do worker pra concurrency, analisaria como a estrutura atual do banco poderia causar problemas de lock trabalhando com concurrency, aumentar o pool maximo de conexoes do banco tambem, definiria uma metrica de atraso maximo nos jobs pra fazer ou nao essa escala.

## 3. Como você faria uma migração de schema neste banco em produção, sem downtime?

precisaria que o codigo implementado durante as etapas fosse compativel tanto com versao anterior quanto com a nova, criaria jobs de backfill pra migrar os dados em segundo plano pra evitar locks no banco, so depois de tudo migrado removeria o codigo antigo e definiria os novos campos NOT NULL caso necessario.

## 4. Se o provedor de SSO (Keycloak/Auth0) ficar indisponível, como isso afeta sua API, e o que você faria para mitigar?

validacao JWT com a chave JWKS armazenada em cache pra evitar depender do provedor a cada validacao, quem ja tenha token continue utilizando assim o problema afetaria menos usuarios afetando login e refresh de tokens.

## 5. Dado um pedido que ficou "travado" sem confirmação, como você investigaria se o problema está na API, na fila ou no worker?

olharia o registro no banco pra ver o estado dele, verificaria o job no bullmq, verificaria os logs do worker pra analisar o fluxo do pedido ate ele travar.

