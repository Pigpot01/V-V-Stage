import { useEffect, useState } from "react";
import {
  ABILITY_RULES,
  ARMOUR_TABLE,
  BIRTHSIGNS,
  CORE_COMBAT_RULES,
  CREATION_STEPS,
  DISTANCE_RULES,
  INITIATIVE_RULES,
  LEVEL_ONE_MAGIC,
  MATERIAL_TABLE,
  REFRACTORY_TABLE,
  STATUS_RULES,
  WEAPON_TABLE,
} from "./rules";
import { describeArmour, describeAttack, formatSigned } from "./stageText";
import type { Stage } from "./Stage";
import {
  ActorController,
  ActorRole,
  ActorSheet,
  ArmourType,
  ControlMode,
  InitiativeType,
  RollLogEntry,
} from "./types";

type TabKey = "builder" | "encounter" | "reference";

const ROLE_OPTIONS: ActorRole[] = ["player", "ally", "enemy", "npc"];
const SETUP_ROLE_OPTIONS: ActorRole[] = ["player", "ally", "npc"];
const INITIATIVE_OPTIONS: InitiativeType[] = [
  "manual",
  "preemptive",
  "interspersed",
  "reactive",
  "rapid",
];
const ARMOUR_OPTIONS: ArmourType[] = ["skimpy", "light", "medium", "full"];

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneActor(actor: ActorSheet): ActorSheet {
  return {
    ...actor,
    abilities: { ...actor.abilities },
    statuses: [...actor.statuses],
  };
}

function actorFromFingerprint(fingerprint: string): ActorSheet {
  return JSON.parse(fingerprint) as ActorSheet;
}

function armourSaveForType(armourType: ArmourType): string {
  return ARMOUR_TABLE.find((entry) => entry.armourType === armourType)?.armourSaveDie ?? "d4";
}

function niceRole(role: ActorRole): string {
  switch (role) {
    case "ally":
      return "Ally";
    case "enemy":
      return "Enemy";
    case "npc":
      return "NPC";
    case "player":
    default:
      return "Player";
  }
}

function actorControllerLabel(controller: ActorController): string {
  return controller === "system" ? "AI" : "Player";
}

function controllerForRole(
  role: ActorRole,
  current: ActorController,
): ActorController {
  if (role === "enemy") {
    return "system";
  }
  if (role === "player") {
    return "player";
  }
  return current === "system" ? "system" : "player";
}

function scalePercentLabel(uiScale: number): string {
  return `${Math.round(uiScale * 100)}%`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText != null) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      void error;
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch (error) {
    void error;
    return false;
  } finally {
    textarea.remove();
  }
}

function tabLabel(tab: TabKey): string {
  switch (tab) {
    case "builder":
      return "Builder";
    case "encounter":
      return "Encounter";
    case "reference":
      return "Reference";
  }
}

function controlModeLabel(controlMode: ControlMode): string {
  return controlMode === "setup" ? "Setup Open" : "System Control";
}

interface VnvStageViewProps {
  stage: Stage;
}

export function VnvStageView({ stage }: VnvStageViewProps) {
  const [, setRevision] = useState(0);
  const [tab, setTab] = useState<TabKey>("builder");
  const chatState = stage.getChatState();
  const config = stage.getConfig();
  const uiError = stage.getUiError();
  const uiScale = stage.getUiScale();
  const uiCollapsed = stage.getUiCollapsed();
  const [campaignNotesDraft, setCampaignNotesDraft] = useState(chatState.campaignNotes);
  const [encounterNotesDraft, setEncounterNotesDraft] = useState(chatState.encounter.notes);
  const [transferDraft, setTransferDraft] = useState("");
  const [importDraft, setImportDraft] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy code");
  const scaleStyle = { "--ui-scale": uiScale } as any;

  useEffect(() => stage.subscribe(() => setRevision((value) => value + 1)), [stage]);
  useEffect(() => setCampaignNotesDraft(chatState.campaignNotes), [chatState.campaignNotes]);
  useEffect(() => setEncounterNotesDraft(chatState.encounter.notes), [chatState.encounter.notes]);
  useEffect(() => setCopyLabel("Copy code"), [transferDraft]);

  return (
    <div className="vnv-shell">
      <div className={`vnv-dock${uiCollapsed ? " is-collapsed" : ""}`}>
        <div className="vnv-dock-edge">
          <button
            type="button"
            className="vnv-dock-toggle"
            onClick={() => stage.setUiCollapsed(!uiCollapsed)}
            aria-label={uiCollapsed ? "Expand stage" : "Collapse stage"}
            title={uiCollapsed ? "Expand stage" : "Collapse stage"}
          >
            {uiCollapsed ? "<" : ">"}
          </button>
          {uiCollapsed ? <span className="vnv-dock-label">Stage hidden</span> : null}
        </div>

        <div className="vnv-dock-panel">
          {uiError != null ? (
            <div className="banner banner-error">
              <span>{uiError}</span>
              <button type="button" onClick={() => stage.clearUiError()}>
                Dismiss
              </button>
            </div>
          ) : null}

          <section className="panel vnv-toolbar">
            <div>
              <p className="eyebrow">Vice & Violence Utility</p>
              <h2>Builder and transfer companion</h2>
              <p className="small-copy">
                Use this visible utility stage to build sheets and export transfer codes. The hidden
                background stage handles prompt injection in the actual RP chat.
              </p>
            </div>
            <div className="toolbar-actions">
              <div className="scale-card">
                <span>UI scale</span>
                <div className="scale-row">
                  <input
                    type="range"
                    min={0.75}
                    max={1.3}
                    step={0.05}
                    value={uiScale}
                    onChange={(event) => stage.setUiScale(Number(event.target.value))}
                  />
                  <strong>{scalePercentLabel(uiScale)}</strong>
                </div>
              </div>
            </div>
          </section>

          <div className="vnv-scale-shell" style={scaleStyle}>
            <header className="vnv-hero">
              <div>
                <p className="eyebrow">Utility Stage</p>
                <h1>Sheets, combat state, and transfer tools</h1>
                <p className="hero-copy">
                  Party setup, initiative planning, and reusable transfer codes for the hidden
                  mechanics stage.
                </p>
              </div>
              <div className="hero-stats">
                <div className="stat-chip">
                  <span>Lewd level</span>
                  <strong>{config.lewdLevel}</strong>
                </div>
                <div className="stat-chip">
                  <span>Stage directions</span>
                  <strong>{config.includeStageDirections ? "On" : "Off"}</strong>
                </div>
                <div className="stat-chip">
                  <span>Tracked actors</span>
                  <strong>{chatState.actors.length}</strong>
                </div>
                <div className="stat-chip">
                  <span>Control mode</span>
                  <strong>{controlModeLabel(chatState.controlMode)}</strong>
                </div>
                <div className="stat-chip">
                  <span>Encounter</span>
                  <strong>{chatState.encounter.active ? `Round ${chatState.encounter.round}` : "Idle"}</strong>
                </div>
              </div>
            </header>

            <nav className="vnv-tabs">
              {(["builder", "encounter", "reference"] as TabKey[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === tab ? "is-active" : ""}
                  onClick={() => setTab(value)}
                >
                  {tabLabel(value)}
                </button>
              ))}
            </nav>

            <div className="vnv-layout">
              <section className="vnv-main">
                {tab === "builder" ? (
                  <BuilderPanel
                    stage={stage}
                    actors={chatState.actors}
                    controlMode={chatState.controlMode}
                    campaignNotesDraft={campaignNotesDraft}
                    setCampaignNotesDraft={setCampaignNotesDraft}
                    transferDraft={transferDraft}
                    setTransferDraft={setTransferDraft}
                    importDraft={importDraft}
                    setImportDraft={setImportDraft}
                    copyLabel={copyLabel}
                    onCopyTransfer={async () => {
                      if (transferDraft.trim() === "") {
                        return;
                      }
                      const copied = await copyTextToClipboard(transferDraft);
                      setCopyLabel(copied ? "Copied" : "Copy failed");
                    }}
                  />
                ) : null}
                {tab === "encounter" ? (
                  <EncounterPanel
                    stage={stage}
                    controlMode={chatState.controlMode}
                    encounterNotesDraft={encounterNotesDraft}
                    setEncounterNotesDraft={setEncounterNotesDraft}
                  />
                ) : null}
                {tab === "reference" ? <ReferencePanel /> : null}
              </section>

              <aside className="vnv-side">
                <DiceTray stage={stage} />
                <RollLog entries={chatState.rollLog} />
                <PromptPreview preview={stage.previewStageDirections()} />
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BuilderPanelProps {
  stage: Stage;
  actors: ActorSheet[];
  controlMode: ControlMode;
  campaignNotesDraft: string;
  setCampaignNotesDraft: (value: string) => void;
  transferDraft: string;
  setTransferDraft: (value: string) => void;
  importDraft: string;
  setImportDraft: (value: string) => void;
  copyLabel: string;
  onCopyTransfer: () => Promise<void>;
}

function BuilderPanel({
  stage,
  actors,
  controlMode,
  campaignNotesDraft,
  setCampaignNotesDraft,
  transferDraft,
  setTransferDraft,
  importDraft,
  setImportDraft,
  copyLabel,
  onCopyTransfer,
}: BuilderPanelProps) {
  const isSetup = controlMode === "setup";

  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Party Builder</p>
            <h2>Roster and notes</h2>
            <p className="small-copy">
              {isSetup
                ? "Add player characters, allies, and NPCs here. Export them as text codes and paste codes into the importer at the bottom."
                : "Roster edits are locked. The model now owns enemy creation, roster changes, and turn-order reshuffling. Browser backup stays active across refreshes."}
            </p>
          </div>
          <div className="button-row">
            {SETUP_ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                disabled={!isSetup}
                onClick={() => void stage.addActor(role)}
              >
                Add {niceRole(role)}
              </button>
            ))}
            <button type="button" onClick={() => setTransferDraft(stage.createRosterTransferCode())}>
              Export Roster Code
            </button>
            <button
              type="button"
              onClick={() => void stage.setControlMode(isSetup ? "system" : "setup")}
            >
              {isSetup ? "Hand Off To System" : "Return To Setup"}
            </button>
          </div>
        </div>
        <label className="field field-wide">
          <span>Campaign notes</span>
          <textarea
            rows={4}
            value={campaignNotesDraft}
            onChange={(event) => setCampaignNotesDraft(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button type="button" onClick={() => void stage.saveCampaignNotes(campaignNotesDraft)}>
            Save notes
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Actors</p>
            <h2>Edit tracked sheets</h2>
          </div>
        </div>
        <div className="card-grid">
          {actors.map((actor) => (
            <ActorEditorCard
              key={actor.id}
              actor={actor}
              stage={stage}
              controlMode={controlMode}
              setTransferDraft={setTransferDraft}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Transfer</p>
            <h2>Export and import codes</h2>
            <p className="small-copy">
              Exported code can be copied into notes, documents, or another chat. The importer accepts a single
              character code or a full roster code.
            </p>
          </div>
          <div className="button-row">
            <button
              type="button"
              disabled={transferDraft.trim() === ""}
              onClick={() => void onCopyTransfer()}
            >
              {copyLabel}
            </button>
            <button type="button" onClick={() => setTransferDraft("")}>
              Clear export
            </button>
          </div>
        </div>
        <div className="transfer-grid">
          <label className="field">
            <span>Exported code</span>
            <textarea
              rows={14}
              value={transferDraft}
              readOnly
              placeholder="Export a roster or actor to generate reusable code here."
            />
          </label>
          <label className="field">
            <span>Character importer</span>
            <textarea
              rows={14}
              value={importDraft}
              onChange={(event) => setImportDraft(event.target.value)}
              placeholder='Paste a {"format":"vnv-actor"...} or {"format":"vnv-roster"...} block here.'
            />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            disabled={!isSetup || importDraft.trim() === ""}
            onClick={() => void stage.importCharacterText(importDraft)}
          >
            Import pasted code
          </button>
          <button type="button" onClick={() => setImportDraft("")}>
            Clear importer
          </button>
        </div>
      </section>
    </div>
  );
}

interface ActorEditorCardProps {
  actor: ActorSheet;
  stage: Stage;
  controlMode: ControlMode;
  setTransferDraft: (value: string) => void;
}

function ActorEditorCard({ actor, stage, controlMode, setTransferDraft }: ActorEditorCardProps) {
  const actorFingerprint = JSON.stringify(actor);
  const [draft, setDraft] = useState<ActorSheet>(() => cloneActor(actor));
  const editable = controlMode === "setup";
  const controllerEditable = draft.role === "ally" || draft.role === "npc";

  useEffect(() => {
    setDraft(actorFromFingerprint(actorFingerprint));
  }, [actorFingerprint]);

  function updateField<Key extends keyof ActorSheet>(key: Key, value: ActorSheet[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateAbility(
    key: keyof ActorSheet["abilities"],
    value: number,
  ) {
    setDraft((current) => ({
      ...current,
      abilities: {
        ...current.abilities,
        [key]: value,
      },
    }));
  }

  return (
    <article className={`actor-card${editable ? "" : " is-locked"}`}>
      <div className="actor-card-top">
        <div>
          <p className="eyebrow">{niceRole(actor.role)}</p>
          <h3>{actor.name}</h3>
          <p className="small-copy">Ref {actor.id}</p>
          <p className="small-copy">{actorControllerLabel(actor.controller)} controls this actor.</p>
          {!editable ? <p className="small-copy">System-managed during play.</p> : null}
        </div>
        <div className="button-row">
          <button
            type="button"
            onClick={() => setTransferDraft(stage.createActorTransferCode(draft))}
          >
            Export code
          </button>
          {editable ? (
            <>
            <button type="button" onClick={() => void stage.saveActor(draft)}>
              Save
            </button>
            <button type="button" onClick={() => void stage.duplicateActor(actor.id)}>
              Duplicate
            </button>
            <button type="button" onClick={() => void stage.resetActorSheet(actor.id)}>
              Reset sheet
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => void stage.removeActor(actor.id)}
            >
              Remove
            </button>
            </>
          ) : null}
        </div>
      </div>

      <fieldset className="actor-editor-fields" disabled={!editable}>
      <div className="field-grid">
        <label className="field">
          <span>Name</span>
          <input value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <select
            value={draft.role}
            onChange={(event) => {
              const role = event.target.value as ActorRole;
              setDraft((current) => ({
                ...current,
                role,
                controller: controllerForRole(role, current.controller),
              }));
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {niceRole(role)}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>AI controls this actor</span>
          {controllerEditable ? (
            <div className="segmented-control">
              <button
                type="button"
                className={draft.controller === "player" ? "is-active" : ""}
                onClick={() => updateField("controller", "player")}
              >
                No
              </button>
              <button
                type="button"
                className={draft.controller === "system" ? "is-active" : ""}
                onClick={() => updateField("controller", "system")}
              >
                Yes
              </button>
            </div>
          ) : (
            <div className="readout">
              {draft.role === "enemy" ? "Yes" : "No"}
            </div>
          )}
        </div>
        <label className="field">
          <span>Kin</span>
          <input value={draft.kin} onChange={(event) => updateField("kin", event.target.value)} />
        </label>
        <label className="field">
          <span>Class</span>
          <input
            value={draft.className}
            onChange={(event) => updateField("className", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Background</span>
          <input
            value={draft.background}
            onChange={(event) => updateField("background", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Level</span>
          <input
            type="number"
            value={draft.level}
            onChange={(event) => updateField("level", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Birthsign</span>
          <input
            value={draft.birthsign}
            onChange={(event) => updateField("birthsign", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Boon</span>
          <input value={draft.boon} onChange={(event) => updateField("boon", event.target.value)} />
        </label>
        <label className="field">
          <span>Initiative</span>
          <select
            value={draft.initiative}
            onChange={(event) =>
              updateField("initiative", event.target.value as InitiativeType)
            }
          >
            {INITIATIVE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Disposition</span>
          <input
            type="number"
            value={draft.disposition}
            onChange={(event) => updateField("disposition", numberValue(event.target.value))}
          />
        </label>
      </div>

      <div className="field-grid resources-grid">
        <label className="field">
          <span>Life current</span>
          <input
            type="number"
            value={draft.lifeCurrent}
            onChange={(event) => updateField("lifeCurrent", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Life max</span>
          <input
            type="number"
            value={draft.lifeMax}
            onChange={(event) => updateField("lifeMax", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Spell current</span>
          <input
            type="number"
            value={draft.spellUsesCurrent}
            onChange={(event) =>
              updateField("spellUsesCurrent", numberValue(event.target.value))
            }
          />
        </label>
        <label className="field">
          <span>Spell max</span>
          <input
            type="number"
            value={draft.spellUsesMax}
            onChange={(event) => updateField("spellUsesMax", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Exertion current</span>
          <input
            type="number"
            value={draft.exertionCurrent}
            onChange={(event) =>
              updateField("exertionCurrent", numberValue(event.target.value))
            }
          />
        </label>
        <label className="field">
          <span>Exertion max</span>
          <input
            type="number"
            value={draft.exertionMax}
            onChange={(event) => updateField("exertionMax", numberValue(event.target.value))}
          />
        </label>
      </div>

      <div className="field-grid resources-grid">
        <label className="field">
          <span>Smarts</span>
          <input
            type="number"
            value={draft.abilities.smarts}
            onChange={(event) => updateAbility("smarts", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Brawn</span>
          <input
            type="number"
            value={draft.abilities.brawn}
            onChange={(event) => updateAbility("brawn", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Moxie</span>
          <input
            type="number"
            value={draft.abilities.moxie}
            onChange={(event) => updateAbility("moxie", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Hotness</span>
          <input
            type="number"
            value={draft.abilities.hotness}
            onChange={(event) => updateAbility("hotness", numberValue(event.target.value))}
          />
        </label>
      </div>

      <div className="field-grid resources-grid">
        <label className="field">
          <span>Weapon</span>
          <input
            value={draft.weaponName}
            onChange={(event) => updateField("weaponName", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Weapon die</span>
          <input
            value={draft.weaponDie}
            onChange={(event) => updateField("weaponDie", event.target.value)}
          />
        </label>
        <label className="field">
          <span>Material bonus</span>
          <input
            type="number"
            value={draft.weaponMaterial}
            onChange={(event) => updateField("weaponMaterial", numberValue(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Armour</span>
          <select
            value={draft.armourType}
            onChange={(event) => {
              const armourType = event.target.value as ArmourType;
              setDraft((current) => ({
                ...current,
                armourType,
                armourSaveDie: armourSaveForType(armourType),
              }));
            }}
          >
            {ARMOUR_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="formula-grid">
        <div className="formula-box">
          <span>Attack formula</span>
          <strong>{describeAttack(draft)}</strong>
        </div>
        <div className="formula-box">
          <span>Armour formula</span>
          <strong>{describeArmour(draft)}</strong>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => void stage.rollActorFullBuild(actor.id)}>
          Roll full build
        </button>
        <button type="button" onClick={() => void stage.rollActorAbilities(actor.id)}>
          Roll abilities
        </button>
        <button type="button" onClick={() => void stage.rollActorWeapon(actor.id)}>
          Roll weapon
        </button>
        <button type="button" onClick={() => void stage.rollActorArmour(actor.id)}>
          Roll armour
        </button>
        <button type="button" onClick={() => void stage.rollActorBirthsign(actor.id)}>
          Roll birthsign
        </button>
        <button type="button" onClick={() => void stage.rollActorSupply(actor.id)}>
          Roll supply
        </button>
      </div>
      <p className="small-copy">
        Full build resets the random sheet fields before rerolling them. Supply rerolls replace the old
        supply block instead of stacking it.
      </p>
      <label className="field field-wide">
        <span>Moves and spells</span>
        <textarea
          rows={4}
          value={draft.movesText}
          onChange={(event) => updateField("movesText", event.target.value)}
        />
      </label>
      <label className="field field-wide">
        <span>Inventory</span>
        <textarea
          rows={4}
          value={draft.inventoryText}
          onChange={(event) => updateField("inventoryText", event.target.value)}
        />
      </label>
      <label className="field field-wide">
        <span>Long backstory (optional)</span>
        <textarea
          rows={7}
          value={draft.backstory}
          onChange={(event) => updateField("backstory", event.target.value)}
        />
      </label>
      <label className="field field-wide">
        <span>Notes</span>
        <textarea
          rows={4}
          value={draft.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </label>
      </fieldset>
      <div className="status-strip">
        <span className="status-label">Statuses</span>
        {actor.statuses.length > 0 ? (
          actor.statuses.map((status) => (
            <span key={status} className="status-chip on">
              {status}
            </span>
          ))
        ) : (
          <span className="status-empty">None tracked</span>
        )}
      </div>
    </article>
  );
}

interface EncounterPanelProps {
  stage: Stage;
  controlMode: ControlMode;
  encounterNotesDraft: string;
  setEncounterNotesDraft: (value: string) => void;
}

function EncounterPanel({
  stage,
  controlMode,
  encounterNotesDraft,
  setEncounterNotesDraft,
}: EncounterPanelProps) {
  const chatState = stage.getChatState();
  const encounter = chatState.encounter;
  const isSetup = controlMode === "setup";

  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Encounter Control</p>
            <h2>Round state and surprise</h2>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => void stage.startEncounter()}>
              Start encounter
            </button>
            <button type="button" onClick={() => void stage.nextTurn()}>
              Next turn
            </button>
            <button type="button" onClick={() => void stage.endEncounter()}>
              End encounter
            </button>
          </div>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Encounter active</span>
            <div className="readout">{encounter.active ? "Yes" : "No"}</div>
          </label>
          <label className="field">
            <span>Round</span>
            <div className="readout">{encounter.round}</div>
          </label>
          <label className="field">
            <span>Surprise</span>
            <select
              value={encounter.surprise}
              onChange={(event) =>
                void stage.setEncounterState({
                  surprise: event.target.value as "none" | "party" | "enemy",
                })
              }
            >
              <option value="none">none</option>
              <option value="party">party</option>
              <option value="enemy">enemy</option>
            </select>
          </label>
        </div>

        <label className="field field-wide">
          <span>Encounter notes</span>
          <textarea
            rows={4}
            value={encounterNotesDraft}
            onChange={(event) => setEncounterNotesDraft(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            onClick={() => void stage.setEncounterState({ notes: encounterNotesDraft })}
          >
            Save encounter notes
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Turn Order</p>
            <h2>{isSetup ? "Manual control" : "System-managed order"}</h2>
            <p className="small-copy">
              {isSetup
                ? "You can still set initiative order by hand while building the encounter."
                : "The model should now adjust roster order and active turns through hidden state patches. These controls stay locked."}
            </p>
          </div>
        </div>
        <div className="encounter-list">
          {chatState.actors.map((actor) => {
            const isActive = encounter.activeActorId === actor.id;
            return (
              <article key={actor.id} className={`encounter-card${isActive ? " active" : ""}`}>
                <div className="encounter-top">
                  <div>
                    <p className="eyebrow">{actor.initiative}</p>
                    <h3>{actor.name}</h3>
                    <p className="small-copy">
                      {niceRole(actor.role)} | {actorControllerLabel(actor.controller)} control | {actor.className} | Life {actor.lifeCurrent}/
                      {actor.lifeMax}
                    </p>
                  </div>
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={!isSetup}
                      onClick={() => void stage.setActiveActor(actor.id)}
                    >
                      Make active
                    </button>
                    <button
                      type="button"
                      disabled={!isSetup}
                      onClick={() => void stage.moveActor(actor.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={!isSetup}
                      onClick={() => void stage.moveActor(actor.id, 1)}
                    >
                      Down
                    </button>
                  </div>
                </div>

                <div className="meter-row">
                  <div className="meter-box">
                    <span>Life</span>
                    <strong>
                      {actor.lifeCurrent}/{actor.lifeMax}
                    </strong>
                    <div className="button-row">
                      <button type="button" onClick={() => void stage.adjustLife(actor.id, -1)}>
                        -1
                      </button>
                      <button type="button" onClick={() => void stage.adjustLife(actor.id, 1)}>
                        +1
                      </button>
                    </div>
                  </div>
                  <div className="meter-box">
                    <span>Spell Uses</span>
                    <strong>
                      {actor.spellUsesCurrent}/{actor.spellUsesMax}
                    </strong>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "spellUses", -1)}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "spellUses", 1)}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                  <div className="meter-box">
                    <span>Exertion</span>
                    <strong>
                      {actor.exertionCurrent}/{actor.exertionMax}
                    </strong>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "exertion", -1)}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "exertion", 1)}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                  <div className="meter-box">
                    <span>Disposition</span>
                    <strong>{formatSigned(actor.disposition)}</strong>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "disposition", -1)}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => void stage.adjustResource(actor.id, "disposition", 1)}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>

                <div className="status-strip">
                  {STATUS_RULES.map((status) => {
                    const enabled = actor.statuses.includes(status.label);
                    return (
                      <button
                        key={status.label}
                        type="button"
                        className={`status-chip${enabled ? " on" : ""}`}
                        onClick={() => void stage.toggleStatus(actor.id, status.label)}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReferencePanel() {
  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">OCR Rules Digest</p>
            <h2>Core procedure</h2>
          </div>
        </div>
        <ol className="number-list">
          {CREATION_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="panel two-column">
        <RuleSection title="Abilities" items={ABILITY_RULES.map((rule) => `${rule.label}: ${rule.summary}`)} />
        <RuleSection title="Combat" items={CORE_COMBAT_RULES.map((rule) => `${rule.label}: ${rule.summary}`)} />
      </section>

      <section className="panel three-column">
        <RuleSection title="Distance" items={DISTANCE_RULES.map((rule) => `${rule.label}: ${rule.summary}`)} />
        <RuleSection title="Initiative" items={INITIATIVE_RULES.map((rule) => `${rule.label}: ${rule.summary}`)} />
        <RuleSection
          title="Status Effects"
          items={STATUS_RULES.map((rule) => `${rule.label}: ${rule.summary}`)}
        />
      </section>

      <section className="panel three-column">
        <RuleSection
          title="Weapons"
          items={WEAPON_TABLE.map((weapon) => `${weapon.name}: ${weapon.die}`)}
        />
        <RuleSection
          title="Materials"
          items={MATERIAL_TABLE.map((material) => `${material.label}: ${formatSigned(material.bonus)}`)}
        />
        <RuleSection
          title="Armour"
          items={ARMOUR_TABLE.map(
            (armour) => `${armour.armourType}: ${armour.armourSaveDie} (${armour.summary})`,
          )}
        />
      </section>

      <section className="panel two-column">
        <RuleSection
          title="Birthsigns"
          items={BIRTHSIGNS.map(
            (sign) => `${sign.name}: ${sign.personality} Boons: ${sign.boons.join(" / ")}`,
          )}
        />
        <RuleSection
          title="Refractory Table"
          items={REFRACTORY_TABLE}
        />
      </section>

      <section className="panel two-column">
        <RuleSection title="Light Magic Samples" items={LEVEL_ONE_MAGIC["Light Magic"]} />
        <RuleSection title="Death Magic Samples" items={LEVEL_ONE_MAGIC["Death Magic"]} />
      </section>
    </div>
  );
}

interface RuleSectionProps {
  title: string;
  items: string[];
}

function RuleSection({ title, items }: RuleSectionProps) {
  return (
    <div className="rule-section">
      <h3>{title}</h3>
      <ul className="rule-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

interface DiceTrayProps {
  stage: Stage;
}

function DiceTray({ stage }: DiceTrayProps) {
  const [countDraft, setCountDraft] = useState("1");
  const [sidesDraft, setSidesDraft] = useState("20");
  const count = Math.max(1, Math.trunc(numberValue(countDraft) || 1));
  const sides = Math.max(2, Math.trunc(numberValue(sidesDraft) || 20));

  return (
    <section className="panel compact-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Dice Tray</p>
          <h2>Loose rolls</h2>
          <p className="small-copy">Type the roll once instead of keeping a wall of preset buttons.</p>
        </div>
      </div>
      <div className="dice-form">
        <label className="field">
          <span>Count</span>
          <input
            type="number"
            min={1}
            value={countDraft}
            onChange={(event) => setCountDraft(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Sides</span>
          <input
            type="number"
            min={2}
            value={sidesDraft}
            onChange={(event) => setSidesDraft(event.target.value)}
          />
        </label>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => void stage.rollLoose(count, sides)}>
          Roll {count}d{sides}
        </button>
      </div>
    </section>
  );
}

interface RollLogProps {
  entries: RollLogEntry[];
}

function RollLog({ entries }: RollLogProps) {
  return (
    <section className="panel compact-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Roll Log</p>
          <h2>Recent results</h2>
        </div>
      </div>
      <div className="roll-log">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <article key={entry.id} className="roll-entry">
              <strong>{entry.label}</strong>
              <span>{entry.detail}</span>
            </article>
          ))
        ) : (
          <p className="small-copy">No rolls yet.</p>
        )}
      </div>
    </section>
  );
}

interface PromptPreviewProps {
  preview: string;
}

function PromptPreview({ preview }: PromptPreviewProps) {
  return (
    <section className="panel compact-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Prompt Preview</p>
          <h2>Background stage directions preview</h2>
        </div>
      </div>
      <pre className="prompt-preview">{preview}</pre>
    </section>
  );
}
