/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
  applyGodMode,
  clearAdminStartingParty,
  getAdminStartingParty,
  grantMaxCandy,
  grantMaxMoney,
  grantMaxVouchers,
  grantRareEggs,
  unlockAllAchievements,
  unlockAllGameModes,
  unlockAllStarters,
} from "#admin/admin-privileges";
import { adminLogout } from "#admin/admin-session";
import { getLegendarySpecies } from "#admin/arena-species";
import { globalScene } from "#app/global-scene";
import { UiMode } from "#enums/ui-mode";
import type { OptionSelectItem, OptionSelectModeConfig } from "#types/ui-types";
import { OptionSelectUiHandler } from "#ui/option-select-ui-handler";

/**
 * The admin menu of **Arena Asxel Studio Games**.
 *
 * Every action is executed on top of the regular game systems so that the
 * resulting save data remains compatible with the normal game.
 */
export class ArenaAdminMenuUiHandler extends OptionSelectUiHandler {
  constructor() {
    super(UiMode.ARENA_ADMIN_MENU);
  }

  /**
   * Show a message to the player without closing the menu.
   * @param message The message to show.
   */
  private notify(message: string): void {
    globalScene.ui.showText(message, null, null, null, true);
  }

  public override show(_args: any[]): boolean {
    const legendaries = getLegendarySpecies();
    const startingParty = getAdminStartingParty();

    const options: OptionSelectItem[] = [
      {
        label: "🚀 GOD MODE (unlock everything)",
        handler: () => {
          applyGodMode()
            .then(() => {
              this.notify("God mode activated! All starters, candies, vouchers and game modes unlocked.");
              globalScene.ui.playSelect();
            })
            .catch(error => {
              console.error(error);
              this.notify("Could not apply god mode.");
              globalScene.ui.playError();
            });
          return true;
        },
        keepOpen: true,
      },
      {
        label: "🔓 Unlock every starter & form",
        handler: () => {
          const count = unlockAllStarters();
          globalScene.gameData.saveSystem();
          this.notify(`Unlocked ${count} species (all forms, genders, variants and shinies).`);
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: "💎 Max candy for every starter",
        handler: () => {
          const count = grantMaxCandy();
          globalScene.gameData.saveSystem();
          this.notify(`Gave max candy to ${count} starter species.`);
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: "🎟 Max vouchers",
        handler: () => {
          grantMaxVouchers();
          globalScene.gameData.saveSystem();
          this.notify("All vouchers topped up!");
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: `🥚 One legendary egg for each of the ${legendaries.length} legendaries`,
        handler: () => {
          const count = grantRareEggs(true);
          globalScene.gameData.saveSystem();
          this.notify(`Added ${count} legendary eggs (shiny) to your egg list.`);
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: "🏆 Unlock every game mode & achievement",
        handler: () => {
          unlockAllGameModes();
          const achievements = unlockAllAchievements();
          globalScene.gameData.saveSystem();
          this.notify(`Unlocked every game mode and ${achievements} achievements.`);
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: "💰 Unlimited money (this session)",
        handler: () => {
          grantMaxMoney();
          this.notify("Money set to the maximum!");
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: `⚡ Set starting party (${startingParty.length}/6)`,
        handler: () => {
          globalScene.ui.setMode(UiMode.ARENA_ADMIN_SPECIES);
          return true;
        },
      },
      {
        label: "🧹 Clear starting party",
        handler: () => {
          clearAdminStartingParty();
          this.notify("Starting party cleared.");
          globalScene.ui.playSelect();
          return true;
        },
        keepOpen: true,
      },
      {
        label: "🚪 Log out",
        handler: () => {
          adminLogout();
          globalScene.ui.setMode(UiMode.TITLE);
          return true;
        },
      },
    ];

    const config: OptionSelectModeConfig = { options, yOffset: 0 };

    return super.show([config]);
  }
}
