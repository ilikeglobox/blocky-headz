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


## História da marca
A seção “Quem somos” e a linha do tempo foram adaptadas a partir do PDF de referência enviado: ideia inicial, primeiros passos, fabricação, embalagem, vendas e trajetória atual. O texto foi incorporado à página inicial.


## Última alteração visual
A logo oficial substitui o símbolo decorativo “BH✳” na seção institucional. A página pública não exibe mais os produtos nem carrega o script da vitrine. O catálogo continua no CMS em `/admin/`, para uso administrativo.
