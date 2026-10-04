import { STORAGE_KEY, TRANSPORTS, REGIONS, INTERESTS, initialState, restoreState, summarize, validate, buildPrompt } from './core.mjs';
const $ = s => document.querySelector(s);
let state = initialState();
let generated = '';
let toastTimer;
let storageHealthy = true;
try { const stored = localStorage.getItem(STORAGE_KEY); if (stored) state = restoreState(stored); }
catch { storageHealthy = false; $('#save-status').textContent = '保存内容を読み込めませんでした。元の保存データは保持しています。'; }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000); }
function invalidate() { generated = ''; $('#output-content').hidden = true; $('#empty-output').hidden = false; $('#errors').hidden = true; }
function save() {
  // 読込失敗時には既存データを自動で上書きしない。
  if (!storageHealthy) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); $('#save-status').textContent = 'このブラウザに保存しました。'; }
  catch { $('#save-status').textContent = '保存できませんでした。画面の内容は使えますが、閉じると失われる場合があります。'; }
}
function changed() { invalidate(); save(); renderStats(); }
function renderStats() {
  const s = summarize(state);
  $('#stat-people').textContent = s.total; $('#stat-days').textContent = Number.isInteger(state.trip.days) ? state.trip.days : '—'; $('#stat-modes').textContent = state.transports.length;
  const summary = $('#family-summary'); summary.replaceChildren();
  const left = document.createElement('strong'); left.textContent = `今回の旅行は ${s.total}人`;
  const right = document.createElement('span'); right.textContent = `成人 ${s.adults}人 ／ 18歳未満 ${s.children}人`;
  summary.append(left, right);
}
function renderMembers() {
  const list = $('#member-list'); list.replaceChildren();
  if (!state.members.length) { const p = document.createElement('div'); p.className = 'empty-family'; p.textContent = 'まずは、一緒に行く人を登録しましょう。'; list.append(p); }
  state.members.forEach((m, i) => {
    const row = document.createElement('div'); row.className = 'member-row';
    const label = document.createElement('label'); label.className = 'person-label';
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'member-check'; check.checked = m.selected; check.setAttribute('aria-label', `${m.label}を旅行に参加させる`);
    check.addEventListener('change', () => { m.selected = check.checked; changed(); });
    const avatar = document.createElement('span'); avatar.className = 'person-avatar'; avatar.textContent = m.age < 18 ? '子' : '大'; avatar.setAttribute('aria-hidden', 'true');
    const info = document.createElement('span'); info.className = 'person-info';
    const name = document.createElement('span'); name.className = 'person-name'; name.textContent = m.label;
    const age = document.createElement('span'); age.className = 'person-age'; age.textContent = `${m.age}歳・この端末だけの情報`;
    info.append(name, age); label.append(check, avatar, info);
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'icon-button'; edit.textContent = '編集'; edit.setAttribute('aria-label', `${m.label}を編集`);
    edit.addEventListener('click', () => {
      $('#member-label').value = m.label; $('#member-age').value = m.age; $('#member-form').dataset.editId = m.id;
      $('#member-form button').textContent = '更新'; $('#member-label').focus();
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button'; remove.textContent = '削除'; remove.setAttribute('aria-label', `${m.label}を削除`);
    remove.addEventListener('click', () => {
      if (!confirm(`「${m.label}」を登録から削除しますか？`)) return;
      state.members.splice(i, 1); if ($('#member-form').dataset.editId === m.id) resetMemberForm(); renderMembers(); changed();
    });
    row.append(label, edit, remove); list.append(row);
  });
}
function resetMemberForm() { $('#member-form').reset(); delete $('#member-form').dataset.editId; $('#member-form button').textContent = '＋ 登録'; }
$('#member-form').addEventListener('submit', event => {
  event.preventDefault(); const label = $('#member-label').value.trim(); const rawAge = $('#member-age').value; const age = Number(rawAge);
  if (!label || !rawAge || !Number.isInteger(age) || age < 0 || age > 120) { toast('呼び名と0〜120歳の年齢を入力してください。'); return; }
  const existing = state.members.find(m => m.id === $('#member-form').dataset.editId);
  if (existing) { existing.label = label; existing.age = age; }
  else { if (state.members.length >= 50) { toast('登録できるのは50人までです。'); return; } state.members.push({ id: crypto.randomUUID(), label, age, selected: true }); }
  resetMemberForm(); renderMembers(); changed(); $('#member-label').focus();
});
const transportSymbols = { '自家用車':'🚙', 'レンタカー':'🚗', '飛行機':'✈', '電車・新幹線':'🚆', 'バス':'🚌', '船':'⛴' };
for (const t of TRANSPORTS) {
  const label = document.createElement('label'); label.className = 'transport-chip';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = t; checkbox.checked = state.transports.includes(t); checkbox.setAttribute('aria-label', t);
  const symbol = document.createElement('span'); symbol.className = 'transport-symbol'; symbol.textContent = transportSymbols[t]; symbol.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span'); text.textContent = t; label.append(checkbox, symbol, text); $('#transport-list').append(label);
  checkbox.addEventListener('change', () => { state.transports = [...$('#transport-list').querySelectorAll('input:checked')].map(input => input.value); changed(); });
}
for (const region of REGIONS) { const option = document.createElement('option'); option.value = region; option.textContent = region; $('#region-select').append(option); }
for (const interest of INTERESTS) {
  const label = document.createElement('label'); label.className = 'interest-chip';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = interest; checkbox.checked = state.interests.includes(interest); checkbox.setAttribute('aria-label', interest);
  const text = document.createElement('span'); text.textContent = interest; label.append(checkbox, text); $('#interest-list').append(label);
  checkbox.addEventListener('change', () => { state.interests = [...$('#interest-list').querySelectorAll('input:checked')].map(input => input.value); changed(); });
}
function renderDestinationFields() {
  const decided = state.trip.destinationMode === 'decided';
  $('#known-destination').hidden = !decided; $('#exploring-fields').hidden = decided;
}
for (const input of $('#trip-form').querySelectorAll('[name]')) {
  if (input.type === 'radio') {
    input.checked = state.trip[input.name] === input.value;
    input.addEventListener('change', () => { if (!input.checked) return; state.trip[input.name] = input.value; renderDestinationFields(); changed(); });
    continue;
  }
  input.value = state.trip[input.name];
  input.addEventListener('input', () => { state.trip[input.name] = ['days', 'rooms'].includes(input.name) ? (input.value === '' ? NaN : Number(input.value)) : input.value; changed(); });
}
renderDestinationFields();
$('#trip-form').addEventListener('submit', event => {
  event.preventDefault(); const errors = validate(state);
  if (errors.length) { $('#errors').textContent = errors.join('\n'); $('#errors').hidden = false; $('#errors').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  generated = buildPrompt(state); $('#prompt-output').value = generated; $('#output-content').hidden = false; $('#empty-output').hidden = true; $('#errors').hidden = true;
  if (window.innerWidth < 900) $('.output-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); toast('個人情報を伏せた依頼文ができました。内容を確認してください。');
});
$('#copy-prompt').addEventListener('click', async () => {
  if (!generated) return;
  try { await navigator.clipboard.writeText(generated); toast('依頼文をコピーしました。AIチャットに貼り付けてください。'); }
  catch {
    $('#prompt-output').focus(); $('#prompt-output').select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    toast(copied ? '依頼文をコピーしました。AIチャットに貼り付けてください。' : '自動コピーできませんでした。選択した文章を手動でコピーしてください。');
  }
});
renderMembers(); renderStats();

for (const name of ['days', 'budget']) $(`[name="${name}"]`).setAttribute('inputmode', 'numeric');
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; $('#install-app').hidden = false;
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; $('#install-app').hidden = true; });
$('#install-app').addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt; installPrompt = undefined; $('#install-app').hidden = true;
  try { await prompt.prompt(); await prompt.userChoice; } catch { toast('ブラウザのメニューからホーム画面に追加してください。'); }
});
async function prepareOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    $('#offline-status').textContent = 'この環境ではオフライン対応を利用できません。スマホではHTTPSの配信先を開いてください。'; return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    $('#offline-status').textContent = 'オフラインでも使えます。ホーム画面に追加してお使いください。';
  } catch {
    $('#offline-status').textContent = 'オフラインの準備ができませんでした。接続を確認して、もう一度開いてください。';
  }
}
prepareOffline();
