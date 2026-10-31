import { containRect, loadImage } from './media.mjs';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

export function drawRadar(canvas, dimensions, options = {}) {
  const width = options.width || 390;
  const height = options.height || 310;
  const ratio = options.ratio || Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  const cx = width / 2;
  const cy = height / 2;
  const fontScale = options.fontScale || 1;
  const radius = Math.min(width * 0.31, height * 0.35 - (fontScale - 1) * 14);
  const point = (index, size) => ({ x: cx + Math.sin(index * Math.PI / 3) * size, y: cy - Math.cos(index * Math.PI / 3) * size });
  ctx.strokeStyle = '#d0d7c1';
  ctx.lineWidth = fontScale;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let index = 0; index < 6; index++) {
      const p = point(index, radius * ring / 4);
      index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath(); ctx.stroke();
  }
  for (let index = 0; index < 6; index++) {
    const p = point(index, radius);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  const points = dimensions.map((d, index) => d.score === null ? null : point(index, radius * d.score / 100));
  ctx.lineWidth = 2 * fontScale;
  ctx.strokeStyle = '#7a9144';
  if (points.every(Boolean)) {
    ctx.beginPath(); points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath(); ctx.fillStyle = '#cce97d88'; ctx.fill(); ctx.stroke();
  } else {
    // Missing data is a gap, never a zero point or a filled polygon.
    points.forEach((p, index) => {
      const next = points[(index + 1) % 6];
      if (p && next) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(next.x, next.y); ctx.stroke(); }
    });
  }
  points.filter(Boolean).forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.1 * fontScale, 0, Math.PI * 2); ctx.fillStyle = '#718739'; ctx.fill(); });
  dimensions.forEach((d, index) => {
    const p = point(index, radius + 24 * fontScale);
    ctx.textAlign = index === 0 || index === 3 ? 'center' : index < 3 ? 'left' : 'right';
    ctx.fillStyle = '#5b6650';
    ctx.font = `${11 * fontScale}px ${FONT}`;
    ctx.fillText(d.label, p.x, p.y - 3 * fontScale);
    ctx.fillStyle = '#929b81';
    ctx.font = `${9 * fontScale}px ${FONT}`;
    ctx.fillText(d.score === null ? '依据不足' : String(Math.round(d.score)), p.x, p.y + 12 * fontScale);
  });
}

function lines(ctx, text, width) {
  const result = [];
  let line = '';
  for (const char of text) {
    if (char === '\n') { result.push(line); line = ''; continue; }
    if (line && ctx.measureText(line + char).width > width) { result.push(line); line = char; }
    else line += char;
  }
  if (line) result.push(line);
  return result;
}

function paragraph(ctx, text, x, y, width, lineHeight) {
  const wrapped = lines(ctx, text, width);
  wrapped.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + wrapped.length * lineHeight;
}

function rounded(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export async function createShareCard(report, { mode = 'live', photoURL = null } = {}) {
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d');
  if (!measure) throw new Error('浏览器暂不支持生成图片，请使用较新的浏览器。');
  measure.font = `500 37px ${FONT}`;
  const headlineLines = lines(measure, report.archetype.headline, 850);
  const scopeText = mode === 'sample' ? `示例报告 · 非上传照片分析。${report.scope}` : report.scope;
  measure.font = `24px ${FONT}`;
  const scopeLines = lines(measure, scopeText, 850);
  const tagWidths = report.keywords.map(word => measure.measureText(word).width + 44);
  let tagRows = 1;
  let tagWidth = 0;
  for (const width of tagWidths) {
    if (tagWidth && tagWidth + width > 850) { tagRows++; tagWidth = 0; }
    tagWidth += width + 16;
  }
  const photoHeight = photoURL ? 530 : 0;
  const height = 1290 + (headlineLines.length - 1) * 55 + (scopeLines.length - 2) * 36 + (tagRows - 1) * 62 + photoHeight;
  canvas.width = 1080;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f5ed'; ctx.fillRect(0, 0, 1080, height);
  ctx.fillStyle = '#fffef8'; rounded(ctx, 55, 50, 970, height - 100, 20); ctx.fill();
  ctx.strokeStyle = '#24251f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#d5f567'; ctx.beginPath(); ctx.arc(118, 116, 28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#24251f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(118, 116, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(118, 116); ctx.lineTo(142, 92); ctx.stroke();
  ctx.fillStyle = '#24251f'; ctx.font = `700 32px ${FONT}`; ctx.fillText('初见雷达', 165, 116);
  ctx.font = `14px ${FONT}`; ctx.fillStyle = '#808a6c'; ctx.fillText('FIRSTLOOK RADAR / 你的初见档案', 167, 140);
  if (mode === 'sample') {
    ctx.fillStyle = '#d5f567'; rounded(ctx, 800, 93, 170, 49, 6); ctx.fill();
    ctx.fillStyle = '#4b6030'; ctx.font = `600 24px ${FONT}`; ctx.fillText('示例报告', 834, 126);
  } else {
    ctx.fillStyle = '#8a9479'; ctx.font = `16px ${FONT}`; ctx.fillText('ONE PHOTO. ONE VIEW.', 767, 122);
  }
  ctx.strokeStyle = '#d2d8c4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(105, 180); ctx.lineTo(975, 180); ctx.stroke();
  let y = 236;
  if (photoURL) {
    const photo = await loadImage(photoURL);
    const fitted = containRect(photo.naturalWidth, photo.naturalHeight, 870, 480);
    ctx.save(); rounded(ctx, 105, y, 870, 480, 10); ctx.clip();
    ctx.fillStyle = '#f0f2e6'; ctx.fillRect(105, y, 870, 480);
    ctx.drawImage(photo, 105 + fitted.x, y + fitted.y, fitted.width, fitted.height); ctx.restore();
    y += 530;
  }
  ctx.font = `18px ${FONT}`; ctx.fillStyle = '#8a9479'; ctx.fillText('THIS IS MY FIRSTLOOK TYPE', 110, y);
  y += 88;
  ctx.font = `800 78px ${FONT}`; ctx.fillStyle = '#24251f'; ctx.fillText(report.archetype.name, 105, y);
  y += 67;
  ctx.font = `500 37px ${FONT}`;
  y = paragraph(ctx, report.archetype.headline, 110, y, 850, 55);
  y += 7;
  let tagX = 110;
  let tagY = y;
  ctx.font = `24px ${FONT}`;
  report.keywords.forEach((word,index) => {
    const w = tagWidths[index];
    if (tagX > 110 && tagX + w > 960) { tagX = 110; tagY += 62; }
    ctx.fillStyle = '#edf2dc'; rounded(ctx, tagX, tagY, w, 47, 24); ctx.fill();
    ctx.strokeStyle = '#cbd6b4'; ctx.stroke();
    ctx.fillStyle = '#63764b'; ctx.fillText(word, tagX + 22, tagY + 32); tagX += w + 16;
  });
  y = tagY + 64;
  const radar = document.createElement('canvas');
  drawRadar(radar, report.dimensions, {width:830,height:470,ratio:1,fontScale:2});
  ctx.drawImage(radar, 125, y);
  y += 480;
  ctx.fillStyle = '#8a9479'; ctx.font = `19px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('分数是视觉效果的呈现强度，每一种风格都有看点。', 540, y); ctx.textAlign = 'left';
  y += 45;
  ctx.setLineDash([7, 7]); ctx.strokeStyle = '#b3bea0'; ctx.beginPath(); ctx.moveTo(95, y); ctx.lineTo(985, y); ctx.stroke(); ctx.setLineDash([]);
  y += 45;
  ctx.font = `24px ${FONT}`; ctx.fillStyle = '#7a846a';
  y = paragraph(ctx, scopeText, 110, y, 850, 36);
  ctx.font = `14px ${FONT}`; ctx.fillStyle = '#929b82'; ctx.fillText('STAY CURIOUS. BE YOU.  /  FIRSTLOOK RADAR', 110, height - 79);
  return canvas;
}

export function shareText(report, mode = 'live') {
  return `${mode === 'sample' ? '【示例报告】\n' : ''}我的初见雷达：${report.archetype.name}\n${report.archetype.headline}\n#${report.keywords.join(' #')}\n\n${report.scope}`;
}

export async function downloadCanvas(canvas, name) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片生成失败，请再试一次。');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
