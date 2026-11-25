'use strict';
(() => {
  const el = document.getElementById('visits');
  let pending = false;
  async function update() {
    if (pending || document.hidden) return;
    pending = true;
    try {
      const url = '/api/visitors';
      const response = await fetch(url,{cache:'no-store'});
      if (!response.ok) throw Error();
      let stats = await response.json();
      if (!navigator.webdriver) {
        const day = stats.day;
        async function register() {
          let visit;
          try {
            visit = JSON.parse(localStorage.getItem('arena.dailyVisit'));
            if (visit?.day !== day || !visit.token) {
              visit = {day,token:crypto.randomUUID()};
              localStorage.setItem('arena.dailyVisit',JSON.stringify(visit));
            }
          } catch { return; }
          const result = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(visit)});
          if (result.ok) stats = await result.json();
        }
        if (navigator.locks) await navigator.locks.request('arena-daily-visit',register);
        else await register();
      }
      el.textContent = Locale.t('오늘 방문자 '+stats.count.toLocaleString()+'명','Visitors today · '+stats.count.toLocaleString());
      el.title = Locale.t('한국시간 기준 · 브라우저당 하루 1회','Korea time · one visit per browser per day');
    } catch {
      el.textContent = Locale.t('오늘 방문자 집계 연결 중','Connecting to visitor count');
    } finally { pending = false; }
  }
  update();
  document.addEventListener('visibilitychange',update);
  setInterval(update,60000);
})();
