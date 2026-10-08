(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'kazakhtelecom-overtime-records-v1';
  const HOLIDAYS = {
    '01-01':'Новый год','01-02':'Новый год','01-07':'Православное Рождество',
    '03-08':'Международный женский день','03-21':'Наурыз мейрамы','03-22':'Наурыз мейрамы','03-23':'Наурыз мейрамы',
    '05-01':'Праздник единства народа Казахстана','05-07':'День защитника Отечества','05-09':'День Победы',
    '07-06':'День столицы','08-30':'День Конституции','10-25':'День Республики','12-16':'День Независимости'
  };
  let records = loadRecords();
  let toastTimer;

  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
  function dayInfo(dateValue) {
    if (!dateValue) return { kind:'workday', label:'Рабочий день', holiday:'' };
    const d = new Date(`${dateValue}T12:00:00`);
    const key = dateValue.slice(5);
    const holiday = HOLIDAYS[key] || '';
    if (holiday) return { kind:'holiday', label:'Праздничный день', holiday };
    if (d.getDay() === 0 || d.getDay() === 6) return { kind:'weekend', label:'Выходной', holiday:'' };
    return { kind:'workday', label:'Рабочий день', holiday:'' };
  }
  function durationHours(startValue, endValue) {
    if (!startValue || !endValue) return 0;
    const toMinutes=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
    return ((toMinutes(endValue)-toMinutes(startValue)+1440)%1440)/60;
  }
  function workType(startValue, endValue) {
    if (!startValue || !endValue) return '';
    const toMinutes=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
    const start=toMinutes(startValue), duration=(toMinutes(endValue)-start+1440)%1440, finish=start+duration;
    if (!duration) return '';
    const overlapsNight=(a,b)=>start<b&&finish>a;
    return overlapsNight(0,360)||overlapsNight(1320,1800)||overlapsNight(2760,3240) ? 'Ночные работы' : 'Сверхурочные работы';
  }
  function formatDate(value) {
    if (!value) return '';
    const [year,month,day]=value.split('-');
    return `${day}.${month}.${year}`;
  }
  function formatEmployeeName(value) {
    const parts=String(value||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return '';
    return parts[0]+(parts.length>1?' ':'')+parts.slice(1).map(part=>`${Array.from(part)[0].toLocaleUpperCase('ru')}.`).join('');
  }
  function formatHours(value) { return `${Number(value).toLocaleString('ru-RU',{maximumFractionDigits:2})} ч`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function updatePreview() {
    const type = workType($('startTime').value,$('endTime').value);
    const typeEl = $('typePreview');
    typeEl.textContent = type || 'Укажите время начала и окончания';
    typeEl.className = `type-pill ${type === 'Ночные работы' ? 'night' : type ? 'overtime' : 'neutral'}`;
    const day = dayInfo($('workDate').value);
    $('dayPreview').textContent = day.label;
    $('dayPreview').className = `day-pill ${day.kind}`;
    $('dayHint').textContent = day.holiday ? `Праздник: ${day.holiday}` : day.kind === 'weekend' ? 'Дата приходится на выходной' : day.kind === 'workday' && $('workDate').value ? 'Рабочий день' : 'Выходной или праздник определится автоматически';
    const duration=durationHours($('startTime').value,$('endTime').value);
    $('durationPreview').textContent = duration ? formatHours(duration) : '—';
    $('formError').textContent=$('startTime').value&&$('endTime').value&&!duration?'Время окончания должно отличаться от времени начала.':'';
  }
  function render() {
    const query = $('searchInput').value.trim().toLocaleLowerCase('ru');
    const visible = records.filter(r => [r.employee,r.employeeNumber,r.ticket,r.department,r.position,r.city].join(' ').toLocaleLowerCase('ru').includes(query));
    $('recordsBody').innerHTML = visible.map(r => {
      const night = r.type === 'Ночные работы';
      const day = dayInfo(r.date);
      return `<tr>
        <td class="person-cell"><strong>${esc(r.employee)}</strong><small>Табельный № ${esc(r.employeeNumber)}</small></td>
        <td>${esc(r.department)}<br><span class="muted">${esc(r.position)}</span></td>
        <td>${esc(r.city)}</td>
        <td>${esc(formatDate(r.date))}<br><span class="muted">${esc(r.time)}–${esc(r.endTime||'')}${r.endTime&&r.endTime<r.time?' (+1 дн.)':''}</span></td>
        <td><span class="type-pill ${night?'night':'overtime'}">${esc(r.type)}</span></td>
        <td><span class="day-pill ${day.kind}">${esc(day.label)}</span></td>
        <td>${esc(r.ticket)}</td><td class="hours-cell">${esc(formatHours(r.duration))}</td>
        <td><div class="row-actions"><button type="button" data-edit="${esc(r.id)}" aria-label="Редактировать">✎</button><button type="button" class="delete" data-delete="${esc(r.id)}" aria-label="Удалить">×</button></div></td>
      </tr>`;
    }).join('');
    $('emptyState').classList.toggle('hidden', visible.length !== 0);
    $('recordsBody').classList.toggle('hidden', visible.length === 0);
    $('recordCaption').textContent = query ? `Результаты поиска: ${visible.length}` : 'Все привлечения к работам';
    $('tableCount').textContent = `Показано ${visible.length} ${plural(visible.length,'запись','записи','записей')}`;
    $('statRecords').textContent = records.length;
    $('statHours').innerHTML = `${records.reduce((n,r)=>n+Number(r.duration),0).toLocaleString('ru-RU',{maximumFractionDigits:2})} <small>ч</small>`;
    $('statNight').textContent = records.filter(r=>r.type==='Ночные работы').length;
    $('statDays').textContent = records.filter(r=>dayInfo(r.date).kind!=='workday').length;
  }
  function plural(n, one, few, many) {
    const a=n%10,b=n%100; return a===1&&b!==11?one:a>=2&&a<=4&&(b<12||b>14)?few:many;
  }
  function openDialog(record) {
    $('formError').textContent=''; $('recordForm').reset();
    $('recordId').value=record?.id||'';
    $('dialogTitle').textContent=record?'Редактировать запись':'Новая запись';
    $('saveLabel').textContent=record?'Сохранить изменения':'Сохранить запись';
    if(record){ $('employee').value=record.employee; $('position').value=record.position; $('department').value=record.department; $('employeeNumber').value=record.employeeNumber; $('city').value=record.city; $('workDate').value=record.date; $('startTime').value=record.time; $('endTime').value=record.endTime||''; $('ticket').value=record.ticket; }
    updatePreview(); $('recordDialog').showModal();
  }
  function cell(v) { return `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`; }
  function exportExcel() {
    if (!records.length) return showToast('Нет записей для экспорта');
    const headers=['ФИО работника','Должность','Структурное подразделение','Табельный номер','Город / район','Дата привлечения','Время начала','Время окончания','Номер проблемного билета','Тип работ','Выходной или праздничный день','Длительность, часы'];
    const rows=records.map(r=>[r.employee,r.position,r.department,r.employeeNumber,r.city,formatDate(r.date),r.time,r.endTime||'',r.ticket,r.type,dayInfo(r.date).label,r.duration]);
    const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Сверхурочные"><Table><Row>${headers.map(cell).join('')}</Row>${rows.map(row=>`<Row>${row.map(cell).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
    downloadBlob(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'}),`Журнал_сверхурочных_${today()}.xls`);
    showToast('Таблица Excel выгружена');
  }
  function exportWord() {
    if (!records.length) return showToast('Нет записей для экспорта');
    const entries=records.map(r=>{
      const line=`${formatDate(r.date)} с ${r.time} - ${r.endTime||''} был привлечен г. ${r.city}, ${String(r.position).toLocaleLowerCase('ru')} ${r.department} ${formatEmployeeName(r.employee)} по ПБ${r.ticket}.`;
      return `<p>${esc(line)}</p>`;
    }).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11pt}p{margin:0 0 10pt}</style></head><body>${entries}</body></html>`;
    downloadBlob(new Blob(['\ufeff',html],{type:'application/msword;charset=utf-8'}),`Сверхурочные_работы_${today()}.doc`);
    showToast('Документ Word выгружен');
  }
  function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function downloadBlob(blob,name) {
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  $('loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    if($('loginName').value.trim()==='demo'&&$('loginPassword').value==='demo'){
      sessionStorage.setItem('kt-overtime-session','1'); $('loginError').textContent=''; $('loginScreen').classList.add('hidden'); $('appScreen').classList.remove('hidden'); render();
    } else $('loginError').textContent='Неверный логин или пароль';
  });
  $('logoutButton').addEventListener('click',()=>{sessionStorage.removeItem('kt-overtime-session');$('appScreen').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginPassword').value='';});
  $('addButton').addEventListener('click',()=>openDialog()); $('emptyAddButton').addEventListener('click',()=>openDialog());
  $('closeDialog').addEventListener('click',()=>$('recordDialog').close()); $('cancelDialog').addEventListener('click',()=>$('recordDialog').close());
  ['workDate','startTime','endTime'].forEach(id=>$(id).addEventListener('input',updatePreview));
  $('recordForm').addEventListener('submit',e=>{
    e.preventDefault(); const date=$('workDate').value,time=$('startTime').value,endTime=$('endTime').value,duration=durationHours(time,endTime);
    if(!time||!endTime){ $('formError').textContent='Укажите время начала и окончания работ.'; return; }
    if(!(duration>0&&duration<24)){ $('formError').textContent='Время окончания должно отличаться от времени начала; длительность не может превышать 24 часа.'; return; }
    const id=$('recordId').value||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const record={id,employee:$('employee').value.trim(),position:$('position').value,department:$('department').value,employeeNumber:$('employeeNumber').value.trim(),city:$('city').value,date,time,endTime,duration,ticket:$('ticket').value.trim(),type:workType(time,endTime)};
    const index=records.findIndex(r=>r.id===id); if(index>=0)records[index]=record;else records.unshift(record);
    persist(); render(); $('recordDialog').close(); showToast(index>=0?'Запись обновлена':'Запись добавлена');
  });
  $('recordsBody').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-delete]');
    if(edit){const record=records.find(r=>r.id===edit.dataset.edit);if(record)openDialog(record);}
    if(del){const record=records.find(r=>r.id===del.dataset.delete);if(record&&confirm(`Удалить запись о работах: ${record.employee}?`)){records=records.filter(r=>r.id!==record.id);persist();render();showToast('Запись удалена');}}
  });
  $('searchInput').addEventListener('input',render); $('excelButton').addEventListener('click',exportExcel); $('wordButton').addEventListener('click',exportWord);
  if(sessionStorage.getItem('kt-overtime-session')==='1'){$('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden');}
  render();
})();
