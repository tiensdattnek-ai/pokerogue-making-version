/**
 * SPDX-FileCopyrightText: 2026 Arena Asxel Studio Games
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Species lookup helpers for the **Arena Asxel Studio Games** admin panel.
 */

import { speciesDataRegistry } from "#app/global-species-data-registry";
import type { PokemonSpecies } from "#data/pokemon-species";
import type { SpeciesId } from "#enums/species-id";

/**
 * Normalize a user supplied species name so that it can be compared against
 * the in-game species names.
 * @param name The name to normalize.
 * @returns The normalized name.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * @returns Every {@linkcode PokemonSpecies} known to the game.
 */
export function getAllSpecies(): PokemonSpecies[] {
  return speciesDataRegistry.getAllSpecies();
}

/**
 * @returns Every "true" legendary species (Mewtwo, Arceus, Rayquaza, ...).
 */
export function getLegendarySpecies(): PokemonSpecies[] {
  return getAllSpecies().filter(species => species.legendary);
}

/**
 * @returns Every rare species: legendaries, sub-legendaries and mythicals.
 */
export function getRareSpecies(): PokemonSpecies[] {
  return getAllSpecies().filter(species => species.legendary || species.subLegendary || species.mythical);
}

/**
 * Resolve a user supplied string into a species.
 *
 * Accepts either a National Pokédex number (e.g. `384`) or a species name
 * (e.g. `giratina`, `Arceus`, `mewtwo`).
 *
 * @param input The user supplied value.
 * @returns The matching species, or `null` if nothing matched.
 */
export function resolveSpecies(input: string): PokemonSpecies | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const allSpecies = getAllSpecies();

  // National Pokédex number. `SpeciesId` values match the Pokédex numbering.
  if (/^\d+$/.test(trimmed)) {
    const dexNumber = Number.parseInt(trimmed, 10);
    const match = allSpecies.find(species => species.speciesId === dexNumber);
    if (match) {
      return match;
    }
  }

  const normalized = normalizeName(trimmed);

  // Exact species name.
  const nameMatch = allSpecies.find(species => normalizeName(species.name) === normalized);
  if (nameMatch) {
    return nameMatch;
  }

  // Form name, e.g. "giratina altered" or "deoxys attack".
  const formMatch = allSpecies.find(species => species.forms.some(form => normalizeName(form.formName) === normalized));
  if (formMatch) {
    return formMatch;
  }

  // Partial match, e.g. "giratina" matching "Giratina Altered".
  const partialMatches = allSpecies.filter(
    species =>
      normalizeName(species.name).includes(normalized)
      || species.forms.some(form => normalizeName(form.formName).includes(normalized)),
  );

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }
  if (partialMatches.length > 1) {
    // Prefer a legendary match over any other match.
    const legendaryMatch = partialMatches.find(species => species.legendary);
    if (legendaryMatch) {
      return legendaryMatch;
    }
  }

  return null;
}

/**
 * @returns The species IDs of every legendary and rare species.
 */
export function getRareSpeciesIds(): SpeciesId[] {
  return getRareSpecies().map(species => species.speciesId);
}
