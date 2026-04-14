import { buildCorePromptRules } from "./rules";
import { ActorSheet, EncounterState, LewdLevel, StageChatState } from "./types";

export interface ResolvedStageConfig {
  includeStageDirections: boolean;
  compactPromptSummary: boolean;
  lewdLevel: LewdLevel;
}

export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function describeAttack(actor: ActorSheet): string {
  return `${actor.weaponName} ${actor.weaponDie} + material ${formatSigned(actor.weaponMaterial)} + Brawn ${formatSigned(actor.abilities.brawn)}`;
}

export function describeArmour(actor: ActorSheet): string {
  return `${actor.armourType} armour, save ${actor.armourSaveDie}, Moxie ${formatSigned(actor.abilities.moxie)}`;
}

function formatRole(actor: ActorSheet): string {
  return `${actor.role.toUpperCase()} | ${actor.controller === "system" ? "system-controlled" : "player-controlled"} | ${actor.kin} | ${actor.className} | level ${actor.level}`;
}

function formatResources(actor: ActorSheet): string {
  return `Life ${actor.lifeCurrent}/${actor.lifeMax}; Spell Uses ${actor.spellUsesCurrent}/${actor.spellUsesMax}; Exertion ${actor.exertionCurrent}/${actor.exertionMax}; Disposition ${formatSigned(actor.disposition)}`;
}

function formatAbilities(actor: ActorSheet): string {
  return `Smarts ${formatSigned(actor.abilities.smarts)}, Brawn ${formatSigned(actor.abilities.brawn)}, Moxie ${formatSigned(actor.abilities.moxie)}, Hotness ${formatSigned(actor.abilities.hotness)}`;
}

function compactActorLine(actor: ActorSheet): string {
  const statuses = actor.statuses.length > 0 ? ` | Statuses: ${actor.statuses.join(", ")}` : "";
  const sign = actor.birthsign !== "" ? ` | Birthsign: ${actor.birthsign}` : "";
  const backstory = actor.backstory.trim() !== ""
    ? ` | Backstory: ${actor.backstory.trim().replace(/\n+/g, " | ")}`
    : "";
  return `[${actor.id}] ${actor.name}: ${formatRole(actor)} | ${formatResources(actor)} | ${formatAbilities(actor)} | Attack ${describeAttack(actor)} | ${describeArmour(actor)}${sign}${statuses}${backstory}`;
}

function fullActorBlock(actor: ActorSheet): string {
  const lines = [
    `${actor.name}`,
    `Ref: ${actor.id}`,
    `Role: ${formatRole(actor)}`,
    `Resources: ${formatResources(actor)}`,
    `Abilities: ${formatAbilities(actor)}`,
    `Attack: ${describeAttack(actor)}`,
    `Armour: ${describeArmour(actor)}`,
    actor.birthsign !== "" ? `Birthsign: ${actor.birthsign}` : "",
    actor.boon !== "" ? `Boon: ${actor.boon}` : "",
    actor.background !== "" ? `Background: ${actor.background}` : "",
    actor.backstory.trim() !== "" ? `Backstory: ${actor.backstory.trim().replace(/\n+/g, " | ")}` : "",
    actor.movesText.trim() !== "" ? `Moves and Spells: ${actor.movesText.trim().replace(/\n+/g, " | ")}` : "",
    actor.inventoryText.trim() !== "" ? `Inventory: ${actor.inventoryText.trim().replace(/\n+/g, " | ")}` : "",
    actor.notes.trim() !== "" ? `Notes: ${actor.notes.trim().replace(/\n+/g, " | ")}` : "",
    actor.statuses.length > 0 ? `Statuses: ${actor.statuses.join(", ")}` : "",
  ];
  return lines.filter((line) => line !== "").join("\n");
}

export function buildActorPromptSummary(actor: ActorSheet, compact: boolean): string {
  return compact ? compactActorLine(actor) : fullActorBlock(actor);
}

export function buildEncounterPromptSummary(
  encounter: EncounterState,
  actors: ActorSheet[],
): string {
  if (!encounter.active) {
    return "Encounter tracker is currently inactive.";
  }

  const activeActor = actors.find((actor) => actor.id === encounter.activeActorId);
  const turnOrder = actors.map((actor) => actor.name).join(" -> ");
  const parts = [
    `Encounter active. Round ${encounter.round}.`,
    `Surprise: ${encounter.surprise}.`,
    activeActor != null ? `Current actor: ${activeActor.name}.` : "Current actor: not set.",
    turnOrder !== "" ? `Turn order: ${turnOrder}.` : "Turn order is empty.",
  ];
  if (encounter.notes.trim() !== "") {
    parts.push(`Encounter notes: ${encounter.notes.trim().replace(/\n+/g, " | ")}.`);
  }
  return parts.join(" ");
}

export function buildStageDirections(
  state: StageChatState,
  config: ResolvedStageConfig,
): string {
  const sections: string[] = [];
  sections.push("Use the following Vice & Violence stage state as the authoritative mechanics reference for this scene.");
  sections.push(buildCorePromptRules(config.lewdLevel).join("\n"));
  sections.push(
    state.controlMode === "setup"
      ? "Control mode: setup. The player is still defining the party manually, so do not append system state patches."
      : [
          "Control mode: system. The player no longer manages enemies, roster composition, or turn order manually.",
          "When state should change, append a hidden JSON block after your visible reply in exactly this format:",
          "<<VNV_STATE>>",
          '{"upsertActors":[{"id":"enemy-bandit-1","role":"enemy","name":"Bandit"}],"removeActorIds":[],"actorOrder":["player-main","enemy-bandit-1"],"encounter":{"active":true,"round":1,"activeActorId":"player-main","surprise":"none"},"rolls":[{"label":"Bandit attack","detail":"d8 + material 1 + Brawn 1 = 7"}]}',
          "<</VNV_STATE>>",
          "Use valid JSON only. Omit keys that did not change. Actor ids in brackets are the refs to update. For actors, `statuses` replaces the full status list and `abilities` may contain only the changed ability scores.",
          "Only choose actions for enemies and for allies or NPCs marked as system-controlled. Treat player-controlled allies and NPCs like player characters: you may report consequences that happen to them, but do not volunteer their decisions without user input.",
        ].join("\n"),
  );
  sections.push(`Campaign notes: ${state.campaignNotes.trim() !== "" ? state.campaignNotes.trim().replace(/\n+/g, " | ") : "None."}`);
  sections.push(buildEncounterPromptSummary(state.encounter, state.actors));
  if (state.actors.length > 0) {
    const actorHeader = config.compactPromptSummary ? "Tracked actors:" : "Tracked actors:\n";
    const actorBlocks = state.actors
      .map((actor) => buildActorPromptSummary(actor, config.compactPromptSummary))
      .join(config.compactPromptSummary ? "\n" : "\n\n");
    sections.push(`${actorHeader}${actorBlocks}`);
  } else {
    sections.push("Tracked actors: none.");
  }
  return sections.join("\n\n");
}
