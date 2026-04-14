import { useEffect, useState } from "react";
import { DEFAULT_INITIAL, InitialData, StageBase } from "@chub-ai/stages-ts";
import InitData from "./assets/test-init.json";

export interface TestStageRunnerProps<
  StageType extends StageBase<InitStateType, ChatStateType, MessageStateType, ConfigType>,
  InitStateType,
  ChatStateType,
  MessageStateType,
  ConfigType,
> {
  factory: (
    data: InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>,
  ) => StageType;
}

export const TestStageRunner = <
  StageType extends StageBase<
    InitStateType,
    ChatStateType,
    MessageStateType,
    ConfigType
  >,
  InitStateType,
  ChatStateType,
  MessageStateType,
  ConfigType,
>({
  factory,
}: TestStageRunnerProps<
  StageType,
  InitStateType,
  ChatStateType,
  MessageStateType,
  ConfigType
>) => {
  const [stage] = useState<StageType>(() => {
    const initialData = {
      ...DEFAULT_INITIAL,
      ...(InitData as Partial<
        InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>
      >),
    } as InitialData<InitStateType, ChatStateType, MessageStateType, ConfigType>;
    return factory(initialData);
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void stage.load().then((res) => {
      if (!res.success || res.error != null) {
        return;
      }
      setReady(true);
    });
  }, [stage]);

  return ready ? stage.render() : <div>Stage loading...</div>;
};
