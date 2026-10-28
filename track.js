const $ = selector => document.querySelector(selector);
function esc(value = '') { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function money(value) { return '৳ ' + Number(value || 0).toLocaleString('en-BD', {maximumFractionDigits:2}); }
function durationLabel(value) { const n = Number(value); if (n < 60) return `${n} min`; const hours = Math.floor(n/60), mins = n%60; return `${hours} hr${hours>1?'s':''}${mins?` ${mins} min`:''}`; }
function prettyStatus(value) { return ({pending:'Awaiting cafe confirmation',confirmed:'Booking confirmed',rejected:'Booking not accepted',cancelled:'Booking cancelled'})[value] || 'Status unavailable'; }
function prettyPayment(value) { return ({unpaid:'No amount reported yet',unverified:'Awaiting manual verification',verified:'Payment marked verified'})[value] || 'Not available'; }
function showMessage(message, isError=false) { const el=$('#track-message'); el.textContent=message; el.className=`track-message ${isError?'error':'success'}`; }
function renderBooking(b) {
  const statusLabel = b.status.toUpperCase();
  const setupLabel = Number(b.station_number)>1 ? `${b.setup_name} · Station ${b.station_number}` : b.setup_name;
  const food = (b.food_items || []).map(item => `${esc(item.name)} × ${Number(item.quantity)}`).join(', ');
  const paymentAmount = money(b.payment_amount);
  const total = Number(b.amount || 0);
  const verifiedPaid = b.payment_status === 'verified' ? Number(b.payment_amount || 0) : 0;
  const due = Math.max(0, total - verifiedPaid);
  let explainer = b.status === 'confirmed'
    ? 'The cafe has confirmed your reservation. Please arrive close to your selected start time and show your reference code if asked.'
    : b.status === 'pending'
      ? 'Your request is received, but your station is not confirmed yet. The cafe team must review the reservation and manually check any payment you reported.'
      : b.status === 'rejected'
        ? 'The cafe did not accept this booking. Please contact the cafe if you need details or want to choose another time.'
        : 'This booking has been cancelled. Contact the cafe if you believe this status is incorrect.';
  $('#track-result').innerHTML = `<div class="track-result-heading"><div><span>UNIQUE BOOKING REFERENCE</span><strong>${esc(b.reference)}</strong><small style="display:block;color:#9298a7;font-size:9px;margin-top:6px">Customer: ${esc(b.customer_name)}</small></div><span class="status-pill-result ${esc(b.status)}">${esc(statusLabel)}</span></div>
    <div class="track-result-grid">
      <div class="track-result-field"><span>Booking status</span><b>${esc(prettyStatus(b.status))}</b></div>
      <div class="track-result-field"><span>Gaming station</span><b>${esc(setupLabel)}</b></div>
      <div class="track-result-field"><span>Date</span><b>${esc(b.booking_date)}</b></div>
      <div class="track-result-field"><span>Time & duration</span><b>${esc(b.start_time)} · ${esc(durationLabel(b.duration_minutes))}</b></div>
      <div class="track-result-field"><span>Order total</span><b>${money(total)}</b></div>
      <div class="track-result-field"><span>Payment method</span><b>${esc(({'bkash':'bKash','nagad':'Nagad','not_recorded':'Not recorded'}[String(b.payment_method || '')] || String(b.payment_method || '').toUpperCase()))}</b></div>
      <div class="track-result-field"><span>Amount reported paid</span><b>${paymentAmount}</b></div>
      <div class="track-result-field"><span>Payment verification</span><b>${esc(prettyPayment(b.payment_status))}</b></div>
      ${b.pass_name ? `<div class="track-result-field"><span>Player pass</span><b>${esc(b.pass_name)} · ${money(b.pass_amount)}</b></div>` : ''}
      ${Number(b.discount_amount || 0) > 0 ? `<div class="track-result-field"><span>Promo discount</span><b>− ${money(b.discount_amount)} (${Number(b.discount_percent)}%)</b></div>` : ''}
      ${b.extra_controllers ? `<div class="track-result-field"><span>Extra controllers</span><b>${Number(b.extra_controllers)}</b></div>` : ''}
      ${food ? `<div class="track-result-field" style="grid-column:1/-1"><span>Food & drinks</span><b>${food}</b></div>` : ''}
      ${due > 0 ? `<div class="track-result-field"><span>Remaining amount</span><b>${money(due)}</b></div>` : ''}
    </div><div class="track-status-explainer"><strong>What this means: </strong>${esc(explainer)} Payment status is separate from booking status; a customer-entered amount or transaction ID is not proof of payment until staff checks the wallet account.</div>`;
  $('#track-result').classList.remove('hidden');
}
async function track(reference) {
  const value = String(reference || '').trim().toUpperCase().replace(/\s+/g,'');
  if (!value) { showMessage('Enter your booking reference code first.', true); return; }
  $('#track-reference').value = value;
  $('#track-submit').disabled = true; $('#track-submit').textContent = 'Checking…';
  $('#track-result').classList.add('hidden'); $('#track-message').classList.add('hidden');
  try {
    const response = await fetch(`/api/bookings/track?reference=${encodeURIComponent(value)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Could not find this booking.');
    renderBooking(data.booking); showMessage('Booking details loaded successfully.');
    const url = new URL(window.location.href); url.searchParams.set('reference', value); window.history.replaceState({}, '', url);
  } catch (error) { showMessage(error.message || 'Could not look up the booking. Please try again.', true); }
  finally { $('#track-submit').disabled = false; $('#track-submit').textContent = '⚡ Track booking'; }
}
const menuToggle = $('#menu-toggle');
const mobileMenu = $('#mobile-menu');
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    menuToggle.setAttribute('aria-expanded', String(!mobileMenu.classList.contains('hidden')));
  });
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => mobileMenu.classList.add('hidden')));
}
$('#track-form').addEventListener('submit', event => { event.preventDefault(); track($('#track-reference').value); });
(async function initTrackPage() {
  $('#track-year').textContent = new Date().getFullYear();
  try {
    const response = await fetch('/api/public-data'); const data = await response.json(); const settings = data.settings || {};
    const parts = String(settings.brand_name || 'RESPAWN CAFE').trim().split(/\s+/); const last = parts.pop() || 'CAFE'; const first = parts.join(' '); const brand = `${esc(first ? first + ' ' : '')}<b>${esc(last)}</b>`;
    $('#track-brand-name').innerHTML = brand; $('#track-footer-brand').innerHTML = brand; $('#track-copyright').textContent = settings.brand_name || 'RESPAWN CAFE';
    $('#track-footer-location').textContent = settings.location || 'Cumilla, Bangladesh'; $('#track-call-link').href = `tel:${String(settings.phone || '').replace(/[^+\d]/g,'')}`;
    $('#track-call-link').textContent = `Need help? Call ${settings.phone || 'the cafe'}`;
  } catch (_) {}
  const reference = new URLSearchParams(window.location.search).get('reference');
  if (reference) track(reference);
})();
