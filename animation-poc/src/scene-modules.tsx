/**
 * Topic-independent scene module registry.
 *
 * Bridge's renderer remains the host (ThreeCanvas, Remotion frame clock, toon cards,
 * camera grammar and post stack). A topic supplies scene modules and authored assets;
 * this registry never assumes every story is a bridge, a planet, or a pyramid.
 */
import React from "react";
import * as THREE from "three";
import { EnvironmentKind, TopicSubject, Vec3 } from "./topic-story";

export type SceneModuleProps = {
  frame: number;
  description: string;
  atmosphere?: string;
};

export type EnvironmentModule = {
  kind: EnvironmentKind;
  Component: React.FC<SceneModuleProps>;
  background: string;
  keyLight: string;
};

const Ground: React.FC<{color:string; y?:number; size?:number}> = ({color,y=-3,size=220}) => (
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,y,-35]} receiveShadow>
    <planeGeometry args={[size,size]}/>
    <meshStandardMaterial color={color} roughness={0.96}/>
  </mesh>
);

const Stars: React.FC<{count?:number}> = ({count=520}) => {
  const positions = React.useMemo(() => {
    const p = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const seed=(n:number)=>{const x=Math.sin((i+1)*n*127.1)*43758.5453;return x-Math.floor(x);};
      p[i*3]=(seed(1)-.5)*260;
      p[i*3+1]=(seed(2)-.5)*170;
      p[i*3+2]=-20-seed(3)*220;
    }
    return p;
  },[count]);
  return <points>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry>
    <pointsMaterial color="#e6efff" size={0.52} sizeAttenuation/>
  </points>;
};

const SpaceEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#071126"]}/>
    <Stars/>
    <ambientLight intensity={0.38}/>
    <hemisphereLight args={["#8db7ee","#11172b",0.55]}/>
    <directionalLight position={[24,18,12]} color="#d7e8ff" intensity={2.2}/>
  </>
);

const LaunchpadEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#78b9e8"]}/>
    <fog attach="fog" args={["#a8d0e9",90,260]}/>
    <hemisphereLight args={["#d9f1ff","#69765a",1.2]}/>
    <directionalLight position={[-35,45,25]} color="#fff0d4" intensity={2.5} castShadow/>
    <Ground color="#78915d" y={-3} size={260}/>
    {[-1,1].map(side=><group key={side} position={[side*16,-3,-30]}>
      <mesh position={[0,13,0]}><boxGeometry args={[1.1,32,1.1]}/><meshStandardMaterial color="#87939a" metalness={.55} roughness={.5}/></mesh>
      {Array.from({length:9},(_,i)=><mesh key={i} position={[0,3+i*3.5,0]}><boxGeometry args={[9,.35,.45]}/><meshStandardMaterial color="#a9b3b8" metalness={.45}/></mesh>)}
    </group>)}
    <mesh position={[-55,10,-110]}><boxGeometry args={[22,20,16]}/><meshStandardMaterial color="#a9b8bc" roughness={.9}/></mesh>
    <mesh position={[58,8,-125]}><boxGeometry args={[26,16,20]}/><meshStandardMaterial color="#a9b8bc" roughness={.9}/></mesh>
  </>
);

const AlienEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#6d7194"]}/>
    <fog attach="fog" args={["#9b91a7",65,210]}/>
    <hemisphereLight args={["#d4c6e7","#45344b",1.1]}/>
    <directionalLight position={[-25,35,18]} color="#ffd6a3" intensity={2.3} castShadow/>
    <Ground color="#795a58" y={-3} size={240}/>
    {Array.from({length:11},(_,i)=><group key={i} position={[(i-5)*18,0,-72-(i%3)*20]}>
      <mesh position={[0,8,0]}><coneGeometry args={[8+(i%3)*2,22+(i%4)*5,5]}/><meshStandardMaterial color={i%2?"#755d72":"#8c6870"} roughness={1}/></mesh>
      <mesh position={[0,1,7]}><dodecahedronGeometry args={[2.2,0]}/><meshStandardMaterial color="#63a8a0" emissive="#17443f" emissiveIntensity={.22}/></mesh>
    </group>)}
  </>
);

const CockpitEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#202b38"]}/>
    <fog attach="fog" args={["#202b38",35,125]}/>
    <ambientLight intensity={0.62}/>
    <hemisphereLight args={["#9ebbd4","#20202a",0.55]}/>
    <pointLight position={[0,7,-9]} color="#78bde5" intensity={22} distance={35}/>
    <mesh position={[0,5,-18]}><sphereGeometry args={[22,40,28]}/><meshStandardMaterial color="#344452" side={THREE.BackSide} roughness={.8}/></mesh>
    {[-1,1].map(side=><group key={side} position={[side*5,-1,-7]}>
      <mesh position={[0,2,0]}><boxGeometry args={[3.4,4.8,2.8]}/><meshStandardMaterial color="#46515d" metalness={.5} roughness={.45}/></mesh>
      <mesh position={[0,4.4,1.46]}><boxGeometry args={[2.8,1.2,.08]}/><meshBasicMaterial color="#3e9ac0"/></mesh>
    </group>)}
    <mesh position={[0,-.2,-5]} rotation={[-.22,0,0]}><boxGeometry args={[12,1.3,4]}/><meshStandardMaterial color="#303d4a" metalness={.45}/></mesh>
    {Array.from({length:8},(_,i)=><mesh key={i} position={[(i-3.5)*1.25,.55,-6]}><boxGeometry args={[.72,.58,.12]}/><meshBasicMaterial color={i%3===0?"#e3a94f":i%3===1?"#58b8d2":"#6d8e9d"}/></mesh>)}
    <mesh position={[0,6,-22]}><torusGeometry args={[5,.45,12,64]}/><meshStandardMaterial color="#73818a" metalness={.7}/></mesh>
  </>
);

const HistoricalEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#e6c18b"]}/>
    <fog attach="fog" args={["#e6c18b",65,230]}/>
    <hemisphereLight args={["#ffe7c0","#766047",1.05]}/>
    <directionalLight position={[-20,35,20]} color="#fff0d0" intensity={2.1} castShadow/>
    <Ground color="#c69e68" y={-3}/>
  </>
);
const ForestEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#a9c69b"]}/>
    <fog attach="fog" args={["#a9c69b",45,160]}/>
    <hemisphereLight args={["#e2f0d5","#43583c",1.1]}/>
    <directionalLight position={[12,28,10]} intensity={1.8} castShadow/>
    <Ground color="#55784a" y={-3}/>
    {Array.from({length:30},(_,i)=><group key={i} position={[(i%6-3)*15,-3,-12-Math.floor(i/6)*24]}>
      <mesh position={[0,5,0]}><cylinderGeometry args={[.55,.9,10,8]}/><meshStandardMaterial color="#76513a"/></mesh>
      <mesh position={[0,12,0]}><coneGeometry args={[5.5,13,7]}/><meshStandardMaterial color={i%2?"#39734b":"#4d8050"}/></mesh>
    </group>)}
  </>
);
const OceanEnvironment: React.FC<SceneModuleProps> = () => (
  <>
    <color attach="background" args={["#91c6dc"]}/>
    <hemisphereLight args={["#d9f5ff","#164b65",1.15]}/>
    <directionalLight position={[12,24,8]} intensity={2}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,-35]}>
      <planeGeometry args={[260,260,48,48]}/>
      <meshStandardMaterial color="#147fa6" metalness={.16} roughness={.3}/>
    </mesh>
  </>
);

export const ENVIRONMENT_MODULES: Record<EnvironmentKind, EnvironmentModule> = {
  space:{kind:"space",Component:SpaceEnvironment,background:"#071126",keyLight:"#d7e8ff"},
  "launchpad":{kind:"launchpad",Component:LaunchpadEnvironment,background:"#78b9e8",keyLight:"#fff0d4"},
  "alien-world":{kind:"alien-world",Component:AlienEnvironment,background:"#6d7194",keyLight:"#ffd6a3"},
  "historical-site":{kind:"historical-site",Component:HistoricalEnvironment,background:"#e6c18b",keyLight:"#fff0d0"},
  forest:{kind:"forest",Component:ForestEnvironment,background:"#a9c69b",keyLight:"#ffffff"},
  ocean:{kind:"ocean",Component:OceanEnvironment,background:"#91c6dc",keyLight:"#ffffff"},
  city:{kind:"city",Component:HistoricalEnvironment,background:"#9fc4dc",keyLight:"#ffffff"},
  village:{kind:"village",Component:HistoricalEnvironment,background:"#9fc4dc",keyLight:"#ffffff"},
  mountains:{kind:"mountains",Component:AlienEnvironment,background:"#b5c8d8",keyLight:"#ffffff"},
  interior:{kind:"interior",Component:HistoricalEnvironment,background:"#b8c7d0",keyLight:"#ffffff"},
  laboratory:{kind:"laboratory",Component:HistoricalEnvironment,background:"#cbd4d8",keyLight:"#ffffff"},
  cave:{kind:"cave",Component:AlienEnvironment,background:"#101923",keyLight:"#e9a66e"},
  abstract:{kind:"abstract",Component:SpaceEnvironment,background:"#101923",keyLight:"#ffffff"},
};

export const TopicEnvironment: React.FC<SceneModuleProps & {kind:EnvironmentKind}> = ({kind,...props}) => {
  const module=ENVIRONMENT_MODULES[kind];
  if(!module) throw new Error("No environment module registered for: "+kind);
  const Component=module.Component;
  return <Component {...props}/>;
};

/** Reusable authored asset primitives. Unknown asset keys fail loudly instead of becoming random boxes. */
export const TopicAsset: React.FC<{subject:TopicSubject; position:Vec3; frame:number}> = ({subject,position,frame}) => {
  const scale=subject.scale??1;
  const key=subject.assetKey??"";
  if(key==="earth" || key==="alien-planet" || subject.kind==="planet"){
    const earth=key==="earth" || /earth/i.test(subject.design);
    const radius=earth?9:8;
    return <group position={position} scale={scale} rotation={[0,frame*.0008,0]}>
      <mesh><sphereGeometry args={[radius,64,48]}/><meshStandardMaterial color={earth?"#2476bd":"#795b91"} roughness={.82} metalness={.02}/></mesh>
      <mesh scale={1.035}><sphereGeometry args={[radius,64,48]}/><meshBasicMaterial color={earth?"#65b9f2":"#d4a2df"} transparent opacity={.12} side={THREE.BackSide}/></mesh>
      {earth && <group>{Array.from({length:7},(_,i)=><mesh key={i} position={[Math.sin(i*2.1)*4,Math.cos(i*1.7)*3,Math.sin(i*1.1)*5]} scale={[1.8,.18,1.2]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color="#58a56c" roughness={1}/></mesh>)}</group>}
    </group>;
  }
  if(key==="sun" || subject.kind==="weather" && /sun/i.test(subject.design)){
    return <group position={position} scale={scale}>
      <mesh><sphereGeometry args={[4.8,48,32]}/><meshBasicMaterial color="#ffd45d"/></mesh>
      <mesh><sphereGeometry args={[6.2,48,32]}/><meshBasicMaterial color="#ff9c43" transparent opacity={.16} side={THREE.BackSide}/></mesh>
      <pointLight color="#ffd18a" intensity={75} distance={150}/>
    </group>;
  }
  if(key==="rocket"){
    return <group position={position} scale={scale}>
      <mesh position={[0,2.5,0]}><cylinderGeometry args={[.82,.82,6.8,32]}/><meshStandardMaterial color="#e7e9e8" metalness={.35} roughness={.32}/></mesh>
      <mesh position={[0,6.35,0]}><coneGeometry args={[.82,1.8,32]}/><meshStandardMaterial color="#e45e32" metalness={.2}/></mesh>
      <mesh position={[0,-1.25,0]}><cylinderGeometry args={[.82,.5,1.1,32]}/><meshStandardMaterial color="#b9c4cb" metalness={.55}/></mesh>
      {[-1,1].map(side=><mesh key={side} position={[side*.76,-.55,0]} rotation={[0,0,-side*.28]}><boxGeometry args={[.32,2.2,.35]}/><meshStandardMaterial color="#d84d35" metalness={.15}/></mesh>)}
      <mesh position={[0,-2.25,0]}><cylinderGeometry args={[.34,.62,.65,24]}/><meshBasicMaterial color="#ffb33d"/></mesh>
    </group>;
  }
  if(key==="spacecraft" || subject.kind==="vehicle"){
    return <group position={position} scale={scale}>
      <mesh><capsuleGeometry args={[1.05,3.8,8,24]}/><meshStandardMaterial color="#cbd5dd" metalness={.62} roughness={.28}/></mesh>
      <mesh position={[0,.45,.7]} rotation={[Math.PI/2,0,0]}><sphereGeometry args={[.78,32,24]}/><meshStandardMaterial color="#3d83a9" metalness={.25} roughness={.18}/></mesh>
      {[-1,1].map(side=><group key={side} position={[side*1.55,-.1,0]}><mesh><boxGeometry args={[1.5,.18,3.1]}/><meshStandardMaterial color="#aebdc8" metalness={.5}/></mesh><mesh position={[0,0,-1.7]}><boxGeometry args={[.75,.12,.8]}/><meshBasicMaterial color="#e5b75b"/></mesh></group>)}
      <mesh position={[0,-2.15,0]}><coneGeometry args={[.48,1.4,20]}/><meshBasicMaterial color="#ff9a36"/></mesh>
    </group>;
  }
  if(key==="crystal"){
    return <group position={position} scale={scale}>
      {[-1,0,1].map((x,i)=><mesh key={i} position={[x*.8,i===1?1.1:0,0]} rotation={[.08*x,0,.12*x]}>
        <octahedronGeometry args={[i===1?1.5:1.05,1]}/>
        <meshPhysicalMaterial color="#79e7f2" emissive="#25b9d1" emissiveIntensity={.65} roughness={.18} metalness={.12} transmission={.18}/>
      </mesh>)}
      <pointLight color="#67e9f5" intensity={12} distance={15}/>
    </group>;
  }
  if(key==="starfield") return <Stars count={720}/>;
  throw new Error("No subject asset module for '"+(key||subject.kind)+"' ("+subject.id+"). Register a reusable asset renderer or provide a supported assetKey.");
};
