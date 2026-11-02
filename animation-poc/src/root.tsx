import React from "react";
import {Composition} from "remotion";
import {BridgeShort, BRIDGE_FRAMES} from "./reference/BridgeReference";
import {ReferenceTopicEngine} from "./reference-topic-engine";
import {TopicStory, compileTopic} from "./topic-story";
import earthStory from "./earth-to-alien.story.json";
import historyStory from "./history-pyramid.story.json";
import batStory from "./bat-echolocation.story.json";

const EarthAlien:React.FC=()=> <ReferenceTopicEngine story={earthStory as TopicStory}/>;
const PyramidHistory:React.FC=()=> <ReferenceTopicEngine story={historyStory as TopicStory}/>;
const BatEcholocation:React.FC=()=> <ReferenceTopicEngine story={batStory as TopicStory}/>;

export const Root:React.FC=()=> <>
  {/* Exact upstream composition: baseline smoke test, not the generic topic engine. */}
  <Composition id="BridgeReferenceBaseline" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920}/>
  <Composition id="EarthAlienReferencePOC" component={EarthAlien} durationInFrames={compileTopic(earthStory as TopicStory).totalFrames} fps={earthStory.fps} width={earthStory.width} height={earthStory.height}/>
  <Composition id="HistoryPyramidReferencePOC" component={PyramidHistory} durationInFrames={compileTopic(historyStory as TopicStory).totalFrames} fps={historyStory.fps} width={historyStory.width} height={historyStory.height}/>
  <Composition id="BatEcholocationReferencePOC" component={BatEcholocation} durationInFrames={compileTopic(batStory as TopicStory).totalFrames} fps={batStory.fps} width={batStory.width} height={batStory.height}/>
</>;
