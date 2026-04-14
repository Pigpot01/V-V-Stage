import {
  ActorRole,
  ActorSheet,
  ArmourType,
  InitiativeType,
  StageChatState,
} from "./types";

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function armourSaveFor(type: ArmourType): string {
  switch (type) {
    case "skimpy":
      return "d2";
    case "light":
      return "d4";
    case "medium":
      return "d6";
    case "full":
      return "d8";
  }
}

export function createActor(role: ActorRole = "player"): ActorSheet {
  const initiative: InitiativeType = role === "enemy" ? "reactive" : "manual";
  return {
    id: makeId(role),
    name: role === "enemy" ? "Enemy" : "Adventurer",
    role,
    kin: role === "enemy" ? "Monster / Humanoid" : "Human",
    className: role === "enemy" ? "Threat" : "Aspiring Adventurer",
    background: "",
    birthsign: "",
    boon: "",
    level: 0,
    lifeCurrent: 12,
    lifeMax: 12,
    spellUsesCurrent: 0,
    spellUsesMax: 0,
    exertionCurrent: 3,
    exertionMax: 3,
    disposition: role === "enemy" ? -5 : 0,
    initiative,
    weaponName: "Sword",
    weaponDie: "d6",
    weaponMaterial: 2,
    armourType: "light",
    armourSaveDie: armourSaveFor("light"),
    abilities: {
      smarts: 0,
      brawn: 0,
      moxie: 0,
      hotness: 0,
    },
    statuses: [],
    movesText: "",
    inventoryText: "",
    notes: "",
  };
}

export function createDefaultState(): StageChatState {
  const hero = createActor("player");
  hero.id = "player-main";
  hero.name = "Wyll Buttons";
  hero.kin = "Dweller";
  hero.className = "Would-Be Bard";
  hero.background = "Courier";
  hero.birthsign = "Ran'di";
  hero.boon = "Roll a Light Magic spell";
  hero.lifeCurrent = 14;
  hero.lifeMax = 14;
  hero.spellUsesCurrent = 2;
  hero.spellUsesMax = 2;
  hero.weaponName = "Short Sword";
  hero.weaponDie = "d4";
  hero.weaponMaterial = 2;
  hero.armourType = "light";
  hero.armourSaveDie = armourSaveFor("light");
  hero.abilities = { smarts: 1, brawn: -1, moxie: 2, hotness: 1 };
  hero.movesText = "The One About the Fair Maiden\nHeal";
  hero.inventoryText = "Lantern and oil\nA pair of reading glasses";

  return {
    version: 2,
    controlMode: "setup",
    actors: [hero],
    encounter: {
      active: false,
      round: 1,
      activeActorId: null,
      surprise: "none",
      notes: "",
    },
    rollLog: [],
    campaignNotes:
      "Use this stage to set up the party, then hand roster control to the system once play begins.",
  };
}
