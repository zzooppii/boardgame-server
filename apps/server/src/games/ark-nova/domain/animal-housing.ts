import { ARK_BUILDINGS, arkTerrainCount, type ArkBuilding, type ArkCardDefinition } from '@hangul-rummikub/shared';

function matchesTerrain(building: ArkBuilding, animal: ArkCardDefinition, ignoreTerrain: boolean): boolean {
  if (ignoreTerrain) return true;
  return animal.rock !== null && arkTerrainCount(building.cells, 'WATER') >= animal.water && arkTerrainCount(building.cells, 'ROCK') >= animal.rock;
}

export function arkAnimalHousingChoices(buildings: readonly ArkBuilding[], animal: ArkCardDefinition, ignoreTerrain = false): string[] {
  if (animal.kind !== 'ANIMAL') return [];
  return buildings.filter(building => {
    if (!matchesTerrain(building, animal, ignoreTerrain)) return false;
    if (building.kind.startsWith('ENCLOSURE_')) return animal.standard && !building.occupied && building.cells.length >= animal.size;
    const special = animal.special.find(s => s.kind === building.kind);
    const definition = Object.hasOwn(ARK_BUILDINGS, building.kind) ? ARK_BUILDINGS[building.kind] : undefined;
    return special !== undefined && definition !== undefined && definition.special && building.used + special.size <= definition.capacity;
  }).map(b => b.id);
}

/** The rule service has already validated the card, payment, icon conditions and action allowance. */
export function occupyArkAnimalHousing(buildings: readonly ArkBuilding[], animal: ArkCardDefinition, housingId: string, ignoreTerrain = false):
  {ok: true; buildings: ArkBuilding[]} | {ok: false; reason: 'INVALID_HOUSING'} {
  if (!arkAnimalHousingChoices(buildings, animal, ignoreTerrain).includes(housingId)) return {ok: false, reason: 'INVALID_HOUSING'};
  const next = buildings.map(b => ({...b, cells: b.cells.map(c => ({...c}))}));
  const housing = next.find(b => b.id === housingId)!;
  if (housing.kind.startsWith('ENCLOSURE_')) housing.occupied = true;
  else housing.used += animal.special.find(s => s.kind === housing.kind)!.size;
  return {ok: true, buildings: next};
}

/** Release/move erratum: smallest occupied enclosure satisfying all requirements,
 * otherwise smallest satisfying size; no historical animal-to-standard-enclosure binding.
 */
export function arkEnclosuresToEmpty(buildings: readonly ArkBuilding[], animal: ArkCardDefinition, ignoreTerrain = false): string[] {
  if (animal.kind !== 'ANIMAL' || !animal.standard) return [];
  const sizeMatches = buildings.filter(b => b.kind.startsWith('ENCLOSURE_') && b.occupied && b.cells.length >= animal.size);
  const terrainMatches = sizeMatches.filter(b => matchesTerrain(b, animal, ignoreTerrain));
  const candidates = terrainMatches.length > 0 ? terrainMatches : sizeMatches;
  const smallest = Math.min(...candidates.map(b => b.cells.length));
  return candidates.filter(b => b.cells.length === smallest).map(b => b.id);
}

export function arkCanShareFlockEnclosure(animal: ArkCardDefinition, existingAnimals: readonly ArkCardDefinition[]): boolean {
  return animal.abilities.some(a => a.key === 'FLOCK_ANIMAL') && existingAnimals.some(other =>
    other.kind === 'ANIMAL' && other.tags.includes('Herbivore') && other.size >= animal.size,
  );
}
