/* =====================================================================
   src/world.js — 3D Universe builder
   
   Builds a fully self-contained Three.js scene for either Universe A
   (Hero, blue/cyan) or Universe B (Devil, crimson/purple).
   Also creates matching cannon-es static bodies for physics collision.

   Returns: { scene, portalMesh, portalPosition, playerStart }
   ===================================================================== */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// ── Theme definitions ─────────────────────────────────────────────────
const THEMES = {
  hero: {
    skyColor:       0x020d1a,
    fogColor:       0x020d1a,
    fogNear:        30,
    fogFar:         95,
    ambientColor:   0x003355,
    ambientInt:     0.7,
    sunColor:       0x00e5ff,
    sunInt:         1.4,
    groundColor:    0x0d2a3a,
    groundEmissive: 0x001020,
    gridColor:      0x004466,
    platColor:      0x004466,
    platEmissive:   0x00bcd4,
    platEmissiveInt:0.35,
    edgeColor:      0x00e5ff,
    portalColor:    0x00e5ff,
    portalInnerOp:  0.14,
    portalGlowInt:  2.5,
    // Start position and starting angle for camera
    playerStart:    new THREE.Vector3(0, 1.2, 9),
  },
  devil: {
    skyColor:       0x0a000e,
    fogColor:       0x0a000e,
    fogNear:        30,
    fogFar:         95,
    ambientColor:   0x2a0015,
    ambientInt:     0.7,
    sunColor:       0xe040fb,
    sunInt:         1.4,
    groundColor:    0x180512,
    groundEmissive: 0x0a000a,
    gridColor:      0x400020,
    platColor:      0x2a0018,
    platEmissive:   0xe040fb,
    platEmissiveInt:0.35,
    edgeColor:      0xe040fb,
    portalColor:    0xe040fb,
    portalInnerOp:  0.14,
    portalGlowInt:  2.5,
    playerStart:    new THREE.Vector3(0, 1.2, 9),
  },
}

// ── Portal position (same in both universes) ──────────────────────────
export const PORTAL_WORLD_POS = new THREE.Vector3(0, 1.5, -14)
export const PORTAL_CAPTURE_RADIUS = 2.2   // world units
export const PORTAL_COOLDOWN_SEC   = 3.5   // seconds before re-capture

// ── Platform layout (same geometry, different colours) ────────────────
//    Each entry: { x, y, z, w, h, d }
const PLATFORM_DEFS = [
  { x: -5.5, y: 1.6, z:  1.5,  w: 4.5, h: 0.3, d: 2.5 },
  { x:  5.5, y: 1.6, z:  1.5,  w: 4.5, h: 0.3, d: 2.5 },
  { x:  0,   y: 3.5, z: -4.5,  w: 4.0, h: 0.3, d: 3.0 },
  { x: -4,   y: 2.8, z: -9,    w: 3.0, h: 0.3, d: 2.0 },
  { x:  4,   y: 2.8, z: -9,    w: 3.0, h: 0.3, d: 2.0 },
]

// ── Public build function ─────────────────────────────────────────────
/**
 * @param {'hero'|'devil'} themeName
 * @param {CANNON.World}   physicsWorld
 * @returns {{ scene, portalMesh, portalPosition, playerStart }}
 */
export function buildWorld(themeName, physicsWorld) {
  const T = THEMES[themeName]

  // ── Scene setup ───────────────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(T.skyColor)
  scene.fog        = new THREE.Fog(T.fogColor, T.fogNear, T.fogFar)

  // ── Lighting ──────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(T.ambientColor, T.ambientInt)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(T.sunColor, T.sunInt)
  sun.position.set(8, 18, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near   = 0.5
  sun.shadow.camera.far    = 80
  sun.shadow.camera.left   = -25
  sun.shadow.camera.right  =  25
  sun.shadow.camera.top    =  25
  sun.shadow.camera.bottom = -25
  sun.shadow.bias = -0.001
  scene.add(sun)

  // Subtle fill light from below
  const fillLight = new THREE.PointLight(T.sunColor, 0.3, 30)
  fillLight.position.set(0, -2, 0)
  scene.add(fillLight)

  // ── Ground (visual) ───────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(80, 80, 1, 1)
  const groundMat = new THREE.MeshStandardMaterial({
    color:     T.groundColor,
    emissive:  T.groundEmissive,
    roughness: 0.9,
    metalness: 0.15,
  })
  const groundMesh = new THREE.Mesh(groundGeo, groundMat)
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.receiveShadow = true
  scene.add(groundMesh)

  // Perspective grid overlay on ground
  const grid = new THREE.GridHelper(80, 40, T.gridColor, T.gridColor)
  grid.material.opacity     = 0.12
  grid.material.transparent = true
  scene.add(grid)

  // ── Ground (physics) ──────────────────────────────────────────────
  const groundBody = new CANNON.Body({ mass: 0 })
  groundBody.addShape(new CANNON.Plane())
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  physicsWorld.addBody(groundBody)

  // ── Platforms ─────────────────────────────────────────────────────
  for (const p of PLATFORM_DEFS) {
    // Visual mesh
    const geo = new THREE.BoxGeometry(p.w, p.h, p.d)
    const mat = new THREE.MeshStandardMaterial({
      color:            T.platColor,
      emissive:         T.platEmissive,
      emissiveIntensity:T.platEmissiveInt,
      roughness: 0.4,
      metalness: 0.6,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(p.x, p.y, p.z)
    mesh.castShadow    = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // Glowing edge lines
    const edges   = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({
      color:       T.edgeColor,
      transparent: true,
      opacity:     0.7,
    })
    const edgeMesh = new THREE.LineSegments(edges, edgeMat)
    edgeMesh.position.set(p.x, p.y, p.z)
    scene.add(edgeMesh)

    // Physics body
    const body = new CANNON.Body({ mass: 0 })
    body.addShape(new CANNON.Box(new CANNON.Vec3(p.w / 2, p.h / 2, p.d / 2)))
    body.position.set(p.x, p.y, p.z)
    physicsWorld.addBody(body)
  }

  // ── Portal ────────────────────────────────────────────────────────
  const portalPos = PORTAL_WORLD_POS.clone()

  // Outer ring torus
  const torusGeo = new THREE.TorusGeometry(1.6, 0.14, 12, 48)
  const torusMat = new THREE.MeshStandardMaterial({
    color:            T.portalColor,
    emissive:         T.portalColor,
    emissiveIntensity:T.portalGlowInt,
    roughness: 0,
    metalness: 0.5,
    transparent: true,
    opacity: 0.95,
  })
  const portalMesh = new THREE.Mesh(torusGeo, torusMat)
  portalMesh.position.copy(portalPos)
  scene.add(portalMesh)

  // Second, slightly larger ghost ring
  const outerGeo = new THREE.TorusGeometry(1.9, 0.04, 8, 48)
  const outerMat = new THREE.MeshBasicMaterial({
    color:       T.portalColor,
    transparent: true,
    opacity:     0.3,
  })
  const outerRing = new THREE.Mesh(outerGeo, outerMat)
  outerRing.position.copy(portalPos)
  scene.add(outerRing)

  // Filled inner disc (semi-transparent)
  const discGeo = new THREE.CircleGeometry(1.46, 48)
  const discMat = new THREE.MeshBasicMaterial({
    color:       T.portalColor,
    transparent: true,
    opacity:     T.portalInnerOp,
    side:        THREE.DoubleSide,
  })
  const discMesh = new THREE.Mesh(discGeo, discMat)
  discMesh.position.copy(portalPos)
  scene.add(discMesh)

  // Portal ground base pillar / platform so player can reach it
  const baseMat = new THREE.MeshStandardMaterial({
    color:            T.platColor,
    emissive:         T.platEmissive,
    emissiveIntensity:0.25,
    roughness: 0.5,
    metalness: 0.5,
  })
  const baseGeo = new THREE.BoxGeometry(3.5, 0.2, 3.5)
  const baseMesh = new THREE.Mesh(baseGeo, baseMat)
  baseMesh.position.set(portalPos.x, 0.1, portalPos.z)
  baseMesh.receiveShadow = true
  scene.add(baseMesh)

  // Return portal mesh so game.js can animate it
  return {
    scene,
    portalMesh,    // the torus (animated each frame)
    outerRing,     // secondary ring (animated)
    discMesh,      // inner disc (animated)
    portalPosition: { x: portalPos.x, y: portalPos.y, z: portalPos.z },
    playerStart: T.playerStart.clone(),
  }
}

// ── Portal animation helper (called every frame from game.js) ─────────
/**
 * @param {THREE.Mesh} portalMesh
 * @param {THREE.Mesh} outerRing
 * @param {THREE.Mesh} discMesh
 * @param {number}     t  total elapsed seconds
 */
export function animatePortal(portalMesh, outerRing, discMesh, t) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 2.8)

  portalMesh.rotation.z = t * 0.6
  portalMesh.material.emissiveIntensity = 2.0 + 1.5 * Math.sin(t * 2.8)

  outerRing.rotation.z = -t * 0.35
  outerRing.material.opacity = 0.15 + 0.2 * Math.abs(Math.sin(t * 1.5))

  discMesh.material.opacity = 0.08 + 0.1 * pulse
}

