try {
  (function () {
    var S = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      var x = this;
      x.addEventListener('loadend', function () {
        try {
          if (String(x.responseURL || '').indexOf('external_user_complete') > -1) {
            var msg = JSON.stringify({ __probe: 1, status: x.status, body: String(x.responseText).slice(0, 1500) });
            try { parent.postMessage(msg, '*'); } catch (e) {}
            try { top.postMessage(msg, '*'); } catch (e) {}
          }
        } catch (e) {}
      });
      return S.apply(this, arguments);
    };
  })();
} catch (e) {}
try {
  (function () {
    var F = window.fetch;
    if (!F) return;
    window.fetch = function () {
      var u = String((arguments[0] && arguments[0].url) || arguments[0] || '');
      var p = F.apply(this, arguments);
      if (u.indexOf('external_user_complete') > -1) {
        p.then(function (res) {
          try {
            res.clone().text().then(function (t) {
              var msg = JSON.stringify({ __probe: 1, via: 'fetch', status: res.status, body: String(t).slice(0, 1500) });
              try { parent.postMessage(msg, '*'); } catch (e) {}
              try { top.postMessage(msg, '*'); } catch (e) {}
            });
          } catch (e) {}
        });
      }
      return p;
    };
  })();
} catch (e) {}
