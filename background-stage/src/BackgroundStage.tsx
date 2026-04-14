import { ReactElement } from "react";
import { InitialData, Message, StageResponse } from "@chub-ai/stages-ts";
import { Stage as UtilityStage } from "../../src/Stage";
import { StageChatState, StageConfig, StageMessageState } from "../../src/types";

const IMPORT_BLOCK_PATTERN = /<<VNV_IMPORT>>\s*([\s\S]*?)\s*<<\/VNV_IMPORT>>/m;
const IMPORT_COMMAND_PATTERN = /^\/vnv-import\b\s*([\s\S]*)$/i;
const TRANSFER_FORMAT_PATTERN = /"format"\s*:\s*"vnv-(actor|roster)"/i;

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch == null ? trimmed : fenceMatch[1].trim();
}

function extractImportPayload(content: string): {
  importText: string | null;
  modifiedMessage: string | null;
} {
  const blockMatch = IMPORT_BLOCK_PATTERN.exec(content);
  if (blockMatch != null) {
    const before = content.slice(0, blockMatch.index);
    const after = content.slice(blockMatch.index + blockMatch[0].length);
    const visibleContent = `${before}${after}`.replace(/\n{3,}/g, "\n\n").trim();
    return {
      importText: blockMatch[1].trim(),
      modifiedMessage:
        visibleContent === "" ? "[Updated V&V background state from transfer code.]" : visibleContent,
    };
  }

  const trimmed = content.trim();
  const commandMatch = trimmed.match(IMPORT_COMMAND_PATTERN);
  if (commandMatch != null && commandMatch[1].trim() !== "") {
    return {
      importText: commandMatch[1].trim(),
      modifiedMessage: "[Updated V&V background state from transfer code.]",
    };
  }

  const stripped = stripJsonFence(trimmed);
  if (
    stripped !== "" &&
    (stripped.startsWith("{") || stripped.startsWith("[")) &&
    TRANSFER_FORMAT_PATTERN.test(stripped)
  ) {
    return {
      importText: stripped,
      modifiedMessage: "[Updated V&V background state from transfer code.]",
    };
  }

  return { importText: null, modifiedMessage: null };
}

export class BackgroundStage extends UtilityStage {
  constructor(
    data: InitialData<null, StageChatState, StageMessageState, StageConfig>,
  ) {
    super({
      ...data,
      config: {
        includeStageDirections: true,
        compactPromptSummary: true,
        lewdLevel: "LL2",
        ...(data.config ?? {}),
      },
    });
  }

  async beforePrompt(
    userMessage: Message,
  ): Promise<Partial<StageResponse<StageChatState, StageMessageState>>> {
    const importPayload = extractImportPayload(userMessage.content);
    let importError: string | null = null;

    if (importPayload.importText != null) {
      importError = await this.importCharacterText(importPayload.importText);
    }

    const response = await super.beforePrompt(userMessage);
    if (importPayload.importText == null) {
      return response;
    }

    return {
      ...response,
      modifiedMessage:
        importError == null
          ? importPayload.modifiedMessage
          : "[V&V transfer code import failed.]",
      error: importError ?? response.error ?? null,
    };
  }

  render(): ReactElement {
    return (
      <div className="background-stage-note">
        <strong>Vice & Violence Background Stage</strong>
        <span>
          This stage is meant to run hidden in Chub. Paste transfer codes into chat with{" "}
          <code>{"<<VNV_IMPORT>>...<</VNV_IMPORT>>"}</code> or <code>/vnv-import</code>.
        </span>
      </div>
    );
  }
}
