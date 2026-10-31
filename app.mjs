import { DIMENSIONS, ARCHETYPES, SAMPLE_REPORT, validateReport } from './report.mjs';
import { preparePhoto, createRequestGate } from './media.mjs';
import { drawRadar, createShareCard, downloadCanvas, shareText } from './share.mjs';
import { createServiceConnection } from './connection.mjs';

const $ = selector => document.querySelector(selector);
const photoInput = $('#photo-input');
const form = $('#analyze-form');
const analyzeButton = $('#analyze-button');
const errorBox = $('#form-error');
const reportSection = $('#report-section');
const reportContent = $('#report-content');
const gate = createRequestGate();
const photoGate = createRequestGate();
let photo = null;
let photoPending = false;
let busy = false;
let controller = null;
let apiBase = '';
let serviceReady = false;
let toastTimer;
let currentReport = null;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button'; node.addEventListener('click', action);
  return node;
}

function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function setError(message = '') { errorBox.textContent = message; errorBox.hidden = !message; }

function updateSubmit() {
  analyzeButton.disabled = !photo || !$('#consent').checked || busy || photoPending || !serviceReady;
  analyzeButton.firstElementChild.textContent = photoPending ? '正在处理照片…' : busy ? '正在分析，请稍等…' : '生成我的初见报告';
}

function cancelAnalysis(announce = false) {
  gate.cancel();
  if (controller) controller.abort();
  controller = null; busy = false;
  $('#loading-panel').hidden = true;
  form.removeAttribute('aria-busy'); updateSubmit();
  if (announce) showToast('分析已取消。你的照片仍在这里，可以重新开始。');
}

function discardPhoto() {
  if (photo) URL.revokeObjectURL(photo.url);
  photo = null;
  $('#preview-image').removeAttribute('src');
  $('#photo-preview').hidden = true; $('#upload-label').hidden = false;
  $('#upload-label strong').textContent = '把你的照片放在这里';
  photoInput.value = ''; updateSubmit();
}

async function selectPhoto(file) {
  cancelAnalysis();
  const token = photoGate.begin();
  discardPhoto();
  reportSection.hidden = true; currentReport = null;
  $('#consent').checked = false;
  setError();
  if (!file) return;
  photoPending = true; updateSubmit();
  $('#upload-label strong').textContent = '正在轻轻整理照片…';
  try {
    const prepared = await preparePhoto(file);
    if (!photoGate.isCurrent(token)) { URL.revokeObjectURL(prepared.url); return; }
    photo = prepared;
    $('#preview-image').src = photo.url;
    $('#photo-preview').hidden = false; $('#upload-label').hidden = true;
    $('#photo-meta').textContent = `${photo.width} × ${photo.height} · 已处理为 JPEG`;
    showToast('照片已准备好，选择场景并确认授权即可分析。');
  } catch (error) {
    if (photoGate.isCurrent(token)) setError(error.message || '照片处理失败，请换一张再试。');
  } finally {
    if (photoGate.isCurrent(token)) {
      photoPending = false;
      $('#upload-label strong').textContent = '把你的照片放在这里'; updateSubmit();
    }
  }
}

photoInput.addEventListener('change', () => { if (photoInput.files[0]) selectPhoto(photoInput.files[0]); });
$('#replace-photo').addEventListener('click', () => photoInput.click());
$('#remove-photo').addEventListener('click', () => {
  cancelAnalysis(); photoGate.cancel(); photoPending = false; discardPhoto();
  $('#consent').checked = false; reportSection.hidden = true; currentReport = null; setError();
  $('#upload-label strong').textContent = '把你的照片放在这里'; updateSubmit(); photoInput.focus();
});
$('#consent').addEventListener('change', updateSubmit);
form.addEventListener('change', event => {
  if (event.target.name === 'scene' && busy) cancelAnalysis(true);
});
$('#cancel-analysis').addEventListener('click', () => cancelAnalysis(true));

const dropZone = $('#drop-zone');
let dragDepth = 0;
dropZone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; });
dropZone.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropZone.classList.remove('drag-over'); } });
dropZone.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; dropZone.classList.remove('drag-over');
  const files = event.dataTransfer?.files;
  if (!files?.length) return;
  if (files.length !== 1) {
    cancelAnalysis(); photoGate.cancel(); photoPending = false; discardPhoto();
    reportSection.hidden = true; currentReport = null; $('#consent').checked = false;
    setError('一次放一张就好。请选一张清晰的单人照片。'); updateSubmit(); return;
  }
  selectPhoto(files[0]);
});

const serviceMessages = {
  checking: '正在连接分析服务，请稍等…',
  ready: '分析服务已准备好。确认授权后，照片才会发送。',
  unconfigured: '真实分析尚未开通。你仍可上传预览，或先查看示例报告。',
  invalid: '分析服务设置有误，请联系网站维护者。你仍可查看示例报告。',
  timeout: '连接分析服务超时。已选照片会保留，请重新连接或切换网络后再试。',
  unavailable: '暂时连不上分析服务，当前网络可能无法访问服务地址。已选照片会保留，请重新连接或切换网络后再试。',
};
const connection = createServiceConnection({
  configUrl: new URL('./config.json', import.meta.url),
  onChange(state) {
    serviceReady = state.status === 'ready';
    apiBase = state.apiBase;
    $('#service-message').textContent = serviceMessages[state.status];
    $('#service-notice').classList.toggle('ready', serviceReady);
    $('#service-retry').hidden = ['idle', 'checking', 'ready'].includes(state.status);
    updateSubmit();
  },
});
$('#service-retry').addEventListener('click', () => connection.check());
window.addEventListener('online', () => connection.check({automatic:true}));
window.addEventListener('pageshow', event => { if (event.persisted) connection.check({automatic:true}); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') connection.check({automatic:true});
});
connection.check();

const errorMessages = {
  RATE_LIMITED: '今天的好奇有点拥挤，请稍后再试。',
  TIMEOUT: '这次分析等得有点久，请重试一次。',
  NOT_CONFIGURED: '真实分析服务尚未开通，请先查看示例报告。',
  INVALID_REPORT: '这次没有得到完整报告，请重新分析一次。',
  IMAGE_TOO_LARGE: '处理后的照片仍然太大，请换一张较小的照片。',
};

form.addEventListener('submit', async event => {
  event.preventDefault(); setError();
  if (!photo) { setError('先选择一张清晰的单人照片吧。'); return; }
  if (!$('#consent').checked) { setError('请先阅读并勾选照片使用与 AI 分析授权。'); $('#consent').focus(); return; }
  if (!serviceReady) { setError(connection.state.status === 'checking' ? '正在连接分析服务，请稍等片刻。' : '尚未连接分析服务，请点击“重新连接”后再试。'); return; }
  cancelAnalysis();
  const token = gate.begin();
  const requestController = new AbortController();
  controller = requestController;
  busy = true; updateSubmit();
  form.setAttribute('aria-busy','true'); $('#loading-panel').hidden = false;
  reportSection.hidden = true; currentReport = null;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; requestController.abort(); }, 85000);
  try {
    const response = await fetch(`${apiBase}/api/analyze`, {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:requestController.signal,
      body:JSON.stringify({image:photo.dataURL, scene:new FormData(form).get('scene'), consent:true}),
    });
    const data = await response.json().catch(() => { throw new Error('分析服务返回了不完整内容，请稍后重试。'); });
    if (!response.ok) throw new Error(errorMessages[data.error?.code] || data.error?.message || '分析没有完成，请稍后重试。');
    if (data.mode !== 'live') throw new Error('服务未返回真实分析结果，请稍后重试。');
    const report = validateReport(data.report);
    if (gate.isCurrent(token)) renderReport(report, 'live');
  } catch (error) {
    if (!gate.isCurrent(token)) return;
    setError(timedOut ? '这次分析等得有点久，已自动停止。请再试一次。' : error.name === 'AbortError' ? '分析已取消，可以随时重新开始。' : error.message || '网络有点不顺，请检查连接后重试。');
  } finally {
    clearTimeout(timeout);
    if (gate.isCurrent(token)) { busy = false; controller = null; form.removeAttribute('aria-busy'); $('#loading-panel').hidden = true; updateSubmit(); }
  }
});

function heading(number, title, note = '') {
  const row = element('div','report-heading');
  row.append(element('span','',number), element('h3','',title));
  if (note) row.append(element('p','',note));
  return row;
}

function focusReport() {
  reportSection.hidden = false;
  const title = $('#report-title');
  if (title) { title.tabIndex = -1; title.focus({preventScroll:true}); }
  reportSection.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
}

function retake() {
  cancelAnalysis(); photoGate.cancel(); photoPending = false; discardPhoto();
  currentReport = null; reportSection.hidden = true; $('#consent').checked = false;
  setError(); updateSubmit();
  $('#test').scrollIntoView({behavior:'smooth',block:'start'});
  photoInput.focus({preventScroll:true});
}

function renderReport(report, mode) {
  currentReport = {report, mode};
  reportContent.replaceChildren();
  $('#report-mode').textContent = mode === 'sample' ? '示例报告 · 非本人分析' : '你的真实分析报告';
  if (mode === 'sample') reportContent.append(element('p','report-sample-note','这是一份完整示例。这里的文字、类型与分数均不来自你的照片；生成真实报告需要上传照片、确认授权并连接分析服务。'));
  if (report.status === 'retake') {
    const card = element('div','retake-card');
    card.append(element('span','retake-symbol','◎'));
    const title = element('h2','','这张照片，还需要一点调整'); title.id = 'report-title';
    card.append(title,element('p','',report.message),button('换一张照片，再发现一次 ↗','button primary',retake));
    reportContent.append(card); focusReport(); return;
  }
  const identity = element('article','report-identity');
  const copy = element('div','identity-copy');
  const typeRow = element('div','identity-type-row');
  const typeIndex = ARCHETYPES.findIndex(a => a.id === report.archetype.id) + 1;
  typeRow.append(element('span','micro-label','你的初见身份 / FIRSTLOOK TYPE'),element('span','type-number',`0${typeIndex} / 08`));
  const title = element('h2','',report.archetype.name); title.id = 'report-title';
  const keywords = element('div','identity-keywords'); report.keywords.forEach(word => keywords.append(element('span','',word)));
  copy.append(typeRow,title,element('p','identity-headline',report.archetype.headline),keywords,element('p','identity-summary',report.archetype.summary));
  const radarWrap = element('div','identity-radar');
  const radar = element('canvas','report-radar');
  radar.setAttribute('role','img');
  radar.setAttribute('aria-label',report.dimensions.map(d => `${d.label}：${d.score === null ? '依据不足' : `${Math.round(d.score)}，满值100`}`).join('；'));
  radarWrap.append(radar,element('p','radar-caption','本张照片的视觉效果呈现强度 · 依据不足处留空'));
  identity.append(copy,radarWrap); reportContent.append(identity);
  drawRadar(radar,report.dimensions);

  reportContent.append(heading('01 / SIX DIMENSIONS','六个维度，看见细节','分数没有高低好坏之分，也不是人格测量。'));
  const dimensions = element('div','dimension-grid');
  report.dimensions.forEach(d => {
    const card = element('article','dimension-item');
    const top = element('div','dimension-top');
    const score = element('span',`dimension-score${d.score === null ? ' no-score' : ''}`,d.score === null ? '依据不足' : String(Math.round(d.score)));
    if (d.score !== null) score.append(element('small','','/100'));
    top.append(element('h4','',d.label),score);
    const bar = element('div','score-bar'); bar.setAttribute('aria-hidden','true');
    if (d.score !== null) { const fill = element('span'); fill.style.width = `${d.score}%`; bar.append(fill); }
    card.append(top,bar,element('p','',d.note),element('p','evidence',d.evidence));
    card.title = DIMENSIONS.find(item => item.key === d.key)?.description || '';
    dimensions.append(card);
  });
  reportContent.append(dimensions,heading('02 / THE LITTLE THINGS','三个让人记住的细节'));
  const highlights = element('div','highlight-grid');
  report.highlights.forEach((h,index) => {
    const card = element('article','highlight-card');
    card.append(element('span','highlight-index',`MEMORY / 0${index + 1}`),element('h4','',h.title),element('p','',h.description),element('p','evidence',h.evidence));
    highlights.append(card);
  });
  reportContent.append(highlights);
  const icebreaker = element('aside','icebreaker');
  const iceCopy = element('div');
  iceCopy.append(element('span','micro-label','一句初见联想 / 趣味创作'),element('blockquote','',report.icebreaker.line),element('p','',report.icebreaker.context));
  icebreaker.append(element('span','icebreaker-mark','“'),iceCopy); reportContent.append(icebreaker);
  reportContent.append(heading('03 / A LITTLE INSPIRATION','让这一面的你，更有感觉','小幅调整，让可见优势继续发光。'));
  const suggestions = element('div','suggestions');
  report.suggestions.forEach((s,index) => {
    const row = element('article','suggestion-row'); const body = element('div');
    body.append(element('h4','',s.title),element('p','',s.action),element('p','reason',s.reason));
    row.append(element('span','suggestion-number',`0${index + 1}`),body); suggestions.append(row);
  });
  reportContent.append(suggestions);

  const share = element('section','share-panel');
  const shareCopy = element('div'); shareCopy.append(element('h3','','把这一面的你，带走。'),element('p','','一张属于这次初见的身份卡。默认不放照片，由你决定分享多少。'));
  const controls = element('div','share-controls'); const actions = element('div','share-actions');
  const photoLabel = element('label','checkbox-label share-checkbox');
  const photoCheckbox = document.createElement('input'); photoCheckbox.type = 'checkbox';
  photoCheckbox.disabled = mode === 'sample' || !photo;
  photoLabel.append(photoCheckbox,element('span','',mode === 'sample' ? '示例卡不包含你的照片' : '分享卡加入我的照片（默认不加入）'));
  const download = button('下载身份卡 PNG ↓','button primary',async () => {
    download.disabled = true; download.textContent = '正在制作身份卡…';
    try {
      const card = await createShareCard(report,{mode,photoURL:photoCheckbox.checked && photo ? photo.url : null});
      await downloadCanvas(card,`初见雷达-${mode === 'sample' ? '示例-' : ''}${report.archetype.name}.png`);
      showToast('身份卡已生成，浏览器将开始下载。');
    } catch (error) { showToast(error.message || '图片生成失败，请再试一次。'); }
    finally { download.disabled = false; download.textContent = '下载身份卡 PNG ↓'; }
  });
  const copyButton = button('复制分享文案 ↗','button quiet',async () => {
    const text = shareText(report,mode);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea'); textarea.value = text;
        textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.append(textarea); textarea.select();
        const copied = document.execCommand('copy'); textarea.remove();
        if (!copied) throw new Error('copy');
      }
      showToast('分享文案已复制，带上你的初见关键词出发吧。');
    } catch { showToast('浏览器未允许复制，请稍后在安全连接下重试。'); }
  });
  actions.append(download,copyButton); controls.append(actions,photoLabel); share.append(shareCopy,controls); reportContent.append(share);
  const notes = element('div','report-notes');
  notes.append(element('p','',`照片可读性：${report.quality.level === 'limited' ? '部分依据有限' : '可见细节较清晰'}。${report.quality.note}`),element('p','',report.scope));
  reportContent.append(notes);
  const resetWrap = element('div','report-reset'); resetWrap.append(button('换张照片，看看另一面的我 ↗','button quiet',retake)); reportContent.append(resetWrap);
  focusReport();
}

document.querySelectorAll('[data-sample]').forEach(node => node.addEventListener('click', event => {
  event.preventDefault(); cancelAnalysis(); setError(); renderReport(SAMPLE_REPORT,'sample');
}));
window.addEventListener('pagehide', () => { cancelAnalysis(); photoGate.cancel(); discardPhoto(); });
