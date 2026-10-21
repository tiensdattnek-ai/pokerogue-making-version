/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { adminLogin } from "#admin/admin-session";
import { loggedInUser } from "#app/account";
import { globalScene } from "#app/global-scene";
import { UiMode } from "#enums/ui-mode";
import type { ModalConfig } from "#types/ui-types";
import type { InputFieldConfig } from "#ui/form-modal-ui-handler";
import { FormModalUiHandler } from "#ui/form-modal-ui-handler";

/**
 * The admin login form for **Arena Asxel Studio Games**.
 *
 * The credentials are verified by the `api/admin/login` serverless function,
 * so the password never reaches the browser's storage.
 */
export class ArenaAdminLoginUiHandler extends FormModalUiHandler {
  public override getModalTitle(): string {
    return "Admin Login";
  }

  public override getWidth(): number {
    return 180;
  }

  public override getMargin(): [number, number, number, number] {
    return [0, 20, 48, 0];
  }

  public override getButtonLabels(): string[] {
    return ["Login", "Cancel"];
  }

  public override getInputFieldConfigs(): InputFieldConfig[] {
    return [{ label: "Username" }, { label: "Password", isPassword: true }];
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

      const username = this.inputs[0]?.text ?? "";
      const password = this.inputs[1]?.text ?? "";

      if (!username || !password) {
        globalScene.ui.setMode(
          UiMode.ARENA_ADMIN_LOGIN,
          Object.assign(config, { errorMessage: "Enter a username and password" }),
        );
        globalScene.ui.playError();
        return;
      }

      globalScene.ui.setMode(UiMode.LOADING, { buttonActions: [] });

      adminLogin(username, password)
        .then(result => {
          if (!result.success) {
            globalScene.ui.setMode(
              UiMode.ARENA_ADMIN_LOGIN,
              Object.assign(config, { errorMessage: result.error ?? "Incorrect username or password" }),
            );
            globalScene.ui.playError();
            return;
          }

          // Use the admin account name for the local save data so that it is
          // kept separate from any other (guest) save data.
          if (loggedInUser) {
            loggedInUser.username = result.username ?? username;
          }

          globalScene.ui.setMode(UiMode.ARENA_ADMIN_MENU);
          globalScene.ui.playSelect();
        })
        .catch(error => {
          console.error(error);
          globalScene.ui.setMode(
            UiMode.ARENA_ADMIN_LOGIN,
            Object.assign(config, { errorMessage: "Could not reach the admin server" }),
          );
          globalScene.ui.playError();
        });
    };

    return true;
  }
}
