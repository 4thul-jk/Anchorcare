self.addEventListener('push', event => {
 let data={};try{data=event.data.json();}catch{}
 const sos=data.kind==='sos_alert';
 event.waitUntil(self.registration.showNotification('AnchorCare',{
  body:sos?'An assistance request is waiting. Open your companion.':'A saved picture is ready. Open your companion.',
  tag:typeof data.tag==='string'?data.tag:'anchorcare',data:{url:'/phone'},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  for(const window of windows)if(new URL(window.url).pathname==='/phone'){await window.focus();return;}
  await clients.openWindow('/phone');
 }));
});
