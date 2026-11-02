/** Shared camera grammar extracted from the pinned Bridge story.ts.
 * Smoothstep glides and hard cuts are intentionally the same interpolation family as upstream.
 * Topic stories provide authored keyframes; no automatic camera guess replaces shot direction.
 */
import * as THREE from "three";
import { TopicCamera, TopicCameraKeyframe, Vec3 } from "../topic-story";

const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
export const referenceGlide=(u:number)=>{const x=clamp01(u);return x*x*x*(x*(6*x-15)+10);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const mix3=(a:Vec3,b:Vec3,t:number):Vec3=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
export interface CameraPose {position:Vec3;lookAt:Vec3;fov:number;roll:number;}
const pose=(p:TopicCameraKeyframe|TopicCamera):CameraPose=>({
 position:p.position,lookAt:p.lookAt,fov:p.fov??40,roll:p.roll??0
});
/** Evaluate an authored camera path at a scene-local frame. Keyframe frame positions are seconds. */
export function cameraPoseAt(camera:TopicCamera,localFrame:number,fps:number,durationFrames:number):CameraPose {
 const keys=(camera.keyframes??[]).slice().sort((a,b)=>a.atSeconds-b.atSeconds);
 if(!keys.length){
  const base=pose(camera);
  const progress=clamp01(localFrame/Math.max(1,durationFrames));
  const move=camera.move??"hold",intensity=camera.intensity??0;
  const push=move==="push"?intensity*progress:move==="pull"?-intensity*progress:0;
  const pan=move==="pan"?intensity*Math.sin(progress*Math.PI*2):0;
  const orbit=move==="orbit"?intensity*progress:0;
  const follow=move==="follow"?intensity*progress:0;
  return {
   position:[base.position[0]+pan+Math.sin(orbit)*Math.max(1,intensity*2),base.position[1]+Math.sin(progress*Math.PI)*.25,base.position[2]-push+Math.cos(orbit)*Math.max(0,intensity*2)-follow],
   lookAt:[base.lookAt[0]+pan*.5,base.lookAt[1],base.lookAt[2]],
   fov:base.fov,roll:base.roll
  };
 }
 const t=localFrame/fps;
 if(t<=keys[0].atSeconds)return pose(keys[0]);
 for(let i=1;i<keys.length;i++){
  const next=keys[i],prev=keys[i-1];
  if(t<=next.atSeconds){
   if(next.cut)return pose(prev);
   const span=Math.max(1e-6,next.atSeconds-prev.atSeconds);
   const u=referenceGlide((t-prev.atSeconds)/span);
   const a=pose(prev),b=pose(next);
   return {position:mix3(a.position,b.position,u),lookAt:mix3(a.lookAt,b.lookAt,u),fov:mix(a.fov,b.fov,u),roll:mix(a.roll,b.roll,u)};
  }
 }
 return pose(keys[keys.length-1]);
}
export function applyCameraPose(camera:THREE.Camera,pose:CameraPose){
 camera.position.set(...pose.position);
 camera.lookAt(...pose.lookAt);
 if(camera instanceof THREE.PerspectiveCamera){camera.fov=pose.fov;camera.updateProjectionMatrix();}
 camera.rotation.z=pose.roll*Math.PI/180;
}
