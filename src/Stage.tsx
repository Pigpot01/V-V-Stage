import { ReactElement } from "react";
import {
  InitialData,
  Message,
  StageBase,
  StageResponse,
} from "@chub-ai/stages-ts";
import { LoadResponse } from "@chub-ai/stages-ts/dist/types/load";
import {
  ARMOUR_TABLE,
  clamp,
  rollAbilityBlock,
  rollArmourLoadout,
  rollBirthsign,
  rollDice,
  rollSupplySnippet,
  rollWeaponLoadout,
} from "./rules";
import { createActor, createDefaultState } from "./sampleState";
import { buildStageDirections, formatSigned, ResolvedStageConfig } from "./stageText";
import {
  ActorAbilities,
  ActorRole,
  ActorSheet,
  ControlMode,
  EncounterState,
  RollLogEntry,
  StageChatState,
  StageConfig,
  StageMessageState,
} from "./types";
import { VnvStageView } from "./VnvStageView";

type UpdateListener = () => void;
type TrackableResource = "spellUses" | "exertion" | "disposition";
type SurpriseType = EncounterState["surprise"];

interface AutomationActorPatch {
  id?: string;
  role?: ActorRole;
  name?: string;
  kin?: string;
  className?: string;
  background?: string;
  birthsign?: string;
  boon?: string;
  level?: number;
  lifeCurrent?: number;
  lifeMax?: number;
  spellUsesCurrent?: number;
  spellUsesMax?: number;
  exertionCurrent?: number;
  exertionMax?: number;
  disposition?: number;
  initiative?: ActorSheet["initiative"];
  weaponName?: string;
  weaponDie?: string;
  weaponMaterial?: number;
  armourType?: ActorSheet["armourType"];
  armourSaveDie?: string;
  abilities?: Partial<ActorAbilities>;
  statuses?: string[];
  movesText?: string;
  inventoryText?: string;
  notes?: string;
}

interface AutomationPatch {
  upsertActors: AutomationActorPatch[];
  removeActorIds: string[];
  actorOrder: string[];
  encounter: Partial<EncounterState>;
  rolls: Array<Pick<RollLogEntry, "label" | "detail">>;
  campaignNotes?: string;
}

const DEFAULT_CONFIG: ResolvedStageConfig = {
  includeStageDirections: true,
  compactPromptSummary: true,
  lewdLevel: "LL2",
};

const MAX_ROLL_LOG = 24;
const STATE_BLOCK_PATTERN = /<<VNV_STATE>>\s*([\s\S]*?)\s*<<\/VNV_STATE>>/m;
const ACTOR_ROLES: ActorRole[] = ["player", "ally", "enemy", "npc"];
const INITIATIVE_TYPES: ActorSheet["initiative"][] = [
  "manual",
  "preemptive",
  "interspersed",
  "reactive",
  "rapid",
];
const ARMOUR_TYPES: ActorSheet["armourType"][] = ["skimpy", "light", "medium", "full"];
const SURPRISE_TYPES: SurpriseType[] = ["none", "party", "enemy"];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseText(value: string): string {
  return value.replace(/\r/g, "").trim();
}

function normaliseId(value: string): string {
  return normaliseText(value).replace(/\s+/g, "-");
}

function normaliseControlMode(value: ControlMode | undefined): ControlMode {
  return value === "system" ? "system" : "setup";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normaliseText(entry))
    .filter((entry) => entry !== "");
}

function readActorRole(value: unknown): ActorRole | undefined {
  return typeof value === "string" && ACTOR_ROLES.includes(value as ActorRole)
    ? (value as ActorRole)
    : undefined;
}

function readInitiative(value: unknown): ActorSheet["initiative"] | undefined {
  return typeof value === "string" && INITIATIVE_TYPES.includes(value as ActorSheet["initiative"])
    ? (value as ActorSheet["initiative"])
    : undefined;
}

function readArmourType(value: unknown): ActorSheet["armourType"] | undefined {
  return typeof value === "string" && ARMOUR_TYPES.includes(value as ActorSheet["armourType"])
    ? (value as ActorSheet["armourType"])
    : undefined;
}

function readSurprise(value: unknown): SurpriseType | undefined {
  return typeof value === "string" && SURPRISE_TYPES.includes(value as SurpriseType)
    ? (value as SurpriseType)
    : undefined;
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch == null ? trimmed : fenceMatch[1].trim();
}

function extractAutomationBlock(content: string): {
  visibleContent: string | null;
  patch: AutomationPatch | null;
  error: string | null;
} {
  const match = STATE_BLOCK_PATTERN.exec(content);
  if (match == null) {
    return { visibleContent: null, patch: null, error: null };
  }

  const before = content.slice(0, match.index);
  const after = content.slice(match.index + match[0].length);
  const visibleContent = `${before}${after}`.replace(/\n{3,}/g, "\n\n").trim();

  try {
    const parsed = JSON.parse(stripJsonFence(match[1]));
    return {
      visibleContent,
      patch: sanitiseAutomationPatch(parsed),
      error: null,
    };
  } catch (error) {
    void error;
    return {
      visibleContent,
      patch: null,
      error: "Ignored a malformed VNV state patch from the model response.",
    };
  }
}

function sanitiseAutomationPatch(value: unknown): AutomationPatch | null {
  if (!isRecord(value)) {
    return null;
  }

  const upsertActors = Array.isArray(value.upsertActors)
    ? value.upsertActors
        .map((entry) => sanitiseAutomationActorPatch(entry))
        .filter((entry): entry is AutomationActorPatch => entry != null)
    : [];

  const removeActorIds = readStringArray(value.removeActorIds) ?? [];
  const actorOrder = readStringArray(value.actorOrder) ?? [];
  const rolls = Array.isArray(value.rolls)
    ? value.rolls
        .map((entry) => sanitiseAutomationRoll(entry))
        .filter((entry): entry is Pick<RollLogEntry, "label" | "detail"> => entry != null)
    : [];

  const encounter = sanitiseEncounterPatch(value.encounter);
  const campaignNotes = readString(value.campaignNotes);

  return {
    upsertActors,
    removeActorIds,
    actorOrder,
    encounter,
    rolls,
    ...(campaignNotes !== undefined ? { campaignNotes } : {}),
  };
}

function sanitiseAutomationActorPatch(value: unknown): AutomationActorPatch | null {
  if (!isRecord(value)) {
    return null;
  }

  const patch: AutomationActorPatch = {};
  const id = readString(value.id);
  const role = readActorRole(value.role);
  const initiative = readInitiative(value.initiative);
  const armourType = readArmourType(value.armourType);
  const statuses = readStringArray(value.statuses);

  if (id !== undefined && normaliseId(id) !== "") {
    patch.id = normaliseId(id);
  }
  if (role !== undefined) {
    patch.role = role;
  }
  if (initiative !== undefined) {
    patch.initiative = initiative;
  }
  if (armourType !== undefined) {
    patch.armourType = armourType;
  }
  if (statuses !== undefined) {
    patch.statuses = statuses;
  }

  const name = readString(value.name);
  const kin = readString(value.kin);
  const className = readString(value.className);
  const background = readString(value.background);
  const birthsign = readString(value.birthsign);
  const boon = readString(value.boon);
  const weaponName = readString(value.weaponName);
  const weaponDie = readString(value.weaponDie);
  const armourSaveDie = readString(value.armourSaveDie);
  const movesText = readString(value.movesText);
  const inventoryText = readString(value.inventoryText);
  const notes = readString(value.notes);
  const level = readNumber(value.level);
  const lifeCurrent = readNumber(value.lifeCurrent);
  const lifeMax = readNumber(value.lifeMax);
  const spellUsesCurrent = readNumber(value.spellUsesCurrent);
  const spellUsesMax = readNumber(value.spellUsesMax);
  const exertionCurrent = readNumber(value.exertionCurrent);
  const exertionMax = readNumber(value.exertionMax);
  const disposition = readNumber(value.disposition);
  const weaponMaterial = readNumber(value.weaponMaterial);

  if (name !== undefined) patch.name = name;
  if (kin !== undefined) patch.kin = kin;
  if (className !== undefined) patch.className = className;
  if (background !== undefined) patch.background = background;
  if (birthsign !== undefined) patch.birthsign = birthsign;
  if (boon !== undefined) patch.boon = boon;
  if (weaponName !== undefined) patch.weaponName = weaponName;
  if (weaponDie !== undefined) patch.weaponDie = weaponDie;
  if (armourSaveDie !== undefined) patch.armourSaveDie = armourSaveDie;
  if (movesText !== undefined) patch.movesText = movesText;
  if (inventoryText !== undefined) patch.inventoryText = inventoryText;
  if (notes !== undefined) patch.notes = notes;
  if (level !== undefined) patch.level = level;
  if (lifeCurrent !== undefined) patch.lifeCurrent = lifeCurrent;
  if (lifeMax !== undefined) patch.lifeMax = lifeMax;
  if (spellUsesCurrent !== undefined) patch.spellUsesCurrent = spellUsesCurrent;
  if (spellUsesMax !== undefined) patch.spellUsesMax = spellUsesMax;
  if (exertionCurrent !== undefined) patch.exertionCurrent = exertionCurrent;
  if (exertionMax !== undefined) patch.exertionMax = exertionMax;
  if (disposition !== undefined) patch.disposition = disposition;
  if (weaponMaterial !== undefined) patch.weaponMaterial = weaponMaterial;

  const abilitiesValue = value.abilities;
  if (isRecord(abilitiesValue)) {
    const abilities: Partial<ActorAbilities> = {};
    (["smarts", "brawn", "moxie", "hotness"] as const).forEach((key) => {
      const nextValue = readNumber(abilitiesValue[key]);
      if (nextValue !== undefined) {
        abilities[key] = nextValue;
      }
    });
    if (Object.keys(abilities).length > 0) {
      patch.abilities = abilities;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function sanitiseEncounterPatch(value: unknown): Partial<EncounterState> {
  if (!isRecord(value)) {
    return {};
  }

  const patch: Partial<EncounterState> = {};
  const active = readBoolean(value.active);
  const round = readNumber(value.round);
  const activeActorId = value.activeActorId === null ? null : readString(value.activeActorId);
  const surprise = readSurprise(value.surprise);
  const notes = readString(value.notes);

  if (active !== undefined) {
    patch.active = active;
  }
  if (round !== undefined) {
    patch.round = round;
  }
  if (activeActorId !== undefined) {
    patch.activeActorId = activeActorId == null ? null : normaliseId(activeActorId);
  }
  if (surprise !== undefined) {
    patch.surprise = surprise;
  }
  if (notes !== undefined) {
    patch.notes = notes;
  }

  return patch;
}

function sanitiseAutomationRoll(value: unknown): Pick<RollLogEntry, "label" | "detail"> | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = readString(value.label);
  const detail = readString(value.detail);
  if (label == null || detail == null) {
    return null;
  }

  return {
    label: normaliseText(label),
    detail: normaliseText(detail),
  };
}

function armourSaveForType(armourType: ActorSheet["armourType"]): string {
  return ARMOUR_TABLE.find((entry) => entry.armourType === armourType)?.armourSaveDie ?? "d4";
}

function defaultNameForRole(role: ActorRole): string {
  switch (role) {
    case "ally":
      return "Ally";
    case "enemy":
      return "Enemy";
    case "npc":
      return "NPC";
    case "player":
    default:
      return "Adventurer";
  }
}

function clampMax(current: number, max: number): number {
  return clamp(current, 0, max);
}

function normaliseActor(actor: ActorSheet): ActorSheet {
  const level = Math.max(0, Math.trunc(actor.level));
  const lifeMax = Math.max(0, Math.trunc(actor.lifeMax));
  const spellUsesMax = Math.max(0, Math.trunc(actor.spellUsesMax));
  const exertionMax = Math.max(0, Math.trunc(actor.exertionMax));
  return {
    ...actor,
    id: normaliseId(actor.id) || makeId(actor.role),
    name: normaliseText(actor.name) || defaultNameForRole(actor.role),
    kin: normaliseText(actor.kin),
    className: normaliseText(actor.className),
    background: normaliseText(actor.background),
    birthsign: normaliseText(actor.birthsign),
    boon: normaliseText(actor.boon),
    level,
    lifeMax,
    lifeCurrent: clampMax(Math.trunc(actor.lifeCurrent), lifeMax),
    spellUsesMax,
    spellUsesCurrent: clampMax(Math.trunc(actor.spellUsesCurrent), spellUsesMax),
    exertionMax,
    exertionCurrent: clampMax(Math.trunc(actor.exertionCurrent), exertionMax),
    disposition: Math.trunc(actor.disposition),
    weaponName: normaliseText(actor.weaponName),
    weaponDie: normaliseText(actor.weaponDie),
    weaponMaterial: Math.trunc(actor.weaponMaterial),
    armourType: actor.armourType,
    armourSaveDie: armourSaveForType(actor.armourType),
    abilities: {
      smarts: Math.trunc(actor.abilities.smarts),
      brawn: Math.trunc(actor.abilities.brawn),
      moxie: Math.trunc(actor.abilities.moxie),
      hotness: Math.trunc(actor.abilities.hotness),
    },
    statuses: Array.from(
      new Set(
        actor.statuses
          .map((status) => normaliseText(status))
          .filter((status) => status !== ""),
      ),
    ),
    movesText: normaliseText(actor.movesText),
    inventoryText: normaliseText(actor.inventoryText),
    notes: normaliseText(actor.notes),
  };
}

function createRollEntry(label: string, detail: string): RollLogEntry {
  return {
    id: makeId("roll"),
    label,
    detail,
  };
}

function pushRoll(
  state: StageChatState,
  label: string,
  detail: string,
): StageChatState {
  return {
    ...state,
    rollLog: [createRollEntry(label, detail), ...state.rollLog].slice(0, MAX_ROLL_LOG),
  };
}

function normaliseEncounter(
  encounter: EncounterState,
  actors: ActorSheet[],
): EncounterState {
  const validActorId =
    encounter.activeActorId != null &&
    actors.some((actor) => actor.id === encounter.activeActorId)
      ? encounter.activeActorId
      : actors[0]?.id ?? null;

  return {
    active: encounter.active && actors.length > 0,
    round: Math.max(1, Math.trunc(encounter.round)),
    activeActorId: encounter.active ? validActorId : null,
    surprise: encounter.surprise,
    notes: normaliseText(encounter.notes),
  };
}

function normaliseState(state: StageChatState): StageChatState {
  const actors = state.actors.map((actor) => normaliseActor(actor));
  return {
    version: 2,
    controlMode: normaliseControlMode(state.controlMode),
    actors,
    encounter: normaliseEncounter(state.encounter, actors),
    rollLog: state.rollLog.slice(0, MAX_ROLL_LOG),
    campaignNotes: normaliseText(state.campaignNotes),
  };
}

function mergeActorPatch(
  current: ActorSheet | undefined,
  patch: AutomationActorPatch,
): ActorSheet {
  const role = patch.role ?? current?.role ?? "enemy";
  const base = current ?? createActor(role);
  const mergedAbilities = patch.abilities == null
    ? base.abilities
    : {
        ...base.abilities,
        ...patch.abilities,
      };
  const mergedStatuses = patch.statuses ?? base.statuses;

  return normaliseActor({
    ...base,
    ...patch,
    role,
    id: patch.id ?? current?.id ?? base.id,
    abilities: mergedAbilities,
    statuses: mergedStatuses,
  });
}

function reorderActors(actors: ActorSheet[], actorOrder: string[]): ActorSheet[] {
  if (actorOrder.length === 0) {
    return actors;
  }

  const order = actorOrder.map((id) => normaliseId(id)).filter((id) => id !== "");
  const seen = new Set<string>();
  const ordered = order
    .map((id) => actors.find((actor) => actor.id === id))
    .filter((actor): actor is ActorSheet => actor != null)
    .filter((actor) => {
      if (seen.has(actor.id)) {
        return false;
      }
      seen.add(actor.id);
      return true;
    });
  const remainder = actors.filter((actor) => !seen.has(actor.id));
  return [...ordered, ...remainder];
}

function applyAutomationPatch(state: StageChatState, patch: AutomationPatch): StageChatState {
  let actors = [...state.actors];

  patch.upsertActors.forEach((actorPatch) => {
    const actorId = actorPatch.id != null ? normaliseId(actorPatch.id) : "";
    const index = actorId === "" ? -1 : actors.findIndex((actor) => actor.id === actorId);

    if (index === -1) {
      actors.push(mergeActorPatch(undefined, actorPatch));
      return;
    }

    actors[index] = mergeActorPatch(actors[index], actorPatch);
  });

  if (patch.removeActorIds.length > 0) {
    const removeIds = new Set(patch.removeActorIds.map((id) => normaliseId(id)));
    actors = actors.filter((actor) => !removeIds.has(actor.id));
  }

  actors = reorderActors(actors, patch.actorOrder);

  let nextState = normaliseState({
    ...state,
    ...(patch.campaignNotes !== undefined
      ? { campaignNotes: patch.campaignNotes }
      : {}),
    actors,
    encounter: {
      ...state.encounter,
      ...patch.encounter,
    },
  });

  patch.rolls.forEach((roll) => {
    nextState = pushRoll(nextState, roll.label, roll.detail);
  });

  return nextState;
}

export class Stage extends StageBase<
  null,
  StageChatState,
  StageMessageState,
  StageConfig
> {
  private chatStateData: StageChatState;
  private messageStateData: StageMessageState;
  private readonly configData: ResolvedStageConfig;
  private readonly listeners: Set<UpdateListener>;
  private uiError: string | null;

  constructor(
    data: InitialData<null, StageChatState, StageMessageState, StageConfig>,
  ) {
    super(data);
    this.chatStateData = normaliseState(data.chatState ?? createDefaultState());
    this.messageStateData = data.messageState ?? { lastInjectedSummary: null };
    this.configData = { ...DEFAULT_CONFIG, ...(data.config ?? {}) };
    this.listeners = new Set();
    this.uiError = null;
  }

  async load(): Promise<
    Partial<LoadResponse<null, StageChatState, StageMessageState>>
  > {
    return {
      success: true,
      error: null,
      initState: null,
      chatState: this.chatStateData,
      messageState: this.messageStateData,
    };
  }

  async setState(state: StageMessageState): Promise<void> {
    this.messageStateData = state ?? { lastInjectedSummary: null };
    this.emit();
  }

  async beforePrompt(
    userMessage: Message,
  ): Promise<Partial<StageResponse<StageChatState, StageMessageState>>> {
    void userMessage;
    const stageDirections = this.configData.includeStageDirections
      ? buildStageDirections(this.chatStateData, this.configData)
      : null;
    this.messageStateData = { lastInjectedSummary: stageDirections };
    return {
      stageDirections,
      messageState: this.messageStateData,
      modifiedMessage: null,
      systemMessage: null,
      error: null,
      chatState: null,
    };
  }

  async afterResponse(
    botMessage: Message,
  ): Promise<Partial<StageResponse<StageChatState, StageMessageState>>> {
    const automation = extractAutomationBlock(botMessage.content);
    const patch = automation.patch;
    let error: string | null = automation.error;

    if (patch != null) {
      if (this.chatStateData.controlMode === "system") {
        await this.mutateState((state) => applyAutomationPatch(state, patch));
      } else {
        error = "Ignored a VNV state patch because setup mode is still active.";
      }
    }

    return {
      stageDirections: null,
      messageState: this.messageStateData,
      modifiedMessage: automation.visibleContent,
      systemMessage: null,
      error,
      chatState: null,
    };
  }

  render(): ReactElement {
    return <VnvStageView stage={this} />;
  }

  getChatState(): StageChatState {
    return this.chatStateData;
  }

  getConfig(): ResolvedStageConfig {
    return this.configData;
  }

  getUiError(): string | null {
    return this.uiError;
  }

  clearUiError(): void {
    this.uiError = null;
    this.emit();
  }

  subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async setControlMode(controlMode: ControlMode): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      controlMode,
    }));
  }

  async saveActor(actor: ActorSheet): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    const nextActor = normaliseActor(actor);
    await this.mutateState((state) => {
      const index = state.actors.findIndex((entry) => entry.id === nextActor.id);
      const actors =
        index === -1
          ? [...state.actors, nextActor]
          : state.actors.map((entry) => (entry.id === nextActor.id ? nextActor : entry));
      return normaliseState({
        ...state,
        actors,
      });
    });
  }

  async addActor(role: ActorRole): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        actors: [...state.actors, createActor(role)],
      }),
    );
  }

  async duplicateActor(actorId: string): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    const actor = this.chatStateData.actors.find((entry) => entry.id === actorId);
    if (actor == null) {
      return;
    }

    const duplicate = normaliseActor({
      ...actor,
      id: makeId(actor.role),
      name: `${actor.name} Copy`,
    });

    await this.mutateState((state) =>
      normaliseState({
        ...state,
        actors: [...state.actors, duplicate],
      }),
    );
  }

  async removeActor(actorId: string): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        actors: state.actors.filter((actor) => actor.id !== actorId),
      }),
    );
  }

  async moveActor(actorId: string, direction: -1 | 1): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    await this.mutateState((state) => {
      const index = state.actors.findIndex((actor) => actor.id === actorId);
      if (index === -1) {
        return state;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= state.actors.length) {
        return state;
      }
      const actors = [...state.actors];
      const [actor] = actors.splice(index, 1);
      actors.splice(targetIndex, 0, actor);
      return normaliseState({
        ...state,
        actors,
      });
    });
  }

  async saveCampaignNotes(notes: string): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      campaignNotes: normaliseText(notes),
    }));
  }

  async setEncounterState(partial: Partial<EncounterState>): Promise<void> {
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        encounter: {
          ...state.encounter,
          ...partial,
        },
      }),
    );
  }

  async startEncounter(): Promise<void> {
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        encounter: {
          ...state.encounter,
          active: state.actors.length > 0,
          round: 1,
          activeActorId: state.actors[0]?.id ?? null,
        },
      }),
    );
  }

  async endEncounter(): Promise<void> {
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        encounter: {
          ...state.encounter,
          active: false,
          round: 1,
          activeActorId: null,
        },
      }),
    );
  }

  async nextTurn(): Promise<void> {
    await this.mutateState((state) => {
      if (state.actors.length === 0) {
        return state;
      }

      const currentIndex = state.actors.findIndex(
        (actor) => actor.id === state.encounter.activeActorId,
      );
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % state.actors.length;
      const wrapped = currentIndex !== -1 && nextIndex === 0;

      return normaliseState({
        ...state,
        encounter: {
          ...state.encounter,
          active: true,
          round: wrapped ? state.encounter.round + 1 : state.encounter.round,
          activeActorId: state.actors[nextIndex]?.id ?? null,
        },
      });
    });
  }

  async setActiveActor(actorId: string | null): Promise<void> {
    if (this.chatStateData.controlMode !== "setup") {
      return;
    }
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        encounter: {
          ...state.encounter,
          activeActorId: actorId,
        },
      }),
    );
  }

  async toggleStatus(actorId: string, status: string): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      actors: state.actors.map((actor) => {
        if (actor.id !== actorId) {
          return actor;
        }
        const hasStatus = actor.statuses.includes(status);
        return normaliseActor({
          ...actor,
          statuses: hasStatus
            ? actor.statuses.filter((entry) => entry !== status)
            : [...actor.statuses, status],
        });
      }),
    }));
  }

  async adjustLife(actorId: string, delta: number): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      actors: state.actors.map((actor) =>
        actor.id === actorId
          ? {
              ...actor,
              lifeCurrent: clamp(actor.lifeCurrent + delta, 0, actor.lifeMax),
            }
          : actor,
      ),
    }));
  }

  async adjustResource(
    actorId: string,
    resource: TrackableResource,
    delta: number,
  ): Promise<void> {
    await this.mutateState((state) => ({
      ...state,
      actors: state.actors.map((actor) => {
        if (actor.id !== actorId) {
          return actor;
        }
        if (resource === "spellUses") {
          return {
            ...actor,
            spellUsesCurrent: clamp(
              actor.spellUsesCurrent + delta,
              0,
              actor.spellUsesMax,
            ),
          };
        }
        if (resource === "exertion") {
          return {
            ...actor,
            exertionCurrent: clamp(
              actor.exertionCurrent + delta,
              0,
              actor.exertionMax,
            ),
          };
        }
        return {
          ...actor,
          disposition: actor.disposition + delta,
        };
      }),
    }));
  }

  async appendRoll(label: string, detail: string): Promise<void> {
    await this.mutateState((state) => pushRoll(state, label, detail));
  }

  async rollLoose(count: number, sides: number, label?: string): Promise<void> {
    const dice = rollDice(count, sides);
    const total = dice.reduce((sum, value) => sum + value, 0);
    const prefix = label ?? `${count}d${sides}`;
    await this.appendRoll(prefix, `${dice.join(", ")} = ${total}`);
  }

  async rollActorAbilities(actorId: string): Promise<void> {
    const abilities = rollAbilityBlock();
    const detail = `Smarts ${formatSigned(abilities.smarts)}, Brawn ${formatSigned(abilities.brawn)}, Moxie ${formatSigned(abilities.moxie)}, Hotness ${formatSigned(abilities.hotness)}`;
    await this.mutateState((state) => {
      const actors = state.actors.map((actor) =>
        actor.id === actorId ? { ...actor, abilities } : actor,
      );
      return pushRoll({ ...state, actors }, "Ability Roll", detail);
    });
  }

  async rollActorWeapon(actorId: string): Promise<void> {
    const roll = rollWeaponLoadout();
    const detail = `${roll.materialLabel} ${roll.weaponName} ${roll.weaponDie}, material bonus ${formatSigned(roll.materialBonus)}`;
    await this.mutateState((state) => {
      const actors = state.actors.map((actor) =>
        actor.id === actorId
          ? {
              ...actor,
              weaponName: roll.weaponName,
              weaponDie: roll.weaponDie,
              weaponMaterial: roll.materialBonus,
            }
          : actor,
      );
      return pushRoll({ ...state, actors }, "Weapon Roll", detail);
    });
  }

  async rollActorArmour(actorId: string): Promise<void> {
    const roll = rollArmourLoadout();
    await this.mutateState((state) => {
      const actors = state.actors.map((actor) =>
        actor.id === actorId
          ? {
              ...actor,
              armourType: roll.armourType,
              armourSaveDie: roll.armourSaveDie,
            }
          : actor,
      );
      return pushRoll(
        { ...state, actors },
        "Armour Roll",
        `${roll.armourType} armour, save ${roll.armourSaveDie}`,
      );
    });
  }

  async rollActorBirthsign(actorId: string): Promise<void> {
    const roll = rollBirthsign();
    await this.mutateState((state) => {
      const actors = state.actors.map((actor) =>
        actor.id === actorId
          ? {
              ...actor,
              birthsign: roll.sign,
              boon: roll.boon,
            }
          : actor,
      );
      return pushRoll(
        { ...state, actors },
        "Birthsign Roll",
        `${roll.sign} | Boon: ${roll.boon}`,
      );
    });
  }

  async rollActorSupply(actorId: string): Promise<void> {
    const supply = rollSupplySnippet();
    await this.mutateState((state) => {
      const actors = state.actors.map((actor) => {
        if (actor.id !== actorId) {
          return actor;
        }
        const inventoryText =
          actor.inventoryText.trim() === ""
            ? supply
            : `${actor.inventoryText}\n${supply}`;
        return {
          ...actor,
          inventoryText,
        };
      });
      return pushRoll({ ...state, actors }, "Supply Roll", supply);
    });
  }

  previewStageDirections(): string {
    const summary = buildStageDirections(this.chatStateData, this.configData);
    if (this.configData.includeStageDirections) {
      return summary;
    }
    return `Stage directions are disabled by config.\n\n${summary}`;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private async mutateState(
    mutator: (state: StageChatState) => StageChatState,
  ): Promise<void> {
    const nextState = normaliseState(mutator(this.chatStateData));
    this.chatStateData = nextState;
    this.emit();
    await this.persistChatState(nextState);
  }

  private async persistChatState(nextState: StageChatState): Promise<void> {
    try {
      await this.messenger.updateChatState(nextState);
      if (this.uiError != null) {
        this.uiError = null;
        this.emit();
      }
    } catch (error) {
      this.uiError =
        error instanceof Error ? error.message : "Failed to persist chat state.";
      this.emit();
    }
  }
}
