import React, {useMemo} from "react";
import * as THREE from "three";
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from "remotion";
import {ThreeCanvas} from "@remotion/three";
import {useFrame, useThree} from "@react-three/fiber";
import {bodyFront, Pen, Outfit} from "../reference/toon";

const explorer: Outfit = {jacket:"#e9e9e2",pants:"#34465c",boots:"#22252b",belt:"#e0b45a",buttons:"#c8d5df",skin:"#f5cba8",build:"adult"};
function makeExplorerTexture(frame:number) {
 const canvas=document.createElement("canvas"); canvas.width=600; canvas.height=1000;
 const g=canvas.getContext("2d")!; g.clearRect(0,0,600,1000);
 const p=new Pen(g);
 bodyFront(p, explorer, {mode:"stroll",phase:frame/30,expr:frame>220?"shock":"neutral",seed:17,light:-Math.PI*0.72,blink:Math.floor(frame/48)%7===0});
 return new THREE.CanvasTexture(canvas);
}
const Stars:React.FC=()=> {
 const pts=useMemo(()=>Array.from({length:520},()=>new THREE.Vector3((Math.random()-.5)*420,(Math.random()-.5)*240,(Math.random()-.5)*420)),[]);
 return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(pts.flatMap(p=>[p.x,p.y,p.z])),3]}/></bufferGeometry><pointsMaterial color="#dce9ff" size={0.8} sizeAttenuation/></points>;
};
const JourneyWorld:React.FC=()=>{
 const f=useCurrentFrame(); const {camera}=useThree();
 const ship=useMemo(()=>new THREE.Group(),[]);
 const earth=useMemo(()=>new THREE.Mesh(new THREE.SphereGeometry(10,48,32),new THREE.MeshStandardMaterial({color:"#277aa5",roughness:0.9})),[]);
 const alien=useMemo(()=>new THREE.Mesh(new THREE.SphereGeometry(15,48,32),new THREE.MeshStandardMaterial({color:"#9862a8",roughness:0.95})),[]);
 const tex=useMemo(()=>makeExplorerTexture(0),[]);
 const card=useMemo(()=>new THREE.Mesh(new THREE.PlaneGeometry(3.6,6),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false})),[tex]);
 useFrame(()=>{
  const t=f/30;
  camera.position.set(0,2,28- t*1.3); camera.lookAt(0,0,-12);
  earth.position.set(-8+Math.min(f/240,1)*-16,1,-18);
  alien.position.set(18-interpolate(f,[0,180,390],[0,12,30],{extrapolateRight:"clamp"}),-1,-70);
  ship.position.set(Math.sin(t*.35)*1.2,Math.sin(t*.7)*.3,-t*2);
  card.position.set(0,-2,-8); card.rotation.y=Math.sin(t*.3)*.08;
 });
 return <><color attach="background" args={["#080e24"]}/><fog attach="fog" args={["#101b3b",35,170]}/>
 <ambientLight intensity={1.3}/><directionalLight position={[8,12,10]} intensity={2.2}/>
 <Stars/><mesh ref={o=>{if(o){o.position.set(-8,1,-18)}}}><sphereGeometry args={[10,48,32]}/><meshStandardMaterial color="#287aa6" roughness={.9}/></mesh>
 <mesh position={[0,0,-70]}><sphereGeometry args={[15,48,32]}/><meshStandardMaterial color="#9862a8" roughness={.95}/></mesh>
 <mesh position={[0,0,-70]} scale={[1.03,1.03,1.03]}><sphereGeometry args={[15,48,32]}/><meshBasicMaterial color="#e2a8dc" wireframe transparent opacity={.08}/></mesh>
 <primitive object={card}/><group ref={o=>{if(o){o.position.set(2.4,-1.6,-9)}}}><mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[.42,2.3,8,16]}/><meshStandardMaterial color="#c9d4e2" metalness={.7} roughness={.3}/></mesh><mesh position={[0,0,1.2]}><coneGeometry args={[.48,1.2,16]}/><meshStandardMaterial color="#e8eef6" metalness={.5}/></mesh><pointLight position={[0,0,-1.4]} color="#ff8b55" intensity={2}/></group>
 </>;
};
export const SpaceJourney:React.FC=()=> {
 const f=useCurrentFrame();
 const title=f<90?"A JOURNEY BEGINS":f<240?"BEYOND OUR SOLAR SYSTEM":f<360?"A NEW WORLD":"THE UNKNOWN";
 return <AbsoluteFill style={{background:"#080e24"}}>
  <ThreeCanvas width={1080} height={1920} camera={{position:[0,2,28],fov:48,near:.1,far:500}} gl={{antialias:true,alpha:false}}>
   <JourneyWorld/>
  </ThreeCanvas>
  <div style={{position:"absolute",left:0,right:0,bottom:105,textAlign:"center",fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:5,fontSize:34,color:"#f3f4ff",textShadow:"0 3px 20px #000",opacity:interpolate(f,[0,18,365,390],[0,1,1,0],{extrapolateRight:"clamp"})}}>{title}</div>
 </AbsoluteFill>
};
