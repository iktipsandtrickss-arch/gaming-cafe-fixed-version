const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let adminData = { settings: {}, setups: [], menu: [], passes: [], bookings: [] };
const imageValues = {};
function esc(value = '') { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function money(value) { return '৳ ' + Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 }); }
function minutesLabel(n) { n = Number(n); return n < 60 ? `${n} min` : `${Math.floor(n/60)} hr${Math.floor(n/60)>1?'s':''}${n%60?` ${n%60} min`:''}`; }
function showGlobalMessage(message, isError = false) {
  const el = $('#global-message'); el.textContent = message; el.classList.remove('hidden','error'); if (isError) el.classList.add('error');
  window.scrollTo({ top: Math.min(180, document.documentElement.scrollHeight), behavior: 'smooth' });
  window.setTimeout(() => el.classList.add('hidden'), 6500);
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) { if (response.status === 401) showLogin(); throw new Error(data.error || 'Something went wrong.'); }
  return data;
}
function showLogin() {
  $('#dashboard').classList.add('hidden'); $('#login-panel').classList.remove('hidden'); $('#logout-button').classList.add('hidden');
}
function showDashboard() {
  $('#login-panel').classList.add('hidden'); $('#dashboard').classList.remove('hidden'); $('#logout-button').classList.remove('hidden');
}
function activateTab(tab) {
  $$('.tab-button').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  $$('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `tab-${tab}`));
}
$$('.tab-button').forEach(button => button.addEventListener('click', () => activateTab(button.dataset.tab)));

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const message = $('#login-message'); message.textContent = 'Signing in…';
  try { await api('/api/admin/login', { method:'POST', body: JSON.stringify({ password: $('#admin-password').value }) }); $('#admin-password').value = ''; await loadDashboard(); showDashboard(); message.textContent = ''; }
  catch (error) { message.textContent = error.message; }
});
$('#logout-button').addEventListener('click', async () => { try { await api('/api/admin/logout', { method:'POST', body:'{}' }); } catch (_) {} showLogin(); });

async function loadDashboard() {
  const data = await api('/api/admin/data'); adminData = data;
  renderMetrics(); hydrateSettings(); renderBookings(); renderSetups(); renderMenu(); renderComboPasses();
}
function renderMetrics() {
  const bookings = adminData.bookings || [];
  $('#metric-bookings').textContent = bookings.length;
  $('#metric-pending').textContent = bookings.filter(b => b.status === 'pending').length;
  const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const revenue = bookings.filter(b => b.booking_date === today && b.status === 'confirmed').reduce((sum, b) => sum + Number(b.amount || 0), 0);
  $('#metric-revenue').textContent = money(revenue);
  $('#metric-setups').textContent = adminData.setups.filter(s => s.active && !s.coming_soon).length;
  $('#booking-count').textContent = bookings.length;
  $('#admin-title').innerHTML = `${esc(adminData.settings.brand_name || 'Your cafe')}, <span>your call.</span>`;
}
function hydrateSettings() {
  const form = $('#settings-form'); const settings = adminData.settings || {};
  $$('[name]', form).forEach(input => {
    const key = input.name;
    if (['logo_image','hero_image','hero_game_one','hero_game_two'].includes(key)) {
      const value = settings[key] || '';
      imageValues[key] = value;
      input.value = value.startsWith('data:image/') ? '' : value;
      input.placeholder = value.startsWith('data:image/') ? 'Uploaded image saved in database' : 'Image URL or upload a file';
    } else if (key in settings) input.value = settings[key];
  });
  updatePreview('logo_image', settings.logo_image, '#logo-preview');
  updatePreview('hero_image', settings.hero_image, '#hero-preview');
  updatePreview('hero_game_one', settings.hero_game_one, '#game-one-preview');
  updatePreview('hero_game_two', settings.hero_game_two, '#game-two-preview');
}
function updatePreview(key, value, selector) {
  const img = $(selector); if (value) { img.src = value; img.classList.remove('hidden'); } else { img.removeAttribute('src'); img.classList.remove('hidden'); }
}
async function imageFileToDataUrl(file, maxWidth = 1400) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose a valid image file.');
  const original = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the image file.')); reader.readAsDataURL(file); });
  const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('That image could not be opened.')); image.src = original; });
  const ratio = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * ratio)); canvas.height = Math.max(1, Math.round(img.height * ratio));
  const context = canvas.getContext('2d'); context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const output = canvas.toDataURL('image/webp', 0.82);
  if (output.length > 5_300_000) throw new Error('Image is still too large. Try a smaller image.');
  return output;
}
// Branding image uploads. Actual image bytes are stored in the database, not in a temporary upload folder.
$$('input[type="file"][data-target]').forEach(fileInput => fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0]; if (!file) return;
  const key = fileInput.dataset.target;
  try {
    const dataUrl = await imageFileToDataUrl(file, key === 'logo_image' ? 700 : 1400);
    if (['logo_image','hero_image','hero_game_one','hero_game_two'].includes(key)) {
      imageValues[key] = dataUrl;
      const field = $(`#${key.replaceAll('_','-')}-url`);
      if (field) { field.value = ''; field.placeholder = 'New uploaded image selected — save settings to apply'; }
      const previewSelector = {'logo_image':'#logo-preview','hero_image':'#hero-preview','hero_game_one':'#game-one-preview','hero_game_two':'#game-two-preview'}[key];
      updatePreview(key, dataUrl, previewSelector);
    } else {
      const form = fileInput.closest('form');
      form.dataset.imageValue = dataUrl;
      const urlField = $('[name="image_url"]', form); if (urlField) { urlField.value = ''; urlField.placeholder = 'New uploaded image selected — save to apply'; }
      const preview = $('.edit-image-preview', form); if (preview) preview.src = dataUrl;
    }
  } catch (error) { showGlobalMessage(error.message, true); }
  fileInput.value = '';
}));
$$('#settings-form input[name="logo_image"], #settings-form input[name="hero_image"], #settings-form input[name="hero_game_one"], #settings-form input[name="hero_game_two"]').forEach(input => input.addEventListener('input', () => {
  imageValues[input.name] = input.value.trim();
  const previewSelector = {'logo_image':'#logo-preview','hero_image':'#hero-preview','hero_game_one':'#game-one-preview','hero_game_two':'#game-two-preview'}[input.name];
  updatePreview(input.name, input.value.trim(), previewSelector);
}));
$$('.clear-image').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.clear;
  const defaults = { hero_image: 'https://www.respawncafebd.com/assets/hero-gamers-bg.png', hero_game_one: '/static/images/fc26-poster.jpg', hero_game_two: '/static/images/spiderman-poster.jpg', logo_image: '' };
  const value = defaults[key] ?? '';
  imageValues[key] = value;
  const field = $(`#${key.replaceAll('_','-')}-url`); if (field) { field.value = value.startsWith('data:image/') ? '' : value; field.placeholder = value ? 'Image URL or uploaded image data' : 'Image URL or upload a file'; }
  const selector = {'logo_image':'#logo-preview','hero_image':'#hero-preview','hero_game_one':'#game-one-preview','hero_game_two':'#game-two-preview'}[key];
  updatePreview(key, value, selector);
}));
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries());
  ['logo_image','hero_image','hero_game_one','hero_game_two'].forEach(key => { data[key] = imageValues[key] ?? data[key] ?? ''; });
  try { await api('/api/admin/settings', { method:'POST', body:JSON.stringify(data) }); showGlobalMessage('Website settings saved. Refresh the public website to see the changes.'); await loadDashboard(); activateTab('branding'); }
  catch (error) { showGlobalMessage(error.message, true); }
});

function renderBookings() {
  const query = ($('#booking-search').value || '').trim().toLowerCase(); const filter = $('#booking-status-filter').value;
  const bookings = adminData.bookings.filter(b => (filter === 'all' || b.status === filter) && [b.reference,b.customer_name,b.phone,b.email,b.setup_name,b.payment_txn_id].some(v => String(v || '').toLowerCase().includes(query)));
  const body = $('#booking-rows');
  if (!bookings.length) { body.innerHTML = '<tr><td colspan="7" class="empty-cell">No booking requests match this filter.</td></tr>'; return; }
  body.innerHTML = bookings.map(b => {
    const food = (b.food_items || []).map(item => `${esc(item.name)} × ${Number(item.quantity)}`).join(', ');
    const paymentStatusLabels = { unpaid: 'UNPAID', unverified: 'UNVERIFIED', verified: 'VERIFIED' };
    const setupLabel = Number(b.station_number)>1 ? `${b.setup_name} · Station ${b.station_number}` : b.setup_name;
    return `<tr><td><span class="customer-name">${esc(b.customer_name)}</span><span class="booking-ref">${esc(b.reference)}</span><span class="subcell">${esc(b.booking_date)} · Created ${esc(b.created_at)}</span></td>
      <td><b>${esc(setupLabel)}</b><span class="subcell">${esc(b.booking_date)} · ${esc(b.start_time)} · ${minutesLabel(b.duration_minutes)}</span><span class="subcell">Address: ${esc(b.address)}</span>${b.notes ? `<span class="subcell">Note: ${esc(b.notes)}</span>`:''}</td>
      <td><span>${esc(b.phone)}</span><span class="subcell">${esc(b.email)}</span></td>
      <td><b>${money(b.amount)}</b><span class="subcell">Session ${money(b.base_amount)}</span>${b.pass_name ? `<span class="subcell">Player pass: ${esc(b.pass_name)} · ${money(b.pass_amount)}</span>`:''}${b.discount_amount ? `<span class="subcell">Promo − ${money(b.discount_amount)} (${Number(b.discount_percent)}%)</span>`:''}${b.extra_controllers ? `<span class="subcell">Controllers × ${b.extra_controllers}: ${money(b.controller_fee)}</span>`:''}${food ? `<span class="subcell">Food: ${esc(food)} · ${money(b.food_total)}</span>`:''}</td>
      <td><b>${esc(({'bkash':'bKash','nagad':'Nagad','not_recorded':'NOT RECORDED'}[String(b.payment_method || '')] || String(b.payment_method || '').toUpperCase()))} · ${money(b.payment_amount)}</b><span class="subcell">Txn ID: ${esc(b.payment_txn_id || 'Not provided')}</span><span class="subcell">Payment state: ${esc(paymentStatusLabels[b.payment_status] || b.payment_status)}</span><select class="status-select payment-status-select" data-payment-status-for="${b.id}" aria-label="Payment verification status for ${esc(b.reference)}">${['unpaid','unverified','verified'].map(status=>`<option value="${status}" ${b.payment_status===status?'selected':''}>${paymentStatusLabels[status]}</option>`).join('')}</select></td>
      <td><select class="status-select" data-status-for="${b.id}" aria-label="Booking status for ${esc(b.reference)}">${['pending','confirmed','rejected','cancelled'].map(status=>`<option value="${status}" ${b.status===status?'selected':''}>${status.toUpperCase()}</option>`).join('')}</select></td>
      <td><button class="btn btn-ghost booking-save" data-booking-save="${b.id}">Save changes</button></td></tr>`;
  }).join('');
  $$('[data-booking-save]').forEach(button => {
    if (button.dataset.bound === 'true') return; button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      const id = button.dataset.bookingSave; const status = $(`[data-status-for="${id}"]`).value; const payment_status = $(`[data-payment-status-for="${id}"]`).value; button.disabled = true;
      try { await api(`/api/admin/bookings/${id}`, { method:'POST', body:JSON.stringify({ status, payment_status }) }); showGlobalMessage(`Booking: ${status.toUpperCase()} · payment: ${payment_status.toUpperCase()}.`); await loadDashboard(); }
      catch (error) { showGlobalMessage(error.message, true); } finally { button.disabled = false; }
    });
  });
}
$('#booking-search').addEventListener('input', renderBookings);
$('#booking-status-filter').addEventListener('change', renderBookings);
$('#refresh-bookings').addEventListener('click', async () => { try { await loadDashboard(); showGlobalMessage('Booking list refreshed.'); } catch (error) { showGlobalMessage(error.message, true); } });

function pricesToText(prices) { return Object.entries(prices || {}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([duration,price])=>`${duration}=${price}`).join(','); }
function renderSetups() {
  $('#setup-list').innerHTML = adminData.setups.map(setup => setupFormHtml(setup)).join('');
  bindEditForms('setup');
}
function setupFormHtml(setup = {}) {
  const isNew = !setup.id;
  const image = setup.image_url || '';
  const displayImage = image.startsWith('data:image/') ? image : image;
  const visibleImage = image.startsWith('data:image/') ? '' : image;
  return `<form class="edit-card setup-edit-form" data-id="${setup.id || ''}" data-image-value="${esc(displayImage)}"><div class="edit-card-heading"><div><b>${isNew ? 'New gaming setup' : esc(setup.name)}</b><span style="display:block">${isNew ? 'Add a station or gaming experience' : `Setup #${setup.id} · Capacity ${setup.capacity}`}</span></div><span>${setup.active ? 'VISIBLE' : 'HIDDEN'}</span></div><div class="edit-grid">
    <label>Setup name<input name="name" required maxlength="120" value="${esc(setup.name || '')}" placeholder="e.g. PC Gaming Station"></label><label>Station capacity<input name="capacity" type="number" min="1" max="100" required value="${setup.capacity || 1}"></label>
    <label class="wide">Short description<textarea name="description" maxlength="1000">${esc(setup.description || '')}</textarea></label><label class="wide">Prices by session length (minutes=price)<input name="prices_text" required value="${esc(pricesToText(setup.prices || {}))}" placeholder="30=150,60=220,120=440"></label>
    <div class="wide edit-image-row"><label>Image URL or uploaded image<input name="image_url" value="${esc(visibleImage)}" placeholder="Paste an image URL or upload below"></label><img class="edit-image-preview" src="${esc(image || '/static/images/hero-texture.jpg')}" alt="Setup image preview" onerror="this.style.opacity='.25'"></div>
    <label class="upload-btn">Upload setup image<input type="file" data-target="setup-image" accept="image/*" hidden></label>
    <label class="checkbox-row"><input type="checkbox" name="active" ${setup.active === false ? '' : 'checked'}> Show on public website / allow booking</label><label class="checkbox-row"><input type="checkbox" name="coming_soon" ${setup.coming_soon ? 'checked' : ''}> Coming soon (not bookable)</label>
    </div><div class="edit-actions"><button type="submit" class="btn btn-red">Save setup</button>${!isNew ? `<button type="button" class="btn btn-ghost delete-button" data-delete-setup="${setup.id}">Delete / hide</button>` : ''}</div></form>`;
}
$('#add-setup').addEventListener('click', () => { $('#setup-list').insertAdjacentHTML('afterbegin', setupFormHtml()); const form = $('#setup-list .setup-edit-form'); form.scrollIntoView({ behavior:'smooth', block:'center' }); bindEditForms('setup', form); });
function renderMenu() { $('#menu-list').innerHTML = adminData.menu.map(item => menuFormHtml(item)).join(''); bindEditForms('menu'); }
function menuFormHtml(item = {}) {
  const isNew = !item.id; const image = item.image_url || ''; const visibleImage = image.startsWith('data:image/') ? '' : image;
  return `<form class="edit-card menu-edit-form" data-id="${item.id || ''}" data-image-value="${esc(image)}"><div class="edit-card-heading"><div><b>${isNew ? 'New menu item' : esc(item.name)}</b><span style="display:block">${isNew ? 'Add an item customers can order at your cafe' : `Menu item #${item.id}`}</span></div><span>${item.active === false ? 'HIDDEN' : 'VISIBLE'}</span></div><div class="edit-grid"><label>Item name<input name="name" required maxlength="120" value="${esc(item.name || '')}" placeholder="e.g. Cold Coffee"></label><label>Category<input name="category" maxlength="60" value="${esc(item.category || 'Snacks')}" placeholder="Snacks, Drinks, Meals…"></label><label>Price (BDT)<input name="price" type="number" min="0" step="0.01" required value="${item.price ?? ''}" placeholder="150"></label><label>Description<input name="description" maxlength="1000" value="${esc(item.description || '')}" placeholder="Short item description"></label><div class="wide edit-image-row"><label>Image URL or uploaded image<input name="image_url" value="${esc(visibleImage)}" placeholder="Optional — paste a URL or upload below"></label><img class="edit-image-preview" src="${esc(image || '/static/images/hero-texture.jpg')}" alt="Menu item image preview" onerror="this.style.opacity='.25'"></div><label class="upload-btn">Upload item image<input type="file" data-target="menu-image" accept="image/*" hidden></label><label class="checkbox-row"><input type="checkbox" name="active" ${item.active === false ? '' : 'checked'}> Show on public menu</label></div><div class="edit-actions"><button type="submit" class="btn btn-red">Save menu item</button>${!isNew ? `<button type="button" class="btn btn-ghost delete-button" data-delete-menu="${item.id}">Delete item</button>` : ''}</div></form>`;
}
$('#add-menu-item').addEventListener('click', () => { $('#menu-list').insertAdjacentHTML('afterbegin', menuFormHtml()); const form = $('#menu-list .menu-edit-form'); form.scrollIntoView({ behavior:'smooth', block:'center' }); bindEditForms('menu', form); });

function comboPassFormHtml(item = {}) {
  const isNew = !item.id;
  return `<form class="edit-card combo-edit-form" data-id="${item.id || ''}"><div class="edit-card-heading"><div><b>${isNew ? 'New combo pass' : esc(item.name)}</b><span style="display:block">${isNew ? 'Create a bundle or offer' : `Combo pass #${item.id}`}</span></div><span>${item.active === false ? 'HIDDEN' : 'VISIBLE'}</span></div>
  <div class="edit-grid"><label>Pass name<input name="name" maxlength="120" required value="${esc(item.name || '')}" placeholder="Ultimate Combo Pass"></label><label>Short subtitle<input name="subtitle" maxlength="240" value="${esc(item.subtitle || '')}" placeholder="A great gaming bundle"></label>
  <label>Offer price (BDT)<input name="price" type="number" min="0" step="0.01" required value="${item.price ?? ''}" placeholder="450"></label><label>Normal / total value (BDT)<input name="original_price" type="number" min="0" step="0.01" required value="${item.original_price ?? ''}" placeholder="580"></label>
  <label class="wide">What is included? <span style="color:#858b9b;font-weight:500">Put each item on a new line</span><textarea name="details" maxlength="3000" placeholder="PS5 Standard · 1 hour\nRacing Simulator · 30 minutes">${esc(item.details || '')}</textarea></label>
  <label class="checkbox-row wide"><input type="checkbox" name="active" ${item.active === false ? '' : 'checked'}> Show this combo pass on the website</label></div>
  <div class="edit-actions"><button class="btn btn-red" type="submit">Save combo pass</button>${!isNew ? `<button class="btn btn-ghost delete-button" type="button" data-delete-pass="${item.id}">Delete pass</button>` : ''}</div></form>`;
}
function renderComboPasses() {
  $('#pass-list').innerHTML = (adminData.passes || []).map(item => comboPassFormHtml(item)).join('');
  bindComboPassForms();
}
function bindComboPassForms(onlyForm = null) {
  const forms = onlyForm ? [onlyForm] : $$('.combo-edit-form');
  forms.forEach(form => {
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      data.id = form.dataset.id || null;
      data.active = $('[name="active"]', form).checked;
      try { await api('/api/admin/passes', { method:'POST', body:JSON.stringify(data) }); showGlobalMessage('Combo pass saved.'); await loadDashboard(); activateTab('passes'); }
      catch (error) { showGlobalMessage(error.message, true); }
    });
  });
  $$('[data-delete-pass]').forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', async () => {
      if (!confirm('Delete this combo pass?')) return;
      try { const result = await api(`/api/admin/passes/${button.dataset.deletePass}`, { method:'DELETE' }); showGlobalMessage(result.message || 'Combo pass deleted.'); await loadDashboard(); activateTab('passes'); }
      catch (error) { showGlobalMessage(error.message, true); }
    });
  });
}
$('#add-pass').addEventListener('click', () => {
  $('#pass-list').insertAdjacentHTML('afterbegin', comboPassFormHtml());
  const form = $('#pass-list .combo-edit-form'); form.scrollIntoView({ behavior:'smooth', block:'center' }); bindComboPassForms(form);
});

function bindEditForms(type, onlyForm = null) {
  const selector = type === 'setup' ? '.setup-edit-form' : '.menu-edit-form';
  const forms = onlyForm ? [onlyForm] : $$(selector);
  forms.forEach(form => {
    if (form.dataset.bound === 'true') return; form.dataset.bound = 'true';
    const imageInput = $('[name="image_url"]', form);
    if (imageInput) imageInput.addEventListener('input', () => { form.dataset.imageValue = imageInput.value.trim(); const preview = $('.edit-image-preview', form); if (preview) preview.src = imageInput.value.trim(); });
    const fileInput = $('input[type="file"]', form);
    if (fileInput) fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0]; if (!file) return;
      try { const dataUrl = await imageFileToDataUrl(file, 1400); form.dataset.imageValue = dataUrl; if (imageInput) { imageInput.value = ''; imageInput.placeholder = 'New uploaded image selected — save to apply'; } const preview = $('.edit-image-preview', form); if (preview) preview.src = dataUrl; }
      catch (error) { showGlobalMessage(error.message, true); }
      fileInput.value = '';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(form).entries());
      data.id = form.dataset.id || null; data.image_url = form.dataset.imageValue || (imageInput ? imageInput.value.trim() : '');
      data.active = $('[name="active"]', form).checked;
      if (type === 'setup') { data.coming_soon = $('[name="coming_soon"]', form).checked; }
      try {
        await api(type === 'setup' ? '/api/admin/setups' : '/api/admin/menu', { method:'POST', body:JSON.stringify(data) });
        showGlobalMessage(type === 'setup' ? 'Gaming setup saved.' : 'Menu item saved.'); await loadDashboard(); activateTab(type === 'setup' ? 'setups' : 'menu');
      } catch (error) { showGlobalMessage(error.message, true); }
    });
  });
  $$('[data-delete-setup]').forEach(button => { if (button.dataset.bound) return; button.dataset.bound='true'; button.addEventListener('click', async () => {
    if (!confirm('Delete or hide this gaming setup? Past bookings will be preserved.')) return;
    try { const data = await api(`/api/admin/setups/${button.dataset.deleteSetup}`, { method:'DELETE' }); showGlobalMessage(data.message || 'Setup updated.'); await loadDashboard(); activateTab('setups'); } catch (error) { showGlobalMessage(error.message, true); }
  }); });
  $$('[data-delete-menu]').forEach(button => { if (button.dataset.bound) return; button.dataset.bound='true'; button.addEventListener('click', async () => {
    if (!confirm('Delete this menu item?')) return;
    try { const data = await api(`/api/admin/menu/${button.dataset.deleteMenu}`, { method:'DELETE' }); showGlobalMessage(data.message || 'Menu item deleted.'); await loadDashboard(); activateTab('menu'); } catch (error) { showGlobalMessage(error.message, true); }
  }); });
}

// Keep the admin session in a browser-session cookie; close the browser to sign out.
(async function init() {
  try { await loadDashboard(); showDashboard(); }
  catch (error) { showLogin(); }
})();
