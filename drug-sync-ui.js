(function(){
'use strict';
if(location.hash.indexOf('bcct-sync=')>=0||location.hash.indexOf('#sync=')===0)return;
const root=document.querySelector('main.wrap');if(!root)return;
const box=document.createElement('section');box.className='card weekly-sync';box.id='weeklyDrugSync';
box.innerHTML='<div class="weekly-title">⬇ Tải dữ liệu thuốc ngoại tuyến</div><p><b>Tự động lúc 10:00 Chủ nhật hằng tuần</b> · giờ Việt Nam</p><p>Lấy danh mục và chi tiết thuốc từ Long Châu, lưu trên máy mà không cần tìm từng tên thuốc. Có thể tắt màn hình hoặc chuyển ứng dụng trong lúc tải.</p><div class="weekly-actions"><button id="weeklyStart" type="button">Bắt đầu tải</button><button id="weeklyPause" type="button" disabled>Tạm dừng</button></div><progress id="weeklyProgress" max="1" value="0" hidden></progress><div id="weeklyStatus" role="status" aria-live="polite">Đang kiểm tra lịch tải…</div><div id="weeklyCounts"></div><div id="weeklyNext"></div><div id="weeklyLast"></div><details><summary>Thiết lập chạy nền</summary><p>Mở bản ứng dụng này một lần sau khi cài. Cho phép thông báo và hoạt động nền; trong cài đặt pin của ứng dụng, chọn Không hạn chế nếu có. Nếu bấm Buộc dừng, cần mở lại ứng dụng để lịch hoạt động. Khi thiếu mạng hoặc Android hạn chế pin, lượt tải có thể trễ và sẽ tiếp tục khi được phép.</p><div class="weekly-actions"><button id="weeklyBattery" type="button">Cài đặt ứng dụng</button><button id="weeklyNotifications" type="button">Thông báo</button><button id="weeklyAlarm" type="button">Cho phép đúng giờ</button></div></details>';
root.insertBefore(box,root.firstChild);
const $=id=>document.getElementById(id),native=window.DrugSync;
function date(ms){return new Date(ms).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});}
function refresh(){
 if(!native){$('weeklyStatus').textContent='Chức năng này cần bản APK có dịch vụ tải nền.';$('weeklyStart').disabled=true;return;}
 try{
  const s=JSON.parse(native.status()),running=!!s.running;
  $('weeklyStart').disabled=running;$('weeklyStart').textContent=running?'Đang tải…':'Bắt đầu tải';$('weeklyPause').disabled=!running&&!s.pending;
  $('weeklyStatus').textContent=s.message||'Lịch tự động đã bật. Có thể bấm Bắt đầu tải ngay.';
  $('weeklyStatus').dataset.state=s.state||'idle';
  const total=Number(s.total||0),done=Number(s.done||0);$('weeklyProgress').hidden=!total;$('weeklyProgress').max=Math.max(1,total);$('weeklyProgress').value=Math.min(done,total);
  $('weeklyCounts').textContent=total?'Đã xử lý '+done.toLocaleString('vi-VN')+'/'+total.toLocaleString('vi-VN')+' • mới '+(s.added||0)+' • cập nhật '+(s.updated||0)+' • lỗi '+(s.failed||0):'';
  $('weeklyNext').textContent=s.next?'Lịch tiếp theo: '+date(s.next)+(s.exact?'':' · Android có thể trì hoãn nếu chưa cho phép báo thức chính xác.'):'';
  $('weeklyLast').textContent=s.lastSuccess?'Lượt dữ liệu hoàn tất gần nhất: '+date(s.lastSuccess):'Chưa có lượt tải chủ động hoàn tất.';
  $('weeklyAlarm').hidden=!!s.exact;
 }catch(e){$('weeklyStatus').textContent='Chưa đọc được trạng thái tải nền. Hãy mở lại ứng dụng.';}
}
$('weeklyStart').onclick=()=>{if(native){native.start();$('weeklyStatus').textContent='Đang bắt đầu lượt tải…';setTimeout(refresh,500);}};
$('weeklyPause').onclick=()=>{if(native){native.pause();setTimeout(refresh,400);}};
$('weeklyBattery').onclick=()=>native&&native.settings('battery');$('weeklyNotifications').onclick=()=>native&&native.settings('notifications');$('weeklyAlarm').onclick=()=>native&&native.settings('alarm');
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(native)native.reschedule();refresh();}});
refresh();setInterval(()=>{if(!document.hidden)refresh();},1800);
// A separate local-results surface makes downloaded products findable without an online search.
const input=$('drugInput');if(!input||!window.BCCT_DRUG_SYNC)return;
const saved=document.createElement('div');saved.id='weeklySavedResults';saved.className='suggestions';input.parentNode.insertBefore(saved,$('suggestions'));
let seq=0,timer;
input.addEventListener('input',()=>{const id=++seq;clearTimeout(timer);saved.replaceChildren();if(input.value.trim().length<2)return;timer=setTimeout(async()=>{
 const rows=await BCCT_DRUG_SYNC.offlineSearch(input.value,40).catch(()=>[]);if(id!==seq)return;
 if(!rows.length)return;const heading=document.createElement('div');heading.className='online-note';heading.textContent='Đã tải về máy · '+rows.length+' kết quả · mở được khi không có mạng';saved.appendChild(heading);
 for(const row of rows){const b=document.createElement('button');b.type='button';b.className='suggestion';const title=document.createElement('strong');title.textContent=row.record.name;const small=document.createElement('small');small.textContent=(row.record.ingredient||'Long Châu')+(row.downloadedAt?' • cập nhật '+date(row.downloadedAt):'');b.append(title,small);b.onclick=()=>{seq++;saved.replaceChildren();if(window.BCCT_SHOW_SAVED_DRUG)window.BCCT_SHOW_SAVED_DRUG(row);};saved.appendChild(b);}
},220);});
})();
