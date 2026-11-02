import React from "react";
import {Composition} from "remotion";
import {SpaceJourney} from "./space/SpaceJourney";
export const Root:React.FC=()=> <Composition id="EarthAlienReferencePOC" component={SpaceJourney} durationInFrames={390} fps={30} width={1080} height={1920}/>;
