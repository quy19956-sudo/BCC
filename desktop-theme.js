(function(){
  'use strict';
  function pageClass(){
    var p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    var base=p.replace(/\.html?$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'index';
    document.body.classList.add('bcct-page-'+base);
    document.documentElement.classList.toggle('bcct-desktop', matchMedia('(min-width:900px)').matches);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',pageClass,{once:true});
  else pageClass();
  try{
    var mq=matchMedia('(min-width:900px)');
    var onChange=function(e){document.documentElement.classList.toggle('bcct-desktop',e.matches)};
    if(mq.addEventListener) mq.addEventListener('change',onChange); else if(mq.addListener) mq.addListener(onChange);
  }catch(_e){}
})();
