(function(){
'use strict';
if(window.__BCCT_FULL_SYNC__||/^#(?:bcct-sync|sync)=/.test(location.hash))return;
// No background polling: apply shared accessibility and mobile input fixes once.
function init(){
 document.querySelectorAll('input[type="number"]').forEach(x=>{if(!x.hasAttribute('inputmode'))x.setAttribute('inputmode',x.step==='1'?'numeric':'decimal');x.setAttribute('autocomplete','off');});
 document.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');
 document.querySelectorAll('button:not([type])').forEach(b=>b.type='button');
 document.querySelectorAll('label').forEach(label=>{if(label.htmlFor||label.querySelector('input,select,textarea'))return;const next=label.nextElementSibling;if(next&&next.matches('input,select,textarea')&&next.id)label.htmlFor=next.id;});
 document.querySelectorAll('.status[role],.result[role]').forEach(x=>x.setAttribute('aria-live','polite'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('bcct-background',document.hidden));
// Discard a completed result as soon as its inputs change, so previous values cannot look current.
const page=location.pathname.split('/').pop();
if(['egfr.html','insulin.html'].includes(page))for(const event of ['input','change'])document.addEventListener(event,e=>{if(!e.target.matches('input,select'))return;const panel=e.target.closest('.panel'),r=panel&&panel.querySelector('.result');if(r){r.className='result';r.innerHTML='<strong>—</strong><small>Số liệu đã thay đổi; bấm tính lại.</small>';}});
if(['news2.html','tang-truong-tre-em.html'].includes(page))for(const type of ['input','change'])document.addEventListener(type,e=>{if(!e.target.matches('input,select,textarea'))return;const r=document.getElementById(page==='news2.html'?'result':'results');if(r)r.style.display='none';});
})();
