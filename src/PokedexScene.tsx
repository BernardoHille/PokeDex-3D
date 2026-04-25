import { Suspense, useLayoutEffect, useMemo } from "react";
import { Canvas, createPortal, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getFireRedMapAsset, pickMapEncounter } from "./fireRedLocations";
import type {
  LoadedPokemon,
  PokedexAction,
  PokedexViewState,
  PokemonListItem,
} from "./types";

const MODEL_URL = "/models/pokedex_pronta.glb";
const LIST_WINDOW_SIZE = 5;

type SceneProps = {
  pokemonList: PokemonListItem[];
  selectedPokemon: PokemonListItem | null;
  activePokemon: LoadedPokemon | null;
  viewState: PokedexViewState;
  onAction: (action: PokedexAction) => void;
};

type ScreenOverlayProps = {
  target: THREE.Object3D | undefined;
  variant: "large" | "small";
  children: React.ReactNode;
};

type ScreenMetrics = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

const ACTION_BY_NODE: Record<string, PokedexAction> = {
  Botao_Select: "select",
  Botao_A: "select",
  Botao_Start: "select",
  Botao_Back: "back",
  Botao_Data: "data",
  Botao_Map: "map",
  Seta_Cima: "up",
  Seta_baixo: "down",
  Seta_esquerda: "left",
  Setas_Direita: "right",
  "Botao_+": "right",
  "Botao_-": "left",
};

export function PokedexScene({
  pokemonList,
  selectedPokemon,
  activePokemon,
  viewState,
  onAction,
}: SceneProps) {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 1.2, 7], fov: 38, near: 0.1, far: 100 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      shadows
    >
      <color attach="background" args={["#07090c"]} />
      <fog attach="fog" args={["#07090c", 18, 45]} />
      <ambientLight intensity={1.15} />
      <directionalLight position={[2.5, 5, 4]} intensity={2.2} castShadow />
      <pointLight position={[-2.5, 2, 3]} intensity={1.2} color="#62f8d3" />
      <pointLight position={[2.4, -1, 2]} intensity={0.9} color="#ff415d" />
      <Suspense fallback={<SceneLoading />}>
        <CameraRig>
          <PokedexModel
            pokemonList={pokemonList}
            selectedPokemon={selectedPokemon}
            activePokemon={activePokemon}
            viewState={viewState}
            onAction={onAction}
          />
        </CameraRig>
        <Environment preset="city" />
      </Suspense>
      <OrbitControls
        makeDefault
        enableDamping
        enablePan={false}
        minDistance={3.2}
        maxDistance={30}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.22}
      />
    </Canvas>
  );
}

function CameraRig({ children }: { children: React.ReactNode }) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const distance = aspect < 0.7 ? 20.5 : aspect < 1.05 ? 11.5 : 8.2;

    camera.position.set(0, 0.15, distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return <group position={[-1.45, -0.03, -0.08]}>{children}</group>;
}

function PokedexModel({
  pokemonList,
  selectedPokemon,
  activePokemon,
  viewState,
  onAction,
}: SceneProps) {
  const gltf = useGLTF(MODEL_URL) as unknown as {
    scene: THREE.Group;
    nodes: Record<string, THREE.Object3D>;
  };

  useMemo(() => {
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
  }, [gltf.scene]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const action = resolveAction(event.object);

    if (!action) {
      return;
    }

    event.stopPropagation();
    onAction(action);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (!resolveAction(event.object)) {
      return;
    }

    event.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "default";
  };

  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      <primitive
        object={gltf.scene}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      <ScreenOverlay target={gltf.nodes.Tela_Maior} variant="large">
        <DetailScreen
          activePokemon={activePokemon}
          selectedPokemon={selectedPokemon}
          viewState={viewState}
        />
      </ScreenOverlay>
      <ScreenOverlay target={gltf.nodes.Tela_menor} variant="small">
        <ListScreen pokemonList={pokemonList} viewState={viewState} />
      </ScreenOverlay>
    </group>
  );
}

function ScreenOverlay({ target, variant, children }: ScreenOverlayProps) {
  const metrics = useMemo(() => {
    if (!target) {
      return null;
    }

    return getScreenMetrics(target, variant);
  }, [target, variant]);

  if (!target || !metrics) {
    return null;
  }

  return createPortal(
    <Html
      transform
      center
      position={metrics.position}
      rotation={metrics.rotation}
      scale={metrics.scale}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className={`pokedex-screen pokedex-screen--${variant}`}>{children}</div>
    </Html>,
    target,
  );
}

function ListScreen({
  pokemonList,
  viewState,
}: {
  pokemonList: PokemonListItem[];
  viewState: PokedexViewState;
}) {
  const visibleItems = useMemo(() => {
    const selectedIndex = viewState.selectedIndex;
    const maxStart = Math.max(0, pokemonList.length - LIST_WINDOW_SIZE);
    const start = clamp(selectedIndex - Math.floor(LIST_WINDOW_SIZE / 2), 0, maxStart);

    return pokemonList.slice(start, start + LIST_WINDOW_SIZE).map((pokemon, offset) => ({
      pokemon,
      index: start + offset,
    }));
  }, [pokemonList, viewState.selectedIndex]);

  if (viewState.listStatus === "loading") {
    return (
      <div className="screen-panel screen-panel--center">
        <span className="screen-kicker">KANTO DEX</span>
        <strong>Carregando lista</strong>
        <div className="scanline-loader" />
      </div>
    );
  }

  if (viewState.listStatus === "error") {
    return (
      <div className="screen-panel screen-panel--center">
        <span className="screen-kicker">SINAL PERDIDO</span>
        <strong>Falha de conexao</strong>
        <p>{viewState.listError}</p>
      </div>
    );
  }

  const scrollProgress =
    pokemonList.length > 1
      ? Math.min(1, Math.max(0, viewState.selectedIndex / (pokemonList.length - 1)))
      : 0;

  return (
    <div className="list-screen retro-list-screen">
      <header className="screen-header retro-list-header">
        <span>Kanto Pokedex</span>
        <strong>{String(viewState.selectedIndex + 1).padStart(3, "0")}</strong>
      </header>
      <div className="retro-list-body">
        <div className="pokemon-list">
          {visibleItems.map(({ pokemon, index }) => (
            <div
            className={`pokemon-row ${index === viewState.selectedIndex ? "is-selected" : ""}`}
            key={pokemon.id}
          >
              <img
                className="pokeball-icon"
                src="/icons/poke_ball.svg"
                alt=""
                aria-hidden="true"
                draggable={false}
              />
              <span className="pokemon-number">{String(pokemon.id).padStart(3, "0")}</span>
              <strong>{pokemon.name}</strong>
            </div>
          ))}
        </div>
        <div className="retro-scrollbar" aria-hidden="true">
          <span className="retro-scroll-arrow retro-scroll-arrow--up" />
          <div>
            <i
              style={{
                top: `${scrollProgress * 100}%`,
                transform: `translateY(-${scrollProgress * 16}px)`,
              }}
            />
          </div>
          <span className="retro-scroll-arrow retro-scroll-arrow--down" />
        </div>
      </div>
      <footer className="screen-footer">
        <span>Vistos: {pokemonList.length}</span>
        <span>{Math.round(((viewState.selectedIndex + 1) / pokemonList.length) * 100)}%</span>
      </footer>
    </div>
  );
}

function DetailScreen({
  activePokemon,
  selectedPokemon,
  viewState,
}: {
  activePokemon: LoadedPokemon | null;
  selectedPokemon: PokemonListItem | null;
  viewState: PokedexViewState;
}) {
  if (viewState.detailStatus === "idle") {
    return (
      <div className="screen-panel screen-panel--center detail-standby retro-standby">
        <span className="screen-kicker">Kanto Pokedex</span>
        <strong>{selectedPokemon ? selectedPokemon.name : "Kanto"}</strong>
        <p>Aguardando selecao</p>
      </div>
    );
  }

  if (viewState.detailStatus === "loading") {
    return (
      <div className="screen-panel screen-panel--center">
        <span className="screen-kicker">SCAN</span>
        <strong>{selectedPokemon?.name ?? "Pokemon"}</strong>
        <div className="scanline-loader" />
      </div>
    );
  }

  if (viewState.detailStatus === "error") {
    return (
      <div className="screen-panel screen-panel--center">
        <span className="screen-kicker">ERRO</span>
        <strong>Ficha indisponivel</strong>
        <p>{viewState.detailError}</p>
      </div>
    );
  }

  if (!activePokemon) {
    return null;
  }

  const { pokemon, species } = activePokemon;
  const primaryAbility = pokemon.abilities[0] ?? "Unknown";
  const movesPreview = pokemon.moves.slice(0, 3).join(" / ") || "Unknown";
  const title = (
    <header className="retro-rich-title">
      <span>#{String(pokemon.id).padStart(3, "0")}</span>
      <strong>{pokemon.name}</strong>
      <em>{pokemon.types.join("/")}</em>
    </header>
  );

  if (viewState.detailPage === "collection") {
    return (
      <article className="retro-detail-screen retro-detail-screen--focus">
        {title}
        <section className="retro-focus-card retro-focus-card--collection">
          <div className="retro-focus-sprite">
            {pokemon.sprite || pokemon.artwork ? (
              <img src={pokemon.sprite ?? pokemon.artwork ?? undefined} alt={pokemon.name} />
            ) : null}
          </div>
          <dl className="retro-focus-list retro-focus-list--large">
            <div>
              <dt>Vistos</dt>
              <dd>151</dd>
            </div>
            <div>
              <dt>Capturados</dt>
              <dd>{String(pokemon.id).padStart(3, "0")}</dd>
            </div>
            <div>
              <dt>Registro</dt>
              <dd>Kanto</dd>
            </div>
            <div>
              <dt>Pokemon</dt>
              <dd>{pokemon.name}</dd>
            </div>
          </dl>
        </section>
        <footer className="retro-page-footer">Registro</footer>
      </article>
    );
  }

  if (viewState.detailPage === "profile") {
    return (
      <article className="retro-detail-screen retro-detail-screen--focus">
        {title}
        <section className="retro-focus-card">
          <dl className="retro-focus-list retro-focus-list--profile">
            <div>
              <dt>Altura</dt>
              <dd>{pokemon.heightMeters.toFixed(1)} m</dd>
            </div>
            <div>
              <dt>Peso</dt>
              <dd>{pokemon.weightKg.toFixed(1)} kg</dd>
            </div>
            <div>
              <dt>Habitat</dt>
              <dd>{species.habitat}</dd>
            </div>
            <div>
              <dt>Crescimento</dt>
              <dd>{species.growthRate}</dd>
            </div>
            <div>
              <dt>Habilidade</dt>
              <dd>{primaryAbility}</dd>
            </div>
            <div>
              <dt>Geracao</dt>
              <dd>{species.generation}</dd>
            </div>
          </dl>
        </section>
        <footer className="retro-page-footer">Perfil</footer>
      </article>
    );
  }

  if (viewState.detailPage === "stats") {
    return (
      <article className="retro-detail-screen retro-detail-screen--focus">
        {title}
        <section className="retro-focus-card retro-focus-card--stats">
          <h2>Atributos base</h2>
          <div className="retro-focus-stat-list">
            {pokemon.stats.map((stat) => (
              <div className="retro-focus-stat-row" key={stat.name}>
                <span>{stat.name}</span>
                <i>
                  <b style={{ width: `${Math.min(100, (stat.value / 180) * 100)}%` }} />
                </i>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <footer className="retro-page-footer">Atributos</footer>
      </article>
    );
  }

  if (viewState.detailPage === "notes") {
    return (
      <article className="retro-detail-screen retro-detail-screen--focus">
        {title}
        <section className="retro-focus-card retro-focus-card--notes">
          <dl className="retro-focus-list retro-focus-list--notes">
            <div>
              <dt>Especie</dt>
              <dd>{species.genus}</dd>
            </div>
            <div>
              <dt>Movimentos</dt>
              <dd>{movesPreview}</dd>
            </div>
            <div>
              <dt>Classe</dt>
              <dd>{species.isLegendary ? "Lendario" : species.isMythical ? "Mitico" : "Normal"}</dd>
            </div>
          </dl>
          <p>{species.description}</p>
        </section>
        <footer className="retro-page-footer">Notas</footer>
      </article>
    );
  }

  if (viewState.detailPage === "map") {
    const mapEncounter = pickMapEncounter(activePokemon.encounters);
    const mapAsset = getFireRedMapAsset(mapEncounter);
    const encounterList = activePokemon.encounters.slice(0, 5);

    return (
      <article className="retro-detail-screen retro-detail-screen--map">
        {title}
        <section className="retro-map-panel">
          <div className="retro-map-frame">
            {mapAsset ? (
              <img src={mapAsset.image} alt={`Mapa de ${mapAsset.label}`} />
            ) : (
              <div className="retro-map-placeholder">
                <strong>Mapa em catalogo</strong>
                <span>{mapEncounter?.areaLabel ?? "Sem rota selvagem"}</span>
              </div>
            )}
          </div>

          <div className="retro-map-info">
            <span>FireRed</span>
            <strong>{mapEncounter?.areaLabel ?? "Sem encontro registrado"}</strong>
            {mapEncounter ? (
              <dl>
                <div>
                  <dt>Metodo</dt>
                  <dd>{mapEncounter.method}</dd>
                </div>
                <div>
                  <dt>Nivel</dt>
                  <dd>{formatEncounterLevel(mapEncounter.minLevel, mapEncounter.maxLevel)}</dd>
                </div>
                <div>
                  <dt>Chance</dt>
                  <dd>{mapEncounter.chance}%</dd>
                </div>
                <div>
                  <dt>Fonte</dt>
                  <dd>{mapAsset ? mapAsset.credit : "PokeAPI"}</dd>
                </div>
              </dl>
            ) : (
              <p>Este Pokemon nao aparece como encontro selvagem de FireRed.</p>
            )}
          </div>
        </section>

        <section className="retro-map-routes">
          {encounterList.length > 0 ? (
            encounterList.map((encounter) => (
              <span
                className={encounter.areaName === mapEncounter?.areaName ? "is-current" : ""}
                key={encounter.areaName}
              >
                <strong>{encounter.areaLabel}</strong>
                <em>{formatEncounterLevel(encounter.minLevel, encounter.maxLevel)}</em>
              </span>
            ))
          ) : (
            <p>Sem local selvagem no FireRed para esta ficha.</p>
          )}
        </section>
        <footer className="retro-page-footer">Mapa</footer>
      </article>
    );
  }

  return (
    <article className="retro-detail-screen retro-detail-screen--rich">
      {title}

      <section className="retro-rich-main">
        <div className="retro-profile-card">
          <div className="retro-sprite-frame">
            {pokemon.sprite || pokemon.artwork ? (
              <img src={pokemon.sprite ?? pokemon.artwork ?? undefined} alt={pokemon.name} />
            ) : null}
          </div>
          <div className="retro-seen-owned">
            <span>Vistos</span>
            <strong>151</strong>
            <span>Capturados</span>
            <strong>{String(pokemon.id).padStart(3, "0")}</strong>
          </div>
        </div>

        <dl className="retro-info-card">
          <div>
            <dt>Altura</dt>
            <dd>{pokemon.heightMeters.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>Peso</dt>
            <dd>{pokemon.weightKg.toFixed(1)} kg</dd>
          </div>
          <div>
            <dt>Habitat</dt>
            <dd>{species.habitat}</dd>
          </div>
          <div>
            <dt>Crescimento</dt>
            <dd>{species.growthRate}</dd>
          </div>
          <div className="retro-info-card__wide">
            <dt>Habilidade</dt>
            <dd>{primaryAbility}</dd>
          </div>
        </dl>
      </section>

      <section className="retro-stats-card">
        <h2>Atributos base</h2>
        <div className="retro-stat-grid">
          {pokemon.stats.map((stat) => (
            <div className="retro-stat-row" key={stat.name}>
              <span>{stat.name}</span>
              <i>
                <b style={{ width: `${Math.min(100, (stat.value / 180) * 100)}%` }} />
              </i>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="retro-notes-card">
        <span>{species.genus}</span>
        <strong>{movesPreview}</strong>
        <p>{species.description}</p>
      </section>
    </article>
  );
}

function SceneLoading() {
  return (
    <Html center>
      <div className="scene-loading">Inicializando</div>
    </Html>
  );
}

function getScreenMetrics(target: THREE.Object3D, variant: "large" | "small"): ScreenMetrics {
  const fallbackScale = variant === "large" ? 0.0021 : 0.0018;
  const screenScaleBoost = variant === "large" ? 46 : 43;

  if (!(target instanceof THREE.Mesh) || !target.geometry) {
    return {
      position: [0, 0, 0.02],
      rotation: [0, 0, 0],
      scale: [fallbackScale, fallbackScale, fallbackScale],
    };
  }

  target.geometry.computeBoundingBox();
  const box = target.geometry.boundingBox;

  if (!box) {
    return {
      position: [0, 0, 0.02],
      rotation: [0, 0, 0],
      scale: [fallbackScale, fallbackScale, fallbackScale],
    };
  }

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const axes = [
    { axis: "x" as const, size: size.x },
    { axis: "y" as const, size: size.y },
    { axis: "z" as const, size: size.z },
  ].sort((a, b) => a.size - b.size);

  const normalAxis = axes[0].axis;
  const planeAxes = axes.slice(1).sort((a, b) => b.size - a.size);
  const normal = axisVector(normalAxis);
  const depthOffset = Math.max(axes[0].size * 0.65, 0.01);
  const position = center.clone().add(normal.multiplyScalar(depthOffset));
  const worldWidth = Math.max(planeAxes[0].size, 0.01);
  const cssWidth = variant === "large" ? 560 : 420;
  const scale = Math.max((worldWidth / cssWidth) * 0.96, fallbackScale) * screenScaleBoost;

  return {
    position: [position.x, position.y, position.z],
    rotation: rotationForNormal(normalAxis),
    scale: [scale, scale, scale],
  };
}

function axisVector(axis: "x" | "y" | "z") {
  switch (axis) {
    case "x":
      return new THREE.Vector3(1, 0, 0);
    case "y":
      return new THREE.Vector3(0, 1, 0);
    case "z":
      return new THREE.Vector3(0, 0, 1);
  }
}

function rotationForNormal(axis: "x" | "y" | "z"): [number, number, number] {
  const screenTwist = Math.PI / 2;

  switch (axis) {
    case "x":
      return [0, Math.PI / 2, screenTwist];
    case "y":
      return [-Math.PI / 2, 0, screenTwist];
    case "z":
      return [0, 0, screenTwist];
  }
}

function resolveAction(object: THREE.Object3D): PokedexAction | null {
  let current: THREE.Object3D | null = object;

  while (current) {
    const action = ACTION_BY_NODE[current.name];

    if (action) {
      return action;
    }

    current = current.parent;
  }

  return null;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const formatEncounterLevel = (minLevel: number, maxLevel: number) =>
  minLevel === maxLevel ? `${minLevel}` : `${minLevel}-${maxLevel}`;

useGLTF.preload(MODEL_URL);
