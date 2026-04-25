export type PokemonListItem = {
  id: number;
  name: string;
  url: string;
};

export type PokemonStat = {
  name: string;
  value: number;
};

export type PokemonDetail = {
  id: number;
  name: string;
  heightMeters: number;
  weightKg: number;
  artwork: string | null;
  sprite: string | null;
  types: string[];
  abilities: string[];
  stats: PokemonStat[];
  moves: string[];
};

export type PokemonSpeciesDetail = {
  id: number;
  description: string;
  genus: string;
  generation: string;
  habitat: string;
  genderRatio: string;
  captureRate: number;
  growthRate: string;
  isLegendary: boolean;
  isMythical: boolean;
};

export type PokemonEncounter = {
  areaName: string;
  areaLabel: string;
  mapKey: string | null;
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
};

export type LoadedPokemon = {
  pokemon: PokemonDetail;
  species: PokemonSpeciesDetail;
  encounters: PokemonEncounter[];
};

export type PokedexDetailPage =
  | "overview"
  | "collection"
  | "profile"
  | "stats"
  | "notes"
  | "map";

export type PokedexViewState = {
  selectedIndex: number;
  activeId: number | null;
  detailPage: PokedexDetailPage;
  listStatus: "loading" | "ready" | "error";
  detailStatus: "idle" | "loading" | "ready" | "error";
  listError: string | null;
  detailError: string | null;
};

export type PokedexAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "back"
  | "data"
  | "map";
