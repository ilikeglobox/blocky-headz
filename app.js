async function loadProducts(){
  const grid=document.getElementById('product-grid');
  const empty=document.getElementById('empty-state');
  const filters=document.getElementById('filters');
  try{
    const res=await fetch('/content/products.json',{cache:'no-store'});
    if(!res.ok) throw new Error('Não foi possível carregar o catálogo');
    const data=await res.json();
    const products=Array.isArray(data.products)?data.products:[];
    const categories=['Todos',...new Set(products.map(p=>p.category).filter(Boolean))];
    filters.innerHTML=categories.map((c,i)=>`<button class="filter ${i===0?'active':''}" data-category="${escapeHtml(c)}">${escapeHtml(c==='Todos'?'Todos os produtos':c)}</button>`).join('');
    function render(category='Todos'){
      const shown=products.filter(p=>category==='Todos'||p.category===category);
      grid.innerHTML=shown.map(p=>{
        const image=p.image?`<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name||'Produto Brick-Headz')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`:'';
        const safeUrl=safeExternalUrl(p.marketplace_url);
        return `<article class="product-card"><div class="product-image">${image}<div class="product-placeholder" style="display:${p.image?'none':'flex'}">BH<span style="color:#ec3027">✳</span></div>${p.tag?`<span class="product-tag">${escapeHtml(p.tag)}</span>`:''}</div><div class="product-info"><span class="product-category">${escapeHtml(p.category||'Colecionáveis')}</span><h3>${escapeHtml(p.name||'Produto Brick-Headz')}</h3><p class="product-description">${escapeHtml(p.description||'Um novo achado para sua coleção.')}</p>${p.price?`<div class="product-price">${escapeHtml(p.price)}</div>`:''}<a class="buy-link" href="${safeUrl||'#'}" ${safeUrl?'target="_blank" rel="noopener noreferrer"':'aria-disabled="true" onclick="return false"'}>COMPRAR NO MERCADO LIVRE <span>↗</span></a></div></article>`;
      }).join('');
      empty.hidden=shown.length>0;
    }
    filters.addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;filters.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));render(b.dataset.category)});
    render();
  }catch(e){grid.innerHTML='';empty.hidden=false;empty.textContent='Não foi possível carregar a vitrine agora.'}
}
function safeExternalUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(s){return escapeHtml(s)}
document.getElementById('year').textContent=new Date().getFullYear();
loadProducts();
