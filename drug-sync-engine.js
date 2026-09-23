(function(){
'use strict';
const SITE='https://nhathuoclongchau.com.vn',DB='bcct_drug_weekly_v1',PRODUCT_DB='bcct_longchau_offline_v4';
const FIELDS=['indications','dosage','contraindications','side','interactions','main','warnings'];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function urlOf(s){try{const u=new URL(String(s||'').trim(),SITE);if(u.protocol!=='https:'||u.hostname!=='nhathuoclongchau.com.vn')return '';u.hash='';return u.href;}catch(e){return '';}}
function productUrl(s){const u=urlOf(s);return u&&/^\/thuoc\/[^/?]+\.html$/.test(new URL(u).pathname)?u.split('?')[0]:'';}
function openDb(name){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;if(name===DB){db.createObjectStore('state',{keyPath:'key'});db.createObjectStore('tasks',{keyPath:'key'});}else{if(!db.objectStoreNames.contains('products'))db.createObjectStore('products',{keyPath:'key'});if(!db.objectStoreNames.contains('queries'))db.createObjectStore('queries',{keyPath:'key'});}};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Kho dữ liệu đang được khôi phục; sẽ thử lại.'));});}
async function dbRead(dbName,store,key){const db=await openDb(dbName);try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),r=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function dbWrite(dbName,store,rows){const db=await openDb(dbName);try{await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite'),os=tx.objectStore(store);for(const row of rows)os.put(row);tx.oncomplete=()=>{if(dbName===PRODUCT_DB&&store==='products')invalidateSearch();resolve();};tx.onerror=()=>reject(tx.error||new Error('Không ghi được dữ liệu'));tx.onabort=()=>reject(tx.error||new Error('Không đủ dung lượng lưu dữ liệu'));});}finally{db.close();}}
async function resetTasks(){const db=await openDb(DB);try{await new Promise((resolve,reject)=>{const t=db.transaction('tasks','readwrite');t.objectStore('tasks').clear();t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error);});}finally{db.close();}}
async function commitTask(meta,task){const db=await openDb(DB);try{await new Promise((resolve,reject)=>{const t=db.transaction(['tasks','state'],'readwrite');t.objectStore('tasks').put(task);t.objectStore('state').put(meta);t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(t.error||new Error('Không lưu được điểm dừng'));});}finally{db.close();}}
async function request(url,depth){
 url=urlOf(url);if(!url)throw new Error('Liên kết nguồn không hợp lệ');
 if((depth||0)>4)throw new Error('Nguồn chuyển hướng quá nhiều lần');
 let result;
 if(window.DrugWorker&&DrugWorker.request){result=JSON.parse(DrugWorker.request(url));}
 else{const c=new AbortController(),t=setTimeout(()=>c.abort(),35000);try{const r=await fetch(url,{signal:c.signal,credentials:'omit',cache:'no-store',redirect:'error'});result={status:r.status,text:r.ok?await r.text():''};}finally{clearTimeout(t);}}
 if(result.status>=300&&result.status<400&&result.location)return request(new URL(result.location,url).href,(depth||0)+1);
 if(result.status!==200){const e=new Error(result.status?'Nguồn Long Châu trả HTTP '+result.status:'Chưa kết nối được nguồn: '+(result.error||'mất mạng'));e.status=result.status;throw e;}
 if(!result.text||result.text.length<80)throw new Error('Nguồn trả dữ liệu trống');
 return result.text;
}
function parseSitemap(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror')||!['urlset','sitemapindex'].includes(doc.documentElement.localName))throw new Error('Nguồn chưa trả danh mục XML hợp lệ');
 const maps=[],products=[],seen=new Set();
 for(const node of Array.from(doc.documentElement.children)){
  const loc=Array.from(node.children).find(x=>x.localName==='loc'),mod=Array.from(node.children).find(x=>x.localName==='lastmod');
  if(!loc)continue;const url=urlOf(loc.textContent);
  if(node.localName==='sitemap'&&url&&/\.xml(?:\.gz)?(?:\?|$)/i.test(url))maps.push(url);
  else{const u=productUrl(url);if(u&&!seen.has(u.toLowerCase())){seen.add(u.toLowerCase());products.push({key:u.toLowerCase(),url:u,lastmod:mod?mod.textContent.trim():''});}}
 }
 return {maps,products};
}
function htmlMarkdown(html,url){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const canonical=doc.querySelector('link[rel="canonical"]');
 if(canonical&&productUrl(canonical.getAttribute('href'))&&productUrl(canonical.getAttribute('href'))!==productUrl(url))throw new Error('Trang trả về không khớp thuốc yêu cầu');
 const title=doc.querySelector('h1');if(!title)throw new Error('Chưa nhận được trang chi tiết thuốc');
 const name=title.textContent.trim();if(!name||/access denied|captcha|not found|không tìm thấy/i.test(name))throw new Error('Nguồn chưa cho đọc trang thuốc');
 let ld={};
 function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}if(x['@type']==='Product'||Array.isArray(x['@type'])&&x['@type'].includes('Product'))ld=x;else if(x['@graph'])visit(x['@graph']);}
 for(const s of doc.querySelectorAll('script[type="application/ld+json"]'))try{visit(JSON.parse(s.textContent));}catch(e){}
 const og=doc.querySelector('meta[property="og:image"]'),image=Array.isArray(ld.image)?ld.image[0]:typeof ld.image==='string'?ld.image:ld.image&&ld.image.url||og&&og.getAttribute('content')||'';
 doc.querySelectorAll('script,style,nav,header,footer,noscript,iframe,button,form,svg').forEach(x=>x.remove());
 const root=doc.querySelector('main')||doc.body;
 function render(n){
  if(n.nodeType===3)return n.nodeValue;
  if(n.nodeType!==1)return '';
  const tag=n.tagName.toLowerCase();if(tag==='img'||tag==='a'&&productUrl(n.getAttribute('href'))&&productUrl(n.getAttribute('href'))!==productUrl(url))return '';
  let x=Array.from(n.childNodes).map(render).join('');
  if(/^h[1-6]$/.test(tag))return '\n\n'+'#'.repeat(Number(tag[1]))+' '+x.trim()+'\n\n';
  if(tag==='br')return '\n';if(tag==='li')return '\n• '+x.trim()+'\n';
  if(tag==='td'||tag==='th')return x.trim()+' | ';
  if(tag==='strong'||tag==='b')return '**'+x.trim()+'**';
  return ['p','div','section','article','tr','table','ul','ol'].includes(tag)?'\n'+x.trim()+'\n':x;
 }
 const markdown='Title: '+name+'\n\nMarkdown Content:\n'+render(root).replace(/\n{3,}/g,'\n\n');
 const candidate={name,url,slug:new URL(url).pathname.split('/').pop(),image};
 const record=BCCT_LONGCHAU.parseMarkdown(markdown,url,candidate);
 record.name=name;record.downloadedAt=Date.now();record.offlineSyncSource='Long Châu – trang sản phẩm công khai';
 record.sources=[{name:'Nhà thuốc Long Châu – trang sản phẩm',url}];
 record.imageUrls=image?[image]:[];record.productMeta=Object.assign({},record.productMeta,{source:'Nhà thuốc Long Châu',url,image});
 if(FIELDS.filter(k=>String(record[k]||'').trim().length>=35).length<2)throw new Error('Trang chưa có đủ nội dung thuốc để lưu; giữ bản cũ.');
 return {candidate,record};
}
async function saveProduct(task){
 const html=await request(task.url),parsed=htmlMarkdown(html,task.url),record=parsed.record;
 let imageMissing=0;
 if(record.imageUrls.length&&window.BCCT_DRUG_IMAGES){const result=await BCCT_DRUG_IMAGES.cacheOne(record.imageUrls[0]);if(!result)imageMissing=1;}
 record.sourceLastmod=task.lastmod||'';
 const old=await dbRead(PRODUCT_DB,'products',task.key);
 await dbWrite(PRODUCT_DB,'products',[{key:task.key,candidate:parsed.candidate,record,ts:old&&old.ts||Date.now(),lastSeen:Date.now(),downloadedAt:Date.now(),sourceLastmod:task.lastmod||'',imageMissing}]);
 return {added:!old,imageMissing};
}
const SEARCH_REV='bcct_drug_search_revision_v1';
let searchIndex=null,searchRevision='',searchFlight=null;
function revision(){try{return localStorage.getItem(SEARCH_REV)||'';}catch(e){return '';}}
function invalidateSearch(){searchIndex=null;try{localStorage.setItem(SEARCH_REV,Date.now()+'-'+Math.random());}catch(e){}}
async function compactIndex(){
 const rev=revision();if(searchIndex&&rev===searchRevision)return searchIndex;
 if(searchFlight)return searchFlight;
 searchFlight=(async()=>{const db=await openDb(PRODUCT_DB),out=[];try{let last;
  for(;;){const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('products','readonly'),r=tx.objectStore('products').getAll(last===undefined?null:IDBKeyRange.lowerBound(last,true),100);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   for(const row of rows){const r=row.record||{},c=row.candidate||{},name=r.name||c.name||'';out.push({key:row.key,name,normalized:norm(name),hay:norm([name,r.ingredient,c.ingredient,c.strength,r.productMeta&&r.productMeta.registration].join(' '))});}
   if(rows.length<100)break;last=rows[rows.length-1].key;await wait(0);
  }
 }finally{db.close();}searchIndex=out;searchRevision=rev;return out;})();
 try{return await searchFlight;}finally{searchFlight=null;}
}
const nameOrder=new Intl.Collator('vi');
async function offlineSearch(q,limit){
 const nq=norm(q),tokens=nq.split(' ').filter(Boolean);if(!tokens.length)return [];
 const index=await compactIndex(),found=[];
 for(const row of index)if(tokens.every(t=>row.hay.includes(t)))found.push({key:row.key,name:row.name,score:row.normalized===nq?0:row.normalized.startsWith(nq)?1:2});
 const keys=found.sort((a,b)=>a.score-b.score||nameOrder.compare(a.name,b.name)).slice(0,limit||40).map(x=>x.key);
 if(!keys.length)return [];
 const db=await openDb(PRODUCT_DB);try{return await new Promise((resolve,reject)=>{const tx=db.transaction('products','readonly'),os=tx.objectStore('products'),rows=new Array(keys.length);keys.forEach((key,i)=>{const r=os.get(key);r.onsuccess=()=>rows[i]=r.result;});tx.oncomplete=()=>resolve(rows.filter(Boolean));tx.onabort=tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}

async function run(){
 const native=window.DrugWorker,started=Date.now();
 let meta=await dbRead(DB,'state','cycle');
 if(!meta||meta.complete){await resetTasks();meta={key:'cycle',startedAt:started,complete:false,phase:'discover',maps:[SITE+'/sitemap.xml'],seen:[],inventoryErrors:[],done:0,added:0,updated:0,skipped:0,failed:0,missingImages:0,total:0};}
 // A failed inventory page is retried on a subsequent scheduled slice, never counted as a completed discovery.
 if(meta.phase==='retryInventory'){meta.maps=meta.inventoryErrors.map(x=>x.url);meta.inventoryErrors=[];meta.phase='discover';}
 const save=()=>dbWrite(DB,'state',[meta]);
 function report(message,extra){if(native)native.progress(JSON.stringify(Object.assign({state:'running',message,done:meta.done,total:meta.total,added:meta.added,updated:meta.updated,skipped:meta.skipped,failed:meta.failed,missingImages:meta.missingImages,startedAt:meta.startedAt},extra||{})));}
 async function end(state,message){await save();if(native)native.finish(state,message);return {state,message,meta};}
 function stopped(){return native&&native.cancelled();}
 await save();
 while(meta.phase==='discover'&&meta.maps.length){
  if(stopped())return end('paused','Đã lưu điểm dừng.');
  if(Date.now()-started>7*60000)return end('continue','Đã lưu tiến độ; tự tiếp tục lấy danh mục.');
  const url=meta.maps[0];report('Đang lấy danh mục thuốc mới • '+meta.total+' địa chỉ thuốc');
  try{
   const parsed=parseSitemap(await request(url));
   const freshMaps=parsed.maps.filter(x=>!meta.seen.includes(x)&&!meta.maps.includes(x));
   if(meta.seen.length+meta.maps.length+freshMaps.length>1000)throw new Error('Danh mục nguồn vượt giới hạn an toàn; chưa hoàn tất.');
   const prior=await dbRead(DB,'tasks'),known=new Set((prior||[]).map(x=>x.key));
   const fresh=parsed.products.filter(x=>!known.has(x.key));
   if(fresh.length)await dbWrite(DB,'tasks',fresh.map(x=>Object.assign(x,{state:'pending',attempts:0})));
   meta.total=known.size+fresh.length;meta.maps.push(...freshMaps);meta.seen.push(url);meta.maps.shift();await save();
  }catch(e){
   // Preserve an inaccessible root for a later attempt; do not substitute a search result or a proxy.
   meta.inventoryErrors.push({url,error:String(e.message||e)});meta.maps.shift();await save();
   if(!meta.total&&!meta.maps.length){meta.phase='retryInventory';report('Chưa tải được danh mục: '+e.message,{state:'error'});return end(e.status===0?'waiting':'error','Chưa tải được danh mục: '+e.message+'. Dữ liệu cũ được giữ nguyên.');}
  }
  await wait(1200);
 }
 if(meta.phase==='discover'){meta.phase='products';await save();}
 const tasks=await dbRead(DB,'tasks');
 // Process all pending and previously failed products, with at most one HTTP request at a time.
 for(const task of tasks||[]){
  if(task.state==='done'||task.state==='skipped')continue;
  if(stopped())return end('paused','Đã lưu điểm dừng.');
  if(Date.now()-started>7*60000)return end('continue','Đã lưu '+meta.done+'/'+meta.total+' mục; tự tiếp tục tải nền.');
  report('Đang tải dữ liệu thuốc • '+meta.done+'/'+meta.total,{current:task.url.split('/').pop()});
  try{
   const old=await dbRead(PRODUCT_DB,'products',task.key);
   if(old&&old.downloadedAt&&task.lastmod&&old.sourceLastmod===task.lastmod&&!old.imageMissing){task.state='skipped';meta.skipped++;}
   else {const result=await saveProduct(task);task.state='done';if(result.added)meta.added++;else meta.updated++;meta.missingImages+=result.imageMissing;}
   if(task.failedBefore){meta.failed=Math.max(0,meta.failed-1);task.failedBefore=false;}
   meta.done++;task.error='';
  }catch(e){
   task.attempts=(task.attempts||0)+1;task.state='failed';task.error=String(e.message||e);
   if(!task.failedBefore){meta.failed++;task.failedBefore=true;}
   await commitTask(meta,task);
   // Stop a blocked or disconnected run instead of rapidly hammering the remaining URLs.
   if(e.status===0||e.status===403||e.status===429||e.status>=500){report(task.error,{state:'waiting'});return end(e.status===0?'waiting':'error',task.error+'; đã giữ tiến độ và dữ liệu cũ.');}
  }
  await commitTask(meta,task);
  report('Đã lưu mới '+meta.added+' • cập nhật '+meta.updated+' • chưa đổi '+meta.skipped+' • lỗi '+meta.failed);
  await wait(1200);
 }
 if(meta.inventoryErrors.length){meta.phase='retryInventory';return end('partial','Đã lưu '+meta.done+' mục; còn trang danh mục chưa tải được. Sẽ thử lại.');}
 if(meta.failed)return end('partial','Đã lưu '+meta.done+'/'+meta.total+' mục; '+meta.failed+' mục chưa tải được. Sẽ thử lại.');
 if(!meta.total)return end('error','Danh mục nguồn không có địa chỉ thuốc hợp lệ; chưa có dữ liệu mới.');
 meta.complete=true;meta.completedAt=Date.now();
 report('Hoàn tất tải dữ liệu thuốc',{state:'complete'});
 return end('complete','Hoàn tất: '+meta.added+' thuốc mới, '+meta.updated+' cập nhật, '+meta.skipped+' chưa đổi.'+(meta.missingImages?' '+meta.missingImages+' ảnh chưa tải được.':''));
}
window.BCCT_DRUG_SYNC={run,offlineSearch,parseSitemap,htmlMarkdown,dbRead,dbWrite,productUrl,invalidateSearch,version:'3.9.4'};
})();
