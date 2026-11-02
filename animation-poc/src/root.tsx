import React from "react";
import {Composition} from "remotion";
import {ReferenceEarthAlien} from "./reference-earth-alien";
export const Root:React.FC=()=> <Composition id="EarthAlienReferencePOC" component={ReferenceEarthAlien} durationInFrames={390} fps={30} width={1080} height={1920}/>;
