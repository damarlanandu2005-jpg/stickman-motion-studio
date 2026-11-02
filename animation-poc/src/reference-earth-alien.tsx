import React,{useMemo} from "react";
import * as THREE from "three";
import {AbsoluteFill,useCurrentFrame,interpolate} from "remotion";
import {ThreeCanvas} from "@remotion/three";
import {useFrame,useThree} from "@react-three/fiber";
import {bodyFront,Pen,Outfit} from "./toon-reference";

// Character drawing and face/limb construction are the upstream toon.ts implementation.
const explorer:Outfit={jacket:"#e9e9e2",pants:"#34465c",boots:"#22252b",belt:"#d8ad54",buttons:"#c8d5df",skin:"#f5cba8",build:"adult"};
const Character:React.FC=()=>{
 const f=useCurrentFrame();const {camera}=useThree();
 // Keep one canvas/texture and redraw the upstream toon renderer every frame.
 // This preserves the reference walk cycle, expressions and blink timing.
 const surface=useMemo(()=>{
  const canvas=document.createElement("canvas");canvas.width=600;canvas.height=1000;
  const context=canvas.getContext("2d")!;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {canvas,context,texture};
 },[]);
 const mat=useMemo(()=>new THREE.MeshBasicMaterial({map:surface.texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}),[surface]);
 useFrame(()=>{
  surface.context.clearRect(0,0,surface.canvas.width,surface.canvas.height);
  bodyFront(new Pen(surface.context),explorer,{mode:"stroll",phase:f/30,expr:f>285?"shock":"neutral",seed:17,light:-2.2,blink:Math.floor(f/48)%9===0});
  surface.texture.needsUpdate=true;
  camera.position.set(Math.sin(f/150)*1.4,1.8,24-f*.055);camera.lookAt(0,0,-18);
 });
 return <mesh position={[0,-1.6,-7]} rotation={[0,Math.sin(f/100)*.06,0]} material={mat}><planeGeometry args={[3.8,6.4]}/></mesh>;
};
const Space:React.FC=()=>{
 const f=useCurrentFrame();
 return <><color attach="background" args={["#080e24"]}/><fog attach="fog" args={["#101b3b",35,180]}/>
 <ambientLight intensity={1.1}/><directionalLight position={[8,12,10]} intensity={2.1}/>
 <mesh position={[-8+interpolate(f,[0,240],[0,-14],{extrapolateRight:"clamp"}),1,-18]}><sphereGeometry args={[10,48,32]}/><meshStandardMaterial color="#287aa6" roughness={.9}/></mesh>
 <mesh position={[18-interpolate(f,[0,390],[0,28],{extrapolateRight:"clamp"}),-1,-70]}><sphereGeometry args={[15,48,32]}/><meshStandardMaterial color="#9862a8" roughness={.95}/></mesh>
 <mesh position={[18-interpolate(f,[0,390],[0,28],{extrapolateRight:"clamp"}),-1,-70]} scale={[1.025,1.025,1.025]}><sphereGeometry args={[15,48,32]}/><meshBasicMaterial color="#e2a8dc" wireframe transparent opacity={.08}/></mesh>
 <Character/>
 <group position={[2.8,-1.3,-9]} rotation={[0,0,Math.PI/2]}><mesh><capsuleGeometry args={[.4,2.2,8,16]}/><meshStandardMaterial color="#d9e1eb" metalness={.65} roughness={.3}/></mesh><mesh position={[0,0,1.25]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.45,1.1,16]}/><meshStandardMaterial color="#edf2f7" metalness={.5}/></mesh><pointLight position={[0,0,-1.2]} color="#ff8855" intensity={2}/></group>
 </>;
};
export const ReferenceEarthAlien:React.FC=()=>{
 const f=useCurrentFrame();const title=f<90?"A JOURNEY BEGINS":f<240?"BEYOND OUR SOLAR SYSTEM":f<330?"A NEW WORLD":"THE UNKNOWN";
 return <AbsoluteFill style={{background:"#080e24"}}><ThreeCanvas width={1080} height={1920} camera={{position:[0,1.8,24],fov:48,near:.1,far:500}} gl={{antialias:true,alpha:false}}><Space/></ThreeCanvas>
 <div style={{position:"absolute",bottom:105,left:0,right:0,textAlign:"center",fontFamily:"Arial",fontWeight:700,letterSpacing:5,fontSize:34,color:"#f3f4ff",textShadow:"0 3px 20px #000"}}>{title}</div></AbsoluteFill>;
};
