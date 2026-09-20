import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { it, expect } from 'vitest';
it('shows visible push, increments badge, and opens only the saved invitation', async () => {
  const handlers={}, notifications=[], badges=[], opened=[];
  let state;
  const database={close(){},transaction(){
    const transaction={objectStore(){return {get(){const request={result:state};queueMicrotask(()=>transaction.oncomplete());return request;},put(value){state=structuredClone(value);queueMicrotask(()=>transaction.oncomplete());return {};}};}};
    return transaction;
  }};
  const self={location:{origin:'https://santiago.teolabs.app'},addEventListener(type,handler){handlers[type]=handler;},navigator:{async setAppBadge(count){badges.push(count);},async clearAppBadge(){badges.push(0);}},registration:{async showNotification(title,options){notifications.push({title,options});},async getNotifications(){return [];}},clients:{async matchAll(){return [];},async openWindow(url){opened.push(url);}}};
  const context=vm.createContext({self,URL,indexedDB:{open(){const request={result:database};queueMicrotask(()=>request.onsuccess());return request;}}});
  vm.runInContext(readFileSync('public/push-worker.js','utf8'),context);
  const dispatch=async(type,event)=>{let pending;handlers[type]({...event,waitUntil(value){pending=value;}});await pending;};
  await dispatch('message',{data:{type:'SANTIAGO_OPEN',path:'/?invite=demo'}});
  await dispatch('message',{data:{type:'SANTIAGO_OPEN',path:'/'}});
  await dispatch('push',{data:{json(){return {title:'Hoy cumple 7',body:'¡Vamos!',key:'birthday-2026-09-25'};}}});
  expect(notifications[0].title).toBe('Hoy cumple 7');expect(badges.at(-1)).toBe(1);
  await dispatch('push',{data:{json(){throw new Error('Malformed');}}});
  expect(notifications).toHaveLength(2);expect(badges.at(-1)).toBe(2);
  await dispatch('notificationclick',{notification:{close(){}}});
  expect(opened).toEqual(['https://santiago.teolabs.app/?invite=demo']);expect(badges.at(-1)).toBe(0);
  await dispatch('message',{data:{type:'SANTIAGO_OPEN',path:'https://evil.test/'}});
  expect(state.path).toBe('/?invite=demo');
});
