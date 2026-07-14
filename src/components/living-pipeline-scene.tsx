"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";

// ─── Brand palette ────────────────────────────────────────────────────────────
const CARD_COLORS = [
  "#4F46E5", // signal violet
  "#7C6FF7", // soft violet
  "#A78BFA", // lavender-violet
  "#C4BFFE", // very light lavender
  "#FF7A59", // warm coral
  "#FFB59A", // light coral
  "#E8E6FF", // pale lavender
  "#C8C6E0", // muted lavender
];

// ─── Text-zone constants (NDC = Normalised Device Coords, range −1…+1) ────────
//
// Projection reference: FOV=55 vertical, camera z=6, viewport 1440×900.
//   visible width at z=0  = 2·6·tan(FOVh/2) where FOVh=atan(tan(27.5°)·1.6)
//   → ~10 world units → 1 NDC unit = 720 px horizontally, 450 px vertically.
//
// max-w-3xl = 768 px → NDC ±768/1440 = ±0.533.
// "without the enterprise" at 72 px bold nearly fills that width → use 0.55.
// 30 px padding each side → +30/720 = +0.042 → final// ZONE_NDC_HX: generous — covers the full max-w-3xl container width at 1440px.
// 768 px / 1440 px = 0.533, plus 60 px padding (0.083) → 0.62.
const ZONE_NDC_HX = 0.62;

// ZONE_NDC_HY: covers heading (3×72px) + subtext + eyebrow + all gaps.
// Measured block ≈ 520 px centred in 900 px viewport → ±260 px → 0.578 NDC.
// Add 40 px padding (0.089) → 0.67.
const ZONE_NDC_HY = 0.67;

// Card half-size in NDC: scale≈1, dist≈7 → (1.6/2)/7/tan(39.8°) ≈ 0.14.
// We expand the check zone by this so fade starts when card EDGE enters the zone.
const CARD_NDC_HALF = 0.14;

// Blend distance: 0.14 NDC ≈ 100 px — cards start fading 100 px before zone edge.
const BLEND_NDC = 0.14;

// Derived check bounds (zone + card half-size):
const CHECK_HX = ZONE_NDC_HX + CARD_NDC_HALF; // 0.76
const CHECK_HY = ZONE_NDC_HY + CARD_NDC_HALF; // 0.81

// Opacity inside text zone.
const OPACITY_IN_ZONE = 0.12;
// Faster lerp — settles in ~12 frames (~0.2s at 60fps).
const LERP_SPEED = 0.22;

// ─── Reusable projection vector — avoid per-frame allocation ─────────────────
const _projVec = new THREE.Vector3();

// ─── Smooth cubic interpolation (matches GLSL smoothstep) ────────────────────
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FloatingCard {
  id: number;
  startPos: [number, number, number];
  rotation: [number, number, number];
  color: string;
  speed: number;
  phase: number;
  driftX: number;
  driftY: number;
  scale: number;
  baseOpacity: number;
  // Opacity used for the INITIAL material render (before useFrame settles).
  // Cards whose startPos is inside the text zone start at OPACITY_IN_ZONE
  // so there is no flash of full opacity on mount.
  initialOpacity: number;
}

// ─── Per-card component ───────────────────────────────────────────────────────
function PipelineCard({ card }: { card: FloatingCard }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const t = useRef(card.phase);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    t.current += delta * card.speed;

    // ── Drift: compound sinusoid so each card traces a lazy, non-repeating path ─
    const curX =
      card.startPos[0] +
      Math.sin(t.current * 0.55 + card.phase) * card.driftX +
      Math.cos(t.current * 0.28) * card.driftX * 0.35;
    const curY =
      card.startPos[1] +
      Math.cos(t.current * 0.42 + card.phase * 0.7) * card.driftY +
      Math.sin(t.current * 0.33) * card.driftY * 0.45;

    meshRef.current.position.x = curX;
    meshRef.current.position.y = curY;

    // ── Gentle rotation ──────────────────────────────────────────────────────
    meshRef.current.rotation.z =
      card.rotation[2] + Math.sin(t.current * 0.25) * 0.09;
    meshRef.current.rotation.x =
      card.rotation[0] + Math.cos(t.current * 0.35) * 0.05;
    meshRef.current.rotation.y =
      card.rotation[1] + Math.sin(t.current * 0.20) * 0.06;

    // ── Proximity fade — NDC-based (screen-accurate regardless of card depth) ─
    //
    // Project the card's LIVE world position to NDC so we compare against
    // the same coordinate space as the CSS text block, regardless of depth.
    _projVec.set(curX, curY, card.startPos[2]);
    _projVec.project(state.camera); // mutates in-place to NDC
    const ndcX = _projVec.x; // −1 = left edge, +1 = right edge
    const ndcY = _projVec.y; // −1 = bottom,    +1 = top

    // How far the card's NDC position is INSIDE each check-zone axis.
    // Positive → inside that axis's bound.  Negative → outside.
    const inX = CHECK_HX - Math.abs(ndcX);
    const inY = CHECK_HY - Math.abs(ndcY);

    // The card is "in zone" only when inside BOTH axes.
    // `margin` = how far inside the constraining (tightest) axis.
    // When outside either axis → margin = 0 (treat as fully outside).
    const margin = inX > 0 && inY > 0 ? Math.min(inX, inY) : 0;

    // smoothstep over [0, BLEND_NDC]:
    //   margin = 0          → s = 0 → t_prox = 1 → baseOpacity  (at/outside zone edge)
    //   margin = BLEND_NDC  → s = 1 → t_prox = 0 → OPACITY_IN_ZONE (well inside zone)
    const s = smoothstep(0, BLEND_NDC, margin);
    const t_proximity = 1 - s; // 0 = inside zone, 1 = outside zone

    const targetOpacity =
      OPACITY_IN_ZONE + t_proximity * (card.baseOpacity - OPACITY_IN_ZONE);

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, LERP_SPEED);
  });

  return (
    <mesh
      ref={meshRef}
      position={card.startPos}
      rotation={card.rotation}
      scale={card.scale}
    >
      <RoundedBox args={[1.6, 1, 0.06]} radius={0.12} smoothness={4}>
        {/*
          initialOpacity: inner cards start at OPACITY_IN_ZONE so they are
          already dim on the very first render frame, before useFrame lerps.
          Outer cards start at baseOpacity. This prevents the 0.2s "flash"
          of full-opacity cards on mount.
        */}
        <meshStandardMaterial
          color={card.color}
          transparent
          opacity={card.initialOpacity}
          depthWrite={false}
          roughness={0.25}
          metalness={0.08}
        />
      </RoundedBox>
    </mesh>
  );
}

// ─── Scene: 20 cards in 3 rings ───────────────────────────────────────────────
function Scene({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { size } = useThree();
  const aspect = size.width / size.height;

  const cards: FloatingCard[] = useMemo(() => {
    // [startX, startY, startZ, scale, speed, driftX, driftY]
    // Base layout coordinates originally balanced for 1.6 aspect ratio (1440x900).
    // Pushed outer coordinates wider to ensure coverage at high aspect ratios.
    const defs: [number, number, number, number, number, number, number][] = [
      // ── INNER (start near/in text zone, will drift through, triggering fade) ──
      [-1.2,  1.5, -1.0,  1.00, 0.31, 1.6, 0.8],  // 0
      [ 1.4,  0.6, -0.7,  1.08, 0.28, 1.5, 0.8],  // 1
      [-0.6, -1.0, -1.4,  0.88, 0.35, 1.4, 0.7],  // 2
      [ 0.8, -1.6, -0.9,  0.95, 0.30, 1.5, 0.7],  // 3
      [-1.8,  0.0, -1.8,  0.78, 0.26, 1.3, 0.6],  // 4
      [ 0.0,  0.8, -2.4,  0.68, 0.23, 1.1, 0.6],  // 5  deep, almost always in zone
      // ── MID (orbit the text zone, occasionally clip its edge) ────────────────
      [-3.0,  1.2, -1.3,  0.90, 0.34, 1.3, 0.8],  // 6
      [ 3.0,  1.2, -1.3,  0.90, 0.27, 1.3, 0.8],  // 7
      [-2.6, -0.8, -2.0,  0.75, 0.36, 1.2, 0.7],  // 8
      [ 2.6, -0.8, -2.0,  0.75, 0.33, 1.2, 0.7],  // 9
      [-3.4,  2.0, -1.5,  0.82, 0.29, 1.0, 0.6],  // 10
      [ 3.4,  2.0, -1.5,  0.82, 0.38, 1.0, 0.6],  // 11
      [-2.2, -2.2, -1.2,  0.85, 0.32, 1.1, 0.7],  // 12
      [ 2.2, -2.2, -1.2,  0.85, 0.31, 1.1, 0.7],  // 13
      // ── OUTER (clear of text zone, full opacity anchors, pushed further out) ──
      [-5.0,  0.4, -1.0,  0.92, 0.33, 0.7, 0.6],  // 14
      [ 5.0,  0.4, -1.0,  0.92, 0.26, 0.7, 0.6],  // 15
      [-5.5, -1.4, -2.0,  0.72, 0.38, 0.6, 0.5],  // 16
      [ 5.5, -1.4, -2.0,  0.72, 0.34, 0.6, 0.5],  // 17
      [-4.8,  2.4, -2.5,  0.62, 0.24, 0.7, 0.5],  // 18
      [ 4.8,  2.4, -2.5,  0.62, 0.29, 0.7, 0.5],  // 19
      // ── FAR OUTER EDGE ANCHORS (ensures zero empty space at 1920px+) ─────────
      [-5.8, -0.2, -1.2,  0.88, 0.32, 0.6, 0.5],  // 20
      [ 5.8,  0.8, -1.2,  0.88, 0.28, 0.6, 0.5],  // 21
    ];

    // Reference aspect ratio is 1.6 (1440x900).
    const scaleFactorX = Math.max(1.0, aspect / 1.6);
    const tanVHalf = Math.tan(27.5 * Math.PI / 180);

    return defs.map(([x, y, z, scale, speed, driftX, driftY], i) => {
      const base = Math.max(0.38, 0.60 - Math.abs(z) * 0.055);

      const dist = 6 - z;
      const refHalfWidth = dist * tanVHalf * 1.6;
      
      // Target screen percentage based on base coords
      const pctX = x / refHalfWidth;
      
      // On wider viewports, scale out-of-center cards dynamically
      let scaledPctX = pctX;
      if (Math.abs(pctX) > 0.25) {
        const stretch = 1.0 + (scaleFactorX - 1.0) * 0.35;
        scaledPctX = Math.sign(pctX) * Math.min(0.92, Math.abs(pctX) * stretch);
      }
      
      // Map back to current actual aspect ratio viewport coordinates
      const actualHalfWidth = dist * tanVHalf * aspect;
      const scaledX = scaledPctX * actualHalfWidth;
      
      // Scale driftX to keep relative movement scope proportional
      const scaledDriftX = x === 0 ? driftX : driftX * (scaledX / x);

      // Recalculate start NDC for initial opacity check
      const ndcXStart = scaledX / (dist * 0.832);
      const ndcYStart = y / (dist * tanVHalf);
      const inZoneAtStart =
        Math.abs(ndcXStart) < CHECK_HX && Math.abs(ndcYStart) < CHECK_HY;

      return {
        id: i,
        startPos: [scaledX, y, z] as [number, number, number],
        rotation: [
          (i * 0.31) % 0.5 - 0.25,
          (i * 0.23) % 0.6 - 0.30,
          (i * 0.17) % 0.5 - 0.25,
        ] as [number, number, number],
        color: CARD_COLORS[i % CARD_COLORS.length],
        speed,
        phase: i * 1.618,
        driftX: scaledDriftX,
        driftY,
        scale,
        baseOpacity: base,
        // Inner cards start dim — no flash of full opacity before useFrame settles
        initialOpacity: inZoneAtStart ? OPACITY_IN_ZONE : base,
      };
    });
  }, [aspect]);

  // Very gentle parallax — kept small so it can't swing a near-edge card off screen
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      mouseRef.current.x * 0.10,
      0.03
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -mouseRef.current.y * 0.07,
      0.03
    );
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 5]} intensity={0.55} />
      <directionalLight position={[-4, -2, 3]} intensity={0.25} color="#E8E6FF" />
      <group ref={groupRef}>
        {cards.map((card) => (
          <PipelineCard key={card.id} card={card} />
        ))}
      </group>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export function LivingPipelineScene() {
  const mouseRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => 
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    container.addEventListener("mousemove", onMouseMove);
    return () => container.removeEventListener("mousemove", onMouseMove);
  }, [reducedMotion]);

  return (
    // Explicit z-index: 0 — canvas is always the BOTTOM layer.
    // Blur overlay (z=5) and text content (z=10) are above it in page.tsx.
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 55 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        {!reducedMotion && <Scene mouseRef={mouseRef} />}
      </Canvas>
    </div>
  );
}
