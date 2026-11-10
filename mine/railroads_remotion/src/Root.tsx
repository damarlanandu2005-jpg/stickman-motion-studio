import React from "react";
import { Composition } from "remotion";
import { RailShort, RAIL_FRAMES } from "./videos/rail/Rail";

export const Root: React.FC = () => (
  <Composition
    id="RailShort"
    component={RailShort}
    durationInFrames={RAIL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
