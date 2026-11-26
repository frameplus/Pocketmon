'use strict';
const Locale = (() => {
  const requested = new URLSearchParams(location.search).get('lang');
  let stored;
  try { stored = localStorage.getItem('arena.language'); } catch {}
  const lang = ['ko','en'].includes(requested) ? requested : stored === 'en' ? 'en' : 'ko';
  const en = lang === 'en';
  const t = (ko, english) => en ? english : ko;
  const regions = {
    kanto:['관동','Kanto'], johto:['성도','Johto'], hoenn:['호연','Hoenn'],
    sinnoh:['신오','Sinnoh'], unova:['하나','Unova'], kalos:['칼로스','Kalos'],
    alola:['알로라','Alola'], galar:['가라르','Galar'], hisui:['히스이','Hisui'],
    paldea:['팔데아','Paldea'], kitakami:['북신','Kitakami'], unknown:['미확인','Unknown']
  };
  const region = key => regions[key][en ? 1 : 0];
  const types = en ? Game.englishTypes : Game.types;
  const stats = en ? Game.englishStats : ['HP','공격력','방어력','특수공격','특수방어','스피드'];

  document.documentElement.lang = lang;
  document.title = t('포켓몬 카드 아레나','Pokémon Card Arena');
  if (en) {
    document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset.en; });
    document.querySelectorAll('[data-en-placeholder]').forEach(el => { el.placeholder = el.dataset.enPlaceholder; });
    document.querySelectorAll('[data-en-label]').forEach(el => { el.setAttribute('aria-label',el.dataset.enLabel); });
  }
  const button = document.getElementById('language');
  button.textContent = t('English','한국어');
  button.lang = t('en','ko');
  function switchLanguage(next) {
    if(next===lang)return;
    const url = new URL(location.href);
    url.searchParams.set('lang',next);
    try { localStorage.setItem('arena.language',next); } catch {}
    location.assign(url);
  }
  button.onclick=()=>switchLanguage(t('en','ko'));
  for(const choice of document.querySelectorAll('[data-language]')){
    choice.setAttribute('aria-pressed',String(choice.dataset.language===lang));
    choice.onclick=()=>switchLanguage(choice.dataset.language);
  }
  return { en, lang, t, regions, region, types, stats };
})();
