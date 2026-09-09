(function(){
'use strict';
const SEARCH_API='https://s.jina.ai/?q=';
const LONGCHAU=null; // Long Châu được xử lý riêng để luôn hiển thị nhiều kết quả trước khi chọn.
const READER_API='https://r.jina.ai/';
const IMG=window.BCCT_DRUG_IMAGES||null;
const CACHE_PREFIX='bcct_web_drug_v8:';
const CACHE_INDEX='bcct_web_drug_v8_index';
const MAX_CACHE=100;
const FIELD_ORDER=['ingredient','indications','main','dosage','contraindications','side','interactions','pregnancy','organ','storage'];
const FIELD_LABEL={ingredient:'Thành phần',indications:'Chỉ định',main:'Cơ chế',dosage:'Liều dùng',contraindications:'Chống chỉ định',side:'Tác dụng phụ',interactions:'Tương tác',pregnancy:'Thai kỳ và cho con bú',organ:'Gan và thận',storage:'Bảo quản'};
const HEADINGS={
 ingredient:[/thành phần/i,/hoạt chất/i,/dược chất/i,/composition/i,/ingredients?/i,/contains?/i,/active ingredient/i],
 indications:[/chỉ định/i,/công dụng/i,/uses?/i,/indications?/i,/benefits?/i,/what .* used for/i],
 main:[/cơ chế/i,/tác dụng của thuốc/i,/dược lực học/i,/mechanism/i,/how .*works?/i,/pharmacology/i,/clinical pharmacology/i],
 dosage:[/liều dùng/i,/cách dùng/i,/liều lượng/i,/dosage/i,/administration/i,/how to use/i,/directions? for use/i],
 contraindications:[/chống chỉ định/i,/không dùng/i,/contraindications?/i,/who should not/i,/do not use/i],
 side:[/tác dụng phụ/i,/tác dụng không mong muốn/i,/side effects?/i,/adverse effects?/i,/undesirable effects?/i,/adverse reactions?/i],
 interactions:[/tương tác/i,/interactions?/i,/drug interactions?/i],
 pregnancy:[/thai kỳ/i,/mang thai/i,/cho con bú/i,/pregnancy/i,/breast.?feeding/i,/lactation/i,/nursing mothers/i],
 organ:[/suy gan/i,/suy thận/i,/gan và thận/i,/kidney/i,/renal/i,/hepatic/i,/liver/i],
 storage:[/bảo quản/i,/storage/i,/how supplied/i,/handling/i]
};
const SOURCE_ORDER=[
 'nhathuoclongchau.com.vn/thuoc/','nhathuoclongchau.com.vn/duoc-chat/','trungtamthuoc.com','nhathuocngocanh.com','nhathuocankhang.com','pharmacity.vn','youmed.vn','nhathuocviet.vn','medigoapp.com','vinmec.com','medlatec.vn','hellobacsi.com','duocdienvietnam.com','vnras.com','dichvucong.dav.gov.vn','dav.gov.vn',
 'dailymed.nlm.nih.gov','open.fda.gov','medlineplus.gov','nhs.uk','medicines.org.uk','drugs.com','mayoclinic.org','webmd.com','medscape.com','1mg.com','practo.com','healthdirect.gov.au','canada.ca','ema.europa.eu','tga.gov.au','medsafe.govt.nz','who.int'
];
const SEARCH_GROUPS=[
 {id:'longchau-exact',label:'Long Châu',make:(q)=>'"'+q+'" site:nhathuoclongchau.com.vn/thuoc'},
 {id:'longchau-wide',label:'Long Châu',make:(q)=>q+' thuốc site:nhathuoclongchau.com.vn/thuoc'},
 {id:'vn-pharmacy-a',label:'Nhà thuốc Việt Nam',make:(q)=>'"'+q+'" thuốc thành phần chỉ định liều dùng site:trungtamthuoc.com OR site:nhathuocngocanh.com OR site:nhathuocankhang.com OR site:pharmacity.vn'},
 {id:'vn-pharmacy-b',label:'Nhà thuốc Việt Nam',make:(q)=>q+' thuốc hoạt chất công dụng cách dùng tác dụng phụ site:youmed.vn OR site:nhathuocviet.vn OR site:medigoapp.com OR site:vinmec.com OR site:medlatec.vn OR site:hellobacsi.com'},
 {id:'vn-registry',label:'Nguồn Việt Nam khác',make:(q)=>'"'+q+'" thuốc site:dichvucong.dav.gov.vn OR site:dav.gov.vn OR site:duocdienvietnam.com OR site:vnras.com'},
 {id:'global-label',label:'Nhãn thuốc quốc tế',make:(q)=>'"'+q+'" drug label dosage contraindications adverse reactions site:dailymed.nlm.nih.gov OR site:open.fda.gov OR site:medicines.org.uk OR site:medsafe.govt.nz OR site:tga.gov.au'},
 {id:'global-clinical',label:'Nguồn y khoa quốc tế',make:(q)=>q+' medicine active ingredient indications mechanism dosage contraindications side effects interactions pregnancy renal hepatic storage site:medlineplus.gov OR site:nhs.uk OR site:drugs.com OR site:mayoclinic.org OR site:webmd.com OR site:medscape.com'},
 {id:'global-wide',label:'Web quốc tế',make:(q)=>q+' medicine drug active ingredient strength dosage form uses mechanism dosage contraindications side effects interactions pregnancy storage'}
];
const KNOWN_PRODUCTS={'voxin':'vancomycin','voxin 1g':'vancomycin','medivernol':'ceftriaxone','medivernol 1g':'ceftriaxone','elthon':'itopride','elthon 50mg':'itopride','elthon 50 mg':'itopride'};
const DIRECT_PAGES={'elthon':'https://nhathuoclongchau.com.vn/thuoc/elthon-50mg-3883.html','elthon 50mg':'https://nhathuoclongchau.com.vn/thuoc/elthon-50mg-3883.html','elthon 50 mg':'https://nhathuoclongchau.com.vn/thuoc/elthon-50mg-3883.html'};
function directPage(q){const n=norm(q);if(DIRECT_PAGES[n])return DIRECT_PAGES[n];for(const [k,u] of Object.entries(DIRECT_PAGES))if(n===k||n.startsWith(k+' '))return u;return''}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim()}
function qTerms(q){return norm(q).split(' ').filter(x=>x.length>1&&!/^(mg|ml|mcg|g|kg|iu|ui|viên|vien|lọ|lo|ống|ong|hộp|hop|tab|tablet|capsule|injection)$/.test(x))}
function knownIngredient(q){const n=norm(q);if(KNOWN_PRODUCTS[n])return KNOWN_PRODUCTS[n];for(const [k,v] of Object.entries(KNOWN_PRODUCTS))if(n===k||n.startsWith(k+' '))return v;return''}
function clean(s){
 return String(s||'')
  .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
  .replace(/<[^>]+>/g,' ')
  .replace(/^\s*[#>*`|+-]+\s*/gm,'')
  .replace(/\*\*/g,'').replace(/__/g,'')
  .replace(/\b(?:giá bao nhiêu|mua ở đâu|thêm vào giỏ hàng|đặt hàng|còn hàng|hết hàng|hotline|tìm nhà thuốc|tư vấn ngay|gửi đơn thuốc)\b[^\n]*/gi,' ')
  .replace(/cookie consent|đăng nhập|đăng ký|shopping cart/gi,' ')
  .replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();
}
function mostlyVietnamese(s){
 const x=' '+String(s||'').toLowerCase()+' ';
 const vi=(x.match(/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g)||[]).length;
 const words=(x.match(/\b(?:thuốc|điều trị|chỉ định|liều|dùng|bệnh|tác dụng|chống|không|người|có thể|thành phần|hoạt chất|bảo quản|thai kỳ|cho con bú)\b/g)||[]).length;
 return vi>=3||words>=3;
}
function splitChunks(text,max=430){
 const src=String(text||'').trim();if(!src)return[];
 const parts=src.split(/(?<=[.!?;:\n])\s+/),out=[];let cur='';
 for(const p0 of parts){const p=p0.trim();if(!p)continue;
  if(p.length>max){if(cur){out.push(cur);cur=''};for(let i=0;i<p.length;i+=max)out.push(p.slice(i,i+max));continue}
  if((cur+' '+p).trim().length>max){if(cur)out.push(cur);cur=p}else cur=(cur+' '+p).trim();
 }
 if(cur)out.push(cur);return out;
}
async function fetchWithTimeout(url,options={},ms=22000){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);
 try{return await fetch(url,{...options,signal:ctl.signal})}finally{clearTimeout(timer)}
}
async function translateChunk(t){
 const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q='+encodeURIComponent(t);
 const r=await fetchWithTimeout(url,{cache:'no-store'},14000);if(!r.ok)throw new Error('Dịch web lỗi '+r.status);
 const j=await r.json();return Array.isArray(j&&j[0])?j[0].map(x=>x&&x[0]||'').join(''):t;
}
async function translate(text){
 const t=clean(text);if(!t||mostlyVietnamese(t))return t;
 const chunks=splitChunks(t),out=[];
 for(const c of chunks){try{out.push(await translateChunk(c))}catch(_e){return t}}
 return clean(out.join(' '));
}
function parseJina(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n');const out=[];let cur=null;
 const push=()=>{if(cur&&cur.url){const raw=cur.content.join('\n');cur.images=IMG&&IMG.extract?IMG.extract(raw):[];cur.content=clean(raw);if(cur.content||cur.title)out.push(cur)}cur=null};
 for(const line0 of lines){const line=line0.trimEnd();let m=line.match(/^\s*(?:\[\d+\]\s*)?Title:\s*(.+)$/i);
  if(m){push();cur={title:clean(m[1]),url:'',content:[]};continue}
  m=line.match(/^\s*(?:\[\d+\]\s*)?URL Source:\s*(https?:\/\/\S+)/i);
  if(m){if(!cur)cur={title:'',url:'',content:[]};cur.url=m[1].replace(/[)>.,]+$/,'');continue}
  if(/^\s*(?:\[\d+\]\s*)?(?:Published Time|Markdown Content):/i.test(line))continue;
  if(cur)cur.content.push(line);
 }
 push();
 if(!out.length){
  const um=String(text||'').match(/URL Source:\s*(https?:\/\/\S+)/i),tm=String(text||'').match(/Title:\s*(.+)/i);
  if(um){const raw=String(text||'').replace(/[\s\S]*?Markdown Content:\s*/i,'');out.push({title:clean(tm&&tm[1]||''),url:um[1].replace(/[)>.,]+$/,''),content:clean(raw),images:IMG&&IMG.extract?IMG.extract(raw):[]})};
 }
 const seen=new Set();return out.filter(x=>{const k=x.url.toLowerCase();if(seen.has(k))return false;seen.add(k);return true});
}
function sectionize(text){
 const lines=String(text||'').split('\n'),secs=[];let title='Mở đầu',buf=[];
 const push=()=>{const body=clean(buf.join('\n'));if(body)secs.push({title:clean(title),body});buf=[]};
 for(const l0 of lines){const l=l0.trim();const h=l.match(/^#{1,6}\s+(.+)$/)||l.match(/^\*\*(.{2,120})\*\*\s*:?$/)||l.match(/^([\d.]{0,6}\s*(?:Thành phần|Hoạt chất|Chỉ định|Công dụng|Tác dụng|Cơ chế|Liều dùng|Cách dùng|Chống chỉ định|Tác dụng phụ|Tương tác|Thai kỳ|Mang thai|Cho con bú|Bảo quản|Ingredients?|Uses?|Indications?|Dosage|Administration|Contraindications?|Side effects?|Interactions?|Pregnancy|Storage).{0,100})$/i);
  if(h){push();title=h[1];continue}buf.push(l0);
 }
 push();return secs;
}
function useful(t,max=2200){const x=clean(t);if(x.length<18)return'';return x.slice(0,max)}
function pickFromResult(res,key){
 const secs=sectionize(res.content),rxs=HEADINGS[key]||[];let best='';
 for(const s of secs){if(rxs.some(r=>r.test(s.title))){const v=useful(s.body);if(v.length>best.length)best=v}}
 if(best)return best;
 const raw=String(res.content||'');
 const labels={ingredient:'(?:Thành phần|Hoạt chất|Dược chất|Ingredients?|Composition|Active ingredient)',indications:'(?:Chỉ định|Công dụng|Uses?|Indications?|What is .* used for)',main:'(?:Cơ chế|Tác dụng|Dược lực học|Mechanism|How it works|Clinical pharmacology)',dosage:'(?:Liều dùng|Cách dùng|Dosage|Administration|Directions)',contraindications:'(?:Chống chỉ định|Contraindications?|Do not use)',side:'(?:Tác dụng phụ|Tác dụng không mong muốn|Side effects?|Adverse effects?|Adverse reactions?)',interactions:'(?:Tương tác|Interactions?|Drug interactions?)',pregnancy:'(?:Thai kỳ|Mang thai|Cho con bú|Pregnancy|Breastfeeding|Lactation)',organ:'(?:Suy gan|Suy thận|Kidney|Renal|Liver|Hepatic)',storage:'(?:Bảo quản|Storage|How supplied)'};
 const lab=labels[key];if(!lab)return'';
 const re=new RegExp(lab+'\\s*[:\\-]?\\s*([\\s\\S]{18,1600}?)(?=\\n(?:#{1,6}\\s+|\\*\\*|[A-ZÀ-Ỹ][^\\n]{1,100}:)|$)','i'),m=raw.match(re);
 if(m)return useful(m[1]);
 if(Array.isArray(res.focus)&&res.focus.includes(key)){
  const paras=raw.split(/\n\s*\n/).map(clean).filter(x=>x.length>50);
  const kw=HEADINGS[key]||[],hit=paras.find(x=>kw.some(r=>r.test(x)))||paras.find(x=>x.length>120);
  return hit?useful(hit,1900):'';
 }
 return'';
}
function sourceScore(url){
 const u=String(url||'').toLowerCase();const i=SOURCE_ORDER.findIndex(x=>u.includes(x));return i<0?99:i;
}
function relevance(res,query){
 const n=norm(query),ts=qTerms(query),title=norm(res.title),content=norm(res.content),url=String(res.url||'').toLowerCase();let s=80;
 if(title===n)s=0;else if(title.includes(n)||n.includes(title))s=2;else if(ts.length&&ts.every(t=>title.includes(t)))s=5;else if(ts.length&&ts.every(t=>content.includes(t)))s=12;else if(ts.some(t=>title.includes(t)))s=22;else if(ts.some(t=>content.includes(t)))s=35;
 if(url.includes('nhathuoclongchau.com.vn/thuoc/'))s-=5;
 if(/\/bai-viet\/|\/tin-tuc\/|facebook\.com|youtube\.com/.test(url))s+=25;
 return s+sourceScore(url)*0.12;
}
function dedupeResults(arr,query,limit=24){
 const s=new Set(),ts=qTerms(query);return arr.filter(x=>{
  const k=String(x.url||'').replace(/\/$/,'').toLowerCase();if(!k||s.has(k))return false;s.add(k);
  const hay=norm((x.title||'')+' '+(x.content||''));return !ts.length||ts.some(t=>hay.includes(t));
 }).sort((a,b)=>relevance(a,query)-relevance(b,query)||sourceScore(a.url)-sourceScore(b.url)).slice(0,limit);
}
async function fetchSearch(q,provider,focus){
 const url=SEARCH_API+encodeURIComponent(q);
 const r=await fetchWithTimeout(url,{headers:{'Accept':'text/plain','X-Retain-Images':'all'},cache:'no-store'},24000);
 if(!r.ok)throw new Error('Nguồn tìm kiếm trả lỗi '+r.status);
 return parseJina(await r.text()).map(x=>({...x,provider:provider||'Web',focus:Array.isArray(focus)?focus:[]}));
}
async function hydrateOne(res){
 if(!res||!/^https?:\/\//i.test(res.url))return res;
 try{
  const r=await fetchWithTimeout(READER_API+res.url,{headers:{'Accept':'text/plain','X-Retain-Images':'all'},cache:'no-store'},26000);
  if(!r.ok)return res;const parsed=parseJina(await r.text())[0];
  if(parsed&&parsed.content&&parsed.content.length>String(res.content||'').length)return {...res,title:parsed.title||res.title,content:parsed.content,images:IMG&&IMG.uniq?IMG.uniq([...(res.images||[]),...(parsed.images||[])]):[...(res.images||[]),...(parsed.images||[])]};
 }catch(_e){}
 return res;
}
async function hydrateResults(results){
 const selected=results.slice(0,6);const hyd=await Promise.all(selected.map(hydrateOne));
 const map=new Map(hyd.map(x=>[x.url,x]));return results.map(x=>map.get(x.url)||x);
}
async function fetchRxNorm(query){
 try{
  const u='https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term='+encodeURIComponent(query)+'&maxEntries=5&option=1';
  const r=await fetchWithTimeout(u,{cache:'no-store'},16000);if(!r.ok)return[];const j=await r.json();
  return (((j||{}).approximateGroup||{}).candidate||[]).filter(x=>x&&x.name).map(x=>({name:x.name,rxcui:x.rxcui,score:Number(x.score||0)})).slice(0,5);
 }catch(_e){return[]}
}
function arrText(x){return Array.isArray(x)?x.filter(Boolean).join('\n'):String(x||'')}
async function fetchOpenFDA(query){
 const hint=knownIngredient(query),safe=(hint||query).replace(/"/g,'');
 const tries=hint?[
  'openfda.generic_name:"'+safe+'"',
  'openfda.substance_name:"'+safe+'"'
 ]:[
  'openfda.brand_name:"'+safe+'"',
  'openfda.generic_name:"'+safe+'"',
  'openfda.substance_name:"'+safe+'"'
 ];
 for(const search of tries){
  try{
   const u='https://api.fda.gov/drug/label.json?search='+encodeURIComponent(search)+'&limit=3';
   const r=await fetchWithTimeout(u,{cache:'no-store'},18000);if(!r.ok)continue;const j=await r.json(),list=j&&j.results||[];if(!list.length)continue;
   let best=list[0];
   const get=(...keys)=>{for(const k of keys){const v=arrText(best[k]);if(v)return useful(v,3000)}return''};
   const of=best.openfda||{};return {
    name:(of.brand_name&&of.brand_name[0])||query,
    ingredient:(of.substance_name&&of.substance_name.join(', '))||get('active_ingredient'),
    indications:get('indications_and_usage','purpose'),
    main:get('mechanism_of_action','clinical_pharmacology','description'),
    dosage:get('dosage_and_administration'),
    contraindications:get('contraindications','warnings'),
    side:get('adverse_reactions','warnings_and_cautions','boxed_warning'),
    interactions:get('drug_interactions'),
    pregnancy:get('pregnancy','pregnancy_or_breast_feeding','use_in_specific_populations','nursing_mothers'),
    organ:get('renal_impairment','hepatic_impairment','use_in_specific_populations'),
    storage:get('storage_and_handling','how_supplied'),
    source:{name:'openFDA – nhãn thuốc',url:u}
   };
  }catch(_e){}
 }
 return null;
}
function bestField(results,key){
 let best='',bestScore=1e9;
 for(const r of results){const v=pickFromResult(r,key);if(!v)continue;const rs=relevance(r,'')+sourceScore(r.url)*0.2-(v.length/2000);if(rs<bestScore||(!best&&v)){best=v;bestScore=rs}}
 return best;
}
function firstUsefulParagraph(results,query){
 const ts=qTerms(query);for(const r of results){const chunks=String(r.content||'').split(/\n\s*\n/).map(clean).filter(x=>x.length>80&&x.length<1800);const hit=chunks.find(x=>ts.some(t=>norm(x).includes(t)));if(hit)return hit.slice(0,1400)}return'';
}
function mergeStructured(record,s){
 if(!s)return record;
 const preferStructured=new Set(['main','interactions','pregnancy','organ']);
 for(const k of FIELD_ORDER){const sv=clean(s[k]||''),rv=clean(record[k]||'');if(!sv)continue;if(!rv||preferStructured.has(k)||sv.length>rv.length*1.45)record[k]=sv}
 if(s.source)record.sources.push(s.source);record.imageUrls=IMG&&IMG.uniq?IMG.uniq([...(record.imageUrls||[]),...(s.imageUrls||[]),...((s.productMeta&&s.productMeta.images)||[]),s.productMeta&&s.productMeta.image]).slice(0,1):[...(record.imageUrls||[]),...(s.imageUrls||[])];return record;
}
function missingFields(record){return FIELD_ORDER.filter(k=>k!=='ingredient'&&!clean(record[k]))}
async function buildRecord(query,results,structured){
 const record={name:query,category:'Tổng hợp trực tiếp từ web Việt Nam và quốc tế',ingredient:'',sources:[],imageUrls:[],web:true};
 for(const r of results){const v=pickFromResult(r,'ingredient');if(v){record.ingredient=v.slice(0,700);break}}
 for(const key of FIELD_ORDER.filter(k=>k!=='ingredient'))record[key]=bestField(results,key);
 if(!record.indications)record.indications=firstUsefulParagraph(results,query);
 record.sources=results.map(r=>({name:r.title||(()=>{try{return new URL(r.url).hostname}catch(_e){return'Nguồn web'}})(),url:r.url})).slice(0,12);record.imageUrls=IMG&&IMG.uniq?IMG.uniq(results.flatMap(r=>r.images||[])).slice(0,1):results.flatMap(r=>r.images||[]).slice(0,1);
 mergeStructured(record,structured);
 const tasks=FIELD_ORDER.map(async key=>{if(record[key])record[key]=await translate(record[key])});await Promise.all(tasks);
 if(!record.ingredient&&structured&&structured.ingredient)record.ingredient=await translate(structured.ingredient);
 return record;
}
function queryBase(q){return String(q||'').replace(/\b\d+(?:[.,]\d+)?\s*(?:mcg|mg|g|kg|ml|l|iu|ui|%)\b/gi,' ').replace(/\b(?:viên|vien|lọ|lo|ống|ong|hộp|hop|tablet|capsule|injection|syrup)\b/gi,' ').replace(/\s{2,}/g,' ').trim()||q}
function makePlans(query,rx){
 const base=queryBase(query),hint=knownIngredient(query),canon=hint||(rx&&rx[0]&&rx[0].name)||'';const qs=[];
 for(const g of SEARCH_GROUPS){const target=(g.id.includes('global')&&canon)?canon:query;qs.push({id:g.id,label:g.label,q:g.make(target)});}
 if(hint){qs.unshift({id:'vn-known-product',label:'Nguồn Việt Nam theo hoạt chất đã xác định',q:'"'+query+'" '+hint+' thuốc'});qs.push({id:'global-known-product',label:'Nhãn thuốc theo hoạt chất đã xác định',q:'"'+hint+'" injection label dosage contraindications adverse reactions'});}
 if(base&&norm(base)!==norm(query))qs.push({id:'longchau-base',label:'Long Châu',q:base+' thuốc site:nhathuoclongchau.com.vn/thuoc'});
 if(canon&&norm(canon)!==norm(query)){qs.push({id:'vn-canonical',label:'Nguồn Việt Nam theo tên chuẩn',q:'"'+canon+'" thuốc chỉ định liều dùng tác dụng phụ'});qs.push({id:'global-canonical',label:'Nguồn quốc tế theo tên chuẩn',q:'"'+canon+'" drug label mechanism dosage contraindications adverse reactions'});}
 const seen=new Set();return qs.filter(x=>{const k=norm(x.q);if(seen.has(k))return false;seen.add(k);return true});
}
async function supplementalSearch(query,record,rx){
 const missing=missingFields(record);if(!missing.length)return[];const canon=rx&&rx[0]&&rx[0].name||query;const plans=[];
 if(missing.some(k=>['main','indications'].includes(k)))plans.push({label:'Bổ sung dược lý',focus:['main','indications'],q:'"'+canon+'" mechanism of action pharmacology indications uses'});
 if(missing.some(k=>['dosage','contraindications','side','interactions'].includes(k)))plans.push({label:'Bổ sung an toàn và liều',focus:['dosage','contraindications','side','interactions'],q:'"'+canon+'" dosage administration contraindications adverse reactions drug interactions'});
 if(missing.some(k=>['pregnancy','organ','storage'].includes(k)))plans.push({label:'Bổ sung đối tượng đặc biệt',focus:['pregnancy','organ','storage'],q:'"'+canon+'" pregnancy breastfeeding renal hepatic impairment storage handling'});
 const settled=await Promise.allSettled(plans.map(p=>fetchSearch(p.q,p.label,p.focus)));let out=[];for(const s of settled)if(s.status==='fulfilled')out=out.concat(s.value);return out;
}
function cacheGet(query){try{const x=JSON.parse(localStorage.getItem(CACHE_PREFIX+norm(query))||'null');if(x&&x.record)return x}catch(_e){}return null}
function cachePut(query,data){try{const key=CACHE_PREFIX+norm(query);localStorage.setItem(key,JSON.stringify({...data,ts:Date.now()}));let idx=JSON.parse(localStorage.getItem(CACHE_INDEX)||'[]').filter(x=>x!==key);idx.unshift(key);while(idx.length>MAX_CACHE){const old=idx.pop();localStorage.removeItem(old)}localStorage.setItem(CACHE_INDEX,JSON.stringify(idx))}catch(_e){}}
async function search(query,opts={}){
 const q=String(query||'').trim();if(!q)throw new Error('Tên thuốc trống');if(!opts.fresh){const cached=cacheGet(q);if(cached){if(IMG&&cached.record&&cached.record.imageUrls){try{cached.record._displayImages=await IMG.resolve(cached.record.imageUrls,1)}catch(_e){}}return {...cached,cached:true}}}
 const rxPromise=fetchRxNorm(q);
 let lc=null;
 if(LONGCHAU){try{lc=await LONGCHAU.search(q,{fresh:!!opts.fresh})}catch(_e){lc=null}}
 const rx=await rxPromise;
 const canonical=(lc&&lc.record&&lc.record.ingredient)||knownIngredient(q)||(rx[0]&&rx[0].name)||q;
 let results=[],plans=[],structured=null;
 if(lc&&lc.record){
  structured=lc.record;
  results=(lc.results||[]).slice();
  const missingLc=missingFields(structured);
  if(missingLc.length){
   const fda=await fetchOpenFDA(canonical).catch(()=>null);
   if(fda)structured=mergeStructured(structured,fda);
   const supplements=await supplementalSearch(q,structured,rx);
   if(supplements.length){results=dedupeResults(results.concat(supplements),q+' '+canonical,24);results=await hydrateResults(results)}
  }
 }else{
  const fdaPromise=fetchOpenFDA(canonical).then(x=>x||fetchOpenFDA(q)).catch(()=>null);
  plans=makePlans(q,rx);const direct=directPage(q);let directResults=[];
  if(direct){try{const x=await hydrateOne({title:q+' – Long Châu',url:direct,content:'',provider:'Long Châu',focus:[]});if(x&&x.content)directResults=[x]}catch(_e){}}
  const settled=await Promise.allSettled(plans.map(p=>fetchSearch(p.q,p.label,p.focus)));results=directResults.slice();
  for(const x of settled)if(x.status==='fulfilled')results=results.concat(x.value);
  results=dedupeResults(results,q,28);if(results.length)results=await hydrateResults(results);
  structured=await fdaPromise;
 }
 let record=await buildRecord(q,results,structured);
 if(lc&&lc.record){
  record=mergeStructured(record,lc.record);
  record.name=lc.record.name||record.name||q;
  record.category=lc.record.category||'Thuốc từ Nhà thuốc Long Châu';
  record.productMeta=lc.record.productMeta||{};
  record.longChau=true;
 }
 const known=knownIngredient(q);if(known&&!record.ingredient)record.ingredient=known;
 if(!lc){
  const supplements=await supplementalSearch(q,record,rx);
  if(supplements.length){results=dedupeResults(results.concat(supplements),q+' '+canonical,32);results=await hydrateResults(results);record=await buildRecord(q,results,structured)}
 }
 if(!results.length&&!structured)throw new Error('Không nhận được kết quả từ Long Châu hoặc các nguồn web khác. Kiểm tra kết nối mạng rồi thử lại.');
 const missing=missingFields(record);record.coverage={filled:9-missing.length,total:9,missing:missing.map(k=>FIELD_LABEL[k])};record.rxnorm=rx.slice(0,3);
 if(IMG&&record.imageUrls&&record.imageUrls.length){try{await IMG.cacheMany(record.imageUrls,1);record._displayImages=await IMG.resolve(record.imageUrls,1)}catch(_e){}}
 const data={query:q,record,results,plans:plans.map(x=>x.label),longChau:!!(lc&&lc.record),longChauCandidates:lc&&lc.candidates||[]};const persist={...data,record:{...record}};delete persist.record._displayImages;cachePut(q,persist);return data;
}
window.BCCT_WEB_DRUG={search,cacheGet,translate,parseJina,version:'WEB-GLOBAL-ONE-IMAGE-2026.07.27.11'};
})();
