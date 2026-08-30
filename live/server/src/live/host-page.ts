// Operator console for running a live auction stream. Ugly-but-usable by design:
// no build step, no external assets, one inline <script>. Plan 3 owns the pretty
// customer-facing viewer page; this one only needs to work for the host.
export const HOST_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Circular Fash Host Console</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #0E0E0E; color: #fff;
    font-family: -apple-system, Segoe UI, Arial, sans-serif;
    padding: 16px 20px 60px;
  }
  .mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #999; margin: 0 0 10px; }
  button {
    background: #1c1c1c; color: #fff; border: 1px solid #555; border-radius: 0;
    padding: 8px 14px; font-size: 14px; cursor: pointer; margin: 0 8px 8px 0;
  }
  button:hover { background: #2a2a2a; }
  button.primary { background: #E8FF52; color: #0E0E0E; border-color: #E8FF52; font-weight: 700; }
  input {
    background: #1c1c1c; color: #fff; border: 1px solid #555; border-radius: 0;
    padding: 8px; font-size: 14px;
  }
  #login { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
  #console { display: none; }
  .panel { border: 1px solid #333; padding: 14px 16px; margin-bottom: 16px; max-width: 640px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid #222; }
  .row:last-child { border-bottom: none; }
  .big { font-size: 28px; }
  .muted { color: #888; }
  .actions { padding-top: 8px; }
  #loginError { color: #ff6b6b; }
  #chatBox { max-height: 260px; overflow-y: auto; }
  .chat-line { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid #222; font-size: 13px; }
  .chat-line .who { color: #E8FF52; }
  .chat-line .text { flex: 1; word-break: break-word; }
  .chat-line button { padding: 2px 8px; font-size: 11px; margin: 0; }
</style>
</head>
<body>
  <h1>Circular Fash &mdash; Host Console</h1>

  <div id="login">
    <input id="pw" type="password" placeholder="host password" autocomplete="off">
    <button id="connectBtn" class="primary">Connect</button>
    <span id="loginError" class="mono"></span>
  </div>

  <div id="console">
    <div class="panel">
      <h2>Stream</h2>
      <div class="row">
        <span id="streamTitle" class="mono">no stream</span>
        <span>
          <button id="newStreamBtn">New stream</button>
          <button id="endStreamBtn">End stream</button>
        </span>
      </div>
    </div>

    <div class="panel">
      <h2>On screen</h2>
      <div id="pinnedBox"><div class="muted">nothing pinned</div></div>
    </div>

    <div class="panel">
      <h2>Queue</h2>
      <button id="addItemBtn">Add item</button>
      <div id="queueBox"></div>
    </div>

    <div class="panel">
      <h2>Chat <span id="viewerCount" class="muted mono"></span></h2>
      <div id="chatBox"><div class="muted">no messages yet</div></div>
    </div>
  </div>

<script>
(function () {
  var pw = null;
  var streamId = null;
  var currentEndsAt = null;
  var pollTimer = null;
  var tickTimer = null;

  function fmtKr(ore) {
    return (ore / 100).toLocaleString('sv-SE') + ' kr';
  }

  function fmtCountdown(endsAt) {
    if (!endsAt) return '';
    var ms = new Date(endsAt).getTime() - Date.now();
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function escapeHtml(s) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, function (c) { return map[c]; });
  }

  async function api(path, method, body) {
    var opts = { method: method, headers: { Authorization: 'Bearer ' + pw } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(path, opts);
    var data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      alert((data && data.error) || ('request failed: ' + res.status));
      throw new Error('api_error');
    }
    return data;
  }

  async function fetchState() {
    var res;
    try {
      res = await fetch('/host/state', { headers: { Authorization: 'Bearer ' + pw } });
    } catch (e) { return; /* network blip during polling — try again next tick */ }
    if (res.status === 401) { backToLogin('password rejected — reconnect'); return; }
    if (!res.ok) return; /* do not alert on poll failures — only user-initiated actions alert */
    var data = null;
    try { data = await res.json(); } catch (e) { return; }
    render(data);
  }

  function pinnedActionsHtml(p) {
    var html = '';
    if (p.mode === 'auction' && p.state === 'pinned') html += '<button data-act="open">Open auction</button>';
    if (p.state === 'auction_open') html += '<button data-act="extend">Extend +60s</button>';
    if (['pinned', 'auction_open', 'payment_failed'].indexOf(p.state) !== -1) html += '<button data-act="pass">Pass</button>';
    if (p.state === 'payment_failed') html += '<button data-act="second-chance">Second chance</button>';
    return html;
  }

  function render(state) {
    streamId = state.stream ? state.stream.id : null;
    document.getElementById('streamTitle').textContent =
      state.stream ? state.stream.title + ' (' + state.stream.status + ')' : 'no stream';

    var box = document.getElementById('pinnedBox');
    var p = state.pinned;
    currentEndsAt = p ? p.endsAt : null;
    if (!p) {
      box.innerHTML = '<div class="muted">nothing pinned</div>';
    } else {
      var priceOre = p.mode === 'buy_now' ? p.buyNowPriceOre : (p.currentBidOre || p.startingBidOre);
      var html = '';
      html += '<div class="row"><span>' + escapeHtml(p.title) + '</span><span class="mono">' + escapeHtml(p.state) + '</span></div>';
      html += '<div class="row"><span>' + (p.mode === 'buy_now' ? 'Buy now' : 'Current bid') + '</span><span class="mono big">' + fmtKr(priceOre || 0) + '</span></div>';
      if (p.state === 'auction_open') {
        html += '<div class="row"><span>Ends in</span><span class="mono" id="countdown">' + fmtCountdown(p.endsAt) + '</span></div>';
      }
      if (p.winner) {
        var who = p.winnerEmail ? escapeHtml(p.winnerEmail) : escapeHtml(p.winner.emailMasked);
        html += '<div class="row"><span>Winner</span><span class="mono">' + who + ' &mdash; ' + escapeHtml(p.chargeStatus || 'unknown') + '</span></div>';
      }
      html += '<div class="actions">' + pinnedActionsHtml(p) + '</div>';
      box.innerHTML = html;
      box.querySelectorAll('button[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () { onPinnedAction(btn.dataset.act, p.itemId); });
      });
    }

    var qbox = document.getElementById('queueBox');
    var queue = state.queue || [];
    if (!queue.length) {
      qbox.innerHTML = '<div class="muted">queue empty</div>';
    } else {
      qbox.innerHTML = queue.map(function (item) {
        var price = item.mode === 'buy_now' ? item.buyNowPriceOre : item.startingBidOre;
        return '<div class="row"><span>' + escapeHtml(item.title) + ' <span class="muted mono">(' + escapeHtml(item.mode) + ')</span></span>' +
          '<span class="mono">' + fmtKr(price || 0) + '</span>' +
          '<button data-pin="' + escapeHtml(item.itemId) + '">Pin</button></div>';
      }).join('');
      qbox.querySelectorAll('button[data-pin]').forEach(function (btn) {
        btn.addEventListener('click', function () { pinItem(btn.dataset.pin); });
      });
    }
  }

  async function onPinnedAction(act, itemId) {
    try {
      if (act === 'open') {
        var secStr = prompt('Duration in seconds', '60');
        if (secStr === null) return;
        var durationSec = parseInt(secStr, 10);
        if (!durationSec) durationSec = 60;
        await api('/host/items/' + itemId + '/open-auction', 'POST', { durationSec: durationSec });
      } else if (act === 'extend') {
        await api('/host/items/' + itemId + '/extend', 'POST', { extraSec: 60 });
      } else if (act === 'pass') {
        await api('/host/items/' + itemId + '/pass', 'POST');
      } else if (act === 'second-chance') {
        await api('/host/items/' + itemId + '/second-chance', 'POST');
      }
      fetchState();
    } catch (e) { /* alert already shown by api() */ }
  }

  async function pinItem(itemId) {
    try { await api('/host/items/' + itemId + '/pin', 'POST'); fetchState(); } catch (e) { /* alerted */ }
  }

  var chatWs = null;

  function startChat() {
    if (chatWs) { chatWs.onclose = null; chatWs.close(); }
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    chatWs = new WebSocket(proto + location.host + '/live/ws');
    chatWs.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'viewers') {
        document.getElementById('viewerCount').textContent = msg.count + ' watching';
      } else if (msg.type === 'chat') {
        var box = document.getElementById('chatBox');
        if (box.firstChild && box.firstChild.className === 'muted') box.innerHTML = '';
        var line = document.createElement('div');
        line.className = 'chat-line';
        line.innerHTML = '<span class="who mono">' + escapeHtml(msg.from) + '</span>' +
          '<span class="text">' + escapeHtml(msg.text) + '</span>' +
          '<button>Mute</button>';
        line.querySelector('button').addEventListener('click', async function () {
          try { await api('/host/mute', 'POST', { fromId: msg.fromId }); line.style.opacity = '0.4'; } catch (e) { /* alerted */ }
        });
        box.appendChild(line);
        while (box.children.length > 200) box.removeChild(box.firstChild);
        box.scrollTop = box.scrollHeight;
      }
    };
    chatWs.onclose = function () {
      if (pw) setTimeout(startChat, 2000); /* reconnect while logged in */
    };
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    pollTimer = setInterval(fetchState, 2000);
    tickTimer = setInterval(function () {
      var el = document.getElementById('countdown');
      if (el && currentEndsAt) el.textContent = fmtCountdown(currentEndsAt);
    }, 1000);
  }

  function backToLogin(message) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    pw = null;
    document.getElementById('console').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
    document.getElementById('loginError').textContent = message || '';
  }

  document.getElementById('connectBtn').addEventListener('click', async function () {
    var val = document.getElementById('pw').value;
    var errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!val) return;
    var res;
    try {
      res = await fetch('/host/state', { headers: { Authorization: 'Bearer ' + val } });
    } catch (e) { errEl.textContent = 'network error'; return; }
    if (res.status === 401) { errEl.textContent = 'wrong password'; return; }
    if (res.status === 503) { errEl.textContent = 'host disabled (HOST_PASSWORD not set)'; return; }
    if (!res.ok) {
      var errData = null;
      try { errData = await res.json(); } catch (e) { /* no body */ }
      errEl.textContent = (errData && errData.error) || ('error: ' + res.status);
      return;
    }
    var data = null;
    try { data = await res.json(); } catch (e) { errEl.textContent = 'bad response from server'; return; }
    pw = val;
    render(data);
    document.getElementById('login').style.display = 'none';
    document.getElementById('console').style.display = 'block';
    startPolling();
    startChat();
  });

  document.getElementById('newStreamBtn').addEventListener('click', async function () {
    var title = prompt('Stream title');
    if (!title) return;
    var playbackUrl = prompt('Playback URL (Mux HLS .m3u8, blank for none)', '') || undefined;
    try { await api('/host/streams', 'POST', { title: title, playbackUrl: playbackUrl }); fetchState(); } catch (e) { /* alerted */ }
  });

  document.getElementById('endStreamBtn').addEventListener('click', async function () {
    if (!streamId) { alert('no active stream'); return; }
    try { await api('/host/streams/end', 'POST', { streamId: streamId }); fetchState(); } catch (e) { /* alerted */ }
  });

  document.getElementById('addItemBtn').addEventListener('click', async function () {
    if (!streamId) { alert('no active stream'); return; }
    var title = prompt('Item title');
    if (!title) return;
    var mode = prompt('Mode: auction or buy_now', 'auction');
    if (mode !== 'auction' && mode !== 'buy_now') { alert('mode must be auction or buy_now'); return; }
    var krStr = prompt(mode === 'auction' ? 'Starting bid (kr)' : 'Buy-now price (kr)', '100');
    var kr = parseFloat(krStr);
    if (!kr || kr <= 0) { alert('invalid price'); return; }
    var ore = Math.round(kr * 100);
    var payload = { streamId: streamId, title: title, mode: mode };
    if (mode === 'auction') payload.startingBidOre = ore; else payload.buyNowPriceOre = ore;
    try { await api('/host/items', 'POST', payload); fetchState(); } catch (e) { /* alerted */ }
  });
})();
</script>
</body>
</html>
`;
