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
  ActorRole,
  ActorSheet,
  EncounterState,
  RollLogEntry,
  StageChatState,
  StageConfig,
  StageMessageState,
} from "./types";
import { VnvStageView } from "./VnvStageView";

type UpdateListener = () => void;
type TrackableResource = "spellUses" | "exertion" | "disposition";

const DEFAULT_CONFIG: ResolvedStageConfig = {
  includeStageDirections: true,
  compactPromptSummary: true,
  lewdLevel: "LL2",
};

const MAX_ROLL_LOG = 24;

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseText(value: string): string {
  return value.replace(/\r/g, "").trim();
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
    id: actor.id || makeId(actor.role),
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
    version: 1,
    actors,
    encounter: normaliseEncounter(state.encounter, actors),
    rollLog: state.rollLog.slice(0, MAX_ROLL_LOG),
    campaignNotes: normaliseText(state.campaignNotes),
  };
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
    void botMessage;
    return {
      stageDirections: null,
      messageState: this.messageStateData,
      modifiedMessage: null,
      systemMessage: null,
      error: null,
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

  async saveActor(actor: ActorSheet): Promise<void> {
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
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        actors: [...state.actors, createActor(role)],
      }),
    );
  }

  async duplicateActor(actorId: string): Promise<void> {
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
    await this.mutateState((state) =>
      normaliseState({
        ...state,
        actors: state.actors.filter((actor) => actor.id !== actorId),
      }),
    );
  }

  async moveActor(actorId: string, direction: -1 | 1): Promise<void> {
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
