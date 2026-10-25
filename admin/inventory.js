(function () {
  const state = document.getElementById('inventory-state');
  const content = document.getElementById('inventory-content');
  function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function renderProducts(products, lowStockThreshold) {
    const wrap = document.getElementById('inventory-products');
    if (!products.length) { wrap.replaceChildren(element('p', 'Nenhum produto cadastrado no CMS.')); return; }
    const table = element('table', undefined, 'inventory-table'); const container = element('div', undefined, 'inventory-table-wrap');
    const head = element('thead'); const row = element('tr');
    ['Produto / SKU','Disponível','Preço Gubee','Sincronização'].forEach(label => row.appendChild(element('th', label)));
    head.appendChild(row); table.appendChild(head); const body = element('tbody');
    products.forEach(product => {
      const tr = element('tr'); tr.appendChild(element('td', (product.name || 'Produto') + '\n' + (product.sku || 'SKU não informado')));
      const stock = product.availability || {}; const isLow = stock.confirmed && stock.quantity <= lowStockThreshold;
      const label = stock.confirmed ? String(stock.quantity) + (isLow ? ' · alerta de estoque baixo' : '') : 'Não confirmado';
      tr.appendChild(element('td', label, isLow ? 'inventory-low' : ''));
      tr.appendChild(element('td', Number.isFinite(product.livePrice) ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(product.livePrice) : 'Não confirmado'));
      const productState = product.gubeeProduct?.status === 'ok' ? ' · cadastro ' + (product.gubeeProduct.productStatus || 'encontrado') : product.gubeeProduct?.status === 'not_found' ? ' · SKU não encontrado' : '';
      tr.appendChild(element('td', (product.sync === 'ok' ? 'Atualizado ' + new Date(product.checkedAt).toLocaleString('pt-BR') : product.sync === 'missing_sku' ? 'SKU pendente' : product.sync === 'partial' ? 'Sincronização parcial' : 'Falha na consulta') + productState));
      body.appendChild(tr);
    });
    table.appendChild(body); container.appendChild(table); wrap.replaceChildren(container);
  }
  function renderOrders(queues) {
    const wrap = document.getElementById('inventory-orders'); wrap.replaceChildren();
    queues.forEach(queue => {
      const card = element('article', undefined, 'inventory-order'); card.appendChild(element('h3', queue.status.toUpperCase()));
      if (!queue.ok) card.appendChild(element('p', 'Consulta sem permissão ou indisponível.', 'inventory-muted'));
      else if (!queue.orders.length) card.appendChild(element('p', 'Nenhum pedido retornado nesta consulta.', 'inventory-muted'));
      else queue.orders.forEach(order => card.appendChild(element('p', (order.id || order.orderId || 'Pedido') + ' · ' + (order.status || queue.status) + (Number.isFinite(Number(order.totalAmount)) ? ' · ' + new Intl.NumberFormat('pt-BR',{style:'currency',currency:order.currency || 'BRL'}).format(Number(order.totalAmount)) : ''))));
      wrap.appendChild(card);
    });
  }
  async function load(user) {
    const connect = document.getElementById('connect-gubee');
    connect.onclick = async function () {
      connect.disabled = true;
      try {
        const jwt = await user.jwt();
        const response = await fetch('/.netlify/functions/gubee-oauth?action=start', { headers: { authorization: 'Bearer ' + jwt }, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.authorizationUrl) throw new Error('Não foi possível iniciar a conexão OAuth da Gubee.');
        window.location.assign(data.authorizationUrl);
      } catch (error) { state.className = 'inventory-error'; state.textContent = error.message; connect.disabled = false; }
    };
    const connectionState = new URLSearchParams(window.location.search).get('gubee');
    if (connectionState === 'connected') state.textContent = 'Conta Gubee conectada. Atualizando dados...';
    if (connectionState === 'error') state.textContent = 'A conexão OAuth da Gubee não foi concluída. Tente novamente.';
    state.textContent = 'Consultando catálogo, estoque, preços e fila de pedidos...';
    try {
      const jwt = await user.jwt();
      const response = await fetch('/.netlify/functions/gubee-admin', { headers: { authorization: 'Bearer ' + jwt }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? 'Esta conta não possui a função admin exigida.' : data.error || 'Falha na consulta.');
      content.hidden = false; renderProducts(data.products || [], Number(data.lowStockThreshold ?? 3)); renderOrders(data.queues || []);
      state.textContent = (connectionState === 'connected' ? 'Conta Gubee conectada. ' : '') + (data.warning || 'Última consulta: ') + (data.checkedAt ? new Date(data.checkedAt).toLocaleString('pt-BR') : '');
    } catch (error) { state.className = 'inventory-error'; state.textContent = error.message; }
  }
  if (!window.netlifyIdentity) { state.textContent = 'Não foi possível inicializar o login do Netlify Identity.'; return; }
  window.netlifyIdentity.on('init', function (user) {
    if (user) load(user);
    else { state.className = 'inventory-login'; state.replaceChildren(element('p', 'Entre com a conta de administrador do Netlify Identity.')); const button = element('button', 'Entrar'); button.onclick = function () { window.netlifyIdentity.open('login'); }; state.appendChild(button); }
  });
  window.netlifyIdentity.on('login', function (user) { load(user); });
})();
