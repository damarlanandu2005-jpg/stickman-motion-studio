import React, {useEffect, useMemo} from "react";
import * as THREE from "three";
import {AbsoluteFill, interpolate, useCurrentFrame} from "remotion";
import {ThreeCanvas} from "@remotion/three";
import {useFrame, useThree} from "@react-three/fiber";
import {EffectComposer} from "@react-three/postprocessing";
import {BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode} from "postprocessing";
import {bodyFront, Pen, Outfit} from "../upstream/templates/bridge/toon";
import {InkPass, noInkFallback} from "../upstream/templates/bridge/ink";
import {LensBlur} from "../upstream/templates/bridge/lensblur";
import {GradeEffect, GRADES, GRADE_STRENGTH, gradeFor} from "../upstream/templates/bridge/grade";
import {TopicStory, TopicSubject, CompiledScene, ActionKind} from "./topic-story";
import {toReferenceShotPlan} from "./reference-topic-adapter";
import {applyCameraPose,cameraPoseAt} from "./reference/camera";
import {cardShade,CARD_K} from "../upstream/templates/bridge/cardshade";
import {NOINK} from "../upstream/templates/bridge/ink";
import {TopicEnvironment, TopicAsset} from "./scene-modules";

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
  const outfit = useMemo<Outfit>(() => {
    if (subject.role === "alien") return {...explorerOutfit, jacket:"#72b94d", pants:"#5b9c43", boots:"#355b32", skin:"#79c94f", belt:"#4c7f39", buttons:"#b8df83"};
    if (subject.outfit?.toLowerCase().includes("astronaut")) return {...explorerOutfit, jacket:"#f0eee5", pants:"#d6d9d8", boots:"#343b43", belt:"#e59a32", buttons:"#397eaf", skin:"#f5cba8"};
    return {...explorerOutfit,jacket:subjectColor(subject)};
  },[subject.id,subject.design,subject.outfit,subject.role]);
  const mat=useMemo(()=>{
    const material=cardShade(new THREE.MeshLambertMaterial({map:surface.texture,alphaTest:.5,side:THREE.DoubleSide}));
    material.alphaToCoverage=false;
    return material;
  },[surface]);
  useFrame(()=>{
    surface.context.clearRect(0,0,600,1000);
    const progress=action?clamp01((frame-action.startFrame)/Math.max(1,action.endFrame-action.startFrame)):0;
    const mode=action?.kind==="walk"||action?.kind==="run"||action?.kind==="travel"?"stroll":"stand";
    const expr=action?.kind==="react"?"shock":action?.kind==="talk"?"smile":"neutral";
    bodyFront(new Pen(surface.context),outfit,{mode,phase:frame/fps,expr,seed:hash(subject.id),light:-2.2,blink:Math.floor(frame/55)%8===0,look:progress>0.5?0.15:0});
    surface.texture.needsUpdate=true;
  });
  const meshRef=React.useRef<THREE.Mesh>(null);
  useEffect(()=>{if(meshRef.current){meshRef.current.layers.set(NOINK);meshRef.current.castShadow=false;meshRef.current.receiveShadow=true;}},[]);

  return <mesh ref={meshRef} position={position} scale={subject.scale??1} material={mat}
    onBeforeRender={(renderer)=>{const rt=renderer.getRenderTarget();CARD_K.uPx.value=(rt?rt.height:renderer.domElement.height)/1920;}}>
    <planeGeometry args={[600*.00216,1000*.00216]}/>
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
 if(kind==="space") return <><color attach="background" args={["#080e24"]}/><fog attach="fog" args={["#101b3b",45,190]}/><Starfield/><ambientLight intensity={1.15}/><directionalLight position={[8,12,10]} intensity={2}/></>;
 if(kind==="historical-site") return <><color attach="background" args={["#e6b978"]}/><fog attach="fog" args={["#e6b978",55,180]}/><ambientLight intensity={1.5}/><directionalLight position={[-20,30,15]} intensity={2.2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#c99d62" roughness={1}/></mesh>{Array.from({length:7},(_,i)=><mesh key={i} position={[(i-3)*24,1,-75-(i%3)*15]} scale={[1.8,.22,1]}><sphereGeometry args={[9,20,12]}/><meshStandardMaterial color={i%2?"#d7b477":"#c79e65"} roughness={1}/></mesh>)}{Array.from({length:8},(_,i)=><mesh key={"block"+i} position={[(i-4)*2.6,-1.8,-18-(i%3)*2]} rotation={[0,(i%2)*.12,0]}><boxGeometry args={[2.3,1.2,1.8]}/><meshStandardMaterial color={i%2?"#b99a6d":"#d3b783"} roughness={1}/></mesh>)}</>;
 if(kind==="city"||kind==="village") return <><color attach="background" args={["#9fc4dc"]}/><fog attach="fog" args={["#b8d0df",50,170]}/><ambientLight intensity={1.35}/><directionalLight position={[12,20,10]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#77796d"/></mesh>{buildings.map((b,i)=><group key={i} position={[b.x,-3,b.z]}><mesh position={[0,b.h/2,0]}><boxGeometry args={[kind==="city"?6:8,b.h,6]}/><meshStandardMaterial color={palette[i%palette.length]}/></mesh><mesh position={[0,b.h+1,0]}><coneGeometry args={[kind==="city"?4:6,3,4]}/><meshStandardMaterial color="#514a46"/></mesh></group>)}</>;
 if(kind==="forest") return <><color attach="background" args={["#a8c6a0"]}/><fog attach="fog" args={["#9dbb92",35,130]}/><ambientLight intensity={1.2}/><directionalLight position={[10,18,8]} intensity={1.8}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#55794a"/></mesh>{Array.from({length:24},(_,i)=><group key={i} position={[(i%6-3)*13,-3,-12-Math.floor(i/6)*22]}><mesh position={[0,5,0]}><cylinderGeometry args={[.6,1,10,8]}/><meshStandardMaterial color="#76513a"/></mesh><mesh position={[0,12,0]}><coneGeometry args={[5,12,7]}/><meshStandardMaterial color="#39734b"/></mesh></group>)}</>;
 if(kind==="ocean") return <><color attach="background" args={["#80b8d0"]}/><ambientLight intensity={1.4}/><directionalLight position={[8,18,10]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,-35]}><planeGeometry args={[220,240,24,24]}/><meshStandardMaterial color="#167fa8" metalness={.18} roughness={.32}/></mesh></>;
 if(kind==="mountains") return <><color attach="background" args={["#b5c8d8"]}/><fog attach="fog" args={["#b5c8d8",45,170]}/><ambientLight intensity={1.2}/><directionalLight position={[10,22,12]} intensity={2}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,-35]}><planeGeometry args={[180,220]}/><meshStandardMaterial color="#657b67"/></mesh>{Array.from({length:8},(_,i)=><mesh key={i} position={[(i-4)*18,8,-65-(i%3)*15]}><coneGeometry args={[13,28,5]}/><meshStandardMaterial color={i%2?"#748b91":"#87969b"}/></mesh>)}</>;
 if(kind==="cave") return <><color attach="background" args={["#101923"]}/><fog attach="fog" args={["#17232d",18,95]}/><ambientLight intensity={0.38}/><hemisphereLight args={["#607b91","#1b1718",0.85]}/><pointLight position={[0,8,-48]} color="#e9a66e" intensity={95} distance={100}/><mesh position={[0,5,-35]}><sphereGeometry args={[68,40,28]}/><meshStandardMaterial color="#27343d" roughness={1} side={THREE.BackSide}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,-30]}><planeGeometry args={[140,150]}/><meshStandardMaterial color="#343638" roughness={1}/></mesh>{Array.from({length:15},(_,i)=><group key={i} position={[(i%5-2)*11,-1,-12-Math.floor(i/5)*22]}><mesh position={[0,7,0]} rotation={[Math.PI,0,0]}><coneGeometry args={[1.1+(i%3)*.45,5+(i%4),7]}/><meshStandardMaterial color="#46515a" roughness={1}/></mesh><mesh position={[0,-.2,0]}><dodecahedronGeometry args={[1.4+(i%3)*.5,0]}/><meshStandardMaterial color="#41494d" roughness={1}/></mesh></group>)}</>;
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
 if(subject.assetKey || subject.kind==="planet" || subject.kind==="vehicle" || (subject.kind==="weather" && /sun/i.test(subject.design))) return <TopicAsset subject={subject} position={[position.x,position.y,position.z]} frame={frame}/>;
 if(subject.kind==="building" && /pyramid/i.test(subject.design)) return <Pyramid position={position} scale={scale} color={col}/>;
 if(subject.kind==="building") return <group position={position} scale={scale}><mesh><boxGeometry args={[8,8,7]}/><meshStandardMaterial color={col}/></mesh><mesh position={[0,5,0]}><coneGeometry args={[6,3,4]}/><meshStandardMaterial color="#514a46"/></mesh></group>;
 if(subject.kind==="animal" && /bat/i.test(subject.design)) return <BatSubject position={position} scale={scale} frame={frame}/>;
 if(subject.kind==="animal") return <group position={position} scale={scale}><mesh scale={[1.15,.85,.72]}><sphereGeometry args={[1.5,32,24]}/><meshStandardMaterial color={col} roughness={.85}/></mesh><mesh position={[1.15,.45,0]} scale={[.55,.5,.55]}><sphereGeometry args={[.8,24,18]}/><meshStandardMaterial color={col} roughness={.85}/></mesh>{[-.75,.75].map(x=><mesh key={x} position={[x,-1.1,0]}><cylinderGeometry args={[.13,.16,1.5,10]}/><meshStandardMaterial color="#403a35"/></mesh>)}</group>;
 if(subject.kind==="prop" && /moth|insect/i.test(subject.design)) return <MothSubject position={position} scale={scale} frame={frame}/>;
 if(subject.kind==="scientific-model" && /echo|sonar|pulse/i.test(subject.design)) return <EchoPulse position={position} frame={frame} scale={scale}/>;

 if(subject.kind==="weather") return <group position={position} scale={scale}>{[-1,0,1].map(x=><mesh key={x} position={[x,0,0]}><sphereGeometry args={[1.5,16,12]}/><meshStandardMaterial color="#e8edf0"/></mesh>)}</group>;
 if(subject.kind==="machine"||subject.kind==="scientific-model") return <group position={position} scale={scale}><mesh><torusGeometry args={[1.8,.18,10,48]}/><meshStandardMaterial color={col} metalness={.6}/></mesh><mesh><sphereGeometry args={[.8,20,16]}/><meshStandardMaterial color="#d7e5ee" metalness={.35}/></mesh></group>;
 return <mesh position={position} scale={scale}><boxGeometry args={[2,2,2]}/><meshStandardMaterial color={col}/></mesh>;
};

const CameraRig:React.FC<{scene:CompiledScene;frame:number;fps:number}> = ({scene,frame,fps})=>{
 const {camera}=useThree();
 useFrame(()=>{
  const pose=cameraPoseAt(scene.camera,frame-scene.startFrame,fps,scene.endFrame-scene.startFrame);
  applyCameraPose(camera,pose);
 });
 return null;
};

const BatSubject:React.FC<{position:THREE.Vector3;scale:number;frame:number}> = ({position,scale,frame})=>{
 const wing=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.quadraticCurveTo(-1.1,1.8,-3.3,1.1);s.lineTo(-2.55,.15);s.lineTo(-1.8,-.35);s.lineTo(-1.05,.12);s.lineTo(-.45,-.45);s.closePath();return new THREE.ShapeGeometry(s);},[]);
 const flap=Math.sin(frame*.48)*.62;
 return <group position={position} scale={scale}>
  <mesh scale={[.48,.88,.42]}><sphereGeometry args={[1,24,18]}/><meshStandardMaterial color="#382b35" roughness={.9}/></mesh>
  <mesh position={[0,.78,.04]} scale={[.52,.48,.46]}><sphereGeometry args={[1,24,18]}/><meshStandardMaterial color="#493442" roughness={.85}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*.28,1.14,0]} rotation={[0,0,side*.12]}><coneGeometry args={[.2,.75,5]}/><meshStandardMaterial color="#493442" roughness={.9}/></mesh>)}
  {[-1,1].map(side=><mesh key={side} position={[side*.22,.82,.43]} scale={[.075,.09,.05]}><sphereGeometry args={[1,12,8]}/><meshBasicMaterial color="#f5d9a8"/></mesh>)}
  <mesh geometry={wing} position={[-.32,.38,0]} rotation={[0,0,flap]}><meshStandardMaterial color="#765065" side={THREE.DoubleSide} roughness={.95}/></mesh>
  <mesh geometry={wing} position={[.32,.38,0]} scale={[-1,1,1]} rotation={[0,0,-flap]}><meshStandardMaterial color="#765065" side={THREE.DoubleSide} roughness={.95}/></mesh>
 </group>;
};

const MothSubject:React.FC<{position:THREE.Vector3;scale:number;frame:number}> = ({position,scale,frame})=>{
 const flap=Math.sin(frame*.55)*.28;
 return <group position={position} scale={scale}>
  <mesh scale={[.18,.55,.18]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#5a4031"/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*.38,.18,0]} rotation={[0,0,side*flap]} scale={[.55,.38,.08]}><sphereGeometry args={[1,20,12]}/><meshStandardMaterial color="#d9c49a" side={THREE.DoubleSide}/></mesh>)}
 </group>;
};

const EchoPulse:React.FC<{position:THREE.Vector3;frame:number;scale:number}> = ({position,frame,scale})=>{
 const phase=((frame%42)+42)%42/42;
 return <group position={position} scale={scale*(.75+phase*1.5)}>
  {[0,1,2].map(i=><mesh key={i} rotation={[0,0,0]} scale={1+i*.38}><torusGeometry args={[1.3,.045,8,64]}/><meshBasicMaterial color="#8ad9e8" transparent opacity={(1-phase)*.42} depthWrite={false}/></mesh>)}
 </group>;
};

const PostStack:React.FC<{frame:number;light:string;focus:THREE.Vector3;cInf:number}> = ({frame,light,focus,cInf})=>{
 const {camera,scene}=useThree();
 const fx=useMemo(()=>({
  ink:new InkPass(scene,camera as THREE.PerspectiveCamera),
  lens:new LensBlur({maxCoC:18,nearScale:1.1}),
  bloom:new BloomEffect({blendFunction:BlendFunction.ADD,intensity:.42,luminanceThreshold:1,luminanceSmoothing:.2,mipmapBlur:true,levels:6,radius:.6}),
  tone:new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL}),
  grade:new GradeEffect(GRADES.day,GRADE_STRENGTH.day),
 }),[camera,scene]);
 useEffect(()=>()=>{
  // InkPass is a reference-renderer pass, not a postprocessing Effect, and
  // intentionally has no dispose() method. Dispose only resources that expose it.
  // LensBlur is a wrapper around two postprocessing Effect instances.
  // In the pinned postprocessing version those Effect instances do not expose
  // dispose(); calling LensBlur.dispose() therefore throws during R3F cleanup.
  // EffectComposer owns the lifecycle of the two mounted Effect primitives.
  for(const resource of [fx.ink,fx.bloom,fx.tone,fx.grade]){
   const dispose=(resource as {dispose?:()=>void}).dispose;
   if(typeof dispose==="function") dispose.call(resource);
  }
 },[fx]);
 useEffect(()=>{noInkFallback(scene);},[scene]);
 useFrame(()=>{
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);
  const target=focus.clone();
  fx.lens.focus=Math.max(.3,target.sub(camera.position).dot(forward));
  fx.lens.cInf=cInf;
  gradeFor(fx.grade,/golden|sunset|warm|desert/i.test(light)?"golden":"day");
 });
 return <EffectComposer multisampling={4}>
  <primitive object={fx.ink} dispose={null}/>
  <primitive object={fx.lens.pre} dispose={null}/>
  <primitive object={fx.lens.main} dispose={null}/>
  <primitive object={fx.bloom} dispose={null}/>
  <primitive object={fx.tone} dispose={null}/>
  <primitive object={fx.grade} dispose={null}/>
 </EffectComposer>;
};

const TopicSceneCanvas:React.FC<{scene:CompiledScene;frame:number;fps:number;alpha:number;width:number;height:number}> = ({scene,frame,fps,alpha,width,height})=>(
 <AbsoluteFill style={{opacity:alpha}}>
  <ThreeCanvas width={width} height={height} shadows camera={{position:scene.camera.position,fov:scene.camera.fov??40,near:.2,far:1500}} gl={{antialias:false,alpha:false,stencil:false,powerPreference:"high-performance",toneMappingExposure:1}}>
   <TopicEnvironment kind={scene.environment} frame={frame} description={scene.environmentDescription} atmosphere={scene.atmosphere}/>
   <CameraRig scene={scene} frame={frame} fps={fps}/>
   {scene.subjects.map((subject,index)=><SubjectModel key={subject.id} subject={subject} frame={frame} fps={fps} action={actionAt(scene,frame,subject.id)} index={index}/>)}
   <PostStack frame={frame} light={scene.lighting??""} focus={new THREE.Vector3(...(scene.camera.dof?.focusAt??scene.camera.lookAt))} cInf={scene.camera.dof?.cInf??0}/>
  </ThreeCanvas>
 </AbsoluteFill>
);

type ShotLayer={scene:CompiledScene;alpha:number};
const shotLayersAt=(plan:ReturnType<typeof toReferenceShotPlan>["plan"],scenes:CompiledScene[],frame:number):ShotLayer[]=>{
 for(let i=1;i<plan.shots.length;i++){
  const incoming=plan.shots[i];
  if(incoming.transition!=="crossfade")continue;
  const fade=plan.crossfades[incoming.id]??0;
  if(fade<=0)continue;
  const from=incoming.a-fade/2,to=incoming.a+fade/2;
  if(frame>=from&&frame<to){
   const previous=scenes[i-1],next=scenes[i];
   return [{scene:previous,alpha:1},{scene:next,alpha:clamp01((frame-from+1)/(fade+1))}];
  }
 }
 const scene=scenes.find(s=>frame>=s.startFrame&&frame<s.endFrame)??scenes[scenes.length-1];
 return [{scene,alpha:1}];
};

export const ReferenceTopicEngine:React.FC<{story:TopicStory}> = ({story})=>{
 const frame=useCurrentFrame();
 const {topic:compiled,plan}=useMemo(()=>toReferenceShotPlan(story),[story]);
 const active=compiled.compiledScenes.find(s=>frame>=s.startFrame&&frame<s.endFrame)??compiled.compiledScenes[compiled.compiledScenes.length-1];
 const localFrame=frame-active.startFrame;
 const layers=shotLayersAt(plan,compiled.compiledScenes,frame);
 return <AbsoluteFill style={{background:"#080e24",overflow:"hidden"}}>
  {layers.map((layer,index)=><TopicSceneCanvas key={layer.scene.id} scene={layer.scene} frame={frame} fps={story.fps} alpha={layer.alpha} width={story.width} height={story.height}/>)}
  <div style={{position:"absolute",left:28,right:28,bottom:88,textAlign:"center",fontFamily:"Arial,sans-serif",fontWeight:700,letterSpacing:3,fontSize:30,color:"#f5f3ee",textShadow:"0 3px 18px #000",opacity:interpolate(localFrame,[0,12,active.endFrame-active.startFrame-10,active.endFrame-active.startFrame],[0,1,1,0],{extrapolateRight:"clamp"})}}>{active.title??story.title}</div>
  {active.narration&&<div style={{position:"absolute",left:38,right:38,bottom:34,textAlign:"center",fontFamily:"Arial,sans-serif",fontSize:18,color:"#f5f3ee",textShadow:"0 2px 12px #000"}}>{active.narration}</div>}
 </AbsoluteFill>;
};
