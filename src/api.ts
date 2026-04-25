import type {
  LoadedPokemon,
  PokemonEncounter,
  PokemonDetail,
  PokemonListItem,
  PokemonSpeciesDetail,
} from "./types";
import { formatFireRedAreaLabel, mapKeyFromLocationArea } from "./fireRedLocations";

const API_BASE = "https://pokeapi.co/api/v2";

type NamedResource = {
  name: string;
  url: string;
};

type PokemonListResponse = {
  results: NamedResource[];
};

type PokemonResponse = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
      home?: {
        front_default: string | null;
      };
    };
  };
  types: Array<{
    slot: number;
    type: NamedResource;
  }>;
  abilities: Array<{
    is_hidden: boolean;
    ability: NamedResource;
  }>;
  stats: Array<{
    base_stat: number;
    stat: NamedResource;
  }>;
  moves: Array<{
    move: NamedResource;
    version_group_details: Array<{
      level_learned_at: number;
      move_learn_method: NamedResource;
      version_group: NamedResource;
    }>;
  }>;
};

type PokemonSpeciesResponse = {
  id: number;
  gender_rate: number;
  capture_rate: number;
  is_legendary: boolean;
  is_mythical: boolean;
  growth_rate: NamedResource;
  habitat: NamedResource | null;
  generation: NamedResource;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: NamedResource;
    version: NamedResource;
  }>;
  genera: Array<{
    genus: string;
    language: NamedResource;
  }>;
};

type PokemonEncounterAreaResponse = {
  location_area: NamedResource;
  version_details: Array<{
    max_chance: number;
    version: NamedResource;
    encounter_details: Array<{
      chance: number;
      max_level: number;
      min_level: number;
      method: NamedResource;
    }>;
  }>;
};

const formatName = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const extractIdFromUrl = (url: string) => {
  const match = url.match(/\/pokemon\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar ${url}`);
  }

  return (await response.json()) as T;
};

export const fetchPokemonList = async (): Promise<PokemonListItem[]> => {
  const data = await fetchJson<PokemonListResponse>(
    `${API_BASE}/pokemon?limit=151&offset=0`,
  );

  return data.results.map((pokemon, index) => ({
    id: extractIdFromUrl(pokemon.url) ?? index + 1,
    name: formatName(pokemon.name),
    url: pokemon.url,
  }));
};

export const fetchPokemonBundle = async (id: number): Promise<LoadedPokemon> => {
  const [pokemon, species, encounters] = await Promise.all([
    fetchJson<PokemonResponse>(`${API_BASE}/pokemon/${id}`),
    fetchJson<PokemonSpeciesResponse>(`${API_BASE}/pokemon-species/${id}`),
    fetchJson<PokemonEncounterAreaResponse[]>(`${API_BASE}/pokemon/${id}/encounters`),
  ]);

  return {
    pokemon: normalizePokemon(pokemon),
    species: normalizeSpecies(species),
    encounters: normalizeFireRedEncounters(encounters),
  };
};

const normalizePokemon = (pokemon: PokemonResponse): PokemonDetail => {
  const levelMoves = pokemon.moves
    .map((entry) => {
      const levelUp = entry.version_group_details.find(
        (detail) => detail.move_learn_method.name === "level-up",
      );

      return {
        name: formatName(entry.move.name),
        level: levelUp?.level_learned_at ?? Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((entry) => entry.name);

  const artwork =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.other?.home?.front_default ??
    pokemon.sprites.front_default;

  return {
    id: pokemon.id,
    name: formatName(pokemon.name),
    heightMeters: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    artwork,
    sprite: pokemon.sprites.front_default,
    types: pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map((type) => formatName(type.type.name)),
    abilities: pokemon.abilities.map((ability) => formatName(ability.ability.name)),
    stats: pokemon.stats.map((stat) => ({
      name: formatStatName(stat.stat.name),
      value: stat.base_stat,
    })),
    moves: levelMoves,
  };
};

const normalizeSpecies = (species: PokemonSpeciesResponse): PokemonSpeciesDetail => {
  const englishFlavor =
    species.flavor_text_entries.find(
      (entry) => entry.language.name === "en" && entry.version.name === "firered",
    ) ??
    species.flavor_text_entries.find((entry) => entry.language.name === "en") ??
    species.flavor_text_entries[0];

  const genus =
    species.genera.find((entry) => entry.language.name === "en")?.genus ?? "Unknown";

  return {
    id: species.id,
    description: cleanFlavorText(englishFlavor?.flavor_text ?? ""),
    genus,
    generation: formatName(species.generation.name),
    habitat: species.habitat ? formatName(species.habitat.name) : "Desconhecido",
    genderRatio: formatGenderRatio(species.gender_rate),
    captureRate: species.capture_rate,
    growthRate: formatName(species.growth_rate.name),
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
  };
};

const cleanFlavorText = (text: string) => text.replace(/[\n\f]/g, " ").replace(/\s+/g, " ");

const normalizeFireRedEncounters = (
  encounters: PokemonEncounterAreaResponse[],
): PokemonEncounter[] =>
  encounters
    .flatMap((area) => {
      const fireRedVersion = area.version_details.find(
        (detail) => detail.version.name === "firered",
      );

      if (!fireRedVersion || fireRedVersion.encounter_details.length === 0) {
        return [];
      }

      const minLevel = Math.min(
        ...fireRedVersion.encounter_details.map((detail) => detail.min_level),
      );
      const maxLevel = Math.max(
        ...fireRedVersion.encounter_details.map((detail) => detail.max_level),
      );
      const methods = Array.from(
        new Set(
          fireRedVersion.encounter_details.map((detail) =>
            formatEncounterMethod(detail.method.name),
          ),
        ),
      );

      return [
        {
          areaName: area.location_area.name,
          areaLabel: formatFireRedAreaLabel(area.location_area.name),
          mapKey: mapKeyFromLocationArea(area.location_area.name),
          method: methods.join(" / "),
          minLevel,
          maxLevel,
          chance: fireRedVersion.max_chance,
        },
      ];
    })
    .sort(sortFireRedEncounters);

const formatGenderRatio = (genderRate: number) => {
  if (genderRate < 0) {
    return "Sem genero";
  }

  const female = (genderRate / 8) * 100;
  const male = 100 - female;
  return `${male.toFixed(0)}% M / ${female.toFixed(0)}% F`;
};

const formatStatName = (name: string) => {
  const labels: Record<string, string> = {
    hp: "HP",
    attack: "ATK",
    defense: "DEF",
    "special-attack": "SP. ATK",
    "special-defense": "SP. DEF",
    speed: "VEL",
  };

  return labels[name] ?? formatName(name);
};

const formatEncounterMethod = (method: string) => {
  const labels: Record<string, string> = {
    gift: "Presente",
    walk: "Andando",
    surf: "Surfando",
    "old-rod": "Vara velha",
    "good-rod": "Vara boa",
    "super-rod": "Super vara",
    "rock-smash": "Quebra-pedra",
    "only-one": "Unico",
    headbutt: "Headbutt",
  };

  return labels[method] ?? formatName(method);
};

const sortFireRedEncounters = (first: PokemonEncounter, second: PokemonEncounter) => {
  const firstRoute = routeNumber(first.areaName);
  const secondRoute = routeNumber(second.areaName);

  if (firstRoute !== null && secondRoute !== null && firstRoute !== secondRoute) {
    return firstRoute - secondRoute;
  }

  if (firstRoute !== null && secondRoute === null) {
    return -1;
  }

  if (firstRoute === null && secondRoute !== null) {
    return 1;
  }

  return first.areaLabel.localeCompare(second.areaLabel);
};

const routeNumber = (areaName: string) => {
  const match = areaName.match(/^kanto-route-(\d+)/);
  return match ? Number(match[1]) : null;
};
