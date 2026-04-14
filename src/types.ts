export type AbilityKey = "smarts" | "brawn" | "moxie" | "hotness";

export type ActorRole = "player" | "ally" | "enemy" | "npc";

export type ArmourType = "skimpy" | "light" | "medium" | "full";

export type InitiativeType =
  | "manual"
  | "preemptive"
  | "interspersed"
  | "reactive"
  | "rapid";

export type LewdLevel = "LL1" | "LL2" | "LL3";
export type ControlMode = "setup" | "system";

export interface ActorAbilities {
  smarts: number;
  brawn: number;
  moxie: number;
  hotness: number;
}

export interface ActorSheet {
  id: string;
  name: string;
  role: ActorRole;
  kin: string;
  className: string;
  background: string;
  birthsign: string;
  boon: string;
  level: number;
  lifeCurrent: number;
  lifeMax: number;
  spellUsesCurrent: number;
  spellUsesMax: number;
  exertionCurrent: number;
  exertionMax: number;
  disposition: number;
  initiative: InitiativeType;
  weaponName: string;
  weaponDie: string;
  weaponMaterial: number;
  armourType: ArmourType;
  armourSaveDie: string;
  abilities: ActorAbilities;
  statuses: string[];
  movesText: string;
  inventoryText: string;
  notes: string;
}

export interface EncounterState {
  active: boolean;
  round: number;
  activeActorId: string | null;
  surprise: "none" | "party" | "enemy";
  notes: string;
}

export interface RollLogEntry {
  id: string;
  label: string;
  detail: string;
}

export interface StageChatState {
  version: number;
  controlMode: ControlMode;
  actors: ActorSheet[];
  encounter: EncounterState;
  rollLog: RollLogEntry[];
  campaignNotes: string;
}

export interface StageMessageState {
  lastInjectedSummary: string | null;
}

export interface StageConfig {
  includeStageDirections?: boolean;
  compactPromptSummary?: boolean;
  lewdLevel?: LewdLevel;
}
