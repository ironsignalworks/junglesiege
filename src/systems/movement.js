import { state } from '../core/state.js';
export function applyMovement(entity){
  if(!entity || !state.canMove) return;
  const s = entity.speed ?? state.speed ?? 2.5;
  let dx=0, dy=0;
  if(state.keys.left) dx-=s;
  if(state.keys.right) dx+=s;
  if(state.keys.up) dy-=s;
  if(state.keys.down) dy+=s;
  entity.x=(entity.x??100)+dx; entity.y=(entity.y??100)+dy;
}
