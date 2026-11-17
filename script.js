const API = '/api';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatPrice = value => new Intl.NumberFormat('fa-IR').format(Number(value) || 0) + ' تومان';
const faNumber = value => new Intl.NumberFormat('fa-IR').format(Number(value) || 0);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let products = [];
let activeCategory = 'همه';
let cart = [];
let currentUser = null;
let selectedProductId = null;
let toastTimer;

try { cart = JSON.parse(localStorage.getItem('vitrin-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
const token = () => localStorage.getItem('vitrin-token') || '';

async function api(path, options = {}) {
  const headers = { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(token() ? {Authorization:`Bearer ${token()}`} : {}), ...(options.headers || {}) };
  let response;
  try { response = await fetch(`${API}${path}`, {...options, headers}); }
  catch { throw new Error('ارتباط با سرور برقرار نشد. اتصال اینترنت یا وضعیت سرور را بررسی کن.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'درخواست انجام نشد.');
  return data;
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function saveCart() { localStorage.setItem('vitrin-cart', JSON.stringify(cart)); updateCart(); }
function stars(n) { const rounded = Math.round(Number(n) || 0); return '★'.repeat(rounded) + '☆'.repeat(5-rounded); }
function imageSrc(src) { const value=String(src || 'assets/vase.svg'); return escapeHTML((value.startsWith('assets/') && !value.includes('..')) || /^https:\/\//i.test(value) ? value : 'assets/vase.svg'); }

async function loadProducts() {
  $('#productGrid').innerHTML = '<div class="loading-state">در حال دریافت محصولات…</div>';
  try { products = await api('/products'); renderProducts(); }
  catch (error) { $('#productGrid').innerHTML = `<div class="loading-state error-state">${escapeHTML(error.message)}<button class="panel-action" id="retryProducts">تلاش دوباره</button></div>`; $('#retryProducts')?.addEventListener('click', loadProducts); }
}
function renderProducts() {
  const term = $('#searchInput').value.trim().toLocaleLowerCase('fa');
  const filtered = products.filter(p => (activeCategory === 'همه' || p.category === activeCategory) && (`${p.name} ${p.category}`.toLocaleLowerCase('fa').includes(term)));
  $('#productGrid').innerHTML = filtered.map(p => `
    <article class="product-card">
      <div class="product-photo" data-open-product="${p.id}" role="button" tabindex="0" aria-label="مشاهده جزئیات ${escapeHTML(p.name)}">
        <img src="${imageSrc(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/vase.svg'">
        ${p.oldPrice ? `<span class="discount">پیشنهاد ویژه</span>` : ''}<button class="favorite" data-favorite="${p.id}" aria-label="افزودن به علاقه‌مندی‌ها">♡</button>
      </div>
      <div class="product-info"><span class="product-category">${escapeHTML(p.category)}</span><h3><button class="product-title-button" data-open-product="${p.id}">${escapeHTML(p.name)}</button></h3>
        <div class="product-rating-mini"><span>${stars(p.rating || 0)}</span><small>${p.review_count ? `${faNumber(p.review_count)} نظر` : 'هنوز نظری ثبت نشده'}</small></div>
        <div class="product-bottom"><div>${p.oldPrice ? `<span class="old-price">${faNumber(p.oldPrice)}</span>` : ''}<span class="price">${faNumber(p.price)} <small>تومان</small></span></div><button class="add-cart" data-add="${p.id}" aria-label="افزودن ${escapeHTML(p.name)} به سبد خرید">+</button></div>
      </div>
    </article>`).join('');
  $('#emptyState').hidden = filtered.length !== 0;
}
function addToCart(id) {
  const p = products.find(x => Number(x.id) === Number(id)); if (!p) return;
  const existing = cart.find(x => Number(x.id) === Number(id));
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1); else cart.push({...p, quantity:1});
  saveCart(); showToast('محصول به سبد خرید اضافه شد.');
}
function updateCart() {
  const count = cart.reduce((sum,x) => sum + x.quantity,0);
  const total = cart.reduce((sum,x) => sum + x.price*x.quantity,0);
  $('#cartCount').textContent = faNumber(count); $('#dockCartCount').textContent = faNumber(count); $('#cartTotal').textContent = formatPrice(total);
  $('#cartItems').innerHTML = cart.length ? cart.map(x => `<div class="cart-line"><img src="${imageSrc(x.image)}" alt=""><div><strong>${escapeHTML(x.name)}</strong><small>${faNumber(x.quantity)} × ${formatPrice(x.price)}</small><div class="quantity-actions"><button data-qty="-1" data-id="${x.id}" aria-label="کاهش تعداد">−</button><b>${faNumber(x.quantity)}</b><button data-qty="1" data-id="${x.id}" aria-label="افزایش تعداد">+</button></div></div><button data-remove="${x.id}" aria-label="حذف محصول">×</button></div>`).join('') : '<p class="cart-empty">سبد خریدت هنوز خالی است.</p>';
  localStorage.setItem('vitrin-cart', JSON.stringify(cart));
}
function openCart() { $('#cartOverlay').classList.add('open'); document.body.classList.add('modal-open'); }
function closeCart() { $('#cartOverlay').classList.remove('open'); document.body.classList.remove('modal-open'); }

function openPanel(title, html) { $('#panelTitle').textContent = title; $('#panelBody').innerHTML = html; $('#panelOverlay').classList.add('open'); $('#panelOverlay').setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closePanel() { $('#panelOverlay').classList.remove('open'); $('#panelOverlay').setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); }
async function refreshUser() {
  if (!token()) { currentUser = null; updateAccountButton(); return; }
  try { currentUser = await api('/auth/me'); } catch { localStorage.removeItem('vitrin-token'); currentUser = null; }
  updateAccountButton();
}
function updateAccountButton() { $('#accountButton').innerHTML = currentUser ? `♙ <span>${escapeHTML(currentUser.name)}</span>` : '♙ <span>ورود / حساب کاربری</span>'; }
function accountPanel() {
  if (currentUser) {
    openPanel('حساب کاربری', `<div class="account-welcome"><span class="eyebrow">خوش آمدی</span><h3>${escapeHTML(currentUser.name)}</h3><p>${escapeHTML(currentUser.email)}</p><span class="role-chip">${currentUser.role === 'admin' ? 'مدیر فروشگاه' : 'مشتری ویترین'}</span></div><div class="panel-card"><button class="panel-action" id="myOrdersButton">مشاهده سفارش‌های من</button><button class="panel-action danger-action" id="logoutButton">خروج از حساب</button></div>`);
    $('#myOrdersButton').addEventListener('click', showMyOrders); $('#logoutButton').addEventListener('click', () => { localStorage.removeItem('vitrin-token'); currentUser=null; updateAccountButton(); closePanel(); showToast('از حساب خارج شدی.'); });
    return;
  }
  openPanel('ورود یا ساخت حساب', `<div class="auth-tabs"><button class="auth-tab active" data-auth-tab="login">ورود</button><button class="auth-tab" data-auth-tab="register">ثبت‌نام</button></div><form id="authForm" class="stack-form"><div id="authNameWrap" hidden><label>نام و نام خانوادگی<input name="name" maxlength="80" autocomplete="name"></label></div><label>ایمیل<input name="email" type="email" required autocomplete="email" placeholder="name@example.com"></label><label>گذرواژه<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="current-password" placeholder="حداقل ۸ نویسه"></label><p class="form-message" id="authMessage">برای ثبت سفارش و نوشتن نظر، وارد حساب کاربری شو.</p><button class="primary-btn" type="submit" id="authSubmit">ورود</button></form>`);
  let mode = 'login';
  $$('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => { mode=btn.dataset.authTab; $$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===btn)); $('#authNameWrap').hidden=mode!=='register'; $('#authSubmit').textContent=mode==='login'?'ورود':'ساخت حساب'; $('#authMessage').textContent=mode==='login'?'اطلاعات ورودت را وارد کن.':'با ایمیل و گذرواژه حساب بساز.'; }));
  $('#authForm').addEventListener('submit', async e => { e.preventDefault(); const fd=new FormData(e.currentTarget); const body=Object.fromEntries(fd.entries()); const button=$('#authSubmit'); button.disabled=true; button.textContent='در حال بررسی…'; try { const result=await api(`/auth/${mode}`,{method:'POST',body:JSON.stringify(body)}); localStorage.setItem('vitrin-token',result.token); currentUser=result.user; updateAccountButton(); closePanel(); showToast(mode==='login'?'با موفقیت وارد شدی.':'حساب کاربری ساخته شد.'); } catch(err) { $('#authMessage').textContent=err.message; } finally { button.disabled=false; button.textContent=mode==='login'?'ورود':'ساخت حساب'; } });
}

async function openProductDetails(id) {
  selectedProductId=Number(id); $('#productDetailOverlay').classList.add('open'); document.body.classList.add('modal-open'); $('#productDetailContent').innerHTML='<div class="loading-state">در حال دریافت جزئیات محصول…</div>';
  try {
    const [p,reviews]=await Promise.all([api(`/products/${id}`),api(`/products/${id}/reviews`)]);
    const avg=Number(p.rating)||0;
    $('#productDetailContent').innerHTML=`<div class="detail-layout"><div class="detail-gallery"><img class="detail-main-image" src="${imageSrc(p.image)}" alt="${escapeHTML(p.name)}" onerror="this.onerror=null;this.src='assets/vase.svg'"><div class="gallery-caption">تصویر محصول</div></div><div class="detail-summary"><span class="product-category">${escapeHTML(p.category)}</span><h2>${escapeHTML(p.name)}</h2><div class="detail-rating"><span>${stars(avg)}</span><b>${avg ? faNumber(avg.toFixed(1)) : '—'}</b><small>بر اساس ${faNumber(reviews.length)} نظر</small></div><p>${escapeHTML(p.description || 'توضیحات این محصول هنوز تکمیل نشده است.')}</p><ul class="detail-specs"><li>مشخصات: ${escapeHTML(p.specifications || 'ثبت نشده')}</li><li>ابعاد: ${escapeHTML(p.dimensions || 'ثبت نشده')}</li><li>رنگ: ${escapeHTML(p.color || 'ثبت نشده')}</li><li>موجودی: ${faNumber(p.stock)} عدد</li><li>شناسه محصول: VT-${String(p.id).padStart(4,'0')}</li></ul><div class="detail-price">${formatPrice(p.price)}</div><button class="primary-btn detail-add" data-detail-add="${p.id}" ${p.stock<1?'disabled':''}>${p.stock<1?'ناموجود':'افزودن به سبد خرید'} <span>←</span></button></div></div>
      <section class="reviews-section"><div class="reviews-heading"><div><span class="eyebrow">تجربه خریداران</span><h3>نظرات و امتیازها</h3></div><span class="review-count">${faNumber(reviews.length)} نظر</span></div>
      <div class="review-list">${reviews.length ? reviews.map(r=>`<article class="review-card"><div class="review-user"><div class="review-avatar">${r.photo?`<img src="${escapeHTML(r.photo)}" alt="عکس ثبت‌شده توسط خریدار">`:escapeHTML((r.name||'م').slice(0,1))}</div><div><strong>${escapeHTML(r.name)}</strong><small>${r.verified?'<span class="verified-buyer">✓ خرید تأییدشده</span>':'نظر مشتری'}</small></div><span class="review-stars">${stars(r.rating)}</span></div><p>${escapeHTML(r.text)}</p>${r.photo?`<img class="review-customer-photo" src="${escapeHTML(r.photo)}" alt="تصویر محصول خریداری‌شده">`:''}</article>`).join('') : '<p class="cart-empty">هنوز نظری برای این محصول ثبت نشده است. اولین نفر باش!</p>'}</div>
      <form id="reviewForm" class="review-form"><h3>نظر خودت را ثبت کن</h3><p class="review-help">برای ثبت نظر باید وارد حساب کاربری شوی. نشان «خرید تأییدشده» فقط پس از تحویل سفارش در حساب همان مشتری نمایش داده می‌شود.</p><label>امتیاز شما<select name="rating"><option value="5">۵ - عالی</option><option value="4">۴ - خوب</option><option value="3">۳ - متوسط</option><option value="2">۲ - ضعیف</option><option value="1">۱ - خیلی ضعیف</option></select></label><label class="review-wide">متن نظر<textarea name="text" required minlength="5" maxlength="1000" rows="3" placeholder="تجربه‌ات از این محصول را بنویس…"></textarea></label><label class="review-wide">عکس محصول (اختیاری)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><span class="upload-hint">حداکثر ۷۰۰ کیلوبایت؛ فرمت JPG، PNG یا WebP</span></label><div class="review-wide" id="reviewPhotoPreview"></div><button class="primary-btn review-wide" type="submit">ثبت نظر و امتیاز</button></form></section>`;
    $('#reviewForm').addEventListener('submit', submitReview);
    $('input[type="file"]','#reviewForm').addEventListener('change', previewReviewPhoto);
  } catch(err) { $('#productDetailContent').innerHTML=`<div class="loading-state error-state">${escapeHTML(err.message)}</div>`; }
}
function closeProductDetails() { $('#productDetailOverlay').classList.remove('open'); document.body.classList.remove('modal-open'); }
function readImage(file) { return new Promise((resolve,reject)=>{ if(!file || !file.size)return resolve(null); if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>700*1024)return reject(new Error('عکس باید JPG، PNG یا WebP و حداکثر ۷۰۰ کیلوبایت باشد.')); const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error('خواندن عکس ممکن نشد.')); reader.readAsDataURL(file); }); }
async function previewReviewPhoto(e) { try { const value=await readImage(e.target.files[0]); $('#reviewPhotoPreview').innerHTML=value?`<img class="review-upload-preview" src="${value}" alt="پیش‌نمایش عکس">`:''; } catch(err){e.target.value='';showToast(err.message);} }
async function submitReview(e) {
  e.preventDefault(); if(!currentUser){closeProductDetails();accountPanel();showToast('برای ثبت نظر ابتدا وارد حساب کاربری شو.');return;}
  const form=e.currentTarget, data=new FormData(form), button=$('button[type="submit"]',form); button.disabled=true;
  try { const photo=await readImage(data.get('photo')); await api(`/products/${selectedProductId}/reviews`,{method:'POST',body:JSON.stringify({rating:Number(data.get('rating')),text:data.get('text'),photo})}); showToast('نظر تو با موفقیت ثبت شد.'); await openProductDetails(selectedProductId); await loadProducts(); }
  catch(err){showToast(err.message);} finally {button.disabled=false;}
}

function checkoutPanel() {
  if(!cart.length){showToast('سبد خرید خالی است.');return;}
  if(!currentUser){closeCart();accountPanel();showToast('برای ثبت سفارش ابتدا وارد حساب کاربری شو.');return;}
  const total=cart.reduce((s,x)=>s+x.price*x.quantity,0);
  closeCart(); openPanel('تکمیل اطلاعات سفارش',`<div class="checkout-summary"><strong>جمع سفارش: ${formatPrice(total)}</strong><small>روش پرداخت: پرداخت در محل هنگام تحویل</small></div><form id="checkoutForm" class="stack-form"><label>نام گیرنده<input name="customerName" required maxlength="100" value="${escapeHTML(currentUser.name)}"></label><label>شماره تماس<input name="phone" required maxlength="20" inputmode="tel" placeholder="0912…"></label><label>نشانی کامل<textarea name="address" required minlength="10" maxlength="1000" rows="3" placeholder="استان، شهر، خیابان، پلاک و واحد"></textarea></label><label>کد پستی (اختیاری)<input name="postalCode" maxlength="20" inputmode="numeric"></label><p class="form-message">این نسخه پرداخت بانکی آنلاین ندارد. سفارش با روش پرداخت در محل ثبت می‌شود.</p><button class="primary-btn" type="submit">ثبت نهایی سفارش</button></form>`);
  $('#checkoutForm').addEventListener('submit',async e=>{e.preventDefault();const button=$('button[type="submit"]',e.currentTarget);button.disabled=true;const fd=new FormData(e.currentTarget);try{const result=await api('/orders',{method:'POST',body:JSON.stringify({customerName:fd.get('customerName'),phone:fd.get('phone'),address:fd.get('address'),postalCode:fd.get('postalCode'),items:cart.map(x=>({id:x.id,quantity:x.quantity}))})});cart=[];saveCart();closePanel();showToast(`سفارش شماره ${faNumber(result.id)} ثبت شد.`);showMyOrders();}catch(err){showToast(err.message);button.disabled=false;}});
}
async function showMyOrders() {
  if(!currentUser){accountPanel();return;}
  openPanel('سفارش‌های من','<div class="loading-state">در حال دریافت سفارش‌ها…</div>');
  try {const orders=await api('/orders/my');$('#panelBody').innerHTML=orders.length?orders.map(o=>`<article class="order-card"><div class="order-card-head"><strong>سفارش #${faNumber(o.id)}</strong><span class="status-pill status-${o.status}">${statusLabel(o.status)}</span></div><small>${new Date(o.created_at).toLocaleDateString('fa-IR')}</small><ul>${o.items.map(i=>`<li>${escapeHTML(i.name)} × ${faNumber(i.quantity)}</li>`).join('')}</ul><b>${formatPrice(o.total)}</b><small>پرداخت در محل · ${o.payment_status==='unpaid'?'پرداخت‌نشده':'پرداخت‌شده'}</small></article>`).join(''):'<p class="cart-empty">هنوز سفارشی ثبت نکرده‌ای.</p>';}catch(err){$('#panelBody').innerHTML=`<p class="form-message">${escapeHTML(err.message)}</p>`;}
}
function statusLabel(status){return ({pending:'در انتظار تأیید',processing:'در حال آماده‌سازی',shipped:'ارسال‌شده',delivered:'تحویل‌شده',cancelled:'لغوشده'})[status]||status;}

async function showManagement() {
  if(!currentUser || currentUser.role!=='admin'){openPanel('مدیریت فروشگاه','<p class="form-message">این قسمت مخصوص مدیر فروشگاه است. برای دسترسی، با حساب مدیر وارد شو.</p><button class="primary-btn" id="adminLoginBtn">ورود به حساب مدیر</button>');$('#adminLoginBtn').addEventListener('click',accountPanel);return;}
  openPanel('مدیریت فروشگاه','<div class="loading-state">در حال دریافت اطلاعات…</div>');
  try {const [summary,allProducts,orders]=await Promise.all([api('/admin/summary'),api('/products'),api('/admin/orders')]);
    $('#panelBody').innerHTML=`<div class="admin-stats"><div><b>${faNumber(summary.products)}</b><small>محصول فعال</small></div><div><b>${faNumber(summary.orders)}</b><small>سفارش</small></div><div><b>${faNumber(summary.customers)}</b><small>مشتری</small></div><div><b>${faNumber(summary.reviews)}</b><small>نظر</small></div></div>
      <div class="admin-section"><h3>افزودن محصول</h3><form id="addProductForm" class="admin-product-form"><label>نام محصول<input name="name" required maxlength="180"></label><label>دسته‌بندی<select name="category"><option>خانه و دکور</option><option>دیجیتال</option><option>مد و پوشاک</option><option>اکسسوری</option></select></label><label>قیمت (تومان)<input name="price" type="number" min="1" required></label><label>موجودی<input name="stock" type="number" min="0" value="1"></label><label class="full-field">نشانی تصویر (URL یا مسیر assets)<input name="image" placeholder="assets/vase.svg"></label><label class="full-field">توضیحات<textarea name="description" rows="2"></textarea></label><label class="full-field">مشخصات<input name="specifications"></label><button class="primary-btn full-field" type="submit">افزودن محصول</button></form></div>
      <div class="admin-section"><h3>محصولات</h3><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>محصول</th><th>قیمت</th><th>موجودی</th><th>عملیات</th></tr></thead><tbody>${allProducts.map(p=>`<tr><td>${escapeHTML(p.name)}</td><td>${faNumber(p.price)}</td><td>${faNumber(p.stock)}</td><td><button class="panel-action" data-edit-product="${p.id}">ویرایش</button> <button class="table-danger" data-delete-product="${p.id}">حذف از نمایش</button></td></tr>`).join('')}</tbody></table></div></div>
      <div class="admin-section"><h3>سفارش‌های اخیر</h3>${orders.length?orders.map(o=>`<article class="order-card"><div class="order-card-head"><strong>#${faNumber(o.id)} · ${escapeHTML(o.customer_name)}</strong><span>${statusLabel(o.status)}</span></div><small>${escapeHTML(o.phone)} · ${formatPrice(o.total)}</small><p>${escapeHTML(o.address)}</p><div class="order-admin-actions"><select data-order-status="${o.id}"><option value="pending" ${o.status==='pending'?'selected':''}>در انتظار تأیید</option><option value="processing" ${o.status==='processing'?'selected':''}>در حال آماده‌سازی</option><option value="shipped" ${o.status==='shipped'?'selected':''}>ارسال‌شده</option><option value="delivered" ${o.status==='delivered'?'selected':''}>تحویل‌شده</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>لغوشده</option></select><button class="panel-action" data-save-status="${o.id}">ذخیره وضعیت</button></div></article>`).join(''):'<p class="cart-empty">هنوز سفارشی ثبت نشده است.</p>'}</div>`;
    $('#addProductForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const body=Object.fromEntries(fd.entries());body.price=Number(body.price);body.stock=Number(body.stock);try{await api('/admin/products',{method:'POST',body:JSON.stringify(body)});showToast('محصول اضافه شد.');await loadProducts();await showManagement();}catch(err){showToast(err.message);}});
    $('#panelBody').onclick=async e=>{const edit=e.target.closest('[data-edit-product]');if(edit){const p=allProducts.find(x=>Number(x.id)===Number(edit.dataset.editProduct));if(p)editProductPanel(p);return;}const del=e.target.closest('[data-delete-product]');if(del){if(!confirm('این محصول از فروشگاه پنهان شود؟'))return;try{await api(`/admin/products/${del.dataset.deleteProduct}`,{method:'DELETE'});await loadProducts();await showManagement();showToast('محصول از نمایش فروشگاه خارج شد.');}catch(err){showToast(err.message);}}const save=e.target.closest('[data-save-status]');if(save){const id=save.dataset.saveStatus;const status=$(`[data-order-status="${id}"]`).value;try{await api(`/admin/orders/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});showToast('وضعیت سفارش به‌روزرسانی شد.');await showManagement();}catch(err){showToast(err.message);}}};
  }catch(err){$('#panelBody').innerHTML=`<p class="form-message">${escapeHTML(err.message)}</p>`;}
}

function editProductPanel(p) {
  openPanel('ویرایش محصول', `<form id="editProductForm" class="admin-product-form">
    <label>نام محصول<input name="name" required maxlength="180" value="${escapeHTML(p.name)}"></label>
    <label>دسته‌بندی<select name="category">${['خانه و دکور','دیجیتال','مد و پوشاک','اکسسوری'].map(c=>`<option ${p.category===c?'selected':''}>${c}</option>`).join('')}</select></label>
    <label>قیمت (تومان)<input name="price" type="number" min="1" required value="${p.price}"></label>
    <label>قیمت قبلی (اختیاری)<input name="oldPrice" type="number" min="0" value="${p.oldPrice||''}"></label>
    <label>موجودی<input name="stock" type="number" min="0" required value="${p.stock}"></label>
    <label class="full-field">نشانی تصویر<input name="image" value="${escapeHTML(p.image||'assets/vase.svg')}"></label>
    <label class="full-field">توضیحات<textarea name="description" rows="2">${escapeHTML(p.description||'')}</textarea></label>
    <label>مشخصات<input name="specifications" value="${escapeHTML(p.specifications||'')}"></label>
    <label>ابعاد<input name="dimensions" value="${escapeHTML(p.dimensions||'')}"></label>
    <label>رنگ<input name="color" value="${escapeHTML(p.color||'')}"></label>
    <button class="primary-btn full-field" type="submit">ذخیره تغییرات</button>
  </form>`);
  $('#editProductForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const body=Object.fromEntries(fd.entries());for(const k of ['price','oldPrice','stock'])body[k]=body[k]===''?null:Number(body[k]);try{await api(`/admin/products/${p.id}`,{method:'PUT',body:JSON.stringify(body)});showToast('تغییرات محصول ذخیره شد.');await loadProducts();await showManagement();}catch(err){showToast(err.message);}});
}

function showSettings() {openPanel('تنظیمات فروشگاه',`<div class="panel-body-grid"><div class="panel-card"><h3>ظاهر فروشگاه</h3><p>قالب سبز زیتونی و کرم</p><button class="panel-action" id="compactToggle">تغییر تراکم نمایش محصولات</button></div><div class="panel-card"><h3>وضعیت حساب</h3><p>${currentUser?`واردشده به‌عنوان ${escapeHTML(currentUser.name)}`:'مهمان'}</p></div><div class="panel-card"><h3>وضعیت سرویس</h3><p id="serviceStatus">در حال بررسی اتصال…</p></div><div class="panel-card"><h3>نسخه پروژه</h3><p>Vitrin Store · نسخه ۲</p></div></div>`);$('#compactToggle').addEventListener('click',()=>{document.body.classList.toggle('compact-products');showToast('تراکم نمایش تغییر کرد.');});api('/health').then(x=>$('#serviceStatus').textContent=`API متصل · پایگاه داده ${x.database==='connected'?'متصل':'قطع'}`).catch(()=>$('#serviceStatus').textContent='اتصال برقرار نیست');}

const infoPages={contact:{title:'ارتباط با ویترین',subtitle:'راه‌های ارتباطی فروشگاه',html:'<div class="info-card"><h3>پشتیبانی مشتریان</h3><p>شماره تلفن، نشانی و ایمیل رسمی پس از تأیید مالک فروشگاه در این بخش قرار می‌گیرد.</p><p>از ثبت اطلاعات تماس ساختگی برای فروشگاه واقعی خودداری کن.</p></div>'},help:{title:'راهنمای خرید',subtitle:'چطور از ویترین خرید کنم؟',html:'<div class="info-card"><h3>مراحل خرید</h3><ol><li>محصول را انتخاب و جزئیات آن را بررسی کن.</li><li>آن را به سبد خرید اضافه کن.</li><li>وارد حساب کاربری شو یا حساب بساز.</li><li>نشانی و شماره تماس را وارد و سفارش را ثبت کن.</li><li>در این نسخه پرداخت هنگام تحویل انجام می‌شود.</li></ol></div>'},shipping:{title:'ارسال و بازگشت',subtitle:'اطلاعات شفاف برای خرید مطمئن',html:'<div class="info-card"><h3>ارسال سفارش</h3><p>روش‌ها، هزینه و زمان ارسال باید با سیاست واقعی فروشگاه جایگزین شوند.</p><h3>بازگشت کالا</h3><p>مهلت و شرایط مرجوعی باید پیش از شروع فروش توسط مالک فروشگاه تعیین و در این صفحه درج شود.</p></div>'}};
function showInfoPage(key){const page=infoPages[key];if(!page)return;$('#mainContent').hidden=true;$('#infoPage').hidden=false;$('#infoTitle').textContent=page.title;$('#infoSubtitle').textContent=page.subtitle;$('#infoContent').innerHTML=page.html;window.scrollTo({top:0,behavior:'smooth'});}
function showHome(){ $('#mainContent').hidden=false;$('#infoPage').hidden=true;window.scrollTo({top:0,behavior:'smooth'}); }

// Delegated interactions keep the UI functional after dynamic rendering.
document.addEventListener('click', e=>{
  const open=e.target.closest('[data-open-product]'); if(open){openProductDetails(open.dataset.openProduct);return;}
  const add=e.target.closest('[data-add]'); if(add){addToCart(add.dataset.add);return;}
  const filter=e.target.closest('[data-filter]'); if(filter){activeCategory=filter.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===filter));renderProducts();return;}
  const category=e.target.closest('[data-category]'); if(category){activeCategory=category.dataset.category;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter===activeCategory));renderProducts();$('#products').scrollIntoView({behavior:'smooth'});return;}
  const page=e.target.closest('[data-page]'); if(page){e.preventDefault();showInfoPage(page.dataset.page);return;}
  const dock=e.target.closest('[data-dock]'); if(dock){$$('.dock-item').forEach(x=>x.classList.toggle('active',x===dock));({home:showHome,cart:openCart,orders:showMyOrders,manage:showManagement,settings:showSettings})[dock.dataset.dock]?.();return;}
  if(e.target.closest('#cartButton'))openCart();
});
$('#productGrid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open-product]')){e.preventDefault();openProductDetails(e.target.dataset.openProduct);}});
$('#productGrid').addEventListener('click',e=>{const fav=e.target.closest('[data-favorite]');if(fav){e.stopPropagation();fav.classList.toggle('selected');showToast(fav.classList.contains('selected')?'به علاقه‌مندی‌ها اضافه شد.':'از علاقه‌مندی‌ها حذف شد.');}});
$('#searchBox').addEventListener('submit',e=>{e.preventDefault();renderProducts();$('#products').scrollIntoView({behavior:'smooth'});});
$('#searchInput').addEventListener('input',renderProducts);
$('#cartItems').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');if(remove){cart=cart.filter(x=>Number(x.id)!==Number(remove.dataset.remove));saveCart();return;}const qty=e.target.closest('[data-qty]');if(qty){const item=cart.find(x=>Number(x.id)===Number(qty.dataset.id));if(item){item.quantity+=Number(qty.dataset.qty);if(item.quantity<=0)cart=cart.filter(x=>x!==item);if(item.quantity>20)item.quantity=20;saveCart();}}});
$('#accountButton').addEventListener('click',accountPanel);
$('#closeCart').addEventListener('click',closeCart);$('#cartOverlay').addEventListener('click',e=>{if(e.target===$('#cartOverlay'))closeCart();});
$('#checkoutButton').addEventListener('click',checkoutPanel);
$('#closePanel').addEventListener('click',closePanel);$('#panelOverlay').addEventListener('click',e=>{if(e.target===$('#panelOverlay'))closePanel();});
$('#closeProductDetail').addEventListener('click',closeProductDetails);$('#productDetailOverlay').addEventListener('click',e=>{if(e.target===$('#productDetailOverlay'))closeProductDetails();});
$('#productDetailContent').addEventListener('click',e=>{const add=e.target.closest('[data-detail-add]');if(add)addToCart(add.dataset.detailAdd);});
$('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();showToast('این بخش پس از اتصال سرویس خبرنامه فعال می‌شود.');e.currentTarget.reset();});
$('#menuToggle').addEventListener('click',()=>{ $('#mainNav').classList.toggle('menu-open'); $('#searchBox').classList.toggle('mobile-visible'); });
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanel();closeCart();closeProductDetails();}});

(async function start(){updateCart();await refreshUser();await loadProducts();})();
