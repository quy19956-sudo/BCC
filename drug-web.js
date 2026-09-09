(function(){
'use strict';
const $=id=>document.getElementById(id);
const BCCT_SYNC_MODE=location.hash.startsWith('#sync=');
const CLIN=(window.BCCT_DRUG_PACKAGE&&window.BCCT_DRUG_PACKAGE.drugs)||[];
const LOCAL=window.DRUG_LOCAL_ALIASES||{};
const RX=window.RXNORM_DATA||[];
const GLOBAL=window.GLOBAL_DRUG_DATA||[];
const META=window.GLOBAL_DRUG_META||{products:GLOBAL.length,withIngredient:0,inferredIngredient:0,sources:{},rxnormTerms:RX.length};
const ONLINE=window.BCCT_WEB_DRUG||null;
const LONGCHAU=window.BCCT_LONGCHAU||null;
const VNDB=window.BCCT_VN_DRUG_DB||null;
const IMG=window.BCCT_DRUG_IMAGES||null;
let VNDATA=[];
let webSeq=0,webTimer=0,coverSeq=0;
let lcCandidates=[],lcQuery='',lcNewCount=0;
const VIEWED_IMAGE_KEY='bcct_viewed_drug_images_v2';
let imageSyncRunning=false,imageSyncRunId=0;
const RXIDX=RX.map(r=>norm((r&&r[2])||''));
const makeAuto=window.BCCT_AUTO_MONOGRAPH||function(name,type){return {name:String(name||''),category:'Thuốc',indications:'Chưa có mô tả chi tiết.',main:'Tác dụng phụ thuộc hoạt chất.',dosage:'Dùng theo đúng nhãn sản phẩm.',contraindications:'Không dùng khi quá mẫn.',side:'Tác dụng phụ phụ thuộc hoạt chất.',interactions:'Cần kiểm tra tương tác trước khi phối hợp.',pregnancy:'Cần đánh giá khi mang thai hoặc cho con bú.',organ:'Cần đánh giá chức năng gan và thận.',storage:'Bảo quản theo nhãn sản phẩm.'}};
const viLabel=window.BCCT_VI_DRUG_LABEL||window.BCCT_VI_DRUG_FORM||function(x){return String(x||'')};
let matches=[];
const FIELDS=[
 ['indications','🎯 Chỉ định','clinical'],
 ['main','⚓ Tác dụng chính / Cơ chế','clinical'],
 ['dosage','💊 Liều dùng / Cách dùng','clinical'],
 ['contraindications','⛔ Chống chỉ định / Cần tránh','contra'],
 ['side','⚠️ Tác dụng phụ','side'],
 ['interactions','🔁 Tương tác đáng chú ý','interaction'],
 ['pregnancy','🤰 Thai kỳ / Cho con bú','contra'],
 ['organ','🧪 Suy gan / Suy thận','interaction'],
 ['storage','📦 Bảo quản / Sử dụng an toàn','clinical']
];
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim()}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function stat(id,t,c='warn'){const e=$(id);if(!e)return;e.textContent=t;e.className='status show '+c}
function clear(id){const e=$(id);if(!e)return;e.textContent='';e.className='status'}
function readViewedImageTargets(){try{const a=JSON.parse(localStorage.getItem(VIEWED_IMAGE_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&norm(x.name).length>=2):[]}catch(_e){return[]}}
function writeViewedImageTargets(a){try{localStorage.setItem(VIEWED_IMAGE_KEY,JSON.stringify((a||[]).slice(-1200)))}catch(_e){}}
function rememberImageTarget(name,ingredient){name=String(name||'').trim();ingredient=String(ingredient||'').trim();if(norm(name).length<2)return;const list=readViewedImageTargets(),key=norm(name)+'|'+norm(ingredient),i=list.findIndex(x=>norm(x.name)+'|'+norm(x.ingredient)===key),row={name,ingredient,ts:Date.now()};if(i>=0)list.splice(i,1);list.push(row);writeViewedImageTargets(list)}
function builtInImageTargets(){const seen=new Set(),out=[];const add=(name,ingredient)=>{name=String(name||'').trim();ingredient=String(ingredient||'').trim();const k=norm(name)+'|'+norm(ingredient);if(norm(name).length<2||seen.has(k))return;seen.add(k);out.push({name,ingredient})};for(const d of CLIN)add(d&&d.name,d&&d.ingredient);for(const x of readViewedImageTargets())add(x.name,x.ingredient);return out}
function imageSyncUi(p){const panel=$('imageSyncPanel'),bar=$('imageSyncProgress'),txt=$('imageSyncText'),pct=$('imageSyncPercent'),cur=$('imageSyncCurrent'),btn=$('imageSyncBtn');if(!panel||!bar||!txt||!pct||!cur||!btn)return;const total=Math.max(0,Number(p&&p.total||0)),done=Math.max(0,Math.min(total,Number(p&&p.done||0))),percent=total?Math.round(done*100/total):0;bar.max=Math.max(1,total);bar.value=done;txt.textContent=String(p&&p.text||'Đang chuẩn bị…');pct.textContent=percent+'%';cur.textContent=String(p&&p.current||'');panel.classList.toggle('done',!!(p&&p.doneState));panel.classList.toggle('error',!!(p&&p.error));btn.disabled=!!(p&&p.running);btn.textContent=p&&p.running?'Đang đồng bộ…':'Đồng bộ lại ảnh'}
function dataSyncUi(p){const g=$('dataSyncGroup'),bar=$('dataSyncProgress'),txt=$('dataSyncText'),pct=$('dataSyncPercent'),cur=$('dataSyncCurrent');if(!g||!bar||!txt||!pct||!cur)return;if(p&&p.hide){g.classList.add('hidden');return}g.classList.remove('hidden');const total=Math.max(0,Number(p&&p.total||0)),done=Math.max(0,Math.min(total,Number(p&&p.done||0))),percent=total?Math.round(done*100/total):0;bar.max=Math.max(1,total);bar.value=done;txt.textContent=String(p&&p.text||'Đang tải dữ liệu…');pct.textContent=percent+'%';cur.textContent=String(p&&p.current||'')}
function showImageLoading(label){const box=$('productImages');if(!box)return;box.classList.remove('hidden');box.innerHTML='<div class="image-loading">🖼️ Đang tìm và tải một ảnh đại diện cho<br><b>'+esc(label||'thuốc này')+'</b></div>'}
function showImageMissing(label){const box=$('productImages');if(!box)return;box.classList.remove('hidden');box.innerHTML='<div class="image-loading">Chưa lấy được ảnh phù hợp cho<br><b>'+esc(label||'thuốc này')+'</b><br><small>Ứng dụng sẽ thử lại trong đợt đồng bộ ảnh nền.</small></div>'}
async function onlineCoverFallback(query,ingredient){if(!ONLINE)return null;for(const q of [query,ingredient]){if(norm(q).length<2)continue;try{const data=await ONLINE.search(q,{fresh:false});const r=data&&data.record||{},urls=IMG&&IMG.uniq?IMG.uniq([...(r.imageUrls||[]),r.productMeta&&r.productMeta.image]):[...(r.imageUrls||[])];const url=urls[0]||'';if(!url)continue;if(IMG){try{await IMG.cacheOne(url)}catch(_e){}}if(LONGCHAU&&LONGCHAU.saveCover)LONGCHAU.saveCover([query,ingredient,r.name,r.ingredient],url,r.name||query);let display=url;if(IMG){try{const rows=await IMG.resolve([url],1);if(rows&&rows[0])display=rows[0].src||url}catch(_e){}}return {url,display,name:r.name||query,cached:false}}catch(_e){}}return null}
async function runImageBackfill(force){if(imageSyncRunning||!LONGCHAU)return;imageSyncRunning=true;const runId=++imageSyncRunId;let savedTotal=0;try{const c=await LONGCHAU.cacheCount();savedTotal=Number(c&&c[1]||0)}catch(_e){}const targets=builtInImageTargets(),total=savedTotal+targets.length;let baseDone=0,found=0,trimmed=0,missing=0,existing=0;imageSyncUi({running:true,total,done:0,text:'Đang kiểm tra ảnh của hồ sơ đã lưu…'});try{if(LONGCHAU.backfillSavedImages){const a=await LONGCHAU.backfillSavedImages(p=>{if(runId!==imageSyncRunId)return;baseDone=Number(p.done||0);found=Number(p.found||0);trimmed=Number(p.trimmed||0);missing=Number(p.missing||0);imageSyncUi({running:true,total,done:baseDone,text:'Đang xử lý hồ sơ đã lưu: '+baseDone+'/'+savedTotal,current:p.name||''})});if(a){baseDone=Number(a.done||baseDone);found=Number(a.found||found);trimmed=Number(a.trimmed||trimmed);missing=Number(a.missing||missing)}}const queue=targets.slice();let coverDone=0;async function worker(){while(queue.length&&runId===imageSyncRunId){const t=queue.shift();let ok=false;const cached=LONGCHAU.getSavedCover(t.name)||LONGCHAU.getSavedCover(t.ingredient);if(cached&&cached.url){existing++;ok=true;if(IMG){try{await IMG.cacheOne(cached.url)}catch(_e){}}}else{try{const x=await LONGCHAU.findCover(t.name,t.ingredient)||await onlineCoverFallback(t.name,t.ingredient);if(x&&x.url){found++;ok=true}}catch(_e){}}if(!ok)missing++;coverDone++;imageSyncUi({running:true,total,done:baseDone+coverDone,text:'Đang tải ảnh thuốc: '+coverDone+'/'+targets.length,current:t.name})}}await Promise.all([worker(),worker()]);try{localStorage.setItem('bcct_image_sync_last_v2',String(Date.now()))}catch(_e){}imageSyncUi({running:false,total,done:total,text:'Hoàn tất: '+(found+existing)+' có ảnh • '+missing+' chưa tìm thấy',current:'Mỗi thuốc chỉ lưu một ảnh đại diện.',doneState:true})}catch(err){imageSyncUi({running:false,total,done:baseDone,text:'Đồng bộ ảnh tạm dừng',current:String(err&&err.message||err),error:true})}finally{if(runId===imageSyncRunId)imageSyncRunning=false}}

function terms(d){return[d.name].concat(d.aliases||[]).map(norm).filter(Boolean)}
const termMap=new Map();
CLIN.forEach((d,i)=>terms(d).forEach(t=>{if(!termMap.has(t))termMap.set(t,i)}));
function resolveClinical(text){
 const n=norm(text);if(!n)return null;if(termMap.has(n))return CLIN[termMap.get(n)];
 let best=null,bestLen=0;
 for(const [t,i] of termMap){if(t.length>=5&&(n.includes(t)||t.includes(n))&&t.length>bestLen){best=CLIN[i];bestLen=t.length}}
 return best;
}
function qTerms(q){return norm(q).split(' ').filter(Boolean)}
function allIn(text,ts){return ts.every(t=>text.includes(t))}
function rankText(name,ingredient,search,n,ts){
 const nn=norm(name),ni=norm(ingredient);
 if(nn===n)return 0;
 if(ni===n)return 1;
 if(nn.startsWith(n))return 2;
 if(ni.startsWith(n))return 3;
 if(allIn(nn,ts))return 4;
 if(ni&&allIn(ni,ts))return 5;
 if(allIn(search||nn+' '+ni,ts))return 6;
 return 99;
}
function typeText(t){return t==='IN'?'Hoạt chất':t==='BN'?'Tên biệt dược':t==='SCD'?'Hoạt chất, hàm lượng và dạng dùng':t==='SBD'?'Biệt dược, hàm lượng và dạng dùng':'Mục RxNorm'}
function sourceText(s){return String(s||'').replace(/FDA/g,'FDA Hoa Kỳ').replace(/Medsafe/g,'Medsafe New Zealand').replace(/TGA/g,'TGA Australia')}
function statusText(s){
 const x=String(s||'');
 const map={'Consent given':'Đang được chấp thuận','Approval lapsed':'Phê duyệt đã hết hiệu lực','Not available':'Không còn sẵn có trong nguồn','Provisional consent':'Chấp thuận có điều kiện'};
 return map[x]||x;
}
function globalObj(row){return {search:row[0]||'',name:row[1]||'',ingredient:row[2]||'',strength:row[3]||'',form:row[4]||'',holder:row[5]||'',source:row[6]||'',id:row[7]||'',status:row[8]||'',date:row[9]||'',confidence:row[10]||''}}
function search(q,limit=45){
 const n=norm(q),ts=qTerms(q);if(!n||!ts.length)return[];
 const out=[],seen=new Set();
 const add=o=>{const k=norm(o.label||o.rawLabel)+'|'+norm(o.ingredient||o.target||'')+'|'+norm(o.strength||'')+'|'+norm(o.form||'');if(!seen.has(k)){seen.add(k);out.push(o)}};
 CLIN.forEach(d=>{
  let r=99,lab=d.name;
  for(const t0 of [d.name].concat(d.aliases||[])){const z=rankText(t0,d.ingredient||'',norm(t0)+' '+norm(d.ingredient||''),n,ts);if(z<r){r=z;lab=t0}}
  if(r<99)add({kind:'clinical',label:viLabel(lab),rawLabel:lab,target:d.name,ingredient:d.ingredient||d.name,d,sub:(d.category||'Thuốc')+' • chuyên luận tiếng Việt viết riêng',r,sp:0});
 });
 for(const [alias,target] of Object.entries(LOCAL)){
  const r=rankText(alias,target,norm(alias)+' '+norm(target),n,ts);
  if(r<99){const d=resolveClinical(target);add({kind:'local',label:viLabel(alias),rawLabel:alias,target:d?d.name:target,ingredient:target,d,sub:'Tên thường gọi / biệt dược → '+viLabel(target),r:r+0.2,sp:1})}
 }
 if(VNDB){
  for(const v of VNDB.search(q,Math.max(limit,60))){
   const r=rankText(v.name+' '+v.strength+' '+v.form,v.ingredient,v.search,n,ts);
   if(r<99){const bits=[];if(v.ingredient)bits.push(viLabel(v.ingredient));if(v.strength)bits.push(viLabel(v.strength));bits.push('Danh mục thuốc Việt Nam');add({kind:'vn',label:viLabel(v.name),rawLabel:v.name,target:v.ingredient||v.name,ingredient:v.ingredient,strength:v.strength,form:v.form,v,sub:bits.filter(Boolean).join(' • '),r:r+0.1,sp:0});}
  }
 }
 for(let i=0;i<GLOBAL.length;i++){
  const row=GLOBAL[i],g=globalObj(row);if(!allIn(g.search,ts))continue;
  const r=rankText(g.name+' '+g.strength+' '+g.form,g.ingredient,g.search,n,ts);
  if(r<99){
   const bits=[];if(g.ingredient)bits.push(viLabel(g.ingredient));if(g.strength)bits.push(viLabel(g.strength));bits.push(sourceText(g.source));
   add({kind:'global',label:viLabel(g.name),rawLabel:g.name,target:g.ingredient||g.name,ingredient:g.ingredient,strength:g.strength,form:g.form,g,sub:bits.filter(Boolean).join(' • '),r:r+0.4,sp:g.source==='Việt Nam bổ sung'?0:2});
  }
 }
 for(let i=0;i<RX.length;i++){
  const srch=RXIDX[i]||'';if(!allIn(srch,ts))continue;
  const row=RX[i]||[],raw=String(row[2]||''),shown=viLabel(raw),r=rankText(raw,'',srch,n,ts);
  if(r<99){const d=resolveClinical(raw);add({kind:'rx',label:shown,rawLabel:raw,target:d?d.name:raw,ingredient:d?(d.ingredient||d.name):(row[1]==='IN'?raw:''),d,rxType:String(row[1]||''),rxcui:String(row[0]||''),sub:typeText(String(row[1]||''))+' • RxNorm ngoại tuyến',r:r+(d?0.6:1.2),sp:3})}
 }
 out.sort((a,b)=>a.r-b.r||a.sp-b.sp||a.label.length-b.label.length||a.label.localeCompare(b.label,'vi'));
 return out.slice(0,limit);
}
function hideResult(){const r=$('result');if(r)r.classList.add('hidden');for(const id of ['drugName','aliases'])if($(id))$(id).textContent='';for(const id of ['sourceBadge','clinicalBlocks','productMeta','productImages'])if($(id))$(id).innerHTML='';if($('productImages'))$('productImages').classList.add('hidden')}
function cachedCoverFor(m){if(!LONGCHAU||!LONGCHAU.getSavedCover)return null;return LONGCHAU.getSavedCover((m&&m.rawLabel)||(m&&m.label)||(m&&m.target)||'')||LONGCHAU.getSavedCover((m&&m.ingredient)||(m&&m.target)||'')}
function suggestionHtml(m,i){const c=cachedCoverFor(m),img=c&&c.url?'<img src="'+esc(c.url)+'" alt="">':'';return '<button class="suggestion '+(img?'has-img':'')+'" data-i="'+i+'">'+img+'<span><strong>'+esc(m.label)+'</strong><small>'+esc(m.sub)+'</small></span></button>'}
async function loadOneCoverForCurrent(m,d,g){const seq=++coverSeq,query=(g&&g.name)||(m&&m.rawLabel)||(m&&m.label)||(d&&d.name)||'',ingredient=(g&&g.ingredient)||(m&&m.ingredient)||(d&&d.ingredient)||'';if(norm(query).length<2)return;rememberImageTarget(query,ingredient);showImageLoading(query);let x=null;try{const cached=LONGCHAU&&LONGCHAU.getSavedCover&&(LONGCHAU.getSavedCover(query)||LONGCHAU.getSavedCover(ingredient));if(cached&&cached.url)x={url:cached.url,display:cached.url,cached:true};if(!x&&LONGCHAU&&LONGCHAU.findCover)x=await LONGCHAU.findCover(query,ingredient);if(!x)x=await onlineCoverFallback(query,ingredient);if(seq!==coverSeq)return;if(!x||!x.url){showImageMissing(query);return}await renderProductImages({_displayImages:[{src:x.display||x.url,original:x.url,offline:!!x.cached}],imageUrls:[x.url],productMeta:{image:x.url}},{label:query})}catch(_e){if(seq===coverSeq)showImageMissing(query)}}
function render(q){
 matches=search(q);const box=$('suggestions');
 const localHtml=matches.map((m,i)=>suggestionHtml(m,i)).join('');
 const lcHtml=LONGCHAU&&norm(q).length>=2?'<button class="suggestion web" data-lc="1"><strong>🔎 Tìm tất cả sản phẩm Long Châu khớp “'+esc(q)+'”</strong><small>Hiển thị nhiều lựa chọn, giá tham khảo và lưu từng hồ sơ để dùng ngoại tuyến.</small></button>':'';
 const webHtml=ONLINE&&norm(q).length>=2?'<button class="suggestion web" data-web="1"><strong>🌐 Tìm thêm trên web Việt Nam và quốc tế</strong><small>Bổ sung chuyên luận khi trang sản phẩm còn thiếu mục.</small></button>':'';
 box.innerHTML=lcHtml+webHtml+localHtml;
 box.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>show(matches[Number(b.dataset.i)]));
 const lb=box.querySelector('button[data-lc]');if(lb)lb.onclick=()=>runLongChauSearch(q,true,matches[0]||null);
 const wb=box.querySelector('button[data-web]');if(wb)wb.onclick=()=>runWebSearch(q,true,true,matches[0]||null);
 clearTimeout(webTimer);clear('message');
}
function mergeDrug(auto,d){
 const x={...auto,...(d||{})};
 const cd=d||{};
 for(const [k] of FIELDS){
  const cv=String(cd[k]||'').trim(),av=String(auto&&auto[k]||'').trim();
  if(!cv){x[k]=av;continue}
  if(k==='main'&&norm(cv)===norm(cd.indications||'')){x[k]=av||cv;continue}
  if(av&&cv.length<75&&norm(av)!==norm(cv)&&!norm(av).includes(norm(cv))&&!norm(cv).includes(norm(av))){x[k]=cv+' '+av}
 }
 x.category=(d&&d.category)||auto.category||'Thuốc';
 x.ingredient=(d&&d.ingredient)||auto.ingredient||x.name;
 x.ruleName=auto&&auto.ruleName;x.quality=(d?'curated':(auto&&auto.quality));x.matched=!!(d||(auto&&auto.matched));
 return x;
}
function blocks(d){const core=FIELDS.filter(([k])=>String(d[k]||'').trim()).map(([k,title,cls])=>'<article class="result '+cls+'"><h3>'+title+'</h3><div class="lang-vi"><p>'+esc(d[k])+'</p></div></article>').join('');const warn=String(d.warnings||'').trim();return core+(warn?'<article class="result contra"><h3>📌 Lưu ý / Thận trọng</h3><div class="lang-vi"><p>'+esc(warn)+'</p></div></article>':'')}
function metaRows(g){
 const rows=[];g=g||{};
 const add=(a,b,always)=>{if(b||always)rows.push('<div class="meta-row"><b>'+esc(a)+'</b><span>'+esc(b||'Chưa có trong dữ liệu ngoại tuyến')+'</span></div>')};
 add('Giá tham khảo',g.price||g.priceText||'Chưa đồng bộ giá',true);
 add('Hoạt chất / thành phần',g.ingredient?viLabel(g.ingredient):'Chưa xác định',true);
 add('Hàm lượng',viLabel(g.strength));add('Dạng bào chế',viLabel(g.form));add('Quy cách',g.pack);
 add('Số đăng ký',g.registration||g.id);add('Phân loại',g.classification);add('Nhà sản xuất',g.manufacturer||g.holder);add('Nước sản xuất',g.country);add('Đơn vị đăng ký',g.holder);add('Nguồn',sourceText(g.source));add('Ngày phê duyệt',g.approval||g.date);
 return rows.join('');
}
function saveHistory(label,d,g){
 try{parent.postMessage({type:'BCCT_HISTORY_ADD',entry:{tool:'Tra cứu thuốc',title:label,summary:'Ngoại tuyến: '+((g&&sourceText(g.source))||(d&&d.category)||'Thuốc'),detail:(g&&g.ingredient?'Hoạt chất: '+g.ingredient+'\n':'')+(d?'Chỉ định: '+(d.indications||'')+'\nChống chỉ định: '+(d.contraindications||'')+'\nTác dụng phụ: '+(d.side||''):'')}},'*')}catch(e){}
}
function webSourcesHtml(data){
 const list=(data&&data.record&&data.record.sources)||[];if(!list.length)return'';
 return '<article class="result clinical"><h3>🔗 Nguồn đã tổng hợp</h3><div class="web-sources">'+list.map((x,i)=>{const u=String(x.url||'');if(!/^https?:\/\//i.test(u))return'';let host='';try{host=new URL(u).hostname}catch(_e){}return '<a class="web-source" href="'+esc(u)+'" target="_blank" rel="noopener"><b>'+(i+1)+'. '+esc(x.name||host||'Nguồn web')+'</b><small>'+esc(host||u)+'</small></a>'}).join('')+'</div></article>';
}
function curatedSourcesHtml(d){
 const list=(d&&d.sources)||[];if(!list.length)return'';
 return '<article class="result clinical"><h3>🔗 Nguồn tham khảo</h3><div class="web-sources">'+list.map((x,i)=>{const u=String(x.url||'');if(!/^https?:\/\//i.test(u))return'';let host='';try{host=new URL(u).hostname}catch(_e){}return '<a class="web-source" href="'+esc(u)+'" target="_blank" rel="noopener"><b>'+(i+1)+'. '+esc(x.name||host||'Nguồn')+'</b><small>'+esc(host||u)+'</small></a>'}).join('')+'</div></article>';
}
async function renderProductImages(record,opt){const box=$('productImages');if(!box)return false;const label=String(opt&&opt.label||record&&record.name||'thuốc này');const urls=(IMG&&IMG.uniq?IMG.uniq([...(record&&record.imageUrls||[]),record&&record.productMeta&&record.productMeta.image]):[...(record&&record.imageUrls||[])]).slice(0,1);let rows=((record&&record._displayImages)||[]).slice(0,1);if(!rows.length&&IMG&&urls.length){try{rows=await IMG.resolve(urls,1)}catch(_e){rows=[]}}if(!rows.length)rows=urls.slice(0,1).map(src=>({src,offline:false}));if(!rows.length){showImageMissing(label);return false}box.classList.remove('hidden');const x=rows[0],src=x.src||x.original||'';box.innerHTML='<div class="image-shell"><img loading="eager" alt="Ảnh '+esc(label)+'" src="'+esc(src)+'"><div class="image-caption">Một ảnh đại diện đã được lưu để dùng ngoại tuyến.</div></div>';const im=box.querySelector('img');if(im)im.onerror=()=>showImageMissing(label);return true}
function showWebData(data){
 if(!data||!data.record)return;const d=data.record,q=data.query||d.name||'';
 $('drugInput').value=d.name||q;$('suggestions').innerHTML='';clear('message');$('result').classList.remove('hidden');
 $('drugName').textContent=d.name||q;
 $('aliases').textContent=d.ingredient?'Hoạt chất / thành phần: '+String(d.ingredient).slice(0,1000):'';
 const lc=!!(data.longChau||d.longChau);
 $('sourceBadge').innerHTML=data.cached?'<span class="tag ok">Đã lưu ngoại tuyến</span>':(lc?'<span class="tag ok">Dữ liệu Long Châu • đã lưu ngoại tuyến</span>':'<span class="tag ok">Đã tìm và lưu trên máy</span>');
 const pm={...(d.productMeta||{}),ingredient:d.ingredient||(d.productMeta&&d.productMeta.ingredient)||'',source:(d.productMeta&&d.productMeta.source)||(lc?'Nhà thuốc Long Châu':d.category||'Nguồn web')};
 $('productMeta').innerHTML=metaRows(pm);rememberImageTarget(d.name||q,d.ingredient||pm.ingredient||'');const hasImg=!!((d.imageUrls&&d.imageUrls.length)||(d.productMeta&&d.productMeta.image));if(hasImg)renderProductImages(d,{label:d.name||q});else loadOneCoverForCurrent({rawLabel:d.name||q,ingredient:d.ingredient||pm.ingredient||''},d,pm);
 const cov=d.coverage||{filled:0,total:9,missing:[]};
 $('clinicalBlocks').innerHTML=blocks(d)+webSourcesHtml(data);
 $('resultNotice').innerHTML='<b>Giá tham khảo:</b> lấy tại thời điểm đồng bộ và có thể thay đổi theo khu vực hoặc khuyến mãi. Đối chiếu đúng hoạt chất, hàm lượng và dạng dùng trước khi sử dụng.';
 saveHistory(d.name||q,d,pm);
}
function priceLabel(c){return String((c&&c.price)||'').trim()||'Chưa có giá niêm yết'}
function showLongChauCandidates(found,q,local){
 const fresh=(found&&found.candidates)||[],saved=(found&&found.savedCandidates)||[];lcCandidates=[...fresh,...saved];lcNewCount=fresh.length;lcQuery=q;hideResult();clear('message');const box=$('suggestions');
 const skipped=Number(found&&found.skippedSaved||saved.length||0),total=Number(found&&found.totalDiscovered||fresh.length+saved.length||0);
 const head=fresh.length?'<div class="online-note"><b>Tìm thấy '+fresh.length+' sản phẩm mới chưa lưu.</b> '+(skipped?'Đã bỏ qua '+skipped+' sản phẩm đã có ngoại tuyến để dành chỗ cho kết quả mới. ':'')+'Các sản phẩm mới sẽ tự tải chi tiết và lưu một lần.</div>':(saved.length?'<div class="online-note"><b>Không có sản phẩm mới trong lượt này.</b> '+saved.length+' sản phẩm khớp đã có ngoại tuyến và không bị tải hay ghi đè lại.</div>':'<div class="online-note">Long Châu chưa trả về sản phẩm khớp tên này.</div>');
 const rows=fresh.slice(0,60).map((c,i)=>'<button class="suggestion web '+(c.image?'has-img':'')+'" data-lci="'+i+'">'+(c.image?'<img src="'+esc(c.image)+'" alt="">':'')+'<span><strong>'+esc(c.name||'Sản phẩm')+'</strong><small>'+esc([c.strength,c.pack,priceLabel(c),'Mới'].filter(Boolean).join(' • '))+'</small></span></button>').join('');
 const locals=(local||matches||[]).slice(0,20).map((m,i)=>'<button class="suggestion" data-li="'+i+'"><strong>'+esc(m.label)+'</strong><small>'+esc(m.sub)+'</small></button>').join('');
 const other=ONLINE?'<button class="suggestion web" data-global="1"><strong>🌐 Tìm thêm nguồn khác</strong><small>Chỉ dùng khi cần mở rộng ngoài danh mục Long Châu.</small></button>':'';
 box.innerHTML=head+rows+other+(locals?'<div class="online-note"><b>Danh mục tích hợp sẵn</b></div>'+locals:'');
 box.querySelectorAll('[data-lci]').forEach(b=>b.onclick=()=>openLongChauCandidate(Number(b.dataset.lci)));
 box.querySelectorAll('[data-li]').forEach(b=>b.onclick=()=>show((local||matches)[Number(b.dataset.li)]));
 const g=box.querySelector('[data-global]');if(g)g.onclick=()=>runWebSearch(q,true,true,(local||matches)[0]||null);
}
async function runLongChauSearch(q,fresh,fallback){
 const query=String(q||'').trim();if(!LONGCHAU||norm(query).length<2){if(fallback)show(fallback);return}
 const seq=++webSeq;hideResult();$('suggestions').innerHTML='';stat('message','Đang tìm sản phẩm mới và bỏ qua các hồ sơ đã lưu…','warn');
 try{
  const found=await LONGCHAU.searchCandidates(query,{fresh:true});if(seq!==webSeq)return;clear('message');showLongChauCandidates(found,query,search(query));
  const list=(found.candidates||[]).slice(0,60),saved=(found.savedCandidates||[]).slice(0,80);
  if(!list.length){if(saved.length&&isExactCandidateList(saved,query)){openLongChauCandidate(lcNewCount);return}if(!saved.length&&ONLINE)return runWebSearch(query,true,!!fresh,fallback);return}
  if(isExactCandidateList(list,query)){
   const rest=list.slice(1);openLongChauCandidate(0);
   if(rest.length)prefetchFullCandidates(rest,p=>{dataSyncUi({total:p.total,done:p.done,text:p.done<p.total?'Đang tải và lưu sản phẩm mới…':'Đã hoàn tất lưu dữ liệu',current:p.name||''});if(p.done<p.total)stat('message','Đang lưu '+p.done+'/'+p.total+' sản phẩm mới…','warn');else stat('message','Đã lưu mới '+p.ok+' sản phẩm; bỏ qua '+p.skipped+' mục đã có.','ok')}).catch(()=>{});
  }else{
   prefetchFullCandidates(list,p=>{if(seq===webSeq){dataSyncUi({total:p.total,done:p.done,text:p.done<p.total?'Đang tải và lưu sản phẩm mới…':'Đã hoàn tất lưu dữ liệu',current:p.name||''});if(p.done<p.total)stat('message','Đang tải và lưu '+p.done+'/'+p.total+' sản phẩm mới…','warn');if(p.done===p.total)stat('message','Đã lưu mới '+p.ok+' sản phẩm; bỏ qua '+p.skipped+' mục đã có.','ok')}}).catch(()=>{});
  }
 }catch(err){if(seq!==webSeq)return;const local=search(query);if(local.length){render(query);stat('message','Không kết nối được Long Châu; các kết quả ngoại tuyến vẫn dùng được.','warn')}else if(ONLINE){runWebSearch(query,true,!!fresh,local[0]||fallback||null)}else stat('message','Không lấy được danh sách Long Châu: '+String(err&&err.message||err),'err')}
}
function mergeMissingRecord(base,extra){
 const out={...(base||{})};if(!extra)return out;
 for(const [k] of FIELDS){const a=String(out[k]||'').trim(),b=String(extra[k]||'').trim();if(!a&&b)out[k]=b}
 if(!out.ingredient&&extra.ingredient)out.ingredient=extra.ingredient;
 out.sources=[...(out.sources||[]),...(extra.sources||[])].filter((x,i,a)=>x&&x.url&&a.findIndex(y=>y.url===x.url)===i);
 out.productMeta={...(extra.productMeta||{}),...(out.productMeta||{})};out.imageUrls=(IMG&&IMG.uniq?IMG.uniq([...(out.imageUrls||[]),...(extra.imageUrls||[]),out.productMeta.image,extra.productMeta&&extra.productMeta.image]):[...(out.imageUrls||[]),...(extra.imageUrls||[])]).slice(0,1);out.productMeta.image=out.imageUrls[0]||out.productMeta.image||'';
 const miss=FIELDS.map(x=>x[0]).filter(k=>!String(out[k]||'').trim());out.coverage={filled:FIELDS.length-miss.length,total:FIELDS.length,missing:miss};return out;
}
function recordCoverage(record){const miss=FIELDS.map(x=>x[0]).filter(k=>!String(record&&record[k]||'').trim());return {filled:FIELDS.length-miss.length,total:FIELDS.length,missing:miss}}
const fullPrefetchJobs=new Map();
function candidateCacheKey(c){return norm([c&&c.url,c&&c.slug,c&&c.sku,c&&c.name].filter(Boolean).join('|'))}
async function enrichLongChauCandidate(c,opts){
 opts=opts||{};if(!c||!LONGCHAU)throw new Error('Chưa có sản phẩm để tải');
 const key=candidateCacheKey(c);if(!opts.fresh&&fullPrefetchJobs.has(key))return fullPrefetchJobs.get(key);
 const job=(async()=>{
  const data=await LONGCHAU.getDetail(c,{forceRefresh:!!opts.forceRefresh});
  let record=data&&data.record||{};record.coverage=recordCoverage(record);
  if(data&&data.cached&&!opts.forceRefresh&&record.coverage.filled>=record.coverage.total&&((record.imageUrls&&record.imageUrls.length)||(record.productMeta&&record.productMeta.image)))return {...data,record,candidate:c,cached:true};
  if(record.coverage.filled<record.coverage.total&&ONLINE){
   const basis=String(record.ingredient||c.ingredient||c.name||'').trim();
   const productName=String(record.name||c.name||'').trim();
   const queries=[];if(basis)queries.push(basis);if(productName&&norm(productName)!==norm(basis))queries.push(productName+' '+basis);
   for(const query of queries){
    try{const supplement=await ONLINE.search(query,{fresh:false});if(supplement&&supplement.record)record=mergeMissingRecord(record,supplement.record)}catch(_e){}
    record.coverage=recordCoverage(record);if(record.coverage.filled>=record.coverage.total)break;
   }
  }
  if(record.coverage.filled<record.coverage.total){
   const basis=String(record.ingredient||c.ingredient||c.name||'').trim(),curated=resolveClinical(basis)||resolveClinical(c.name||'');
   const auto=makeAuto(basis||c.name,'IN',{product:c.name,strength:c.strength,form:c.form,source:'Nhà thuốc Long Châu'});
   if(curated||(auto&&auto.matched))record=mergeMissingRecord(record,mergeDrug(auto,curated));
  }
  record.coverage=recordCoverage(record);record.longChau=true;
  if(LONGCHAU.storeDetail){try{record=await LONGCHAU.storeDetail(c,record)||record}catch(_e){}}if(IMG&&record.imageUrls){try{record._displayImages=await IMG.resolve(record.imageUrls,1)}catch(_e){}}
  return {...data,record,candidate:c,cached:!!(data&&data.cached)};
 })();
 fullPrefetchJobs.set(key,job);try{return await job}finally{fullPrefetchJobs.delete(key)}
}
async function prefetchFullCandidates(candidates,onProgress){
 const list=(candidates||[]).slice(0,60),queue=list.slice();let done=0,ok=0,full=0,skipped=0;
 async function worker(){while(queue.length){const c=queue.shift();try{if(LONGCHAU&&LONGCHAU.isComplete&&await LONGCHAU.isComplete(c)){skipped++}else{const d=await enrichLongChauCandidate(c,{forceRefresh:false});if(d&&d.cached&&recordCoverage(d.record).filled>=FIELDS.length)skipped++;else{ok++;if(d&&d.record&&recordCoverage(d.record).filled>=FIELDS.length)full++}}}catch(_e){}done++;try{if(typeof onProgress==='function')onProgress({done,total:list.length,ok,full,skipped,name:c&&c.name||''})}catch(_e){}}}
 await Promise.all([worker(),worker()]);return {done,total:list.length,ok,full,skipped};
}
function isExactCandidateList(list,query){if(!list||!list.length)return false;if(list.length===1)return true;const r0=LONGCHAU&&typeof LONGCHAU.rank==='function'?LONGCHAU.rank(list[0],query):99;const r1=LONGCHAU&&typeof LONGCHAU.rank==='function'?LONGCHAU.rank(list[1],query):99;return r0<=2&&r1>8}
async function openLongChauCandidate(index){
 const c=lcCandidates[index];if(!c||!LONGCHAU)return;const seq=++webSeq,isSaved=index>=lcNewCount;hideResult();$('suggestions').innerHTML='';dataSyncUi({total:1,done:isSaved?1:0,text:isSaved?'Đang mở dữ liệu ngoại tuyến':'Đang tải đầy đủ hồ sơ…',current:c.name||''});stat('message',isSaved?'Đang mở hồ sơ ngoại tuyến, không tải lại…':'Đang tải đầy đủ nội dung, giá và lưu mới “'+String(c.name||'sản phẩm')+'”…','warn');
 try{const data=await enrichLongChauCandidate(c,{forceRefresh:false});if(seq!==webSeq)return;const record=data.record;dataSyncUi({total:1,done:1,text:'Đã lưu đầy đủ hồ sơ',current:record.name||c.name||''});clear('message');showWebData({query:record.name||c.name,record,cached:data.cached,longChau:true,results:record.sources||[]})
 }catch(err){if(seq!==webSeq)return;stat('message','Không tải được chi tiết sản phẩm: '+String(err&&err.message||err),'err');showLongChauCandidates({candidates:lcCandidates},lcQuery,search(lcQuery))}
}
async function runWebSearch(q,autoOpen,fresh,fallback,baseRecord){
 const query=String(q||'').trim();if(!ONLINE||norm(query).length<2)return;
 const seq=++webSeq;clearTimeout(webTimer);hideResult();$('suggestions').innerHTML='';dataSyncUi({total:1,done:0,text:'Đang bổ sung dữ liệu từ web…',current:query});stat('message','Đang bổ sung chuyên luận từ các nguồn Việt Nam và quốc tế cho “'+query+'”…','warn');
 try{const data=await ONLINE.search(query,{fresh:!!fresh});if(seq!==webSeq)return;dataSyncUi({total:1,done:1,text:'Đã lưu dữ liệu bổ sung',current:query});clear('message');if(baseRecord&&data&&data.record)data.record=mergeMissingRecord(baseRecord,data.record);showWebData(data)}catch(err){if(seq!==webSeq)return;if(baseRecord){showWebData({query:baseRecord.name||query,record:baseRecord,cached:true,longChau:!!baseRecord.longChau});stat('message','Không lấy thêm được nguồn web; đang hiển thị hồ sơ đã lưu.','warn')}else if(fallback){show(fallback);stat('message','Không kết nối được tìm kiếm web; đang hiển thị dữ liệu cục bộ.','warn')}else stat('message','Chưa lấy được dữ liệu web cho tên này: '+String(err&&err.message||err),'err')}
}
function show(m){
 if(!m)return;
 if(m.kind==='webaggregate'){showWebData(m.data);return}
 const raw=m.rawLabel||m.label||m.target||'';
 let d=null,g=null,ingredient=m.ingredient||'',curated=m.d||null,clinicalAllowed=true,note='',badge='';
 if(m.kind==='vn'){
  g=m.v;ingredient=g.ingredient||'';curated=resolveClinical(g.name)||resolveClinical(ingredient);
  const auto=makeAuto(ingredient||g.name,'IN',{product:g.name,strength:g.strength,form:g.form,source:g.source});d=mergeDrug(auto,curated);
  badge='<span class="tag ok">Thuốc Việt Nam đã lưu ngoại tuyến</span>';
  note=curated?'Đã liên kết với chuyên luận tiếng Việt theo đúng sản phẩm hoặc hoạt chất.':(auto&&auto.matched?'Nội dung được liên kết theo hoạt chất.':'Thông tin đăng ký sản phẩm đã được lưu ngoại tuyến.');
  if(!curated&&(!auto||!auto.matched))clinicalAllowed=false;
 }else if(m.kind==='global'){
  g=m.g;ingredient=g.ingredient||'';
  if(ingredient){
   curated=resolveClinical(ingredient)||resolveClinical(g.name);
   const auto=makeAuto(ingredient,'IN',{product:g.name,strength:g.strength,form:g.form,source:g.source});
   d=mergeDrug(auto,curated);
   if(g.confidence==='s'){
    badge='<span class="tag warn">Hoạt chất suy đoán từ tên đăng ký</span>';
    if(auto&&auto.matched)badge+=' <span class="tag ok">Nội dung: '+esc(auto.ruleName||auto.category)+'</span>';
    note='Thông tin sản phẩm được lưu từ danh mục nguồn. Hoạt chất của mục này được máy suy đoán từ tên đăng ký; '+(auto&&auto.matched?'các mục bên dưới mô tả rõ theo nhóm dược lý “'+(auto.ruleName||auto.category)+'”.':'chưa có dữ liệu lâm sàng cụ thể cho hoạt chất suy đoán này.');
   }else{
    badge='<span class="tag ok">Có hoạt chất từ nguồn dữ liệu</span>';
    if(curated)badge+=' <span class="tag ok">Chuyên luận viết riêng</span>';
    else if(auto&&auto.matched)badge+=' <span class="tag ok">Nội dung: '+esc(auto.ruleName||auto.category)+'</span>';
    note=curated?'Đã liên kết với chuyên luận tiếng Việt viết riêng theo hoạt chất.':(auto&&auto.matched?'Đã xác định hoạt chất và nhóm dược lý “'+(auto.ruleName||auto.category)+'”; 9 mục bên dưới là nội dung cụ thể cho nhóm/hoạt chất này, không còn là đoạn mẫu chung.':'Đã xác định tên hoạt chất nhưng dữ liệu ngoại tuyến chưa phân loại được nhóm dược lý; ứng dụng không suy đoán công dụng.');
   }
   if(!curated&&(!auto||!auto.matched))clinicalAllowed=false;
  }else{
   clinicalAllowed=false;
   badge='<span class="tag warn">Chưa xác định hoạt chất</span>';
   note='Đây là bản ghi sản phẩm có thật trong danh mục đã nhập, nhưng nguồn không cung cấp hoặc ứng dụng chưa xác định được hoạt chất. Ứng dụng không tạo chỉ định, liều dùng hay chống chỉ định giả cho mục này.';
  }
 }else if(m.kind==='clinical'){
  d=mergeDrug(makeAuto(ingredient||raw,'IN',{}),curated);badge='<span class="tag ok">Chuyên luận tiếng Việt viết riêng</span>';note='Hồ sơ tiếng Việt ngoại tuyến được liên kết trực tiếp với hoạt chất / biệt dược này.';
 }else if(m.kind==='local'){
  d=mergeDrug(makeAuto(ingredient||m.target,'IN',{}),curated);badge='<span class="tag ok">Tên biệt dược đã liên kết hoạt chất</span>';note='Tên thường gọi hoặc biệt dược đã được liên kết với hoạt chất để tạo nội dung tiếng Việt ngoại tuyến.';
 }else{
  if(curated||m.rxType==='IN'||m.rxType==='SCD'||m.rxType==='SBD'){
   const basis=ingredient||raw,auto=makeAuto(basis,m.rxType||'',{});d=mergeDrug(auto,curated);badge='<span class="tag ok">Bản ghi RxNorm ngoại tuyến</span>';if(!curated&&auto&&auto.matched)badge+=' <span class="tag ok">Nội dung: '+esc(auto.ruleName||auto.category)+'</span>';note=curated?'Đã liên kết với chuyên luận tiếng Việt viết riêng.':(auto&&auto.matched?'Nội dung cụ thể theo nhóm dược lý “'+(auto.ruleName||auto.category)+'”.':'Chưa phân loại được nhóm dược lý; không suy đoán công dụng.');if(!curated&&(!auto||!auto.matched))clinicalAllowed=false;
  }else{
   clinicalAllowed=false;badge='<span class="tag warn">Tên biệt dược chưa liên kết hoạt chất</span>';note='RxNorm xác nhận tên biệt dược nhưng bản ngoại tuyến chưa xác định được hoạt chất. Ứng dụng không tạo nội dung điều trị giả từ tên thương mại.';
  }
 }
 $('drugInput').value=m.label||viLabel(raw);$('suggestions').innerHTML='';clear('message');$('result').classList.remove('hidden');
 $('drugName').textContent=m.label||viLabel(raw);
 if(g){$('aliases').textContent=(g.ingredient?'Hoạt chất: '+viLabel(g.ingredient):'Sản phẩm trong danh mục')+(g.strength?' • '+viLabel(g.strength):'');$('productMeta').innerHTML=metaRows({...g,price:g.price||g.priceText||''})}
 else{$('aliases').textContent=d?'Nhóm: '+(d.category||'Thuốc')+(ingredient?' • Hoạt chất / thành phần: '+viLabel(ingredient):''):(m.rxcui?'Mã RxNorm: '+m.rxcui:'');if(d&&d.productMeta){const pm=d.productMeta;$('productMeta').innerHTML=metaRows({ingredient:d.ingredient||ingredient,strength:pm.strength,form:pm.form,registration:pm.registration,manufacturer:pm.manufacturer,country:pm.country,pack:pm.pack,price:pm.price||'',source:'Dữ liệu thuốc Việt Nam'})}else $('productMeta').innerHTML=metaRows({ingredient:ingredient||'',price:'Chưa đồng bộ giá',source:m.rxcui?'RxNorm ngoại tuyến':'Dữ liệu ngoại tuyến'})+(m.rxcui?'<div class="meta-row"><b>Mã RxNorm</b><span>'+esc(m.rxcui)+'</span></div>':'')}
 $('sourceBadge').innerHTML=badge;showImageLoading(m.label||viLabel(raw));rememberImageTarget(m.label||raw,ingredient);
 $('clinicalBlocks').innerHTML=(clinicalAllowed&&d?blocks(d)+curatedSourcesHtml(d):'<article class="result contra"><h3>ℹ️ Thông tin sản phẩm</h3><div class="lang-vi"><p>'+esc(note)+'</p></div></article>');
 $('resultNotice').innerHTML='<b>Lưu ý:</b> Đối chiếu nhãn thuốc và chỉ định của người kê đơn.';
 saveHistory(m.label||raw,d,g);
 loadOneCoverForCurrent(m,d,g);
}
let tm;
$('drugInput').addEventListener('input',e=>{hideResult();clearTimeout(tm);clearTimeout(webTimer);webSeq++;const v=e.target.value;if(norm(v).length>=2){stat('message','Đang tìm trong '+(META.products||GLOBAL.length).toLocaleString('vi-VN')+' hồ sơ cục bộ…','warn');tm=setTimeout(()=>render(v),160)}else{$('suggestions').innerHTML='';clear('message')}});
$('drugInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(webTimer);const q=e.target.value,x=search(q),best=x[0];if(LONGCHAU)runLongChauSearch(q,false,best||null);else if(best)show(best);else if(ONLINE)runWebSearch(q,true,false,null)}});
function updateSyncUi(detail){
 const btn=$('vnSyncBtn'),info=$('vnSyncInfo');if(!btn||!info)return;
 if(detail&&detail.state==='loading'){btn.disabled=true;btn.textContent='Đang tải dữ liệu Việt Nam…';info.textContent='Trang '+detail.page+' • '+Number(detail.count||0).toLocaleString('vi-VN')+' thuốc';return}
 if(detail&&detail.state==='error'){btn.disabled=false;btn.textContent='Tải lại danh mục thuốc Việt Nam';info.textContent='Chưa cập nhật xong: '+detail.error;return}
 const count=VNDB?VNDB.count:0;btn.disabled=false;btn.textContent=count?'Cập nhật danh mục thuốc Việt Nam':'Tải danh mục thuốc Việt Nam về máy';info.textContent=count?Number(count).toLocaleString('vi-VN')+' thuốc Việt Nam đã lưu ngoại tuyến':'';
}
if(VNDB){
 VNDB.ready.then(rows=>{VNDATA=rows||[];updateSyncUi({state:'ready'});if(!BCCT_SYNC_MODE&&!VNDATA.length)VNDB.sync(false).catch(()=>{})});
 addEventListener('bcct-vn-drug-progress',e=>{updateSyncUi(e.detail||{});if(e.detail&&e.detail.state==='ready'){VNDATA=VNDB.getAll();const v=$('drugInput').value;if(norm(v).length>=2)render(v)}});
 if($('vnSyncBtn'))$('vnSyncBtn').onclick=()=>VNDB.sync(true).catch(err=>stat('message','Không tải được danh mục Việt Nam: '+String(err&&err.message||err),'err'));
}else if($('vnSyncBtn'))$('vnSyncBtn').style.display='none';
dataSyncUi({hide:true});if($('imageSyncBtn'))$('imageSyncBtn').onclick=()=>runImageBackfill(true);if(LONGCHAU&&!BCCT_SYNC_MODE)setTimeout(()=>runImageBackfill(false),900);else imageSyncUi({running:false,total:1,done:0,text:'Không có bộ đồng bộ ảnh',current:'',error:true});
const q=new URLSearchParams(location.search).get('q');
if(q){$('drugInput').value=viLabel(q);const x=search(q),best=x[0];if(LONGCHAU)runLongChauSearch(q,false,best||null);else if(best)show(best);else if(ONLINE)runWebSearch(q,true,false,null)}
window.BCCT_RUN_WEB_DRUG=(q,fresh)=>runWebSearch(q||$('drugInput').value,true,!!fresh);
})();
