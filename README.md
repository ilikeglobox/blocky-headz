# Brick-Headz — site para Netlify

Site de vitrine para colecionáveis. Os botões de compra abrem o anúncio do produto no Mercado Livre; o site não processa pagamentos.

## Publicar no Netlify

1. Descompacte o ZIP.
2. Crie um repositório GitHub e envie todos os arquivos deste projeto para a branch `main`.
3. No Netlify, escolha **Add new site → Import an existing project** e conecte o repositório.
4. Build command: deixe vazio. Publish directory: `.`.
5. Faça o deploy.

## Configurar o painel administrativo

O painel usa Decap CMS + Netlify Identity + Git Gateway para editar `content/products.json` e enviar imagens ao repositório.

1. No painel do site no Netlify, vá a **Site configuration / Identity** (o nome pode variar) e habilite Netlify Identity.
2. Em Identity, configure o cadastro como **Invite only**. Não deixe cadastro público aberto.
3. Habilite **Git Gateway** nas configurações de Identity.
4. Convide seu e-mail como usuário administrador e aceite o convite.
5. Acesse `https://SEU-DOMINIO/admin/` e entre com a conta criada.
6. Cadastre produtos, faça upload de imagens e cole o link completo de cada anúncio do Mercado Livre. Salve e publique. O CMS fará commit no repositório e o Netlify atualizará a vitrine.

## Sobre a senha do administrador

Por segurança, a senha não é armazenada no HTML nem no repositório. Crie a conta pelo convite do Netlify Identity e defina a senha no fluxo oficial de convite/recuperação. Você pode escolher a senha que desejar na própria plataforma. Não use uma senha em código-fonte público.

## Domínio próprio

No Netlify, abra **Domain management → Add a domain** e adicione o domínio que você já comprou. O Netlify mostrará os registros DNS exatos para configurar no registrador onde comprou o domínio. Não altere registros MX se usa e-mail no domínio. Aguarde a verificação e a emissão do HTTPS.

## Produtos de exemplo

O catálogo inicial contém apenas dois exemplos demonstrativos. Edite ou remova-os no painel antes de divulgar a loja.

## Estrutura

- `index.html`: página inicial
- `styles.css`: identidade visual responsiva
- `app.js`: carrega e filtra o catálogo
- `content/products.json`: catálogo inicial
- `admin/`: painel CMS
- `assets/logo.png`: logo fornecida

## Integração Gubee (Netlify)

A integração usa exclusivamente a API oficial em `https://api.gubee.com.br`. A vitrine consulta `GET /integration/stocks/bysku?sku=...` e `GET /integration/prices/bysku?sku=...` por SKU e exibe a quantidade disponível (total menos reservas) e o preço confirmado pela Gubee. O painel consulta o cadastro do produto via `GET /integration/skus/by-sku?sku=...` e `GET /integration/products/bySkuId/{skuId}`; catálogo editorial e links continuam sob controle do Decap CMS. As leituras são feitas no backend; sem SKU, saldo válido, permissão ou resposta da API, a disponibilidade aparece como **não confirmada**.

### Configuração

1. No painel da Gubee, registre um app OAuth2 e autorize a conta que possui o catálogo. Cadastre como redirect URI a URL `https://SEU-DOMINIO/.netlify/functions/gubee-oauth?action=callback` (match exato). A conexão usa authorization code + PKCE e o endpoint oficial `https://auth.gubee.com.br/realms/gubee/protocol/openid-connect/token`.
2. Conceda apenas os escopos de leitura necessários às operações realmente utilizadas: leitura de produto/catálogo, estoque, preço e pedidos (`product:view`, `stock:view`, `ad:view` quando exigido pela leitura de preço, e `order:view`). A Gubee também precisa conceder as permissões ao usuário da conta. Consulte a lista atual no cadastro do app e ajuste ao retorno de autorização; não conceda escopos de escrita para este painel.
3. No Netlify, adicione `GUBEE_CLIENT_ID`, `GUBEE_CLIENT_SECRET` e `GUBEE_REDIRECT_URI` em **Site configuration → Environment variables**. Depois de publicar um deploy de preview ou ambiente de teste, entre em `/admin/inventory.html` com sua conta Identity e use **Conectar Gubee**. A função guarda PKCE/state temporários e troca o código no servidor; access/refresh tokens ficam no Netlify Blobs (`gubee-private`) e são renovados automaticamente. Opcionalmente `GUBEE_REFRESH_TOKEN` pode inicializar o armazenamento durante migração, mas a conexão pelo painel é o caminho recomendado. Nunca comite valores reais. `.env.example` contém somente nomes e exemplos de configuração.
4. Para webhooks, gere um segredo aleatório longo e configure-o como `GUBEE_WEBHOOK_TOKEN` no Netlify. No painel Gubee, cadastre a URL `https://SEU-DOMINIO/.netlify/functions/gubee-webhook` com header `X-Gubee-Token` e assine `VariationCreated`, `VariationUpdated`, `PriceUpdated`, `StockUpdated` e eventos de pedido desejados. A Gubee atualmente não assina payloads com HMAC; a função valida o token compartilhado com comparação em tempo constante e recupera o recurso pelo caminho `/integration/*` recebido, usando OAuth no servidor. Se a assinatura de webhook não for habilitada, a vitrine faz leituras atuais ao carregar e o painel pode ser atualizado pelo navegador.
5. Em **Identity**, mantenha o cadastro fechado como já usado pelo CMS. Atribua a role `admin` somente aos administradores que podem ver o painel Gubee. Acesse `/admin/inventory.html`; `/admin/` e a configuração Decap CMS não foram substituídos.
6. No Decap CMS, preencha o campo opcional **SKU na Gubee** usando o SKU real do catálogo Gubee. SKU em branco não chama a API nem recebe estado de disponibilidade. Não preencha preço ou quantidade inventados.

Variáveis aceitas: `GUBEE_CLIENT_ID`, `GUBEE_CLIENT_SECRET`, `GUBEE_REDIRECT_URI`, `GUBEE_REFRESH_TOKEN` (opcional para migração), `GUBEE_WEBHOOK_TOKEN`, `GUBEE_SELLER_ID` (opcional) e `GUBEE_LOW_STOCK_THRESHOLD` (limite de alerta, padrão 3 unidades). O Netlify fornece `URL` à função para ler o catálogo estático. Valores secretos devem ser definidos no escopo de Functions/Runtime e nunca em variáveis `VITE_`, `NEXT_PUBLIC_` ou HTML.

### Painel e pedidos

`/.netlify/functions/gubee-admin` exige sessão Netlify Identity válida e role `admin`. O painel mostra estoque disponível, alerta visual para até 3 unidades, preço e estado/horário da consulta. Ele consulta as filas `created`, `paid`, `invoiced`, `shipped`, `delivered` e `canceled` de pedidos (`GET /integration/orders/queue/{status}`), sem chamar o DELETE de ACK e sem expor dados pessoais do comprador. Cada fila é limitada aos 50 itens retornados na primeira página. Ausência de escopo ou falha da API é sinalizada como indisponível.

### Verificações locais

Requer Node.js 22 ou superior e dependências do projeto instaladas (`npm install`). Execute `npm test` para os testes das regras de disponibilidade, preço e validação de webhook, e `npm run check` para verificar sintaxe das funções.

### Referências oficiais consultadas

- [Apps OAuth2 e quickstart](https://developers.gubee.com.br/getting-started/quickstart/)
- [Referência OAuth2](https://developers.gubee.com.br/oauth2/referencia/)
- [Estoque e preço por SKU](https://developers.gubee.com.br/journeys/erp/stock-price/)
- [Receber pedidos e filas](https://developers.gubee.com.br/journeys/erp/receive-orders/)
- [Eventos e segurança de webhooks](https://developers.gubee.com.br/webhooks/events/)
- [Schema de webhook](https://developers.gubee.com.br/webhooks/payload-schema/)


## História da marca
A seção “Quem somos” e a linha do tempo foram adaptadas a partir do PDF de referência enviado: ideia inicial, primeiros passos, fabricação, embalagem, vendas e trajetória atual. O texto foi incorporado à página inicial.


## Última alteração visual
A logo oficial substitui o símbolo decorativo “BH✳” na seção institucional. A página pública não exibe mais os produtos nem carrega o script da vitrine. O catálogo continua no CMS em `/admin/`, para uso administrativo.

### Correção de confirmação/login do Netlify Identity

O `index.html` redireciona tokens de confirmação, convite, recuperação de senha e alteração de e-mail da raiz do site para `/admin/`, mantendo o fragmento `#...` para que o widget do Netlify Identity o processe. Publique esta alteração no GitHub e aguarde o deploy do Netlify. Links de confirmação antigos podem expirar; solicite um novo e-mail depois do deploy.
