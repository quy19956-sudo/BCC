(function(){
'use strict';
const STYLE=`
.bcct-date-readonly{cursor:pointer;background:#fbfdff!important;color:#143447!important;-webkit-text-fill-color:#143447!important;opacity:1!important}
#bcctDateWheel{position:fixed;inset:0;z-index:999999;display:none;align-items:flex-end;background:rgba(4,20,30,.42);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
#bcctDateWheel.show{display:flex}.dw-sheet{width:100%;background:#f7f7fa;border-radius:22px 22px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.18);padding-bottom:max(10px,env(safe-area-inset-bottom))}
.dw-top{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #e1e1e7}.dw-top b{font-size:16px;color:#1f2937}.dw-action{border:0;background:transparent;font:700 16px system-ui;color:#087e8b;padding:10px 6px}.dw-today{font-size:13px}
.dw-wheels{position:relative;display:grid;grid-template-columns:1fr 1.25fr 1fr;height:224px;overflow:hidden;padding:0 12px}.dw-wheels:before,.dw-wheels:after{content:"";position:absolute;left:12px;right:12px;height:44px;top:90px;border-top:1px solid #c9ccd4;border-bottom:1px solid #c9ccd4;pointer-events:none;z-index:2}.dw-wheels:after{top:0;height:90px;border:0;background:linear-gradient(#f7f7fa,rgba(247,247,250,.08))}.dw-fade-bottom{position:absolute;left:12px;right:12px;bottom:0;height:90px;background:linear-gradient(rgba(247,247,250,.08),#f7f7fa);z-index:2;pointer-events:none}
.dw-col{height:224px;overflow-y:auto;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:90px 0}.dw-col::-webkit-scrollbar{display:none}.dw-item{height:44px;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;font-size:21px;color:#111827;white-space:nowrap}.dw-item.muted{color:#6b7280}
@media(min-width:700px){#bcctDateWheel{align-items:center;justify-content:center}.dw-sheet{max-width:430px;border-radius:22px;padding-bottom:10px}}
`;
if(!document.getElementById('bcctDateWheelStyle')){const st=document.createElement('style');st.id='bcctDateWheelStyle';st.textContent=STYLE;document.head.appendChild(st)}
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const valid=(y,m,d)=>{const x=new Date(y,m-1,d,12);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d};
const parse=v=>{const a=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return a?{y:+a[1],m:+a[2],d:+a[3]}:null};
let active=null, state={d:1,m:1,y:new Date().getFullYear()}, cols={}, timer=null;
function build(){if(document.getElementById('bcctDateWheel'))return;const el=document.createElement('div');el.id='bcctDateWheel';el.innerHTML=`<div class="dw-sheet"><div class="dw-top"><button class="dw-action" data-x="cancel">Hủy</button><b id="dwTitle">Chọn ngày</b><button class="dw-action" data-x="done">Xong</button></div><div class="dw-wheels"><div class="dw-col" data-k="d"></div><div class="dw-col" data-k="m"></div><div class="dw-col" data-k="y"></div><div class="dw-fade-bottom"></div></div><div style="text-align:center"><button class="dw-action dw-today" data-x="today">Hôm nay</button></div></div>`;document.body.appendChild(el);cols.d=el.querySelector('[data-k=d]');cols.m=el.querySelector('[data-k=m]');cols.y=el.querySelector('[data-k=y]');
 el.addEventListener('click',e=>{if(e.target===el)close(false);const x=e.target.dataset.x;if(x==='cancel')close(false);if(x==='done')close(true);if(x==='today'){const n=new Date();state={d:n.getDate(),m:n.getMonth()+1,y:n.getFullYear()};renderAll(true)}});
 Object.entries(cols).forEach(([k,c])=>c.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{const idx=Math.round(c.scrollTop/44);const item=c.children[idx];if(!item)return;state[k]=+item.dataset.v;if(k==='m'||k==='y'){fixDay();renderDay()}},75)}));
}
function range(a,b){return Array.from({length:b-a+1},(_,i)=>a+i)}
function fill(c,vals,label,selected){c.innerHTML=vals.map(v=>`<div class="dw-item" data-v="${v}">${label(v)}</div>`).join('');requestAnimationFrame(()=>{const i=vals.indexOf(selected);c.scrollTop=Math.max(0,i)*44})}
function daysInMonth(y,m){return new Date(y,m,0).getDate()}
function fixDay(){state.d=Math.min(state.d,daysInMonth(state.y,state.m))}
function renderDay(){const vals=range(1,daysInMonth(state.y,state.m));fill(cols.d,vals,v=>pad(v),state.d)}
function renderAll(immediate){fixDay();renderDay();fill(cols.m,range(1,12),v=>'Tháng '+v,state.m);const min=active&&+active.dataset.minYear||1900,max=active&&+active.dataset.maxYear||new Date().getFullYear()+5;fill(cols.y,range(min,max),v=>v,state.y);if(immediate){requestAnimationFrame(()=>{Object.entries(cols).forEach(([k,c])=>{const items=[...c.children],i=items.findIndex(x=>+x.dataset.v===state[k]);c.scrollTop=Math.max(0,i)*44})})}}
function open(inp){build();active=inp;const p=parse(inp.value),n=new Date();state=p||{d:n.getDate(),m:n.getMonth()+1,y:n.getFullYear()};document.getElementById('dwTitle').textContent=inp.dataset.dateTitle||'Chọn ngày';document.getElementById('bcctDateWheel').classList.add('show');renderAll(true)}
function close(save){const el=document.getElementById('bcctDateWheel');if(!el)return;if(save&&active&&valid(state.y,state.m,state.d)){active.value=iso(state.y,state.m,state.d);active.dispatchEvent(new Event('change',{bubbles:true}));active.dispatchEvent(new Event('input',{bubbles:true}))}el.classList.remove('show');active=null}
function bind(inp){if(inp.dataset.dwBound)return;inp.dataset.dwBound='1';inp.readOnly=true;inp.classList.add('bcct-date-readonly');inp.addEventListener('click',e=>{e.preventDefault();open(inp)});inp.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(inp)}})}
function init(){document.querySelectorAll('input[data-ios-date],input[type=date].ios-wheel').forEach(bind)}
window.BCCTDateWheel={init,open};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
