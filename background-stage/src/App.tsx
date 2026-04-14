import { InitialData, ReactRunner } from "@chub-ai/stages-ts";
import { BackgroundStage } from "./BackgroundStage";
import { TestStageRunner } from "./TestRunner";
import { StageChatState, StageConfig, StageMessageState } from "../../src/types";

type VnvInitialData = InitialData<null, StageChatState, StageMessageState, StageConfig>;

function App() {
  const isDev = import.meta.env.MODE === "development";
  const factory = (data: VnvInitialData) => new BackgroundStage(data);

  return isDev ? <TestStageRunner factory={factory} /> : <ReactRunner factory={factory} />;
}

export default App;
