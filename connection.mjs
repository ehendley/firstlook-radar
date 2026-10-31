// Only probes configuration and health. Photo analysis is always an explicit user action.
export function createServiceConnection({ configUrl, fetchImpl = globalThis.fetch, timeoutMs = 15000, now = Date.now, onChange = () => {} }) {
  let state = { status: 'idle', apiBase: '' };
  let pending = null;
  let lastStarted = -Infinity;
  function publish(status, apiBase = '') {
    state = { status, apiBase };
    onChange(state);
    return state;
  }
  async function probe() {
    publish('checking');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await fetchImpl(configUrl, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('configuration unavailable');
      let config;
      try { config = await response.json(); }
      catch (error) { if (controller.signal.aborted) throw error; return publish('invalid'); }
      if (typeof config?.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) return publish('unconfigured');
      let url;
      try { url = new URL(config.apiBaseUrl, configUrl); }
      catch { return publish('invalid'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return publish('invalid');
      const apiBase = url.href.replace(/\/$/, '');
      const health = await fetchImpl(`${apiBase}/api/health`, { cache: 'no-store', signal: controller.signal });
      if (!health.ok) throw new Error('health unavailable');
      const status = await health.json();
      if (status.configured === false) return publish('unconfigured', apiBase);
      if (status.configured !== true) throw new Error('invalid health');
      return publish('ready', apiBase);
    } catch {
      return publish(timedOut ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timer); }
  }
  function check({ automatic = false } = {}) {
    if (pending) return pending;
    if (state.status === 'ready' || (automatic && now() - lastStarted < 10000)) return Promise.resolve(state);
    lastStarted = now();
    pending = probe().finally(() => { pending = null; });
    return pending;
  }
  return { check, get state() { return state; } };
}
