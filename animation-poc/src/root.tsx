import React from 'react';
import {Composition} from 'remotion';
import {EarthAlienPoc} from './scene';

export const Root: React.FC = () => (
  <Composition
    id="EarthAlienPoc"
    component={EarthAlienPoc}
    durationInFrames={240}
    fps={24}
    width={576}
    height={1024}
  />
);
