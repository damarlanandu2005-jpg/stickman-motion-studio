import React from "react";
import { Composition } from "remotion";
import { RailShort, RAIL_FRAMES } from "./videos/rail/Rail";
import { QA_FRAMES } from "./videos/rail/rstory";

export const Root: React.FC = () => (
  <>
    <Composition
      id="RailShort"
      component={RailShort}
      durationInFrames={RAIL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="RailShotQA"
      component={RailShort}
      durationInFrames={QA_FRAMES.length}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ post: { dpr: 0.5, frameMap: QA_FRAMES } } as never}
    />
  </>
);
