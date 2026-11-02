import React, {useMemo} from "react";
import * as THREE from "three";
import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";
import {ThreeCanvas} from "@remotion/three";
import {useFrame, useThree} from "@react-three/fiber";
import {bodyFront, Pen, Outfit} from "./reference/toon";
import {compileTopic, TopicStory, TopicSubject, CompiledScene, ActionKind} from "./topic-story";

const explorerOutfit: Outfit = {
  jacket: "#e9e9e2", pants: "#34465c", boots: "#22252b",
  belt: "#d8ad54", buttons: "#c8d5df", skin: "#f5cba8", build: "adult"
};
const clamp01 = (v:number) => Math.max(0, Math.min(1, v));
const hash = (s:string) => [...s].reduce((a,c)=>((a*31)+c.charCodeAt(0))>>>0, 7);
const palette = ["#b86d4b","#547b9b","#8b6da8","#66865a","#c39a54","#6c8792"];
const subjectColor = (s:TopicSubject) => palette[hash(s.id+s.design)%palette.length];

const actionAt = (scene:CompiledScene, frame:number, subjectId:string) =>
  scene.actionsInFrames.find(a=>a.subjectId===subjectId && frame>=a.startFrame && frame<a.endFrame);

const ToonSubject:React.FC<{subject:TopicSubject; position:THREE.Vector3; frame:number; fps:number; action?:{kind:ActionKind;startFrame:number;endFrame:number}}> = ({subject,position,frame,fps,action}) => {
  const surface = useMemo(()=>{
    const canvas=document.createElement("canvas"); canvas.width=600; canvas.height=1000;
    const context=canvas.getContext("2d")!;
    const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    return {canvas,context,texture};
  },[]);
  const outfit = useMemo<Outfit>(()=>({...explorerOutfit,jacket:subjectColor(subject)}),[subject.id,subject.design]);
  useFrame(()=>{
    surface.context.clearRect(0,0,600,1000);
    const progress=action?clamp01((frame-action.startFrame)/Math.max(1,action.endFrame-action.startFrame)):0;
    const mode=action?.kind==="walk"||action?.kind==="run"||action?.kind==="travel"?"stroll":"stand";
    const expr=action?.kind==="react"?"shock":action?.kind==="talk"?"smile":"neutral";
    bodyFront(new Pen(surface.context),outfit,{mode,phase:frame/fps,expr,seed:hash(subject.id),light:-2.2,blink:Math.floor(frame/55)%8===0,look:progress>0.5?0.15:0});
    surface.texture.needsUpdate=true;
  });
  return <mesh position={position} scale={subject.scale??1}>
    <planeGeometry args={[3.4,5.7]}/>
    <meshBasicMaterial map={surface.texture} transparent side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>;
};

const Starfield:React.FC=()=>{
 const stars=useMemo(()=>Array.from({length:420},(_,i)=>new THREE.Vector3(((hash("x"+i)%1000)/1000-.5)*240,((hash("y"+i)%1000)/1000-.5)*150,-(hash("z"+i)%1000)/1000*220)),[]);
 const positions=new Float32Array(stars.flatMap(p=>[p.x,p.y,p.z]));
 return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color="#dce9ff" size={0.65} sizeAttenuation/></points>;
};

const Pyramid:React.FC<{position:THREE.Vector3;scale?:number;color?:string}> = ({position,scale=1,color="#c8aa78"}) =>
 <mesh position={position} scale={scale} rotation={[0,Math.PI/4,0]}><coneGeometry args={[6,8,4]}/><meshStandardMaterial color={color} roughness={1}/></mesh>;

const Environment:React.FC<{kind:string;frame:number}> = ({kind,frame})=>{
 const buildings=Array.from({length:9},(_,i)=>({x:(i-4)*9,z:-24-(i%3)*12,h:8+(hash(kind+i)%18)}));
 if(kind==="space") return <><color attach="background" args={["#080e24"]}/><fog attach="fog" args={["#101b3b",45,190]}/><Starfield/><ambientLight intensity={1.15}/><directionalLight position={[8,12,10]} intensity={2}/><mesh position={[-12,1,-52]}><sphereGeometry args={[12,48,32]}/><meshStandardMaterial color="#287aa6" roughness={.9}/></mesh><mesh position={[14,-1,-92]}><sphereGeometry args={[17,48,32]}/><meshStandardMaterial color="#9862a8" roughness={.95}/></mesh></>;
 if(kind==="historical-site") return <><color attach="background" args={["#e6b978"]}/><fog attach="fog" args={["#e6b978",55,180]}/><ambientLight intensity={1.5}/><directionalLight position={[-20,30,15]} intensity={2.2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#c99d62" roughness={1}/></mesh><Pyramid position={new THREE.Vector3(-13,1,-52)} scale={1.7}/><Pyramid position={new THREE.Vector3(13,0,-65)} scale={1.2} color="#b99868"/><Pyramid position={new THREE.Vector3(35,-1,-78)} scale={.9} color="#d0ae7b"/>{Array.from({length:12},(_,i)=><mesh key={i} position={[(i-6)*3,-1,-18-(i%4)*7]}><boxGeometry args={[2.4,1.8,2.2]}/><meshStandardMaterial color={i%2?"#b99a6d":"#d3b783"}/></mesh>)}</>;
 if(kind==="city"||kind==="village") return <><color attach="background" args={["#9fc4dc"]}/><fog attach="fog" args={["#b8d0df",50,170]}/><ambientLight intensity={1.35}/><directionalLight position={[12,20,10]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#77796d"/></mesh>{buildings.map((b,i)=><group key={i} position={[b.x,-3,b.z]}><mesh position={[0,b.h/2,0]}><boxGeometry args={[kind==="city"?6:8,b.h,6]}/><meshStandardMaterial color={palette[i%palette.length]}/></mesh><mesh position={[0,b.h+1,0]}><coneGeometry args={[kind==="city"?4:6,3,4]}/><meshStandardMaterial color="#514a46"/></mesh></group>)}</>;
 if(kind==="forest") return <><color attach="background" args={["#a8c6a0"]}/><fog attach="fog" args={["#9dbb92",35,130]}/><ambientLight intensity={1.2}/><directionalLight position={[10,18,8]} intensity={1.8}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#55794a"/></mesh>{Array.from({length:24},(_,i)=><group key={i} position={[(i%6-3)*13,-3,-12-Math.floor(i/6)*22]}><mesh position={[0,5,0]}><cylinderGeometry args={[.6,1,10,8]}/><meshStandardMaterial color="#76513a"/></mesh><mesh position={[0,12,0]}><coneGeometry args={[5,12,7]}/><meshStandardMaterial color="#39734b"/></mesh></group>)}</>;
 if(kind==="ocean") return <><color attach="background" args={["#80b8d0"]}/><ambientLight intensity={1.4}/><directionalLight position={[8,18,10]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,-35]}><planeGeometry args={[220,240,24,24]}/><meshStandardMaterial color="#167fa8" metalness={.18} roughness={.32}/></mesh></>;
 if(kind==="mountains") return <><color attach="background" args={["#b5c8d8"]}/><fog attach="fog" args={["#b5c8d8",45,170]}/><ambientLight intensity={1.2}/><directionalLight position={[10,22,12]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#657b67"/></mesh>{Array.from({length:8},(_,i)=><mesh key={i} position={[(i-4)*18,8,-65-(i%3)*15]}><coneGeometry args={[13,28,5]}/><meshStandardMaterial color={i%2?"#748b91":"#87969b"}/></mesh>)}</>;
 return <><color attach="background" args={["#b8c7d0"]}/><ambientLight intensity={1.35}/><directionalLight position={[8,16,10]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-30]}><planeGeometry args={[160,200]}/><meshStandardMaterial color={kind==="laboratory"?"#cbd4d8":"#8b8178"}/></mesh><mesh position={[0,8,-70]}><boxGeometry args={[150,24,2]}/><meshStandardMaterial color={kind==="laboratory"?"#e4eaed":"#a59b8d"}/></mesh></>;
};

const SubjectModel:React.FC<{subject:TopicSubject;frame:number;fps:number;action?:ReturnType<typeof actionAt>;index:number}> = ({subject,frame,fps,action,index})=>{
 const base=subject.startPosition??[(index%3-1)*5,-1.4,-8-Math.floor(index/3)*4] as [number,number,number];
 const progress=action?clamp01((frame-action.startFrame)/Math.max(1,action.endFrame-action.startFrame)):0;
 const travel=action&&(action.kind==="travel"||action.kind==="walk"||action.kind==="run"||action.kind==="fly");
 const position=new THREE.Vector3(base[0]+(travel?progress*3:0),base[1]+(action?.kind==="fly"?progress*2:0),base[2]-(travel?progress*7:0));
 const scale=subject.scale??1, col=subjectColor(subject);
 if(subject.kind==="person") return <ToonSubject subject={subject} position={position} frame={frame} fps={fps} action={action}/>;
 if(subject.kind==="crowd") return <group position={position}>{Array.from({length:5},(_,i)=><ToonSubject key={i} subject={{...subject,id:subject.id+"-"+i}} position={new THREE.Vector3((i-2)*1.5,0,-(i%2)*.5)} frame={frame} fps={fps} action={action}/>)}</group>;
 if(subject.kind==="planet") return <mesh position={position} scale={scale}><sphereGeometry args={[5,40,28]}/><meshStandardMaterial color={col} roughness={.92}/></mesh>;
 if(subject.kind==="building" && /pyramid/i.test(subject.design)) return <Pyramid position={position} scale={scale} color={col}/>;
 if(subject.kind==="building") return <group position={position} scale={scale}><mesh><boxGeometry args={[8,8,7]}/><meshStandardMaterial color={col}/></mesh><mesh position={[0,5,0]}><coneGeometry args={[6,3,4]}/><meshStandardMaterial color="#514a46"/></mesh></group>;
 if(subject.kind==="animal") return <group position={position} scale={scale}><mesh><sphereGeometry args={[1.5,20,14]}/><meshStandardMaterial color={col}/></mesh><mesh position={[1.25,.55,0]}><sphereGeometry args={[.7,16,12]}/><meshStandardMaterial color={col}/></mesh>{[-.8,.8].map(x=><mesh key={x} position={[x,-1,0]}><cylinderGeometry args={[.13,.16,1.4,8]}/><meshStandardMaterial color="#403a35"/></mesh>)}</group>;
 if(subject.kind==="vehicle") return <group position={position} scale={scale}><mesh><capsuleGeometry args={[.7,2.2,6,12]}/><meshStandardMaterial color={col} metalness={.35}/></mesh><mesh position={[0,.8,0]}><boxGeometry args={[1.8,.7,1.5]}/><meshStandardMaterial color="#dce4e9" metalness={.25}/></mesh></group>;
 if(subject.kind==="weather") return <group position={position} scale={scale}>{[-1,0,1].map(x=><mesh key={x} position={[x,0,0]}><sphereGeometry args={[1.5,16,12]}/><meshStandardMaterial color="#e8edf0"/></mesh>)}</group>;
 if(subject.kind==="machine"||subject.kind==="scientific-model") return <group position={position} scale={scale}><mesh><torusGeometry args={[1.8,.18,10,48]}/><meshStandardMaterial color={col} metalness={.6}/></mesh><mesh><sphereGeometry args={[.8,20,16]}/><meshStandardMaterial color="#d7e5ee" metalness={.35}/></mesh></group>;
 return <mesh position={position} scale={scale}><boxGeometry args={[2,2,2]}/><meshStandardMaterial color={col}/></mesh>;
};

const CameraRig:React.FC<{scene:CompiledScene;frame:number;fps:number}> = ({scene,frame,fps})=>{
 const {camera}=useThree();
 useFrame(()=>{
  const local=clamp01((frame-scene.startFrame)/Math.max(1,scene.endFrame-scene.startFrame));
  const move=scene.camera.move??"hold", intensity=scene.camera.intensity??0;
  const p=scene.camera.position, look=scene.camera.lookAt;
  const push=move==="push"?intensity*local:move==="pull"?-intensity*local:0;
  const pan=move==="pan"?intensity*Math.sin(local*Math.PI*2):0;
  camera.position.set(p[0]+pan,p[1],p[2]-push);
  camera.lookAt(look[0]+pan*.5,look[1],look[2]);
  if(camera instanceof THREE.PerspectiveCamera){camera.fov=scene.camera.fov??48;camera.updateProjectionMatrix();}
 });
 return null;
};

export const ReferenceTopicEngine:React.FC<{story:TopicStory}> = ({story})=>{
 const frame=useCurrentFrame();
 const compiled=useMemo(()=>compileTopic(story),[story]);
 const active=compiled.compiledScenes.find(s=>frame>=s.startFrame&&frame<s.endFrame)??compiled.compiledScenes[compiled.compiledScenes.length-1];
 const localFrame=frame-active.startFrame;
 return <AbsoluteFill style={{background:"#080e24",overflow:"hidden"}}>
  <ThreeCanvas width={story.width} height={story.height} camera={{position:[0,2,24],fov:active.camera.fov??48,near:.1,far:500}} gl={{antialias:true,alpha:false}}>
   <Environment kind={active.environment} frame={frame}/>
   <CameraRig scene={active} frame={frame} fps={story.fps}/>
   {active.subjects.map((subject,index)=><SubjectModel key={subject.id} subject={subject} frame={frame} fps={story.fps} action={actionAt(active,frame,subject.id)} index={index}/>)}
  </ThreeCanvas>
  <div style={{position:"absolute",left:28,right:28,bottom:88,textAlign:"center",fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:3,fontSize:30,color:"#f5f3ee",textShadow:"0 3px 18px #000",opacity:interpolate(localFrame,[0,12,active.endFrame-active.startFrame-10,active.endFrame-active.startFrame],[0,1,1,0],{extrapolateRight:"clamp"})}}>{active.title??story.title}</div>
  {active.narration&&<div style={{position:"absolute",left:38,right:38,bottom:34,textAlign:"center",fontFamily:"Arial,sans-serif",fontSize:18,color:"#f5f3ee",textShadow:"0 2px 12px #000"}}>{active.narration}</div>}
 </AbsoluteFill>;
};
