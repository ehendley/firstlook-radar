export const DIMENSIONS = Object.freeze([
  { key: 'warmth', label: '亲近感', description: '笑容、嘴角、面部朝向与视线的视觉呈现，不代表善良或可信。' },
  { key: 'freshness', label: '清爽感', description: '配色、造型线条和背景的简洁程度，不代表身体健康。' },
  { key: 'ease', label: '松弛感', description: '可见姿态、肩颈和动作呈现，不判断实际情绪。' },
  { key: 'polish', label: '利落感', description: '衣饰搭配、轮廓和细节组织，不推断财富或职业。' },
  { key: 'presence', label: '存在感', description: '色彩对比、造型辨识度和画面焦点，不代表外向或领导力。' },
  { key: 'story', label: '故事感', description: '光影、环境、道具与构图的画面叙事，不推断真实经历。' },
].map(Object.freeze));

export const ARCHETYPES = Object.freeze([
  { id: 'warm_light', name: '暖光破冰型' }, { id: 'breeze', name: '微风同频型' },
  { id: 'cinema', name: '清醒电影型' }, { id: 'relaxed', name: '松弛主场型' },
  { id: 'focus', name: '鲜明焦点型' }, { id: 'blank', name: '留白故事型' },
  { id: 'spark', name: '轻快灵感型' }, { id: 'clean', name: '干净直球型' },
].map(Object.freeze));

export const SCOPE = '仅描述本张照片中可见的表达、造型与画面。分数表示视觉效果的呈现强度，不是颜值、人格或优劣，也不代表他人的真实评价。';
const RETAKE_REASONS = ['no_person', 'multiple_people', 'unclear', 'unsupported'];
const object = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('报告格式不正确');
  return value;
};
const text = (value, max = 400) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new Error('报告文字不完整');
  return value.trim();
};
const exactArray = (value, length) => {
  if (!Array.isArray(value) || value.length !== length) throw new Error('报告项目数量不正确');
  return value;
};

/** Select and validate every returned field. Text remains plain text, never HTML. */
export function validateReport(input) {
  const r = object(input);
  if (r.version !== '1.0') throw new Error('报告版本不正确');
  if (r.status === 'retake') {
    if (!RETAKE_REASONS.includes(r.reason)) throw new Error('重拍原因不正确');
    return { version: '1.0', status: 'retake', reason: r.reason, message: text(r.message, 300) };
  }
  if (r.status !== 'ready') throw new Error('报告状态不正确');
  const archetype = object(r.archetype);
  const known = ARCHETYPES.find(a => a.id === archetype.id);
  if (!known) throw new Error('报告类型不正确');
  const sourceDimensions = exactArray(r.dimensions, 6).map(object);
  if (new Set(sourceDimensions.map(d => d.key)).size !== 6) throw new Error('维度重复');
  const dimensions = DIMENSIONS.map(d => {
    const source = sourceDimensions.find(item => item.key === d.key);
    if (!source || !(source.score === null || (typeof source.score === 'number' && Number.isFinite(source.score) && source.score >= 0 && source.score <= 100))) throw new Error('维度分数不正确');
    return { key: d.key, label: d.label, score: source.score, note: text(source.note, 240), evidence: text(source.evidence, 240) };
  });
  const quality = object(r.quality);
  if (!['good', 'limited'].includes(quality.level)) throw new Error('图片质量状态不正确');
  const icebreaker = object(r.icebreaker);
  return {
    version: '1.0', status: 'ready',
    archetype: { id: known.id, name: known.name, headline: text(archetype.headline, 80), summary: text(archetype.summary, 400) },
    keywords: exactArray(r.keywords, 3).map(value => text(value, 20)), dimensions,
    highlights: exactArray(r.highlights, 3).map(value => { const h = object(value); return { title: text(h.title, 40), description: text(h.description, 300), evidence: text(h.evidence, 240) }; }),
    icebreaker: { line: text(icebreaker.line, 400), context: text(icebreaker.context, 240) },
    suggestions: exactArray(r.suggestions, 3).map(value => { const s = object(value); return { title: text(s.title, 40), action: text(s.action, 300), reason: text(s.reason, 240) }; }),
    quality: { level: quality.level, note: text(quality.note, 240) }, scope: SCOPE,
  };
}

export const SAMPLE_REPORT = validateReport({
  version: '1.0', status: 'ready',
  archetype: { id: 'breeze', name: '微风同频型', headline: '不用很用力，也会让人想靠近一点。', summary: '浅色造型、自然光和面向镜头的笑容，让这张示例照片呈现轻快、容易开启对话的视觉感觉。' },
  keywords: ['自然', '清爽', '轻轻有趣'],
  dimensions: [
    { key: 'warmth', score: 85, note: '朝向镜头的笑容带来亲近的视觉感觉。', evidence: '嘴角上扬，面部朝向镜头。' },
    { key: 'freshness', score: 80, note: '浅色搭配与简洁背景显得清爽。', evidence: '浅色上衣，背景颜色不繁杂。' },
    { key: 'ease', score: 75, note: '自然的姿态为画面留出呼吸感。', evidence: '肩线平缓，手臂自然放置。' },
    { key: 'polish', score: 60, note: '衣饰细节保持简洁。', evidence: '衣服轮廓清楚，配饰数量少。' },
    { key: 'presence', score: 55, note: '柔和对比让主体轻轻浮现。', evidence: '人物与背景之间有适度的明暗差。' },
    { key: 'story', score: 70, note: '日常光线让画面有片刻停留的意味。', evidence: '侧面的自然光与留白形成层次。' },
  ],
  highlights: [
    { title: '笑容是开场', description: '面向镜头的轻笑成为画面的第一个记忆点。', evidence: '嘴角上扬，视线靠近镜头。' },
    { title: '浅色带来轻盈', description: '造型与背景的柔和配色，让画面显得干净轻快。', evidence: '浅色衣服和低对比背景。' },
    { title: '光线留了一点故事', description: '自然光让普通片刻有了可以回味的层次。', evidence: '脸侧与背景保留柔和明暗。' },
  ],
  icebreaker: { line: '“这里的光好舒服，你也觉得吗？”', context: '趣味创作的开场白，不是对真实他人想法的调查。' },
  suggestions: [
    { title: '保留这点笑意', action: '拍摄时轻轻呼气，保留自然的嘴角弧度。', reason: '让照片延续轻快的视觉感觉。' },
    { title: '让浅色有一点层次', action: '尝试用一件有细微纹理的浅色上衣搭配简洁背景。', reason: '在清爽配色中增加细节。' },
    { title: '靠近柔和的光', action: '把镜头移到窗边，避免直射强光，并为头顶留出少量空间。', reason: '柔和光线与留白能让主体更清楚。' },
  ],
  quality: { level: 'good', note: '示例报告：以上内容与分数不来自你的上传照片。' }, scope: SCOPE,
});
