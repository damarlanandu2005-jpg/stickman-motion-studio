import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

const Starfield: React.FC = () => {
  const stars = Array.from({length: 90}, (_, i) => ({
    x: (i * 73 + 19) % 576,
    y: (i * 137 + 31) % 1024,
    r: 0.7 + (i % 4) * 0.35,
    a: 0.25 + (i % 5) * 0.12,
  }));
  return <g>{stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dce8ff" opacity={s.a}/>)}</g>;
};

export const EarthAlienPoc: React.FC = () => {
  const f = useCurrentFrame();
  const earthScale = interpolate(f, [0, 95, 239], [1, 0.62, 0.42], {extrapolateRight: 'clamp'});
  const earthX = interpolate(f, [0, 95, 239], [288, 160, -220], {extrapolateRight: 'clamp'});
  const shipX = interpolate(f, [0, 48, 120, 239], [650, 330, 285, 250], {extrapolate: 'clamp'});
  const shipY = interpolate(f, [0, 95, 239], [620, 490, 430], {extrapolate: 'clamp'});
  const planetOpacity = interpolate(f, [125, 190, 239], [0, 1, 1], {extrapolateLeft: 'clamp'});
  const planetScale = interpolate(f, [125, 239], [0.15, 1.05], {extrapolateLeft: 'clamp'});
  const nebulaShift = interpolate(f, [0, 239], [0, -180], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 52% 44%, #25234c 0%, #10152f 48%, #070b19 100%)', overflow: 'hidden'}}>
      <svg width="576" height="1024" viewBox="0 0 576 1024" style={{position:'absolute', inset:0}}>
        <defs>
          <radialGradient id="earth"><stop offset="0%" stopColor="#4b9cbd"/><stop offset="65%" stopColor="#23658f"/><stop offset="100%" stopColor="#102c5d"/></radialGradient>
          <radialGradient id="alien"><stop offset="0%" stopColor="#d4a5bd"/><stop offset="55%" stopColor="#805b9e"/><stop offset="100%" stopColor="#322c69"/></radialGradient>
          <linearGradient id="ship" x1="0" x2="1"><stop stopColor="#dce7f2"/><stop offset="1" stopColor="#728aa9"/></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="18"/></filter>
        </defs>
        <g transform={`translate(${nebulaShift} 0)`} opacity="0.45">
          <ellipse cx="440" cy="340" rx="230" ry="90" fill="#754d9d" filter="url(#glow)"/>
          <ellipse cx="180" cy="760" rx="200" ry="70" fill="#245c8b" filter="url(#glow)"/>
        </g>
        <Starfield/>
        <g transform={`translate(${earthX} 355) scale(${earthScale})`}>
          <circle r="170" fill="#5eb4d1" opacity="0.25" filter="url(#glow)"/>
          <circle r="145" fill="url(#earth)" stroke="#8bd8e7" strokeWidth="5"/>
          <path d="M-85 -75 L-30 -110 L8 -80 L-12 -40 L-55 -18 L-88 20 L-120 -10 Z M25 5 L75 -25 L112 10 L82 58 L45 84 L18 48 Z M-10 90 L20 65 L42 110 L10 132 Z" fill="#6c9e80" opacity=".9"/>
          <path d="M-130 -20 Q0 -85 130 -20 M-110 65 Q0 20 110 65" fill="none" stroke="#b4e6ed" strokeWidth="8" opacity=".25"/>
        </g>
        <g opacity={planetOpacity} transform={`translate(430 470) scale(${planetScale})`}>
          <circle r="175" fill="#a16db9" opacity=".22" filter="url(#glow)"/>
          <ellipse cx="-155" cy="-165" rx="24" ry="24" fill="#b8c0dc"/>
          <ellipse cx="145" cy="-205" rx="15" ry="15" fill="#d4b8c9"/>
          <circle r="138" fill="url(#alien)" stroke="#d6a6d6" strokeWidth="5"/>
          <path d="M-125 -15 Q0 -75 125 -15 M-100 55 Q0 8 100 55 M-65 105 Q0 75 65 105" fill="none" stroke="#d7a4c9" strokeWidth="17" opacity=".45"/>
          <path d="M-75 -80 Q-15 -120 35 -72 L10 -30 L-55 -25 Z" fill="#9ab2a0" opacity=".6"/>
        </g>
        <g transform={`translate(${shipX} ${shipY}) rotate(-7)`}>
          <path d="M-58 0 L-12 -18 L48 0 L-12 18 Z" fill="url(#ship)" stroke="#f0f5ff" strokeWidth="3"/>
          <path d="M-15 -14 L-3 -38 L12 -14 Z" fill="#9bc4d8" stroke="#e5f0ff" strokeWidth="2"/>
          <path d="M-58 0 L-90 -12 L-80 0 L-90 12 Z" fill="#f1a46e" opacity=".9"/>
          <path d="M-55 -6 L-115 -20 M-55 6 L-115 20" stroke="#e9a46d" strokeWidth="3" opacity=".65"/>
        </g>
      </svg>
      <div style={{position:'absolute',left:32,right:32,bottom:54,color:'#e9edf8',fontFamily:'Arial, sans-serif',textAlign:'center',letterSpacing:2,fontSize:19,opacity:interpolate(f,[0,18,215,239],[0,1,1,0.4])}}>
        {f < 48 ? 'LEAVING EARTH' : f < 125 ? 'INTO DEEP SPACE' : f < 216 ? 'A NEW WORLD' : 'APPROACHING'}
      </div>
    </AbsoluteFill>
  );
};
