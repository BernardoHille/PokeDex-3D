import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPokemonBundle, fetchPokemonList } from "./api";
import { PokedexScene } from "./PokedexScene";
import type {
  LoadedPokemon,
  PokedexAction,
  PokedexDetailPage,
  PokedexViewState,
  PokemonListItem,
} from "./types";

const PAGE_STEP = 8;
const DETAIL_PAGES: PokedexDetailPage[] = [
  "overview",
  "collection",
  "profile",
  "stats",
  "notes",
];

const initialViewState: PokedexViewState = {
  selectedIndex: 0,
  activeId: null,
  detailPage: "overview",
  listStatus: "loading",
  detailStatus: "idle",
  listError: null,
  detailError: null,
};

function App() {
  const [pokemonList, setPokemonList] = useState<PokemonListItem[]>([]);
  const [detailCache, setDetailCache] = useState<Record<number, LoadedPokemon>>({});
  const [viewState, setViewState] = useState<PokedexViewState>(initialViewState);

  useEffect(() => {
    let isMounted = true;

    fetchPokemonList()
      .then((list) => {
        if (!isMounted) {
          return;
        }

        setPokemonList(list);
        setViewState((current) => ({
          ...current,
          selectedIndex: 0,
          listStatus: "ready",
          listError: null,
        }));
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setViewState((current) => ({
          ...current,
          listStatus: "error",
          listError:
            error instanceof Error ? error.message : "Nao foi possivel carregar a lista.",
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPokemon = pokemonList[viewState.selectedIndex] ?? null;
  const activePokemon = viewState.activeId ? detailCache[viewState.activeId] ?? null : null;

  const moveSelection = useCallback(
    (delta: number) => {
      if (pokemonList.length === 0) {
        return;
      }

      setViewState((current) => ({
        ...current,
        selectedIndex: clamp(current.selectedIndex + delta, 0, pokemonList.length - 1),
      }));
    },
    [pokemonList.length],
  );

  const openSelectedPokemon = useCallback(async () => {
    if (!selectedPokemon) {
      return;
    }

    const selectedId = selectedPokemon.id;
    setViewState((current) => ({
      ...current,
      activeId: selectedId,
      detailPage: "overview",
      detailStatus: detailCache[selectedId] ? "ready" : "loading",
      detailError: null,
    }));

    if (detailCache[selectedId]) {
      return;
    }

    try {
      const loadedPokemon = await fetchPokemonBundle(selectedId);
      setDetailCache((current) => ({
        ...current,
        [selectedId]: loadedPokemon,
      }));
      setViewState((current) => ({
        ...current,
        activeId: selectedId,
        detailPage: "overview",
        detailStatus: "ready",
        detailError: null,
      }));
    } catch (error: unknown) {
      setViewState((current) => ({
        ...current,
        activeId: selectedId,
        detailPage: "overview",
        detailStatus: "error",
        detailError:
          error instanceof Error ? error.message : "Nao foi possivel carregar a ficha.",
      }));
    }
  }, [detailCache, selectedPokemon]);

  const handlePokedexAction = useCallback(
    (action: PokedexAction) => {
      switch (action) {
        case "up":
          moveSelection(-1);
          break;
        case "down":
          moveSelection(1);
          break;
        case "left":
          moveSelection(-PAGE_STEP);
          break;
        case "right":
          moveSelection(PAGE_STEP);
          break;
        case "select":
          void openSelectedPokemon();
          break;
        case "back":
          setViewState((current) => ({
            ...current,
            activeId: null,
            detailPage: "overview",
            detailStatus: "idle",
            detailError: null,
          }));
          break;
        case "data":
          setViewState((current) => {
            if (current.detailStatus !== "ready" || !current.activeId) {
              return current;
            }

            return {
              ...current,
              detailPage: nextDetailPage(current.detailPage),
            };
          });
          break;
        case "map":
          setViewState((current) => {
            if (current.detailStatus !== "ready" || !current.activeId) {
              return current;
            }

            return {
              ...current,
              detailPage: "map",
            };
          });
          break;
      }
    },
    [moveSelection, openSelectedPokemon],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = actionFromKey(event.key);

      if (!action) {
        return;
      }

      event.preventDefault();
      handlePokedexAction(action);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePokedexAction]);

  const sceneState = useMemo(
    () => ({
      pokemonList,
      selectedPokemon,
      activePokemon,
      viewState,
    }),
    [activePokemon, pokemonList, selectedPokemon, viewState],
  );

  return (
    <main className="app-shell">
      <PokedexScene {...sceneState} onAction={handlePokedexAction} />
    </main>
  );
}

const actionFromKey = (key: string): PokedexAction | null => {
  const keyMap: Record<string, PokedexAction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Enter: "select",
    " ": "select",
    Escape: "back",
    Backspace: "back",
    d: "data",
    D: "data",
    m: "map",
    M: "map",
  };

  return keyMap[key] ?? null;
};

const nextDetailPage = (page: PokedexDetailPage): PokedexDetailPage => {
  const currentIndex = DETAIL_PAGES.indexOf(page);
  return DETAIL_PAGES[(currentIndex + 1) % DETAIL_PAGES.length];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default App;
