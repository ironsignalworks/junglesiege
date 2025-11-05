import { state } from './state.js';
const map={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const setKey=(c,d)=>{const k=map[c]; if(k) state.keys[k]=d;};
export function attachInput(el=window){ el.addEventListener('keydown',e=>setKey(e.code,true)); el.addEventListener('keyup',e=>setKey(e.code,false)); }
