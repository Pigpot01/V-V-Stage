import {
  AbilityKey,
  ActorAbilities,
  ArmourType,
  LewdLevel,
} from "./types";

export interface LabelledRule {
  label: string;
  summary: string;
}

export interface BirthsignRule {
  name: string;
  personality: string;
  boons: string[];
}

export interface WeaponRoll {
  weaponName: string;
  weaponDie: string;
  materialLabel: string;
  materialBonus: number;
}

export interface ArmourRoll {
  armourType: ArmourType;
  armourSaveDie: string;
  summary: string;
}

export const CREATION_STEPS: string[] = [
  "Choose or roll your kin, then take any kin-specific bonuses manually.",
  "Roll 2d20 for racial traits if you want the full book process.",
  "Roll adventuring supplies, then a birthsign and one of its two boons.",
  "If a boon grants magic, roll a starting spell and spell uses.",
  "Roll starting weapon, armour, abilities, and life.",
  "Add background, class training, and any learned martial or magical skills.",
];

export const LEWD_LEVELS: Record<LewdLevel, string> = {
  LL1: "Treat lewd content as setting texture only. Keep the stage focused on adventure and combat.",
  LL2: "Use the game as written in a playful, messy middle ground between dungeon crawling and explicit comedy.",
  LL3: "Lean fully into the book's explicit tone, including sex as a mechanical and narrative resource.",
};

export const ABILITY_RULES: Array<{ key: AbilityKey; label: string; summary: string }> = [
  {
    key: "smarts",
    label: "Smarts",
    summary: "Cast spells, pick locks, decipher text, disarm traps, investigate.",
  },
  {
    key: "brawn",
    label: "Brawn",
    summary: "Fight, carry, push, break, intimidate, wrestle, force outcomes.",
  },
  {
    key: "moxie",
    label: "Moxie",
    summary: "Defend, resist poison, stay sober, survive pain, keep moving.",
  },
  {
    key: "hotness",
    label: "Hotness",
    summary: "Seduce, bribe, get paid, blend in, stand out, weaponise charm.",
  },
];

export const CORE_COMBAT_RULES: LabelledRule[] = [
  {
    label: "Turn Economy",
    summary: "Each combatant normally gets 1 Combat Action and 2 Tactical Actions each turn.",
  },
  {
    label: "Basic Attacks",
    summary: "Basic weapon attacks automatically hit unless a special rule says otherwise.",
  },
  {
    label: "Weapon Damage",
    summary: "Weapon damage = weapon die roll + material bonus + Brawn.",
  },
  {
    label: "Armour Save",
    summary: "When hit, roll Armour Save and add or subtract Moxie to reduce incoming damage.",
  },
  {
    label: "Downed",
    summary: "At 0 Life you are Downed. After 3 turns without help, you die.",
  },
  {
    label: "Stabilising",
    summary: "An adjacent ally can stabilise you with a Tactical Action or heal you with magic or potions.",
  },
];

export const DISTANCE_RULES: LabelledRule[] = [
  {
    label: "Adjacent",
    summary: "Melee range. A bandit in your face, or the brothel you are standing outside of.",
  },
  {
    label: "Nearby",
    summary: "One move away. The next doorway, next shop, or edge of the room.",
  },
  {
    label: "Far",
    summary: "Across the room or street. Reachable, but not immediate.",
  },
  {
    label: "Distant",
    summary: "The far wall, the temple across town, or a target needing setup to reach.",
  },
];

export const INITIATIVE_RULES: LabelledRule[] = [
  {
    label: "Preemptive",
    summary: "Acts before all players.",
  },
  {
    label: "Interspersed",
    summary: "Acts between players, starting after the player who went first.",
  },
  {
    label: "Reactive",
    summary: "Acts after all players.",
  },
  {
    label: "Rapid",
    summary: "Acts again after each player, effectively taking multiple turns per round.",
  },
];

export const ARMOUR_TABLE: Array<ArmourRoll & { roll: string }> = [
  {
    roll: "1",
    armourType: "skimpy",
    armourSaveDie: "d2",
    summary: "Barely covered at all. Best for stealth, worst for surviving stabbings.",
  },
  {
    roll: "2-3",
    armourType: "light",
    armourSaveDie: "d4",
    summary: "Simple protection over the joints and a few key areas.",
  },
  {
    roll: "4-5",
    armourType: "medium",
    armourSaveDie: "d6",
    summary: "Decent limb and torso coverage, but still plenty of gaps for knives.",
  },
  {
    roll: "6",
    armourType: "full",
    armourSaveDie: "d8",
    summary: "Good metal and leather coverage. Noisy, but much safer.",
  },
];

export const WEAPON_TABLE = [
  { name: "Dagger", die: "d4" },
  { name: "Staff", die: "d4" },
  { name: "Short Sword", die: "d4" },
  { name: "Sword", die: "d6" },
  { name: "Spear", die: "d6" },
  { name: "Hammer", die: "d6" },
  { name: "Axe", die: "d8" },
  { name: "Bow", die: "d8" },
  { name: "Maul", die: "d8" },
  { name: "Greatsword", die: "d10" },
];

export const MATERIAL_TABLE = [
  { label: "Wood", bonus: 1 },
  { label: "Stone", bonus: 1 },
  { label: "Bronze", bonus: 2 },
  { label: "Iron", bonus: 2 },
  { label: "Steel", bonus: 3 },
  { label: "Glass", bonus: 3 },
];

export const STATUS_RULES: LabelledRule[] = [
  {
    label: "Prone",
    summary: "Cannot cast spells or use martial skills until you stand up with a Tactical Action.",
  },
  {
    label: "Terrified",
    summary: "Lose 1 Tactical Action and your actions are weakened until you recover.",
  },
  {
    label: "Charmed",
    summary: "You are magically compelled; the GM or effect controller directs your turn until you resist.",
  },
  {
    label: "Restrained",
    summary: "You can only try to escape, usually with a Moxie roll or outside help.",
  },
  {
    label: "Poisoned",
    summary: "Take 1 damage whenever you use Combat or Tactical Actions until cured.",
  },
  {
    label: "Drunk",
    summary: "Most DCs become harder, but poison is cured and some effects shift in your favour.",
  },
  {
    label: "Filthy",
    summary: "Disposition checks worsen, stealth gets louder and more obvious, and poison gets nastier.",
  },
  {
    label: "Burning",
    summary: "Fire damage escalates each turn until extinguished with enough water.",
  },
  {
    label: "Dehydrated",
    summary: "Going without water starts dealing escalating damage after 24 hours.",
  },
  {
    label: "Exhausted",
    summary: "Skipping sleep lowers Smarts and Brawn, and can eventually force a collapse.",
  },
  {
    label: "Downed",
    summary: "At 0 Life you cannot act. If not stabilised or healed within 3 turns, you die.",
  },
];

export const BIRTHSIGNS: BirthsignRule[] = [
  {
    name: "Ran'di",
    personality: "Artistic, carnal, upbeat, often performers or sex workers.",
    boons: ["Roll a Light Magic spell.", "Sex is always considered Great or better."],
  },
  {
    name: "Du'di",
    personality: "Party-seekers, social, distractible, beer-bellied or gloriously overcommitted.",
    boons: ["Immune to poison.", "Roll a Death Magic spell."],
  },
  {
    name: "Iri'qi",
    personality: "Pranksters, barbarians, chaotic wanderers who laugh through trouble.",
    boons: ["Gain +1 Exertion Use.", "Gain a permanent +1 Moxie."],
  },
  {
    name: "For'ai",
    personality: "Violence-loving, competitive, often drawn to combat or hard labour.",
    boons: ["Gain +3 Life every level up.", "Gain a permanent +1 Brawn."],
  },
  {
    name: "Fid'li",
    personality: "Cynics and realists who prefer libraries over taverns.",
    boons: ["Roll a Death Magic spell.", "Roll a Light Magic spell."],
  },
  {
    name: "Sais'i",
    personality: "Beauty-seekers and aesthetes, eerie but often captivating.",
    boons: ["Roll two Light Magic spells.", "Gain a permanent +2 Hotness."],
  },
];

export const LEVEL_ONE_MAGIC: Record<string, string[]> = {
  "Death Magic": [
    "Fireball: 3d6 damage to one target and causes Burning.",
    "Adrenaline: grants yourself or an ally 1 Exertion Use.",
    "Force Pull: drag a target or object toward you; useful for theft and repositioning.",
    "Force Push: shove targets away, knock them Prone, or move willing allies and objects.",
    "Paralyse: damage a target and make them miss turns.",
    "A Spell of Your Choice: pick another Level 1 Death spell when allowed.",
  ],
  "Light Magic": [
    "Heal: restore 2d8 Life to one target.",
    "Group Heal: heal multiple allies at once.",
    "Sleep: put a target down until damaged or the effect ends.",
    "Barrier / Utility Light effects: create protective magical space or other support effects.",
    "Charm / Enthrall: sway or temporarily turn a hostile target.",
    "A Spell of Your Choice: pick another Level 1 Light spell when allowed.",
  ],
};

export const SUPPLY_SNIPPETS = [
  "A lantern and oil",
  "A pair of reading glasses",
  "Pink lipstick",
  "A spare set of handcuffs",
  "A harmonica",
  "A deck of playing cards",
  "A pair of high heels",
  "A gentleman's sex aid",
  "A small joke book",
  "A tin of worms",
  "A tackle hook on a chain",
  "A bag of yarn",
];

export const REFRACTORY_TABLE = [
  "1 hour 45 minutes",
  "1 hour 30 minutes",
  "1 hour 15 minutes",
  "1 hour",
  "45 minutes",
  "30 minutes",
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

export function rollAbilityScore(): number {
  return rollDie(6) - 4;
}

export function rollAbilityBlock(): ActorAbilities {
  return {
    smarts: rollAbilityScore(),
    brawn: rollAbilityScore(),
    moxie: rollAbilityScore(),
    hotness: rollAbilityScore(),
  };
}

export function rollWeaponLoadout(): WeaponRoll {
  const weapon = WEAPON_TABLE[rollDie(10) - 1];
  const material = MATERIAL_TABLE[rollDie(6) - 1];
  return {
    weaponName: weapon.name,
    weaponDie: weapon.die,
    materialLabel: material.label,
    materialBonus: material.bonus,
  };
}

export function rollArmourLoadout(): ArmourRoll {
  const roll = rollDie(6);
  if (roll === 1) {
    return ARMOUR_TABLE[0];
  }
  if (roll <= 3) {
    return ARMOUR_TABLE[1];
  }
  if (roll <= 5) {
    return ARMOUR_TABLE[2];
  }
  return ARMOUR_TABLE[3];
}

export function rollBirthsign(): { sign: string; boon: string } {
  const sign = BIRTHSIGNS[rollDie(6) - 1];
  const boon = sign.boons[rollDie(2) - 1];
  return { sign: sign.name, boon };
}

export function rollSupplySnippet(): string {
  return SUPPLY_SNIPPETS[rollDie(SUPPLY_SNIPPETS.length) - 1];
}

export function buildCorePromptRules(lewdLevel: LewdLevel): string[] {
  return [
    `Vice & Violence tone level: ${lewdLevel}. ${LEWD_LEVELS[lewdLevel]}`,
    "Use the V&V ability quartet: Smarts, Brawn, Moxie, Hotness.",
    "Basic attacks hit automatically unless a special rule or status says otherwise.",
    "Weapon damage is weapon die + material bonus + Brawn.",
    "Armour Save reduces damage and uses armour die plus or minus Moxie.",
    "Each combatant normally has 1 Combat Action and 2 Tactical Actions per turn.",
    "Distances are Adjacent, Nearby, Far, and Distant.",
    "At 0 Life a character is Downed; after 3 turns without stabilising or healing, they die.",
    "If a precise rule is missing, prefer GM judgement instead of inventing new stats.",
  ];
}
