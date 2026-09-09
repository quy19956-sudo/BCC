/* BCCT compatibility bridge: preserves backup/restore and activity history. */
(function(){
  'use strict';
  function snapshot(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      out[k]=localStorage.getItem(k);
    }
    return out;
  }
  addEventListener('message',function(e){
    const m=e.data;
    if(!m||m.type!=='BCCT_SYNC'||!m.requestId)return;
    try{
      if(m.action==='import'){
        localStorage.clear();
        for(const [k,v] of Object.entries(m.storage||{}))localStorage.setItem(k,String(v));
      }else if(m.action==='merge'){
        for(const k of (m.removeKeys||[]))localStorage.removeItem(k);
        for(const [k,v] of Object.entries(m.storage||{}))localStorage.setItem(k,String(v));
      }
      e.source.postMessage({type:'BCCT_SYNC_RESULT',requestId:m.requestId,ok:true,storage:snapshot()},'*');
    }catch(err){
      e.source.postMessage({type:'BCCT_SYNC_RESULT',requestId:m.requestId,ok:false,error:String(err&&err.message||err)},'*');
    }
  });
  document.addEventListener('click',function(e){
    const use=e.target.closest&&e.target.closest('[data-use]');
    if(!use)return;
    const card=use.closest('.card');
    if(!card)return;
    const code=(card.querySelector('.code')||{}).textContent||'';
    const name=(card.querySelector('.name')||{}).textContent||'';
    const english=(card.querySelector('.english')||{}).textContent||'';
    try{
      parent.postMessage({type:'BCCT_HISTORY_ADD',entry:{
        tool:'ICD-10',title:code.trim()||'Đã chọn mã',summary:name.trim(),
        detail:['ICD 10-2026 FULL TT06 + QĐ1849',english.trim()].filter(Boolean).join(' • ')
      }},'*');
    }catch(_e){}
  });
})();
