window.__probe = window.__probe || [];
window.addEventListener('message', function (e) {
  try {
    var d = e.data;
    if (typeof d === 'string' && d.indexOf('__probe') > -1) window.__probe.push(d);
  } catch (err) {}
});
