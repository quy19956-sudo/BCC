(function(){
'use strict';
const $=id=>document.getElementById(id);let unit='mmol',mode='ldl';
const ids=['tc','known','tg'];
function number(text){const s=String(text==null?'':text).trim().replace(',','.');return /^\d+(?:\.\d+)?$/.test(s)?Number(s):NaN;}
function compute(tc,known,tg,u,m){
 if(![tc,known,tg].every(Number.isFinite)||tc<=0||known<=0||tg<0)return {error:'Nhập đủ các giá trị hợp lệ; TC và '+(m==='hdl'?'LDL-C':'HDL-C')+' phải lớn hơn 0, TG không được âm.'};
 if(tg>=(u==='mmol'?4.5:400))return {error:'Không áp dụng Friedewald khi TG ≥ '+(u==='mmol'?'4,5 mmol/L':'400 mg/dL')+'. Cần phương pháp xét nghiệm/ước tính phù hợp khác.'};
 const value=tc-known-tg/(u==='mmol'?2.2:5);
 if(value<=0||known>=tc)return {error:'Các giá trị không phù hợp: kết quả tính bằng hoặc dưới 0. Kiểm tra lại số liệu và đơn vị.'};
 return {value,nonHdl:m==='ldl'?tc-known:null};
}
function clearResult(){const r=$('result');r.className='result';r.replaceChildren();const s=document.createElement('strong');s.textContent='—';const t=document.createElement('small');t.textContent='Nhập đủ ba thông số rồi bấm tính.';r.append(s,t);}
function update(){
 $('knownLabel').textContent=(mode==='ldl'?'HDL-C':'LDL-C')+' ('+(unit==='mmol'?'mmol/L':'mg/dL')+')';
 $('tcLabel').textContent='Cholesterol toàn phần — TC ('+(unit==='mmol'?'mmol/L':'mg/dL')+')';
 $('tgLabel').textContent='Triglycerid — TG ('+(unit==='mmol'?'mmol/L':'mg/dL')+')';
 $('calc').textContent=mode==='ldl'?'Tính LDL-C':'Ước tính HDL-C';
 $('formula').textContent=(mode==='ldl'?'LDL-C = TC − HDL-C':'HDL-C ≈ TC − LDL-C')+' − TG/'+(unit==='mmol'?'2,2 (mmol/L).':'5 (mg/dL).');
 $('hdlNotice').hidden=mode!=='hdl';
 document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelectorAll('[data-unit]').forEach(b=>{const active=b.dataset.unit===unit;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));});
 clearResult();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(mode===b.dataset.mode)return;mode=b.dataset.mode;$('known').value='';update();});
document.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>{if(unit===b.dataset.unit)return;unit=b.dataset.unit;ids.forEach(id=>$(id).value='');update();});
ids.forEach(id=>$(id).addEventListener('input',clearResult));
$('clear').onclick=()=>{ids.forEach(id=>$(id).value='');clearResult();$('tc').focus();};
$('calc').onclick=()=>{
 const v=ids.map(id=>number($(id).value)),answer=compute(v[0],v[1],v[2],unit,mode),r=$('result');
 r.replaceChildren();const strong=document.createElement('strong'),small=document.createElement('small');r.append(strong,small);
 if(answer.error){r.className='result warn';strong.textContent='Chưa tính được';small.textContent=answer.error;return;}
 const name=mode==='ldl'?'LDL-C':'HDL-C ước tính',u=unit==='mmol'?'mmol/L':'mg/dL';
 r.className=mode==='hdl'?'result warn':'result';strong.textContent=name+': '+answer.value.toFixed(2)+' '+u;
 small.textContent=mode==='hdl'?'Giá trị tính ngược bằng giả định Friedewald; không phải HDL-C đo bằng xét nghiệm.':'Ước tính Friedewald. Non-HDL-C = '+answer.nonHdl.toFixed(2)+' '+u+'.';
 try{parent.postMessage({type:'BCCT_HISTORY_ADD',entry:{tool:'LDL-C / HDL-C',title:mode==='ldl'?'Tính LDL-Cholesterol':'Ước tính HDL-Cholesterol',summary:name+' '+answer.value.toFixed(2)+' '+u,detail:'TC '+v[0]+' • '+(mode==='ldl'?'HDL-C':'LDL-C')+' '+v[1]+' • TG '+v[2]+' '+u+(mode==='hdl'?' • Không thay thế HDL-C đo trực tiếp.':'')}},'*');}catch(e){}
};
window.BCCT_LIPID={compute,number};update();
})();
