import React from "react";
import { Composition } from "remotion";
import { RailShort, RAIL_FRAMES } from "./videos/bell/Rail";
export const Root: React.FC = () => (
  <Composition id="BellShort" component={RailShort} durationInFrames={RAIL_FRAMES} fps={30} width={1080} height={1920} />
);
