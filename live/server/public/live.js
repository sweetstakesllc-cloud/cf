/* Circular Fash Live — viewer widget.
   Mounts into #cf-live. Server-authoritative: this file renders PublicState
   broadcast over the WebSocket and never decides auction outcomes; the
   countdown is cosmetic. Plain browser JS by design — no build step. */
(function () {
  'use strict';

  var mountEl = document.getElementById('cf-live');
  if (!mountEl) return;

  // The widget may be embedded on the shop domain; the API lives where this
  // script was served from.
  var API = location.origin;
  try { API = new URL(document.currentScript.src).origin; } catch (e) { /* inline/fallback */ }
  var WS_BASE = API.replace(/^http/, 'ws');

  var SOFT_CLOSE_MS = 10000;
  var FEED_MAX = 200;

  // ---------- state ----------
  var current = null;        // last PublicState
  var me = null;             // { email, bidReady } | null
  var myLastBidOre = null;   // to render "you're highest"
  var myItemId = null;
  var ws = null;
  var wsBackoff = 1000;
  var pollTimer = null;
  var ctaBusy = false;

  // ---------- helpers ----------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fmtKr(ore) {
    var kr = ore / 100;
    var opts = ore % 100 === 0 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return kr.toLocaleString('sv-SE', opts) + ' kr';
  }

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'include';
    if (opts.body) opts.headers = { 'Content-Type': 'application/json' };
    return fetch(API + path, opts);
  }

  // ---------- skeleton ----------
  mountEl.innerHTML =
    '<div class="cfl-offair" hidden>' +
      '<span class="cfl-wordmark">Circular Fash</span>' +
      '<span class="label">Live</span>' +
      '<p>We’re not live right now. Streams run daily at 19:00 CET.</p>' +
      '<a href="https://circularfash.com/pages/live">See the schedule</a>' +
    '</div>' +
    '<div class="cfl-stage">' +
      '<video muted autoplay playsinline></video>' +
      '<div class="cfl-novideo"><span class="cfl-wordmark">Circular Fash</span><span class="label">Stream starting…</span></div>' +
    '</div>' +
    '<div class="cfl-ui">' +
      '<div class="cfl-top">' +
        '<span class="cfl-badge"><span class="dot"></span>Live</span>' +
        '<span class="cfl-title"></span>' +
        '<span class="cfl-viewers num" hidden></span>' +
      '</div>' +
      '<div class="cfl-feedwrap">' +
        '<div class="cfl-feed"></div>' +
        '<div class="cfl-send">' +
          '<input maxlength="280" placeholder="Say something…" aria-label="Chat message">' +
          '<button>Send</button>' +
        '</div>' +
        '<div class="cfl-card">' +
          '<div class="cfl-item">' +
            '<img class="cfl-thumb empty" alt="">' +
            '<div class="cfl-iteminfo">' +
              '<span class="label cfl-pricelabel"></span>' +
              '<div class="cfl-itemtitle"></div>' +
            '</div>' +
            '<div class="cfl-timer" hidden><span class="num">0:00</span><span class="label cfl-timerlabel">Ends in</span></div>' +
          '</div>' +
          '<div class="cfl-row">' +
            '<span class="cfl-price num"></span>' +
            '<span class="cfl-sub"></span>' +
          '</div>' +
          '<button class="cfl-cta" disabled>Waiting…</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="cfl-toasts"></div>';

  var $ = function (sel) { return mountEl.querySelector(sel); };
  var offairEl = $('.cfl-offair');
  var stageEl = $('.cfl-stage');
  var uiEl = $('.cfl-ui');
  var videoEl = $('.cfl-stage video');
  var novideoEl = $('.cfl-novideo');
  var titleEl = $('.cfl-title');
  var viewersEl = $('.cfl-viewers');
  var feedEl = $('.cfl-feed');
  var thumbEl = $('.cfl-thumb');
  var itemTitleEl = $('.cfl-itemtitle');
  var priceLabelEl = $('.cfl-pricelabel');
  var priceEl = $('.cfl-price');
  var subEl = $('.cfl-sub');
  var timerEl = $('.cfl-timer');
  var timerNumEl = $('.cfl-timer .num');
  var timerLabelEl = $('.cfl-timerlabel');
  var ctaEl = $('.cfl-cta');
  var toastsEl = $('.cfl-toasts');

  // ---------- toasts ----------
  function toast(msg) {
    var t = el('div', 'cfl-toast', msg);
    toastsEl.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  // ---------- feed ----------
  function feedLine(node) {
    var nearBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 60;
    feedEl.appendChild(node);
    while (feedEl.children.length > FEED_MAX) feedEl.removeChild(feedEl.firstChild);
    if (nearBottom) feedEl.scrollTop = feedEl.scrollHeight;
  }

  function bidLine(who, amountOre) {
    var line = el('div', 'cfl-line bid');
    line.appendChild(el('span', 'who', who));
    line.appendChild(document.createTextNode('bid '));
    line.appendChild(el('span', 'amt', fmtKr(amountOre)));
    feedLine(line);
  }

  function sysLine(text) {
    feedLine(el('div', 'cfl-line sys', text));
  }

  // ---------- video ----------
  var videoUrl = null;
  var hlsLib = null; // promise for the hls.js script

  function loadHlsJs() {
    if (hlsLib) return hlsLib;
    hlsLib = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
      s.onload = function () { resolve(window.Hls); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return hlsLib;
  }

  function ensureVideo(url) {
    if (url === videoUrl) return;
    videoUrl = url;
    if (!url) {
      videoEl.removeAttribute('src');
      novideoEl.hidden = false;
      return;
    }
    novideoEl.hidden = true;
    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = url;
      videoEl.play().catch(function () {});
      return;
    }
    loadHlsJs().then(function (Hls) {
      if (url !== videoUrl) return; // stream changed while loading
      if (!Hls || !Hls.isSupported()) { novideoEl.hidden = false; return; }
      var hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      videoEl.play().catch(function () {});
    }).catch(function () { novideoEl.hidden = false; });
  }

  // ---------- countdown ----------
  var endsAt = null;

  function tick() {
    if (!endsAt || !current || !current.pinned || current.pinned.state !== 'auction_open') return;
    var ms = new Date(endsAt).getTime() - Date.now();
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    timerNumEl.textContent = Math.floor(totalSec / 60) + ':' + ('0' + (totalSec % 60)).slice(-2);
    var closing = ms <= SOFT_CLOSE_MS;
    timerEl.classList.toggle('closing', closing);
    timerLabelEl.textContent = closing ? 'Going once…' : 'Ends in';
  }
  setInterval(tick, 250);

  // ---------- pinned card ----------
  function minAcceptableOre(p) {
    return p.currentBidOre != null ? p.currentBidOre + p.minIncrementOre : p.startingBidOre;
  }

  function setCta(text, opts) {
    opts = opts || {};
    ctaEl.textContent = text;
    ctaEl.disabled = !!opts.disabled;
    ctaEl.classList.toggle('sold', !!opts.sold);
  }

  function renderPinned(p) {
    if (!p) {
      thumbEl.className = 'cfl-thumb empty';
      itemTitleEl.textContent = 'Waiting for the next piece…';
      priceLabelEl.textContent = '';
      priceEl.textContent = '';
      subEl.textContent = '';
      timerEl.hidden = true;
      setCta('Hold tight', { disabled: true });
      return;
    }
    if (p.imageUrl) { thumbEl.src = p.imageUrl; thumbEl.className = 'cfl-thumb'; }
    else thumbEl.className = 'cfl-thumb empty';
    itemTitleEl.textContent = p.title;

    var isAuction = p.mode === 'auction';
    var priceOre = p.winner ? p.winner.amountOre
      : isAuction ? (p.currentBidOre != null ? p.currentBidOre : p.startingBidOre) : p.buyNowPriceOre;
    priceEl.textContent = fmtKr(priceOre || 0);
    priceLabelEl.textContent = p.winner ? 'Sold for'
      : isAuction ? (p.currentBidOre != null ? 'Current bid' : 'Starting bid') : 'Buy now';

    timerEl.hidden = p.state !== 'auction_open';

    subEl.innerHTML = '';
    if (p.winner) {
      subEl.appendChild(el('span', 'who', p.winner.emailMasked));
      subEl.appendChild(document.createTextNode(' won · ' + fmtKr(p.winner.amountOre)));
    } else if (p.state === 'auction_open' && p.currentBidOre != null) {
      var mine = myItemId === p.itemId && myLastBidOre === p.currentBidOre;
      subEl.appendChild(el('span', 'who', mine ? 'You' : (p.currentBidderMasked || '')));
      subEl.appendChild(document.createTextNode(mine ? '’re highest!' : ' is highest'));
      subEl.appendChild(document.createTextNode(' · ' + p.bidCount + (p.bidCount === 1 ? ' bid' : ' bids')));
    } else if (p.state === 'auction_open') {
      subEl.textContent = 'No bids yet — yours could be first';
    }

    switch (p.state) {
      case 'auction_open':
        setCta('Bid ' + fmtKr(minAcceptableOre(p)));
        break;
      case 'pinned':
        if (isAuction) setCta('Auction opens soon', { disabled: true });
        else setCta('Buy now · ' + fmtKr(p.buyNowPriceOre));
        break;
      case 'won':
      case 'charged':
        setCta('Sold', { sold: true, disabled: true });
        break;
      case 'payment_failed':
        setCta('Sold · confirming payment', { sold: true, disabled: true });
        break;
      case 'passed':
        setCta('Passed', { disabled: true });
        break;
      default:
        setCta('Waiting…', { disabled: true });
    }
  }

  // ---------- state transitions → feed lines ----------
  function announceTransitions(prev, next) {
    var p = prev && prev.pinned;
    var n = next.pinned;
    if (!n) return;
    var sameItem = p && p.itemId === n.itemId;
    if (n.state === 'auction_open' && (!sameItem || p.state !== 'auction_open')) {
      sysLine('Auction open — starting at ' + fmtKr(n.startingBidOre || 0));
    }
    if (n.currentBidOre != null && (!sameItem || p.currentBidOre !== n.currentBidOre) && n.state === 'auction_open') {
      var mine = myItemId === n.itemId && myLastBidOre === n.currentBidOre;
      bidLine(mine ? 'You' : (n.currentBidderMasked || 'someone'), n.currentBidOre);
    }
    if ((n.state === 'won' || n.state === 'charged') && (!sameItem || (p.state !== 'won' && p.state !== 'charged')) && n.winner) {
      sysLine('SOLD to ' + n.winner.emailMasked + ' — ' + fmtKr(n.winner.amountOre));
    }
    if (n.state === 'passed' && sameItem && p.state !== 'passed') {
      sysLine('Passed — next piece coming up');
    }
  }

  // ---------- main render ----------
  function update(state) {
    var prev = current;
    current = state;
    if (!state.stream) {
      offairEl.hidden = false;
      stageEl.hidden = true;
      uiEl.hidden = true;
      endsAt = null;
      return;
    }
    offairEl.hidden = true;
    stageEl.hidden = false;
    uiEl.hidden = false;
    titleEl.textContent = state.stream.title;
    ensureVideo(state.stream.playbackUrl);
    if (state.pinned && myItemId && state.pinned.itemId !== myItemId) { myItemId = null; myLastBidOre = null; }
    announceTransitions(prev, state);
    renderPinned(state.pinned);
    endsAt = state.pinned ? state.pinned.endsAt : null;
    tick();
  }

  // ---------- actions ----------
  function onCta() {
    var p = current && current.pinned;
    if (!p || ctaBusy) return;
    if (p.state === 'auction_open' && p.mode === 'auction') return placeBid(p);
    if (p.state === 'pinned' && p.mode === 'buy_now') return buyNow(p);
  }
  ctaEl.addEventListener('click', onCta);

  function needsGate() {
    if (!me) { openAuthModal(); return true; }
    if (!me.bidReady) { openReadyModal(); return true; }
    return false;
  }

  function placeBid(p) {
    if (needsGate()) return;
    var amountOre = minAcceptableOre(p);
    ctaBusy = true;
    api('/live/bid', { method: 'POST', body: JSON.stringify({ itemId: p.itemId, amountOre: amountOre }) })
      .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (r) {
        if (r.res.ok) {
          myItemId = p.itemId;
          myLastBidOre = r.data.amountOre;
        } else if (r.res.status === 401) { me = null; openAuthModal(); }
        else if (r.data.error === 'not_bid_ready') { me.bidReady = false; openReadyModal(); }
        else if (r.data.error === 'too_low') toast('Outbid — tap again');
        else if (r.data.error === 'ended') toast('Auction ended');
        else if (r.data.error === 'not_open') toast('Bidding closed');
        else toast('Bid failed — try again');
      })
      .catch(function () { toast('Network error'); })
      .then(function () { ctaBusy = false; refreshState(); });
  }

  function buyNow(p) {
    if (needsGate()) return;
    ctaBusy = true;
    api('/live/buy', { method: 'POST', body: JSON.stringify({ itemId: p.itemId }) })
      .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (r) {
        if (r.res.ok) toast('It’s yours!');
        else if (r.res.status === 401) { me = null; openAuthModal(); }
        else if (r.data.error === 'not_bid_ready') { me.bidReady = false; openReadyModal(); }
        else if (r.data.error === 'not_available') toast('Already claimed');
        else toast('Could not claim — try again');
      })
      .catch(function () { toast('Network error'); })
      .then(function () { ctaBusy = false; refreshState(); });
  }

  // ---------- modal chrome ----------
  function modal(title) {
    closeModal();
    var back = el('div', 'cfl-modalback');
    var box = el('div', 'cfl-modal');
    var close = el('button', 'cfl-close', 'Close');
    close.addEventListener('click', closeModal);
    box.appendChild(close);
    box.appendChild(el('h3', null, title));
    back.appendChild(box);
    back.addEventListener('click', function (ev) { if (ev.target === back) closeModal(); });
    mountEl.appendChild(back);
    return box;
  }

  function closeModal() {
    var open = mountEl.querySelector('.cfl-modalback');
    if (open) open.remove();
  }

  function textInput(placeholder, type, mode) {
    var input = el('input');
    input.type = type || 'text';
    input.placeholder = placeholder;
    if (mode) input.inputMode = mode;
    return input;
  }

  function primaryBtn(label) {
    return el('button', 'cfl-cta', label);
  }

  // ---------- sign-in (email + one-time code) ----------
  function openAuthModal() {
    var box = modal('Sign in to bid');
    var err = el('div', 'err');
    var email = textInput('Email address', 'email', 'email');
    var next = primaryBtn('Send code');
    box.appendChild(el('p', null, 'We’ll email you a 6-digit code. No password, no account setup.'));
    box.appendChild(email);
    box.appendChild(err);
    box.appendChild(next);
    email.focus();

    next.addEventListener('click', function () {
      var addr = email.value.trim();
      if (!addr) { err.textContent = 'Enter your email'; return; }
      next.disabled = true;
      err.textContent = '';
      api('/auth/request-code', { method: 'POST', body: JSON.stringify({ email: addr }) })
        .then(function (res) {
          if (res.status === 429) { err.textContent = 'Too many codes — wait a minute and retry'; next.disabled = false; return; }
          if (!res.ok) { err.textContent = 'Could not send the code — check the address'; next.disabled = false; return; }
          codeStep(addr);
        })
        .catch(function () { err.textContent = 'Network error'; next.disabled = false; });
    });

    function codeStep(addr) {
      var box2 = modal('Enter the code');
      var err2 = el('div', 'err');
      var code = textInput('6-digit code', 'text', 'numeric');
      code.maxLength = 6;
      code.autocomplete = 'one-time-code';
      var verify = primaryBtn('Sign in');
      box2.appendChild(el('p', null, 'Sent to ' + addr + '. It’s valid for a few minutes.'));
      box2.appendChild(code);
      box2.appendChild(err2);
      box2.appendChild(verify);
      code.focus();

      verify.addEventListener('click', function () {
        verify.disabled = true;
        err2.textContent = '';
        api('/auth/verify', { method: 'POST', body: JSON.stringify({ email: addr, code: code.value.trim() }) })
          .then(function (res) {
            if (!res.ok) { err2.textContent = 'Wrong or expired code'; verify.disabled = false; return; }
            return fetchMe().then(function () {
              closeModal();
              toast('Signed in');
              // Reconnect so the socket picks up the session — chat needs it.
              if (ws) ws.close();
              if (me && !me.bidReady) openReadyModal();
            });
          })
          .catch(function () { err2.textContent = 'Network error'; verify.disabled = false; });
      });
    }
  }

  // ---------- get bid-ready (save a card via Stripe) ----------
  var widgetConfig = null;

  function fetchConfig() {
    if (widgetConfig) return Promise.resolve(widgetConfig);
    return api('/live/config').then(function (res) { return res.json(); })
      .then(function (data) { widgetConfig = data; return data; });
  }

  var stripeLib = null;

  function loadStripeJs() {
    if (stripeLib) return stripeLib;
    stripeLib = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = function () { resolve(window.Stripe); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return stripeLib;
  }

  function openReadyModal() {
    var box = modal('Get bid-ready');
    var err = el('div', 'err');
    var slot = el('div');
    box.appendChild(el('p', null,
      'Save a card once and every win is charged automatically the moment the hammer falls — no checkout race.'));
    box.appendChild(slot);
    box.appendChild(err);

    fetchConfig().then(function (cfg) {
      if (!cfg.stripePublishableKey) {
        slot.appendChild(el('p', null, 'Card setup isn’t available right now. You can watch and chat — bidding needs a saved card.'));
        return;
      }
      return Promise.all([loadStripeJs(), api('/billing/setup-intent', { method: 'POST', body: '{}' }).then(function (res) {
        if (!res.ok) throw new Error('setup_intent_failed');
        return res.json();
      })]).then(function (parts) {
        var stripe = parts[0](cfg.stripePublishableKey);
        var elements = stripe.elements({
          clientSecret: parts[1].clientSecret,
          appearance: { theme: 'night', variables: { colorPrimary: '#E8FF52', borderRadius: '0px', fontFamily: 'Assistant, sans-serif' } },
        });
        elements.create('payment').mount(slot);
        var save = primaryBtn('Save card');
        box.appendChild(save);
        save.addEventListener('click', function () {
          save.disabled = true;
          err.textContent = '';
          stripe.confirmSetup({ elements: elements, confirmParams: { return_url: API + '/live' }, redirect: 'if_required' })
            .then(function (result) {
              if (result.error) { err.textContent = result.error.message || 'Card was not saved'; save.disabled = false; return; }
              save.textContent = 'Confirming…';
              return waitForBidReady().then(function (ready) {
                if (ready) { closeModal(); toast('You’re bid-ready'); }
                else { err.textContent = 'Saved — confirmation is taking a moment. Try bidding shortly.'; save.disabled = false; save.textContent = 'Save card'; }
              });
            });
        });
      });
    }).catch(function () { err.textContent = 'Could not start card setup — try again'; });
  }

  // The webhook flips bid_ready; poll briefly until it lands.
  function waitForBidReady() {
    var tries = 15;
    return new Promise(function (resolve) {
      (function poll() {
        fetchMe().then(function (data) {
          if (data && data.bidReady) return resolve(true);
          if (--tries <= 0) return resolve(false);
          setTimeout(poll, 2000);
        });
      })();
    });
  }

  // ---------- chat send ----------
  var sendInput = $('.cfl-send input');
  var sendBtn = $('.cfl-send button');

  function sendChat() {
    var text = sendInput.value.trim();
    if (!text) return;
    if (!me) { openAuthModal(); return; }
    if (!ws || ws.readyState !== 1) { toast('Reconnecting — try again'); return; }
    ws.send(JSON.stringify({ type: 'chat', text: text }));
    sendInput.value = '';
  }
  sendBtn.addEventListener('click', sendChat);
  sendInput.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); sendChat(); }
  });

  // ---------- me ----------
  function fetchMe() {
    return api('/auth/me').then(function (res) {
      if (!res.ok) { me = null; return null; }
      return res.json().then(function (data) { me = data; return data; });
    }).catch(function () { return null; });
  }

  // ---------- transport ----------
  function refreshState() {
    return api('/live/state').then(function (res) { return res.json(); })
      .then(update).catch(function () {});
  }

  function handleMessage(msg) {
    if (msg.type === 'state') update(msg.state);
    else if (msg.type === 'viewers') {
      viewersEl.hidden = false;
      viewersEl.textContent = msg.count + ' watching';
    } else if (msg.type === 'chat') {
      var line = el('div', 'cfl-line');
      line.appendChild(el('span', 'who', msg.from));
      line.appendChild(document.createTextNode(msg.text));
      feedLine(line);
    } else if (msg.type === 'error') {
      if (msg.error === 'slow_down') toast('Easy — one message every 2s');
      else if (msg.error === 'muted') toast('You’ve been muted by the host');
      else if (msg.error === 'too_long') toast('Message too long');
      else if (msg.error === 'auth_required') openAuthModal();
    }
  }

  function connect() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    ws = new WebSocket(WS_BASE + '/live/ws');
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      handleMessage(msg);
    };
    ws.onopen = function () { wsBackoff = 1000; };
    ws.onclose = function () {
      viewersEl.hidden = true;
      if (!pollTimer) pollTimer = setInterval(refreshState, 10000);
      setTimeout(connect, wsBackoff);
      wsBackoff = Math.min(wsBackoff * 2, 8000);
    };
  }

  // ---------- boot ----------
  refreshState();
  fetchMe();
  connect();
})();
