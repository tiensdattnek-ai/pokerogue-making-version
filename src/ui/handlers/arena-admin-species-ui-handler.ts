/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getAdminStartingParty, grantSpeciesToParty, setAdminStartingParty } from "#admin/admin-privileges";
import { resolveSpecies } from "#admin/arena-species";
import { globalScene } from "#app/global-scene";
import { UiMode } from "#enums/ui-mode";
import type { ModalConfig } from "#types/ui-types";
import type { InputFieldConfig } from "#ui/form-modal-ui-handler";
import { FormModalUiHandler } from "#ui/form-modal-ui-handler";

/**
 * Lets the admin pick a Pokémon to add to their starting party.
 *
 * The selected Pokémon are stored locally and are added to the party at the
 * start of every run, which makes it possible to start a run with up to six
 * legendary Pokémon.
 */
export class ArenaAdminSpeciesUiHandler extends FormModalUiHandler {
  public override getModalTitle(): string {
    return "Grant Pokémon";
  }

  public override getWidth(): number {
    return 200;
  }

  public override getMargin(): [number, number, number, number] {
    return [0, 20, 48, 0];
  }

  public override getButtonLabels(): string[] {
    return ["Grant", "Cancel"];
  }

  public override getInputFieldConfigs(): InputFieldConfig[] {
    return [{ label: "Species (name or dex #)" }, { label: "Shiny (yes/no)" }];
  }

  public override show(args: any[]): boolean {
    if (!super.show(args)) {
      return false;
    }

    const config = (args[0] ?? {}) as ModalConfig;
    const originalSubmitAction = this.submitAction;

    this.submitAction = () => {
      if (globalScene.tweens.getTweensOf(this.modalContainer).length > 0) {
        return;
      }
      this.submitAction = originalSubmitAction;
      this.sanitizeInputs();

      const rawSpecies = this.inputs[0]?.text ?? "";
      const shiny = /^(y|yes|true|1|shiny)$/i.test(this.inputs[1]?.text ?? "");

      const species = resolveSpecies(rawSpecies);
      if (!species) {
        globalScene.ui.setMode(
          UiMode.ARENA_ADMIN_SPECIES,
          Object.assign(config, { errorMessage: `Unknown species: ${rawSpecies}` }),
        );
        globalScene.ui.playError();
        return;
      }

      const party = getAdminStartingParty();
      const existingIndex = party.findIndex(entry => entry.speciesId === species.speciesId);
      if (existingIndex >= 0) {
        party[existingIndex] = { speciesId: species.speciesId, shiny };
      } else {
        party.push({ speciesId: species.speciesId, shiny });
      }
      setAdminStartingParty(party);

      // Also add the Pokémon to the current party, if a run is in progress.
      const currentParty = globalScene.getPlayerParty();
      if (currentParty.length > 0) {
        grantSpeciesToParty(species.speciesId, shiny);
      }

      globalScene.ui.setMode(UiMode.ARENA_ADMIN_MENU);
      globalScene.ui.showText(`${species.name} added to your starting party!`, null, null, null, true);
      globalScene.ui.playSuccess();
    };

    return true;
  }
}
