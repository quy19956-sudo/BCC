(function(){'use strict';
function object(x){return x&&typeof x==='object'&&!Array.isArray(x);}
function fail(){throw new Error('Bản sao lưu có cấu trúc không hợp lệ; chưa ghi dữ liệu.');}
function storage(x){if(!object(x))fail();for(const [k,v] of Object.entries(x))if(typeof v!=='string'||!k)fail();}
function database(payload){
 if(!object(payload)||!/^BCCT_INDEXEDDB_FULL_V[12]$/.test(payload.format)||!Array.isArray(payload.databases))fail();
 const names=new Set();for(const db of payload.databases){if(!object(db)||typeof db.name!=='string'||!db.name||names.has(db.name)||!Number.isInteger(db.version)||db.version<1||!Array.isArray(db.stores))fail();names.add(db.name);const stores=new Set();
  for(const st of db.stores){if(!object(st)||typeof st.name!=='string'||!st.name||stores.has(st.name)||!Array.isArray(st.records)||!Array.isArray(st.indexes))fail();stores.add(st.name);if(st.keyPath!=null&&typeof st.keyPath!=='string'&&!(Array.isArray(st.keyPath)&&st.keyPath.every(x=>typeof x==='string')))fail();const indexes=new Set();for(const ix of st.indexes){if(!object(ix)||!ix.name||indexes.has(ix.name)||!(typeof ix.keyPath==='string'||Array.isArray(ix.keyPath)&&ix.keyPath.every(x=>typeof x==='string')))fail();indexes.add(ix.name);}for(const row of st.records){if(!object(row)||!Object.prototype.hasOwnProperty.call(row,'value'))fail();if(typeof st.keyPath==='string'&&st.keyPath&&!st.keyPath.includes('.')&&(!object(row.value)||row.value[st.keyPath]===undefined))fail();}
  }
 }
}
function backup(data){if(!object(data)||data.format!=='BO_CONG_CU_TONG_HOP'||![3,4,5,6].includes(Number(data.version))||!object(data.stores))fail();for(const s of Object.values(data.stores))storage(s);for(const p of Object.values(data.databases||{}))database(p);}
window.BCCT_BACKUP_VALIDATE={backup,database,storage};
})();
