const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let publicData = { settings: {}, setups: [], menu: [], passes: [] };
let selectedMenuCategory = 'All';
let timeRequest = 0;
let wizardStep = 1;
let foodCart = {};
let selectedGameImageSettings = {};
let selectedSlotStates = [];

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function money(value) {
  return '৳ ' + Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 });
}
function mins(time, isClose = false) {
  if (!time || !time.includes(':')) return 0;
  const [h, m] = time.split(':').map(Number);
  return isClose && h === 0 && m === 0 ? 1440 : h * 60 + m;
}
function timeLabel(value) {
  const [h, m] = value.split(':').map(Number);
  const ap = h >= 12 && h < 24 ? 'PM' : 'AM';
  const shown = h % 12 || 12;
  return `${String(shown).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
}
function durationLabel(value) {
  const n = Number(value);
  if (n < 60) return `${n} min`;
  const hours = Math.floor(n / 60), minsLeft = n % 60;
  return `${hours} hr${hours > 1 ? 's' : ''}${minsLeft ? ` ${minsLeft} min` : ''}`;
}
function imageOrBlank(url, alt = '') {
  return url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.display='none'">` : '';
}
function setBrandName(name) {
  const parts = String(name || 'YOUR CAFE').trim().split(/\s+/);
  const last = parts.pop() || 'CAFE';
  const first = parts.join(' ');
  const content = `${esc(first ? first + ' ' : '')}<b>${esc(last)}</b>`;
  $('#brand-name').innerHTML = content;
  $('#footer-brand').innerHTML = content;
  $('#footer-copyright-name').textContent = name;
  if (first) {
    $('#hero-brand').textContent = first;
    $('#hero-brand-accent').textContent = last;
  } else {
    $('#hero-brand').textContent = last;
    $('#hero-brand-accent').textContent = '';
  }
  document.title = document.title.replace(/Respawn Cafe/g, name);
}
function renderSettings(settings) {
  setBrandName(settings.brand_name || 'YOUR CAFE');
  $('#tagline').textContent = settings.tagline || 'EAT • DRINK • PLAY';
  $('#hero-subtitle').textContent = settings.hero_subtitle || '';
  $('#hero-location').textContent = (settings.location || '').toUpperCase();
  $('#booking-location').textContent = settings.location || '';
  $('#location-address').textContent = settings.address || '';
  $('#contact-phone').textContent = settings.phone || '';
  $('#contact-email').textContent = settings.email || '';
  $('#phone-link').href = `tel:${String(settings.phone || '').replace(/[^+\d]/g, '')}`;
  $('#email-link').href = `mailto:${settings.email || ''}`;
  $('#footer-location').textContent = settings.location || '';
  $('#footer-note').textContent = settings.footer_note || '';
  $('#footer-copyright-name').textContent = settings.brand_name || '';
  const logo = $('#brand-logo');
  const footerLogo = $('#footer-brand-logo');
  if (settings.logo_image) {
    logo.src = settings.logo_image;
    footerLogo.src = settings.logo_image;
    logo.classList.remove('hidden');
    footerLogo.classList.remove('hidden');
    $('#brand-mark').classList.add('hidden');
    $('#footer-brand-mark').classList.add('hidden');
  } else {
    logo.classList.add('hidden');
    footerLogo.classList.add('hidden');
    $('#brand-mark').classList.remove('hidden');
    $('#footer-brand-mark').classList.remove('hidden');
  }
  $('#hero-game-one').src = settings.hero_game_one || '/static/images/fc26-poster.jpg';
  $('#hero-game-two').src = settings.hero_game_two || '/static/images/spiderman-poster.jpg';
  $('#hero-game-one-label').textContent = settings.hero_game_one_label || 'FC 26';
  $('#hero-game-two-label').textContent = settings.hero_game_two_label || 'ACTION GAMES';
  $('#bkash-receiver').textContent = settings.bkash_number ? `Send to ${settings.bkash_number}` : 'Contact cafe for payment number';
  $('#nagad-receiver').textContent = settings.nagad_number ? `Send to ${settings.nagad_number}` : 'Contact cafe for payment number';
  const promoActive = String(settings.promo_enabled || 'NO').toUpperCase() === 'YES' && Number(settings.promo_percent || 0) > 0;
  $('#promo-ribbon').classList.toggle('hidden', !promoActive);
  $('#promo-live-banner').classList.toggle('hidden', !promoActive);
  $('#promo-ribbon-title').textContent = settings.promo_title || 'LEVEL UP YOUR NEXT SESSION';
  $('#promo-live-title').textContent = settings.promo_title || 'LEVEL UP YOUR NEXT SESSION';
  $('#promo-ribbon-percent').textContent = `${Number(settings.promo_percent || 0)}% OFF`;
  $('#promo-live-off').textContent = `${Number(settings.promo_percent || 0)}% OFF`;
  const scopeLabels = {all:'your whole order', session:'gaming sessions', pass:'player passes', extras:'controllers and food'};
  $('#promo-ribbon-detail').textContent = `Save ${Number(settings.promo_percent || 0)}% on ${scopeLabels[settings.promo_scope || 'all'] || 'eligible items'} · applied at checkout`;
  $('#promo-live-detail').textContent = `Save ${Number(settings.promo_percent || 0)}% on ${scopeLabels[settings.promo_scope || 'all'] || 'eligible items'} — automatically applied at checkout.`;
  renderGameMarquee(settings);
  const hero = $('.hero');
  if (settings.hero_image) {
    const url = settings.hero_image.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    hero.style.setProperty('--hero-bg-image', `url('${url}')`);
  }
  const closeText = settings.close_time === '00:00' ? '12:00 AM (midnight)' : timeLabel(settings.close_time || '00:00');
  $('#opening-hours').textContent = `Daily · ${timeLabel(settings.open_time || '08:00')} – ${closeText}`;
  const query = encodeURIComponent(settings.address || settings.location || 'Bangladesh');
  $('#maps-link').href = `https://www.google.com/maps/search/?api=1&query=${query}`;
}
function renderArenas(setups) {
  const grid = $('#arena-grid');
  if (!setups.length) { grid.innerHTML = '<div class="loading-card">No gaming setups are available yet.</div>'; return; }
  grid.innerHTML = setups.map((setup, index) => {
    const prices = Object.entries(setup.prices || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
    const rates = prices.slice(0, 3).map(([duration, price]) => `<div class="rate-row"><span>${esc(durationLabel(duration))}</span><b>${money(price)}</b></div>`).join('');
    const upcoming = setup.coming_soon;
    return `<article class="arena-card">
      <div class="arena-image">${imageOrBlank(setup.image_url, setup.name)}<span class="arena-number">ARENA / ${String(index + 1).padStart(2, '0')}</span></div>
      <div class="arena-content"><div class="arena-title-row"><h3>${esc(setup.name)}</h3><span class="arena-capacity">${esc(String(setup.capacity))} station${setup.capacity === 1 ? '' : 's'}</span></div>
      <p>${esc(setup.description || '')}</p>${rates}<div class="arena-bottom"><span>${upcoming ? 'COMING SOON' : 'EDITABLE PRICING'}</span><button class="mini-book" ${upcoming ? 'disabled' : `data-book-setup="${setup.id}"`}>${upcoming ? 'Coming soon' : 'Book this ↗'}</button></div></div></article>`;
  }).join('');
  $$('[data-book-setup]').forEach(btn => btn.addEventListener('click', () => {
    window.location.href = `/book?setup=${encodeURIComponent(btn.dataset.bookSetup)}`;
  }));
}
const categoryEmoji = { burgers: '🍔', snacks: '🍟', meals: '🍜', drinks: '🥤', dessert: '🍰', coffee: '☕' };
function renderMenuFilters(menu) {
  const categories = ['All', ...new Set(menu.map(item => item.category || 'Snacks'))];
  if (!categories.includes(selectedMenuCategory)) selectedMenuCategory = 'All';
  $('#menu-filters').innerHTML = categories.map(category => `<button class="filter-chip ${selectedMenuCategory === category ? 'selected' : ''}" data-category="${esc(category)}">${esc(category)}</button>`).join('');
  $$('[data-category]').forEach(button => button.addEventListener('click', () => { selectedMenuCategory = button.dataset.category; renderMenuFilters(publicData.menu); renderMenuCards(publicData.menu); }));
}
function renderMenuCards(menu) {
  const items = selectedMenuCategory === 'All' ? menu : menu.filter(item => item.category === selectedMenuCategory);
  const grid = $('#menu-grid');
  if (!items.length) { grid.innerHTML = '<div class="loading-card">No items in this category yet.</div>'; return; }
  grid.innerHTML = items.map(item => {
    const emoji = categoryEmoji[String(item.category || '').toLowerCase()] || '🍽️';
    return `<article class="menu-card"><div class="menu-photo">${item.image_url ? imageOrBlank(item.image_url, item.name) : emoji}</div><div><span class="menu-category">${esc(item.category)}</span><h3>${esc(item.name)}</h3><p>${esc(item.description || '')}</p><div class="menu-price">${money(item.price)} <span>BDT</span></div></div></article>`;
  }).join('');
}
function renderPasses(passes) {
  const stack = $('#pass-stack');
  if (!passes.length) {
    stack.innerHTML = '<div class="loading-card">Combo passes are not available right now. Ask the cafe about a custom bundle.</div>';
    return;
  }
  stack.innerHTML = passes.map((item, index) => {
    const details = String(item.details || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const inclusions = details.length ? `<ul class="pass-inclusions">${details.map(line => `<li>${esc(line)}</li>`).join('')}</ul>` : '';
    const savings = Number(item.original_price || 0) > Number(item.price || 0) ? Number(item.original_price) - Number(item.price) : 0;
    return `<article class="pass-card ${index % 2 === 1 ? 'pass-card-red' : ''}" style="--pass-index:${index}">
      <div class="pass-topline"><span>PLAYER PASS / ${String(index + 1).padStart(2, '0')}</span><span>${index % 2 === 1 ? '✦' : '◈'}</span></div>
      <h3>${esc(item.name)}</h3><p>${esc(item.subtitle || '')}</p>${inclusions}
      <div class="pass-value"><span>VALUE <s>${money(item.original_price)}</s></span><b>ONLY ${money(item.price)}</b></div>
      <div class="pass-bottom"><span>${savings ? `SAVE ${money(savings)}` : 'COMBO PASS'}</span><a href="/book">RESERVE TIME ↗</a></div>
    </article>`;
  }).join('');
}
function selectedPass() {
  const id = String($('#booking-pass')?.value || '');
  return (publicData.passes || []).find(item => String(item.id) === id && item.active);
}
function renderBookingPasses(passes) {
  const holder = $('#booking-pass-options');
  if (!holder) return;
  const active = (passes || []).filter(item => item.active);
  holder.innerHTML = `<button type="button" class="pass-pick-card ${!$('#booking-pass').value ? 'selected' : ''}" data-pass-id=""><b>No player pass</b><span>Book only your station</span></button>` + active.map(item => {
    const chosen = String(item.id) === String($('#booking-pass').value || '');
    const saving = Number(item.original_price || 0) > Number(item.price || 0) ? Number(item.original_price) - Number(item.price) : 0;
    return `<button type="button" class="pass-pick-card ${chosen ? 'selected' : ''}" data-pass-id="${item.id}"><span class="pass-pick-top">PLAYER PASS${saving ? ` · SAVE ${money(saving)}` : ''}</span><b>${esc(item.name)}</b><span>${esc(item.subtitle || 'A curated gaming bundle')}</span><strong>${money(item.price)}${saving ? ` <s>${money(item.original_price)}</s>` : ''}</strong></button>`;
  }).join('');
  $$('[data-pass-id]').forEach(button => button.addEventListener('click', () => {
    $('#booking-pass').value = button.dataset.passId || '';
    $$('.pass-pick-card').forEach(card => card.classList.toggle('selected', card === button));
    renderEstimatedTotal();
  }));
}
function renderBookingSetups(setups) {
  const select = $('#booking-setup');
  const old = select.value;
  const availableSetups = setups.filter(setup => setup.active && !setup.coming_soon);
  select.innerHTML = availableSetups.map(setup => `<option value="${setup.id}">${esc(setup.name)}</option>`).join('');
  select.value = availableSetups.some(setup => String(setup.id) === old) ? old : '';
  $('#booking-setup-cards').innerHTML = availableSetups.length ? availableSetups.map((setup, index) => {
    const rates = Object.entries(setup.prices || {}).sort((a,b) => Number(a[0])-Number(b[0]));
    const firstRates = rates.slice(0, 3).map(([duration, price]) => `<span>${esc(durationLabel(duration))} <b>${money(price)}</b></span>`).join('');
    return `<article class="booking-setup-card ${String(setup.id) === select.value ? 'selected' : ''}" data-setup-card="${setup.id}">
      <div class="booking-setup-image">${setup.image_url ? imageOrBlank(setup.image_url, setup.name) : '<span>ϟ</span>'}<i>${index === 0 ? 'FEATURED' : `SETUP ${String(index+1).padStart(2,'0')}`}</i></div>
      <div class="booking-setup-copy"><h5>${esc(setup.name)}</h5><p>${esc(setup.description || 'Choose a session and reserve your station.')}</p><div class="setup-rate-chips">${firstRates}</div><div class="setup-card-bottom"><small>${Number(setup.capacity || 1)} station${Number(setup.capacity || 1) === 1 ? '' : 's'} available</small><button type="button" class="button button-red" data-choose-setup="${setup.id}">Book now ↗</button></div></div></article>`;
  }).join('') : '<div class="loading-card">No bookable gaming setups are available right now.</div>';
  $$('[data-choose-setup]').forEach(button => button.addEventListener('click', () => {
    selectSetup(button.dataset.chooseSetup);
    setWizardStep(2);
  }));
  const foodSelect = $('#food-select');
  foodSelect.innerHTML = '<option value="">Select food or drink item…</option>' + (publicData.menu || []).filter(item => item.active).map(item => `<option value="${item.id}">${esc(item.name)} · ${money(item.price)}</option>`).join('');
  if (select.value) selectSetup(select.value, false);
  renderFoodCart();
  renderControllerCount();
  renderEstimatedTotal();
}
function selectedSetup() {
  return publicData.setups.find(setup => String(setup.id) === String($('#booking-setup').value));
}
function selectedDuration() { return Number($('#booking-duration').value || 0); }
function selectedStationNumber() { return Number($('#booking-station-number').value || 1); }
function selectSetup(id, resetStep = true) {
  const setup = publicData.setups.find(item => String(item.id) === String(id) && item.active && !item.coming_soon);
  if (!setup) return;
  const changed = String($('#booking-setup').value) !== String(setup.id);
  $('#booking-setup').value = String(setup.id);
  $('#selected-setup-name').textContent = setup.name;
  $$('.booking-setup-card').forEach(card => card.classList.toggle('selected', card.dataset.setupCard === String(setup.id)));
  if (changed) {
    $('#booking-duration').value = '';
    $('#booking-station-number').value = '1';
    $('#booking-time').value = '';
  }
  renderDurationOptions();
  renderStationOptions();
  renderEstimatedTotal();
  updateWizardControls();
  if (resetStep) $('#wizard-action-note').textContent = `${setup.name} selected.`;
}
function renderDurationOptions() {
  const setup = selectedSetup();
  const holder = $('#duration-options');
  if (!setup) { holder.innerHTML = '<p class="muted">Choose an experience first.</p>'; return; }
  const current = selectedDuration();
  const prices = Object.entries(setup.prices || {}).sort((a,b) => Number(a[0])-Number(b[0]));
  holder.innerHTML = prices.map(([duration, price]) => `<button type="button" class="duration-option ${Number(duration) === current ? 'selected' : ''}" data-duration="${Number(duration)}"><span>${esc(durationLabel(duration))}</span><b>${money(price)}</b></button>`).join('');
  $$('[data-duration]').forEach(button => button.addEventListener('click', () => {
    $('#booking-duration').value = button.dataset.duration;
    $('#booking-time').value = '';
    $$('.duration-option').forEach(option => option.classList.toggle('selected', option === button));
    renderStationOptions(); renderEstimatedTotal(); updateTimeOptions(); updateWizardControls();
  }));
}
function renderStationOptions() {
  const setup = selectedSetup();
  const duration = selectedDuration();
  const holder = $('#station-options');
  if (!setup) { holder.innerHTML = '<p class="muted">Choose an experience first.</p>'; $('#station-hint').textContent = 'Select the individual station you want to use.'; return; }
  if (!duration) { holder.innerHTML = '<p class="muted">Choose your session duration first.</p>'; $('#station-hint').textContent = 'Station availability depends on the selected session length.'; return; }
  const capacity = Math.max(1, Number(setup.capacity || 1));
  const current = selectedStationNumber();
  holder.innerHTML = Array.from({length: capacity}, (_,index) => index + 1).map(number => {
    const label = capacity === 1 ? setup.name : `${setup.name} · Station ${number}`;
    return `<button type="button" class="station-option ${number === current ? 'selected' : ''}" data-station-number="${number}"><span class="station-icon">▣</span><span><b>${esc(label)}</b><small>Individual station · check time slots below</small></span><i>${number === current ? 'SELECTED' : 'CHOOSE'}</i></button>`;
  }).join('');
  $('#station-hint').textContent = `${capacity} station${capacity === 1 ? '' : 's'} for this setup. Select one to view its live schedule.`;
  $$('[data-station-number]').forEach(button => button.addEventListener('click', () => {
    $('#booking-station-number').value = button.dataset.stationNumber;
    $('#booking-time').value = '';
    $$('.station-option').forEach(option => option.classList.toggle('selected', option === button));
    updateTimeOptions(); updateWizardControls(); renderEstimatedTotal();
  }));
}
function controllerUnitPrice(duration) {
  if (!duration) return 0;
  if (duration <= 30) return 50;
  return 80 + Math.max(0, Math.ceil((duration - 60) / 30)) * 50;
}
function cartItems() {
  return Object.entries(foodCart).map(([id, quantity]) => ({ item: (publicData.menu || []).find(menuItem => String(menuItem.id) === String(id)), quantity })).filter(row => row.item && row.quantity > 0);
}
function renderFoodCart() {
  const holder = $('#food-cart');
  const rows = cartItems();
  if (!rows.length) { holder.innerHTML = '<p class="empty-cart">No food items selected yet. Choose from the menu above.</p>'; renderEstimatedTotal(); return; }
  holder.innerHTML = rows.map(({item, quantity}) => `<div class="food-cart-row"><div><b>${esc(item.name)}</b><small>${money(item.price)} each · ${money(Number(item.price) * quantity)}</small></div><div class="quantity-control compact"><button type="button" data-food-step="-1" data-food-id="${item.id}" aria-label="Remove one ${esc(item.name)}">−</button><b>${quantity}</b><button type="button" data-food-step="1" data-food-id="${item.id}" aria-label="Add one ${esc(item.name)}">+</button></div><button type="button" class="food-remove" data-food-remove="${item.id}" aria-label="Remove ${esc(item.name)}">×</button></div>`).join('');
  $$('[data-food-step]').forEach(button => button.addEventListener('click', () => {
    const id = String(button.dataset.foodId); const next = Number(foodCart[id] || 0) + Number(button.dataset.foodStep);
    if (next <= 0) delete foodCart[id]; else if (next <= 50) foodCart[id] = next;
    renderFoodCart();
  }));
  $$('[data-food-remove]').forEach(button => button.addEventListener('click', () => { delete foodCart[String(button.dataset.foodRemove)]; renderFoodCart(); }));
  renderEstimatedTotal();
}
function renderControllerCount() {
  $('#controller-count').textContent = $('#extra-controllers').value || '0';
}
function renderEstimatedTotal() {
  const setup = selectedSetup();
  const duration = selectedDuration();
  const base = setup && duration && setup.prices[String(duration)] !== undefined ? Number(setup.prices[String(duration)]) : 0;
  const controllerCount = Number($('#extra-controllers').value || 0);
  const controllerFee = controllerUnitPrice(duration) * controllerCount;
  const foodTotal = cartItems().reduce((sum, row) => sum + Number(row.item.price) * row.quantity, 0);
  const pass = selectedPass();
  const passTotal = pass ? Number(pass.price || 0) : 0;
  const subtotal = base + controllerFee + foodTotal + passTotal;
  const settings = publicData.settings || {};
  const promoActive = String(settings.promo_enabled || 'NO').toUpperCase() === 'YES';
  const percent = promoActive ? Math.min(100, Math.max(0, Number(settings.promo_percent || 0))) : 0;
  const scope = settings.promo_scope || 'all';
  let eligible = 0;
  if (scope === 'all') eligible = subtotal;
  else if (scope === 'session') eligible = base;
  else if (scope === 'pass') eligible = passTotal;
  else if (scope === 'extras') eligible = controllerFee + foodTotal;
  const discount = Math.round(eligible * percent) / 100;
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  $('#booking-total').textContent = setup && duration ? money(total) : '৳ —';
  $('#payment-amount').max = String(Math.max(0,total));
  const lines = [];
  if (base) lines.push(`<span>Gaming session</span><b>${money(base)}</b>`);
  if (passTotal) lines.push(`<span>${esc(pass.name)}</span><b>${money(passTotal)}</b>`);
  if (controllerCount) lines.push(`<span>Extra controllers × ${controllerCount}</span><b>${money(controllerFee)}</b>`);
  if (foodTotal) lines.push(`<span>Food & drinks</span><b>${money(foodTotal)}</b>`);
  if (discount > 0) lines.push(`<span class="promo-summary-label">Promo discount (${percent}%)</span><b class="promo-summary-value">− ${money(discount)}</b>`);
  $('#booking-summary-lines').innerHTML = lines.join('') || '<span>Choose a duration to calculate your order.</span>';
  $('#wizard-action-note').textContent = setup && duration ? `Estimated total: ${money(total)}` : 'Choose a duration to calculate the total.';
  return {base, controllerFee, foodTotal, passTotal, subtotal, discount, percent, total};
}
function localISODate(offset = 0) {
  const dateValue = new Date(); dateValue.setDate(dateValue.getDate() + offset);
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth()+1).padStart(2,'0')}-${String(dateValue.getDate()).padStart(2,'0')}`;
}
function setBookingDate(value, quickOffset = null) {
  if (!value) return;
  $('#booking-date').value = value;
  $('#custom-booking-date').value = value;
  $('#custom-booking-date').min = localISODate(0);
  $$('.date-quick').forEach(button => button.classList.toggle('active', quickOffset !== null && Number(button.dataset.dateOffset) === quickOffset));
  $('#booking-time').value = '';
  updateTimeOptions(); updateWizardControls();
}
async function updateTimeOptions() {
  const requestId = ++timeRequest;
  const setup = selectedSetup(); const duration = selectedDuration();
  const dateValue = $('#booking-date').value; const stationNumber = selectedStationNumber();
  const holder = $('#time-grid');
  if (!setup || !duration || !dateValue || !stationNumber) {
    holder.innerHTML = '<p class="muted">Choose a duration, station and date to load the schedule.</p>';
    $('#slot-hint').textContent = 'Choose a duration, station and date to see available start times.';
    return;
  }
  holder.innerHTML = '<p class="muted">Checking station availability…</p>';
  $('#slot-hint').textContent = 'Checking live availability…';
  try {
    const params = new URLSearchParams({setup_id:String(setup.id), booking_date:dateValue, duration_minutes:String(duration), station_number:String(stationNumber)});
    const response = await fetch(`/api/available-times?${params.toString()}`);
    const result = await response.json();
    if (requestId !== timeRequest) return;
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not check availability.');
    const slots = result.slots || [];
    selectedSlotStates = slots;
    if (!slots.length) {
      holder.innerHTML = '<p class="empty-slots">No start times fit this duration. Try another date or session length.</p>';
      $('#slot-hint').textContent = 'No times available for this date and duration.'; return;
    }
    holder.innerHTML = slots.map(slot => {
      const booked = slot.state === 'booked'; const pending = slot.state === 'pending'; const available = slot.state === 'available';
      const active = $('#booking-time').value === slot.start;
      const label = booked ? 'Booked' : pending ? 'Pending' : 'Available';
      return `<button type="button" class="time-slot ${slot.state}${active ? ' selected' : ''}" data-time-slot="${esc(slot.start)}" ${available ? '' : 'disabled'}><b>${timeLabel(slot.start)}</b><small>${label}</small></button>`;
    }).join('');
    $$('[data-time-slot]').forEach(button => button.addEventListener('click', () => {
      $('#booking-time').value = button.dataset.timeSlot;
      $$('.time-slot').forEach(slot => slot.classList.toggle('selected', slot === button));
      $('#slot-hint').textContent = `${timeLabel(button.dataset.timeSlot)} selected · ${durationLabel(duration)} session · ${setup.name}`;
      updateWizardControls();
    }));
    const available = slots.filter(slot => slot.state === 'available').length;
    const booked = slots.filter(slot => slot.state === 'booked').length;
    $('#slot-hint').textContent = `${available} available · ${booked} booked. Pending requests temporarily hold their selected station until staff reviews them.`;
  } catch (error) {
    if (requestId !== timeRequest) return;
    holder.innerHTML = '<p class="empty-slots">Could not load the schedule. Please retry.</p>';
    $('#slot-hint').textContent = 'Availability could not be checked. Refresh and try again.';
  }
}
function setWizardStep(step) {
  wizardStep = Math.max(1, Math.min(4, Number(step)));
  $$('.booking-step').forEach(section => section.classList.toggle('active', Number(section.dataset.step) === wizardStep));
  $$('.wizard-progress-item').forEach(item => {
    const n = Number(item.dataset.progress); item.classList.toggle('active', n === wizardStep); item.classList.toggle('complete', n < wizardStep);
  });
  $('#wizard-back').disabled = wizardStep === 1;
  $('#wizard-next').classList.toggle('hidden', wizardStep === 4);
  $('.submit-booking').classList.toggle('hidden', wizardStep !== 4);
  $('#wizard-next').textContent = wizardStep === 3 ? 'Details & payment ↗' : 'Next ↗';
  $('#wizard-action-note').textContent = wizardStep === 1 ? 'Select an experience to begin.' : wizardStep === 2 ? 'Extras are optional.' : wizardStep === 3 ? 'Choose your date, station and available time.' : 'Review the total and enter your details.';
  updateWizardControls();
}
function updateWizardControls() {
  const canNext = wizardStep === 1 ? Boolean(selectedSetup()) : wizardStep === 2 ? true : wizardStep === 3 ? Boolean(selectedSetup() && selectedDuration() && $('#booking-date').value && $('#booking-time').value && selectedStationNumber()) : false;
  $('#wizard-next').disabled = !canNext;
  if (wizardStep === 1 && selectedSetup()) $('#wizard-action-note').textContent = `${selectedSetup().name} selected.`;
}
function resetBookingWizard() {
  $('#booking-form').reset(); foodCart = {}; wizardStep = 1;
  $('#booking-setup').value = ''; $('#booking-duration').value = ''; $('#booking-station-number').value = '1'; $('#booking-pass').value = ''; renderBookingPasses(publicData.passes || []);
  $('#booking-time').value = ''; $('#extra-controllers').value = '0'; $('#payment-amount').value = '0';
  setBookingDate(localISODate(0), 0); renderBookingSetups(publicData.setups || []); renderFoodCart(); renderControllerCount(); renderEstimatedTotal();
  $('#booking-message').classList.add('hidden'); $('#booking-success').classList.add('hidden'); $('#booking-wizard').classList.remove('hidden'); setWizardStep(1);
}

function renderGameMarquee(settings) {
  selectedGameImageSettings = settings || {};
  const games = [
    {name: settings.hero_game_one_label || 'FOOTBALL ARENA', image: settings.hero_game_one || '/static/images/fc26-poster.jpg'},
    {name: 'GTA V', image: '/static/images/gta-v-poster.svg'},
    {name: settings.hero_game_two_label || 'ACTION GAMES', image: settings.hero_game_two || '/static/images/spiderman-poster.jpg'},
    {name: 'NEXT-GEN CONSOLES', image: settings.hero_game_one || '/static/images/fc26-poster.jpg'},
    {name: 'RACING SIMULATOR', image: settings.hero_game_two || '/static/images/spiderman-poster.jpg'},
    {name: 'SQUAD PLAY', image: settings.hero_game_one || '/static/images/fc26-poster.jpg'},
    {name: 'ACTION UNLEASHED', image: settings.hero_game_two || '/static/images/spiderman-poster.jpg'}
  ];
  ['#game-track-top','#game-track-middle','#game-track-bottom'].forEach((selector, laneIndex) => {
    const laneGames = laneIndex === 1 ? [...games].reverse() : games;
    const cards = laneGames.map((game,index) => `<article class="marquee-game-card game-card-${index % 4}" style="--game-image:url('${esc(game.image).replace(/'/g, '%27')}')"><div class="marquee-game-image">${imageOrBlank(game.image, game.name)}</div><span>${esc(game.name)}</span></article>`).join('');
    $(selector).innerHTML = cards + cards.replaceAll('marquee-game-card', 'marquee-game-card duplicate-card');
  });
}

async function fetchPublicData() {
  try {
    const response = await fetch('/api/public-data');
    publicData = await response.json();
    renderSettings(publicData.settings || {});
    renderArenas(publicData.setups || []);
    renderMenuFilters(publicData.menu || []);
    renderMenuCards(publicData.menu || []);
    renderPasses(publicData.passes || []);
    renderBookingPasses(publicData.passes || []);
    renderBookingSetups(publicData.setups || []);
    const presetSetup = new URLSearchParams(window.location.search).get('setup');
    if (document.body.classList.contains('page-book') && presetSetup) selectSetup(presetSetup, false);
  } catch (error) {
    $('#arena-grid').innerHTML = '<div class="loading-card">Could not load the cafe menu right now. Refresh the page to try again.</div>';
  }
}
function showBookingMessage(message, error = false) {
  const box = $('#booking-message');
  box.classList.remove('hidden', 'error');
  if (error) box.classList.add('error');
  box.textContent = message;
}
$('#wizard-next').addEventListener('click', () => {
  if (wizardStep === 1 && !selectedSetup()) { showBookingMessage('Choose a gaming experience first.', true); return; }
  if (wizardStep === 3) {
    if (!selectedDuration()) { showBookingMessage('Choose a session duration.', true); return; }
    if (!$('#booking-time').value || !selectedStationNumber()) { showBookingMessage('Choose a station and an available time slot.', true); return; }
  }
  $('#booking-message').classList.add('hidden'); setWizardStep(wizardStep + 1);
  if (wizardStep === 3) { renderEstimatedTotal(); updateTimeOptions(); }
});
$('#wizard-back').addEventListener('click', () => { if (wizardStep > 1) setWizardStep(wizardStep - 1); });
$$('[data-controller-step]').forEach(button => button.addEventListener('click', () => {
  const count = Number($('#extra-controllers').value || 0) + Number(button.dataset.controllerStep);
  $('#extra-controllers').value = String(Math.max(0, Math.min(6, count)));
  renderControllerCount(); renderEstimatedTotal();
}));
$('#add-food').addEventListener('click', () => {
  const id = String($('#food-select').value || '');
  if (!id) { $('#food-cart').insertAdjacentHTML('afterbegin', '<p class="empty-cart cart-warning">Select a menu item first.</p>'); return; }
  const menuItem = (publicData.menu || []).find(item => String(item.id) === id && item.active);
  if (!menuItem) { showBookingMessage('That food item is no longer available. Refresh the page.', true); return; }
  foodCart[id] = Math.min(50, Number(foodCart[id] || 0) + 1); $('#food-select').value = ''; renderFoodCart();
});
$$('[data-date-offset]').forEach(button => button.addEventListener('click', () => setBookingDate(localISODate(Number(button.dataset.dateOffset)), Number(button.dataset.dateOffset))));
$('#custom-booking-date').addEventListener('change', () => setBookingDate($('#custom-booking-date').value, null));
$('#booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (wizardStep !== 4) return;
  const fields = ['customer_name','phone','email','payment_amount'];
  for (const name of fields) {
    const field = $(`[name="${name}"]`);
    if (!field || !field.checkValidity()) { field?.reportValidity(); return; }
  }
  if (!selectedSetup() || !selectedDuration() || !$('#booking-date').value || !$('#booking-time').value) {
    showBookingMessage('Your station, duration, date and start time are required.', true); setWizardStep(3); return;
  }
  const totals = renderEstimatedTotal();
  const paid = Number($('#payment-amount').value || 0);
  if (paid < 0 || paid > totals.total) { showBookingMessage(`Payment amount must be between ৳0 and ${money(totals.total)}.`, true); return; }
  const button = $('.submit-booking'); const originalHtml = button.innerHTML;
  button.disabled = true; button.textContent = 'Submitting booking…'; $('#booking-message').classList.add('hidden');
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  data.food_items = cartItems().map(row => ({ id: row.item.id, quantity: row.quantity }));
  try {
    const response = await fetch('/api/bookings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Could not submit the booking.');
    $('#booking-result-reference').textContent = result.reference;
    $('#booking-result-track').href = `/track?reference=${encodeURIComponent(result.reference)}`;
    $('#booking-result-summary').innerHTML = `<div><span>Experience</span><b>${esc(selectedSetup()?.name || '')}</b></div>${result.pass_name ? `<div><span>Player pass</span><b>${esc(result.pass_name)} · ${money(result.pass_amount)}</b></div>` : ''}${Number(result.discount_amount || 0) > 0 ? `<div><span>Promo discount</span><b>− ${money(result.discount_amount)} (${Number(result.discount_percent)}%)</b></div>` : ''}<div><span>Date & time</span><b>${esc(data.booking_date)} · ${timeLabel(data.start_time)}</b></div><div><span>Booking total</span><b>${money(result.amount)}</b></div><div><span>Booking status</span><b class="status-pending">PENDING</b></div><div><span>Payment reported</span><b>${money(result.payment_amount)} · ${esc(String(data.payment_method).toUpperCase())}</b></div>`;
    $('#booking-wizard').classList.add('hidden'); $('#booking-success').classList.remove('hidden');
    $('#booking-success').scrollIntoView({behavior:'smooth',block:'center'});
  } catch (error) {
    showBookingMessage(error.message || 'Something went wrong. Please try again.', true);
  } finally { button.disabled = false; button.innerHTML = originalHtml; }
});
$('#copy-booking-reference').addEventListener('click', async () => {
  const reference = $('#booking-result-reference').textContent;
  try { await navigator.clipboard.writeText(reference); $('#copy-booking-reference').textContent = 'Copied ✓'; }
  catch (_) { const textArea = document.createElement('textarea'); textArea.value = reference; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); textArea.remove(); $('#copy-booking-reference').textContent = 'Copied ✓'; }
});
$('#new-booking').addEventListener('click', () => { resetBookingWizard(); $('#booking').scrollIntoView({behavior:'smooth'}); });

$('#menu-toggle').addEventListener('click', () => $('#mobile-menu').classList.toggle('hidden'));
$$('#mobile-menu a').forEach(link => link.addEventListener('click', () => $('#mobile-menu').classList.add('hidden')));
$$('.mobile-bottom-nav a').forEach(link => link.addEventListener('click', () => { $$('.mobile-bottom-nav a').forEach(item => item.classList.remove('active')); link.classList.add('active'); }));
$('#year').textContent = new Date().getFullYear();
const now = new Date();
$('#custom-booking-date').min = localISODate(0);
setBookingDate(localISODate(0), 0);
setWizardStep(1);
fetchPublicData();
