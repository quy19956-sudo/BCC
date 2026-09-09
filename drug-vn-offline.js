(function(){
'use strict';
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim()}
const byKey=new Map();
function add(x){
 const name=String(x&&x.name||'').trim();if(!name)return;
 const ingredient=String(x.ingredient||'').trim(),strength=String(x.strength||'').trim(),form=String(x.form||'').trim();
 const key=norm(name)+'|'+norm(strength)+'|'+norm(form);
 const record={
  id:String(x.id||('LOCAL-'+(byKey.size+1))),name,ingredient,strength,form,
  pack:String(x.pack||''),classification:String(x.classification||'Thuốc / hoạt chất đã tích hợp'),
  registration:String(x.registration||''),manufacturer:String(x.manufacturer||''),country:String(x.country||''),
  holder:String(x.holder||''),holderCountry:String(x.holderCountry||''),approval:String(x.approval||''),expiry:String(x.expiry||''),
  source:String(x.source||'Danh mục tích hợp trực tiếp trong APK')
 };
 record.search=norm([record.name,record.ingredient,record.strength,record.form,record.registration,record.manufacturer].join(' '));
 const old=byKey.get(key);
 if(!old || (!old.ingredient && record.ingredient) || (!old.registration && record.registration))byKey.set(key,record);
}
// Hồ sơ sản phẩm Việt Nam đã xác định rõ.
add({id:'VN-20983-18',name:'Voxin 1g',ingredient:'Vancomycin hydrochloride',strength:'1 g/lọ',form:'Bột đông khô pha dung dịch truyền tĩnh mạch',pack:'Hộp 1 lọ',registration:'VN-20983-18',manufacturer:'Vianex S.A.',country:'Hy Lạp',source:'Hồ sơ thuốc Việt Nam tích hợp'});
add({id:'MEDIVERNOL-1G',name:'Medivernol 1g',ingredient:'Ceftriaxone',strength:'1 g',form:'Bột pha tiêm',manufacturer:'Medochemie / Medoc-pharm',source:'Hồ sơ thuốc Việt Nam tích hợp'});
add({id:'MEDIVER-NOL-1G',name:'Mediver-nol 1g',ingredient:'Ceftriaxone',strength:'1 g',form:'Bột pha tiêm',manufacturer:'Medochemie / Medoc-pharm',source:'Hồ sơ thuốc Việt Nam tích hợp'});
add({id:'VN-8408-09',name:'Elthon 50mg',ingredient:'Itoprid hydrochlorid',strength:'50 mg/viên',form:'Viên nén',pack:'Hộp 2 vỉ x 10 viên',registration:'VN-8408-09',manufacturer:'Abbott Japan Co., Ltd.',country:'Nhật Bản',source:'Hồ sơ thuốc Việt Nam tích hợp từ trang sản phẩm và tờ hướng dẫn sử dụng'});
// Toàn bộ tên biệt dược/tên thường gọi đã có trong ứng dụng được đưa thẳng vào chỉ mục ngoại tuyến.
const aliases=window.DRUG_LOCAL_ALIASES||{};
for(const [name,target] of Object.entries(aliases)){
 if(norm(name)==='voxin'||norm(name)==='voxin 1g'||norm(name)==='vancomycin 1g')continue;
 add({name,ingredient:String(target||''),source:'Tên biệt dược / hoạt chất tích hợp trong APK'});
}
// Các chuyên luận tiếng Việt viết riêng và toàn bộ bí danh của chúng.
const drugs=(window.BCCT_DRUG_PACKAGE&&window.BCCT_DRUG_PACKAGE.drugs)||[];
for(const d of drugs){
 const ingredient=String(d.ingredient||d.name||'');
 add({name:String(d.name||ingredient),ingredient,classification:String(d.category||'Thuốc'),source:'Chuyên luận tiếng Việt tích hợp trong APK'});
 for(const a of (d.aliases||[]))add({name:String(a),ingredient,classification:String(d.category||'Thuốc'),source:'Bí danh chuyên luận tích hợp trong APK'});
}
const memory=[...byKey.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
function search(q,limit=60){
 const n=norm(q),ts=n.split(' ').filter(Boolean);if(!n)return[];const out=[];
 for(const r of memory){const s=r.search||'';if(!ts.every(t=>s.includes(t)))continue;let rank=9;const nn=norm(r.name),ni=norm(r.ingredient);if(nn===n)rank=0;else if(ni===n)rank=1;else if(nn.startsWith(n))rank=2;else if(ni.startsWith(n))rank=3;else if(nn.includes(n))rank=4;else if(ni.includes(n))rank=5;out.push({record:r,rank});}
 out.sort((a,b)=>a.rank-b.rank||a.record.name.localeCompare(b.record.name,'vi'));return out.slice(0,limit).map(x=>x.record);
}
function emit(){try{window.dispatchEvent(new CustomEvent('bcct-vn-drug-progress',{detail:{state:'ready',count:memory.length,cached:true,bundled:true}}))}catch(_e){}}
const ready=Promise.resolve(memory).then(x=>{setTimeout(emit,0);return x});
window.BCCT_VN_DRUG_DB={ready,sync:async()=>{emit();return memory},search,getAll:()=>memory.slice(),get count(){return memory.length},version:'VN-BUNDLED-NO-DOWNLOAD-5'};
})();
