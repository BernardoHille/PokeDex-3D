import type { PokemonEncounter } from "./types";

export type FireRedMapAsset = {
  key: string;
  label: string;
  image: string;
  sourceLabel: string;
  sourceUrl: string;
  credit: string;
};

export const FIRE_RED_MAPS: Record<string, FireRedMapAsset> = {
  "route-7": {
    key: "route-7",
    label: "Rota 7",
    image: "/maps/route-7.png",
    sourceLabel: "StrategyWiki Route 7",
    sourceUrl: "https://strategywiki.org/wiki/Pok%C3%A9mon_FireRed_and_LeafGreen/Route_7",
    credit: "StrategyWiki",
  },
};

const AREA_LABELS: Record<string, string> = {
  "pallet-town-area": "Pallet Town",
  "viridian-city-area": "Viridian City",
  "pewter-city-area": "Pewter City",
  "cerulean-city-area": "Cerulean City",
  "vermilion-city-area": "Vermilion City",
  "lavender-town-area": "Lavender Town",
  "celadon-city-area": "Celadon City",
  "fuchsia-city-area": "Fuchsia City",
  "saffron-city-area": "Saffron City",
  "cinnabar-island-area": "Cinnabar Island",
  "viridian-forest-area": "Viridian Forest",
  "mt-moon-1f": "Mt. Moon, andar 1",
  "mt-moon-b1f": "Mt. Moon, subsolo 1",
  "mt-moon-b2f": "Mt. Moon, subsolo 2",
  "rock-tunnel-1f": "Rock Tunnel, andar 1",
  "rock-tunnel-b1f": "Rock Tunnel, subsolo 1",
  "pokemon-tower-3f": "Pokemon Tower, andar 3",
  "pokemon-tower-4f": "Pokemon Tower, andar 4",
  "pokemon-tower-5f": "Pokemon Tower, andar 5",
  "pokemon-tower-6f": "Pokemon Tower, andar 6",
  "pokemon-tower-7f": "Pokemon Tower, andar 7",
  "kanto-power-plant-area": "Power Plant",
  "seafoam-islands-1f": "Seafoam Islands, andar 1",
  "seafoam-islands-b1f": "Seafoam Islands, subsolo 1",
  "seafoam-islands-b2f": "Seafoam Islands, subsolo 2",
  "seafoam-islands-b3f": "Seafoam Islands, subsolo 3",
  "seafoam-islands-b4f": "Seafoam Islands, subsolo 4",
  "pokemon-mansion-1f": "Pokemon Mansion, andar 1",
  "pokemon-mansion-2f": "Pokemon Mansion, andar 2",
  "pokemon-mansion-3f": "Pokemon Mansion, andar 3",
  "pokemon-mansion-b1f": "Pokemon Mansion, subsolo 1",
  "victory-road-1f": "Victory Road, andar 1",
  "victory-road-2f": "Victory Road, andar 2",
  "victory-road-3f": "Victory Road, andar 3",
  "cerulean-cave-1f": "Cerulean Cave, andar 1",
  "cerulean-cave-2f": "Cerulean Cave, andar 2",
  "cerulean-cave-b1f": "Cerulean Cave, subsolo 1",
  "safari-zone-center-area": "Safari Zone, centro",
  "safari-zone-east-area": "Safari Zone, leste",
  "safari-zone-north-area": "Safari Zone, norte",
  "safari-zone-west-area": "Safari Zone, oeste",
  "berry-forest-area": "Berry Forest",
  "bond-bridge-area": "Bond Bridge",
  "five-isle-meadow-area": "Five Isle Meadow",
};

export const mapKeyFromLocationArea = (areaName: string): string | null => {
  const routeMatch = areaName.match(/^kanto-route-(\d+)/);

  if (routeMatch) {
    return `route-${routeMatch[1]}`;
  }

  const knownLocationMapKeys: Record<string, string> = {
    "viridian-forest-area": "viridian-forest",
    "kanto-power-plant-area": "power-plant",
    "rock-tunnel-1f": "rock-tunnel",
    "rock-tunnel-b1f": "rock-tunnel",
    "seafoam-islands-1f": "seafoam-islands",
    "seafoam-islands-b1f": "seafoam-islands",
    "seafoam-islands-b2f": "seafoam-islands",
    "seafoam-islands-b3f": "seafoam-islands",
    "seafoam-islands-b4f": "seafoam-islands",
    "safari-zone-center-area": "safari-zone",
    "safari-zone-east-area": "safari-zone",
    "safari-zone-north-area": "safari-zone",
    "safari-zone-west-area": "safari-zone",
    "victory-road-1f": "victory-road",
    "victory-road-2f": "victory-road",
    "victory-road-3f": "victory-road",
    "cerulean-cave-1f": "cerulean-cave",
    "cerulean-cave-2f": "cerulean-cave",
    "cerulean-cave-b1f": "cerulean-cave",
  };

  return knownLocationMapKeys[areaName] ?? null;
};

export const formatFireRedAreaLabel = (areaName: string) => {
  const cleanAreaName = areaName.replace(/-area$/, "");
  const routeMatch = cleanAreaName.match(/^kanto-route-(\d+)(?:-(.+))?/);

  if (routeMatch) {
    const extra = routeMatch[2]
      ? ` - ${formatExtraRouteLabel(routeMatch[2])}`
      : "";

    return `Rota ${routeMatch[1]}${extra}`;
  }

  return AREA_LABELS[areaName] ?? titleCase(cleanAreaName);
};

export const getFireRedMapAsset = (encounter: PokemonEncounter | null) => {
  if (!encounter?.mapKey) {
    return null;
  }

  return FIRE_RED_MAPS[encounter.mapKey] ?? null;
};

export const pickMapEncounter = (encounters: PokemonEncounter[]) =>
  encounters.find((encounter) => getFireRedMapAsset(encounter)) ?? encounters[0] ?? null;

const formatExtraRouteLabel = (value: string) =>
  value
    .split("-")
    .map((part) => {
      const labels: Record<string, string> = {
        east: "leste",
        north: "norte",
        south: "sul",
        towards: "ate",
        west: "oeste",
      };

      if (labels[part]) {
        return labels[part];
      }

      return part === "mt" ? "Mt." : titleCase(part);
    })
    .join(" ");

const titleCase = (value: string) =>
  value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
