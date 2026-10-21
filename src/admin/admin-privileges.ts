/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * "God mode" privileges for the **Arena Asxel Studio Games** admin account.
 *
 * Everything in here is deliberately implemented on top of the normal game
 * systems (dex attributes, starter data, vouchers, eggs, ...) instead of
 * patching the save format, so that the resulting save data stays readable
 * by the regular game.
 */

import { getRareSpeciesIds } from "#admin/arena-species";
import { globalScene } from "#app/global-scene";
import { speciesDataRegistry } from "#app/global-species-data-registry";
import { MAX_STARTER_CANDY_COUNT } from "#constants/game-constants";
import { Egg } from "#data/egg";
import { Gender } from "#data/gender";
import { AbilityAttr } from "#enums/ability-attr";
import { DexAttr } from "#enums/dex-attr";
import { EggSourceType } from "#enums/egg-source-types";
import { Nature } from "#enums/nature";
import type { SpeciesId } from "#enums/species-id";
import { Unlockables } from "#enums/unlockables";
import { VoucherType } from "#enums/voucher-type";
import { achvs } from "#system/achv";

/** The `localStorage` key holding the Pokémon that the admin wants to start every run with. */
export const ADMIN_PARTY_STORAGE_KEY = "arena_admin_party";

/** The maximum amount of money the admin account can hold. */
export const ADMIN_MAX_MONEY = 9_999_999;

/** The maximum amount of vouchers the admin account can hold. */
export const ADMIN_MAX_VOUCHERS = 99_999;

/** A Pokémon that the admin has designated as part of their starting party. */
export interface AdminPartyEntry {
  /** The species of the Pokémon. */
  speciesId: SpeciesId;
  /** Whether the Pokémon should be shiny. */
  shiny: boolean;
}

/** Every attribute bit that marks a species as fully caught. */
const ALL_DEX_ATTRS =
  DexAttr.NON_SHINY
  | DexAttr.SHINY
  | DexAttr.MALE
  | DexAttr.FEMALE
  | DexAttr.DEFAULT_VARIANT
  | DexAttr.VARIANT_2
  | DexAttr.VARIANT_3
  | DexAttr.DEFAULT_FORM;

/** A bitmask with every nature unlocked. */
const ALL_NATURES = (1n << 26n) - 1n;

/** The maximum individual value for every stat. */
const MAX_IVS = [31, 31, 31, 31, 31, 31];

/**
 * Unlock every starter, including all forms, genders, variants and shinies.
 * @returns The number of species that were unlocked.
 */
export function unlockAllStarters(): number {
  const { dexData, starterData } = globalScene.gameData;
  let unlocked = 0;

  for (const species of speciesDataRegistry.getAllSpecies()) {
    const entry = dexData[species.speciesId];
    if (!entry) {
      continue;
    }
    entry.seenAttr = ALL_DEX_ATTRS;
    entry.caughtAttr = ALL_DEX_ATTRS;
    entry.natureAttr = Number(ALL_NATURES);
    entry.seenCount = 999;
    entry.caughtCount = 999;
    entry.hatchedCount = 999;
    entry.ivs = [...MAX_IVS];
    unlocked++;
  }

  // The starter data only contains entries for species that can be used as
  // starters, so unlock every ability and the passive for those.
  for (const starterId of speciesDataRegistry.getAllStarters()) {
    const starterEntry = starterData[starterId];
    if (!starterEntry) {
      continue;
    }
    starterEntry.abilityAttr = AbilityAttr.ABILITY_1 | AbilityAttr.ABILITY_2 | AbilityAttr.ABILITY_HIDDEN;
    starterEntry.passiveAttr = 1;
    starterEntry.friendship = 255;
  }

  return unlocked;
}

/**
 * Give every starter the maximum amount of candies.
 * @returns The number of starter species that were topped up.
 */
export function grantMaxCandy(): number {
  const { starterData } = globalScene.gameData;
  let topped = 0;

  for (const starterId of speciesDataRegistry.getAllStarters()) {
    const entry = starterData[starterId];
    if (!entry) {
      continue;
    }
    entry.candyCount = MAX_STARTER_CANDY_COUNT;
    topped++;
  }

  return topped;
}

/**
 * Give the maximum amount of every kind of voucher.
 */
export function grantMaxVouchers(): void {
  const { voucherCounts } = globalScene.gameData;
  voucherCounts[VoucherType.REGULAR] = ADMIN_MAX_VOUCHERS;
  voucherCounts[VoucherType.PLUS] = ADMIN_MAX_VOUCHERS;
  voucherCounts[VoucherType.PREMIUM] = ADMIN_MAX_VOUCHERS;
  voucherCounts[VoucherType.GOLDEN] = ADMIN_MAX_VOUCHERS;
}

/**
 * Unlock every game mode (Endless, Spliced Endless, Evolite, Mini Black Hole).
 */
export function unlockAllGameModes(): void {
  const { unlocks } = globalScene.gameData;
  unlocks[Unlockables.ENDLESS_MODE] = true;
  unlocks[Unlockables.MINI_BLACK_HOLE] = true;
  unlocks[Unlockables.SPLICED_ENDLESS_MODE] = true;
  unlocks[Unlockables.EVIOLITE] = true;
}

/**
 * Unlock every achievement.
 * @returns The number of achievements that were unlocked.
 */
export function unlockAllAchievements(): number {
  const { achvUnlocks } = globalScene.gameData;
  let unlocked = 0;

  for (const achievement of Object.values(achvs)) {
    achvUnlocks[achievement.id] = Date.now();
    unlocked++;
  }

  return unlocked;
}

/**
 * Give the player an absurd amount of money.
 * @remarks
 * Money is a per-run value in PokéRogue, so this only affects the current
 * session. The persistent currency is the candy and the vouchers.
 */
export function grantMaxMoney(): void {
  globalScene.money = ADMIN_MAX_MONEY;
}

/**
 * Give one egg for every legendary and rare species.
 * @param shiny - (Default `true`) Whether the eggs should hatch into shiny Pokémon.
 * @returns The number of eggs that were granted.
 */
export function grantRareEggs(shiny = true): number {
  const eggs = globalScene.gameData.eggs;
  const speciesIds = getRareSpeciesIds();
  let granted = 0;

  for (const speciesId of speciesIds) {
    eggs.push(
      new Egg({
        sourceType: EggSourceType.GACHA_LEGENDARY,
        species: speciesId,
        isShiny: shiny,
        timestamp: Date.now(),
      }),
    );
    granted++;
  }

  return granted;
}

/**
 * Add a Pokémon to the player's current party.
 * @param speciesId The species of the Pokémon.
 * @param shiny - (Default `false`) Whether the Pokémon should be shiny.
 * @param level - (Default `100`) The level of the Pokémon.
 * @returns Whether the Pokémon could be added.
 */
export function grantSpeciesToParty(speciesId: SpeciesId, shiny = false, level = 100): boolean {
  const species = speciesDataRegistry.getSpecies(speciesId);
  if (!species) {
    return false;
  }

  const party = globalScene.getPlayerParty();
  // Make room for the new Pokémon.
  while (party.length >= 6) {
    party.shift();
  }

  const pokemon = globalScene.addPlayerPokemon(species, level, 0, 0, Gender.MALE, shiny, 0, [...MAX_IVS], Nature.HARDY);
  party.push(pokemon);

  return true;
}

/**
 * Store the Pokémon that should form the player's party at the start of
 * every run.
 * @param entries The Pokémon to start with.
 */
export function setAdminStartingParty(entries: AdminPartyEntry[]): void {
  localStorage.setItem(ADMIN_PARTY_STORAGE_KEY, JSON.stringify(entries.slice(0, 6)));
}

/**
 * @returns The Pokémon that should form the player's party at the start of every run.
 */
export function getAdminStartingParty(): AdminPartyEntry[] {
  const raw = localStorage.getItem(ADMIN_PARTY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as AdminPartyEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

/** Clear the designated starting party. */
export function clearAdminStartingParty(): void {
  localStorage.removeItem(ADMIN_PARTY_STORAGE_KEY);
}

/**
 * Apply every persistent "god mode" privilege at once.
 */
export async function applyGodMode(): Promise<void> {
  unlockAllStarters();
  grantMaxCandy();
  grantMaxVouchers();
  unlockAllGameModes();
  grantMaxMoney();
  await globalScene.gameData.saveSystem();
}
