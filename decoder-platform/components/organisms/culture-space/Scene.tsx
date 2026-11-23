'use client';

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { DIMENSIONS, type DimensionKey, type Scores } from '@/lib/insights/hofstede';
import type { OrbitPlacement } from '@/lib/insights/culture-space';

export interface SceneBody {
  id: string;
  name: string;
  iso2: string | null;
  scores: Scores;
}

export interface SceneProps {
  view: 'orbit' | 'space';
  bodies: SceneBody[];
  /** Orbit view: where each body sits; absent ids are hidden (e.g. the centre itself). */
  placements: OrbitPlacement[];
  orbitMode: 'distance' | DimensionKey;
  scaleMax: number;
  center: { label: string; iso2: string | null; scores: Scores };
  /** Space view axes: [across, up, depth]. */
  axes: [DimensionKey, DimensionKey, DimensionKey];
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  reducedMotion: boolean;
  /** False while the card is off screen: stop drawing frames, keep the scene mounted. */
  active: boolean;
}

const R = 3.7; // outer orbit radius, world units
/** In distance mode the scale starts at the sun's edge, so close markets never sink into it. */
const SUN_CLEAR = 0.95;
/** World radius for a 0–1 orbit fraction. */
const orbitRadius = (frac: number, mode: 'distance' | DimensionKey) => (mode === 'distance' ? SUN_CLEAR + frac * (R - SUN_CLEAR) : frac * R);
/** Tilt the flag globes toward the camera so the flag, not its pole, faces the viewer. */
const FACE_TILT = 0.55;
const HALF = 2.6; // space cube half-size
const INK = '#1d1d1f';
const ACCENT = '#0071e3';

type Vec3 = [number, number, number];

const dimLabel = (k: DimensionKey) => DIMENSIONS.find((d) => d.key === k)!.label;
const toCube = (v: number) => (Math.min(100, Math.max(0, v)) / 100) * 2 * HALF - HALF;
const damp = (dt: number, reduced: boolean, rate = 4) => (reduced ? 1 : 1 - Math.exp(-dt * rate));

/**
 * A DOM label pinned to a point in the scene. Labels live in one plain HTML
 * layer over the canvas and are moved each frame by <LabelProjector>, so they
 * stay crisp on a projector and mount and unmount like any React element.
 */
interface LabelSpec {
  id: string;
  /** A fixed world position, or the id of a planet to follow. */
  at: Vec3 | { planet: string; lift: number };
  node: ReactNode;
}

/** Mutable state shared by the canvas and the label layer, kept in a ref. */
interface Shared {
  planets: Map<string, THREE.Group>;
  labelEls: Map<string, HTMLDivElement>;
  specs: LabelSpec[];
}
type SharedRef = RefObject<Shared>;

/** Flag texture without Suspense: the planet shows a plain glossy colour until the image lands. */
function useFlagTexture(iso2: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!iso2) return;
    let alive = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(`https://flagcdn.com/w320/${iso2}.png`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      loaded = t;
      if (alive) setTex(t);
      else t.dispose();
    });
    return () => {
      alive = false;
      loaded?.dispose();
      setTex(null);
    };
  }, [iso2]);
  return tex;
}

function Planet({
  body,
  target,
  visible,
  selected,
  hovered,
  dimmed,
  view,
  shared,
  onSelect,
  onHover,
  reducedMotion,
}: {
  body: SceneBody;
  target: MutableRefObject<THREE.Vector3>;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  view: 'orbit' | 'space';
  shared: SharedRef;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const drop = useRef<THREE.Group>(null);
  const flag = useFlagTexture(body.iso2);
  const scale = useRef(0);

  useEffect(() => {
    const g = group.current;
    const planets = shared.current.planets;
    if (!g) return;
    planets.set(body.id, g);
    return () => {
      planets.delete(body.id);
    };
  }, [body.id, shared]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.lerp(target.current, damp(dt, reducedMotion));
    const want = visible ? (hovered || selected ? 1.25 : 1) : 0;
    scale.current += (want - scale.current) * damp(dt, reducedMotion, 6);
    const s = Math.max(0.0001, scale.current);
    g.scale.setScalar(s);
    if (ball.current && !reducedMotion) ball.current.rotation.y += dt * 0.35;
    if (drop.current) {
      // Drop line from the point to the cube floor, in the group's scaled space.
      const h = g.position.y + HALF;
      drop.current.visible = view === 'space' && visible && h > 0.05;
      drop.current.scale.set(1, Math.max(0.001, h) / s, 1);
      drop.current.position.y = -h / 2 / s;
    }
  });

  return (
    <group ref={group}>
      <group rotation={[FACE_TILT, 0, 0]}>
      <mesh
        ref={ball}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : body.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(body.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.26, 48, 32]} />
        <meshStandardMaterial
          key={flag ? 'flag' : 'plain'}
          map={flag}
          color={flag ? '#ffffff' : '#c9ced8'}
          roughness={0.32}
          metalness={0.05}
          transparent
          opacity={dimmed ? 0.35 : 1}
        />
      </mesh>
      </group>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.018, 12, 64]} />
          <meshBasicMaterial color={ACCENT} />
        </mesh>
      )}
      <group ref={drop}>
        <mesh>
          <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
          <meshBasicMaterial color={INK} transparent opacity={0.22} />
        </mesh>
      </group>
    </group>
  );
}

/** Soft radial glow, drawn once into a canvas. */
function useGlowTexture() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.35, 'rgba(255,240,228,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** The orbit's centre: a plain glowing pearl (a flag this large distorts badly on a sphere); its label names it. */
function Sun({ visible, reducedMotion }: { visible: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const glow = useGlowTexture();
  const scale = useRef(0);
  useFrame((_, dt) => {
    scale.current += ((visible ? 1 : 0) - scale.current) * damp(dt, reducedMotion, 5);
    group.current?.scale.setScalar(Math.max(0.0001, scale.current));
  });
  return (
    <group ref={group}>
      <sprite scale={[2.6, 2.6, 1]}>
        <spriteMaterial map={glow} transparent depthWrite={false} />
      </sprite>
      <mesh>
        <sphereGeometry args={[0.42, 64, 48]} />
        <meshPhysicalMaterial color="#f7f4ef" emissive="#fff3e6" emissiveIntensity={0.3} roughness={0.18} clearcoat={1} clearcoatRoughness={0.15} />
      </mesh>
    </group>
  );
}

function circlePoints(r: number, seg = 128): Vec3[] {
  return Array.from({ length: seg + 1 }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  });
}

function orbitRings(orbitMode: SceneProps['orbitMode'], scaleMax: number) {
  return orbitMode === 'distance'
    ? Array.from({ length: Math.round(scaleMax / 0.5) }, (_, i) => (i + 1) * 0.5).map((v) => ({ v, r: orbitRadius(v / scaleMax, orbitMode), text: v.toFixed(1) }))
    : [25, 50, 75, 100].map((v) => ({ v, r: (v / 100) * R, text: String(v) }));
}

function OrbitRings({ orbitMode, scaleMax, centerScore }: { orbitMode: SceneProps['orbitMode']; scaleMax: number; centerScore: number | null }) {
  return (
    <group>
      {orbitRings(orbitMode, scaleMax).map(({ v, r }) => (
        <Line key={`${orbitMode}-${v}`} points={circlePoints(r)} color={INK} transparent opacity={0.13} lineWidth={1} />
      ))}
      {centerScore !== null && (
        <Line
          key={`centre-${orbitMode}-${centerScore}`}
          points={circlePoints((centerScore / 100) * R)}
          color={ACCENT}
          transparent
          opacity={0.75}
          lineWidth={1.5}
          dashed
          dashSize={0.18}
          gapSize={0.12}
        />
      )}
    </group>
  );
}

const H = HALF;
const CUBE_EDGES: Vec3[][] = [
  [[-H, -H, -H], [H, -H, -H], [H, -H, H], [-H, -H, H], [-H, -H, -H]],
  [[-H, H, -H], [H, H, -H], [H, H, H], [-H, H, H], [-H, H, -H]],
  [[-H, -H, -H], [-H, H, -H]],
  [[H, -H, -H], [H, H, -H]],
  [[H, -H, H], [H, H, H]],
  [[-H, -H, H], [-H, H, H]],
];
const FLOOR_GRID: Vec3[][] = [25, 50, 75].flatMap((v) => {
  const c = toCube(v);
  return [
    [[c, -H, -H], [c, -H, H]],
    [[-H, -H, c], [H, -H, c]],
  ] as Vec3[][];
});

function SpaceFrame() {
  return (
    <group>
      {CUBE_EDGES.map((pts, i) => (
        <Line key={`e${i}`} points={pts} color={INK} transparent opacity={0.16} lineWidth={1} />
      ))}
      {FLOOR_GRID.map((pts, i) => (
        <Line key={`g${i}`} points={pts} color={INK} transparent opacity={0.07} lineWidth={1} />
      ))}
      <Line points={[[-H, -H, -H], [H, -H, -H]]} color={ACCENT} lineWidth={2} />
      <Line points={[[-H, -H, -H], [-H, H, -H]]} color={ACCENT} lineWidth={2} />
      <Line points={[[-H, -H, -H], [-H, -H, H]]} color={ACCENT} lineWidth={2} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -H - 0.001, 0]}>
        <planeGeometry args={[2 * H, 2 * H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Advances the shared orbit phase and keeps each planet's target in sync. */
function Choreographer({ props, targets }: { props: SceneProps; targets: Map<string, MutableRefObject<THREE.Vector3>> }) {
  const phase = useRef(0);
  const { view, placements, axes, bodies, selected, hovered, reducedMotion } = props;
  const byId = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  useFrame((_, dt) => {
    const paused = reducedMotion || selected !== null || hovered !== null;
    if (view === 'orbit' && !paused) phase.current += dt * 0.06;
    for (const b of bodies) {
      const t = targets.get(b.id);
      if (!t) continue;
      if (view === 'orbit') {
        const p = byId.get(b.id);
        const r = orbitRadius(p?.radius ?? 0, props.orbitMode);
        const a = (p?.angle ?? 0) + phase.current;
        t.current.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      } else {
        t.current.set(toCube(b.scores[axes[0]]), toCube(b.scores[axes[1]]), toCube(b.scores[axes[2]]));
      }
    }
  });
  return null;
}

function CameraRig({ view, reducedMotion }: { view: SceneProps['view']; reducedMotion: boolean }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    goal.current = view === 'orbit' ? new THREE.Vector3(0, 5.8, 7.1) : new THREE.Vector3(7.2, 4.6, 8.2);
  }, [view]);
  useFrame((_, dt) => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, damp(dt, reducedMotion, 3));
    if (camera.position.distanceTo(goal.current) < 0.02) goal.current = null; // hand control back to the user
  });
  return null;
}

/** Projects every label's anchor to screen space and moves its DOM node there. */
function LabelProjector({ shared }: { shared: SharedRef }) {
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    const v = scratch.current;
    const { specs, labelEls, planets } = shared.current;
    for (const spec of specs) {
      const el = labelEls.get(spec.id);
      if (!el) continue;
      let show = true;
      if (Array.isArray(spec.at)) {
        v.set(spec.at[0], spec.at[1], spec.at[2]);
      } else {
        const g = planets.get(spec.at.planet);
        if (!g) {
          el.style.visibility = 'hidden';
          continue;
        }
        v.copy(g.position);
        v.y += spec.at.lift * g.scale.x;
        show = g.scale.x > 0.3;
      }
      v.project(camera);
      if (v.z > 1) show = false;
      el.style.visibility = show ? 'visible' : 'hidden';
      el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0) translate(-50%, -50%)`;
      el.style.zIndex = String(Math.round((1 - v.z) * 10000));
    }
  });
  return null;
}

const pill = 'whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold shadow-[0_1px_4px_rgba(15,23,42,0.12)]';

export default function Scene(props: SceneProps) {
  const { view, bodies, placements, orbitMode, scaleMax, center, axes, selected, hovered, onSelect, onHover, reducedMotion, active } = props;

  const targets = useMemo(() => {
    const m = new Map<string, MutableRefObject<THREE.Vector3>>();
    for (const b of bodies) m.set(b.id, { current: new THREE.Vector3() });
    return m;
  }, [bodies]);

  const shared = useRef<Shared>({ planets: new Map(), labelEls: new Map(), specs: [] });
  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const focus = selected ?? hovered;
  const centerScore = view === 'orbit' && orbitMode !== 'distance' ? center.scores[orbitMode] : null;

  const specs: LabelSpec[] = [];
  for (const b of bodies) {
    const p = placementById.get(b.id);
    if (view === 'orbit' && !p) continue;
    const value = view === 'space' ? null : orbitMode === 'distance' ? (p?.value ?? 0).toFixed(2) : String(b.scores[orbitMode]);
    const on = selected === b.id;
    specs.push({
      id: `p:${b.id}`,
      at: { planet: b.id, lift: 0.5 },
      node: (
        <div className={`${pill} transition-opacity duration-200 ${on ? 'bg-accent text-white' : 'bg-white/90 text-ink'}`} style={{ opacity: focus && focus !== b.id ? 0.4 : 1 }}>
          {b.name}
          {value && <span className={`num ml-1.5 font-medium ${on ? 'text-white/80' : 'text-ink-2'}`}>{value}</span>}
        </div>
      ),
    });
  }
  if (view === 'orbit') {
    if (orbitMode === 'distance') {
      specs.push({ id: 'sun', at: [0, 0.85, 0], node: <div className={`${pill} bg-ink text-white`}>{center.label}</div> });
    }
    for (const { v, r, text } of orbitRings(orbitMode, scaleMax)) {
      specs.push({ id: `ring:${orbitMode}:${v}`, at: [0, 0, r], node: <span className="num rounded-full bg-white/70 px-1.5 text-[10px] font-medium text-ink-2">{text}</span> });
    }
    if (centerScore !== null) {
      specs.push({
        id: `centre-ring:${orbitMode}`,
        at: [0, 0, -(centerScore / 100) * R],
        node: <span className="whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white">{center.label} {centerScore}</span>,
      });
    }
  } else {
    const [x, y, z] = axes;
    const axisPill = 'whitespace-nowrap rounded-full bg-white/85 px-1.5 py-0.5 text-[11px] font-semibold text-accent';
    const tick = 'num text-[10px] font-medium text-ink-2';
    specs.push(
      { id: 'ax:x', at: [H + 0.45, -H, -H], node: <span className={axisPill}>{dimLabel(x)} →</span> },
      { id: 'ax:y', at: [-H, H + 0.35, -H], node: <span className={axisPill}>{dimLabel(y)} ↑</span> },
      { id: 'ax:z', at: [-H, -H, H + 0.45], node: <span className={axisPill}>{dimLabel(z)} →</span> },
      { id: 't:0', at: [-H - 0.2, -H - 0.25, -H], node: <span className={tick}>0</span> },
      { id: 't:x', at: [H, -H - 0.3, -H], node: <span className={tick}>100</span> },
      { id: 't:y', at: [-H - 0.3, H, -H], node: <span className={tick}>100</span> },
      { id: 't:z', at: [-H - 0.3, -H, H], node: <span className={tick}>100</span> }
    );
  }
  // The projector reads specs every frame; refresh them after each render.
  useEffect(() => {
    shared.current.specs = specs;
  });

  return (
    <div className="absolute inset-0">
      <Canvas frameloop={active ? 'always' : 'never'} camera={{ position: [0, 5.8, 7.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => onSelect(null)}>
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#ffffff', '#dfe4ee', 0.6]} />
        <directionalLight position={[5, 9, 6]} intensity={1.4} />
        <directionalLight position={[-6, 3, -4]} intensity={0.35} />

        <Choreographer props={props} targets={targets} />
        <CameraRig view={view} reducedMotion={reducedMotion} />
        <LabelProjector shared={shared} />

        {view === 'orbit' ? <OrbitRings orbitMode={orbitMode} scaleMax={scaleMax} centerScore={centerScore} /> : <SpaceFrame />}
        <Sun visible={view === 'orbit' && orbitMode === 'distance'} reducedMotion={reducedMotion} />

        {bodies.map((b) => (
          <Planet
            key={b.id}
            body={b}
            target={targets.get(b.id)!}
            visible={view === 'space' || placementById.has(b.id)}
            selected={selected === b.id}
            hovered={hovered === b.id}
            dimmed={focus !== null && focus !== b.id}
            view={view}
            shared={shared}
            onSelect={onSelect}
            onHover={onHover}
            reducedMotion={reducedMotion}
          />
        ))}

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          minDistance={5}
          maxDistance={16}
          maxPolarAngle={Math.PI * 0.49}
          autoRotate={view === 'space' && !reducedMotion && focus === null}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {specs.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) shared.current.labelEls.set(s.id, el);
              else shared.current.labelEls.delete(s.id);
            }}
            className="absolute left-0 top-0 will-change-transform"
            style={{ visibility: 'hidden' }}
          >
            {s.node}
          </div>
        ))}
      </div>
    </div>
  );
}
