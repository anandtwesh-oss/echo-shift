/* =====================================================================
   src/world.js — Atmospheric 3D Multiverse Arena & Environment
   
   Builds a high-fidelity floating sci-fi fantasy arena inspired by the
   reference art:
     - Giant celestial skybox with split cosmic moon & nebulae (₹0 cost via
       procedural canvas textures).
     - Massive floating monolithic arena island with beveled metallic trim,
       perimeter neon conduits, central dividing rift, and underside stalactites.
     - Enhanced floating platforms with glowing runic trims and levitation crystals.
     - Floating sentinel obelisks hovering around the island perimeter.
     - Sea of volumetric clouds drifting below the floating arena.
     - Dimensional Gateway Portal with stepped dais, flanking monoliths,
       counter-rotating segmented rings, swirling cosmic vortex, and vertical light beam.
     - Ambient rising energy motes (cyan for Hero, crimson for Devil).
     - Precise Cannon-es physics collision bodies matching all visual structures.
   ===================================================================== */

import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// ── Theme definitions ─────────────────────────────────────────────────
const THEMES = {
  hero: {
    skyColor:       0x020d1a,
    fogColor:       0x031224,
    fogNear:        35,
    fogFar:         110,
    ambientColor:   0x0a2842,
    ambientInt:     1.1,
    sunColor:       0x80e5ff,
    sunInt:         1.8,
    rimColor:       0x00e5ff,
    rimInt:         1.2,
    islandStone:    0x0a1420,
    islandTrim:     0x122438,
    edgeGlow:       0x00e5ff,
    platColor:      0x0f2233,
    platEmissive:   0x0099cc,
    platEmissiveInt:0.4,
    portalColor:    0x00e5ff,
    portalBeamColor:0x33eeff,
    portalGlowInt:  3.0,
    particleColor:  0x00e5ff,
    playerStart:    new THREE.Vector3(0, 1.2, 9),
  },
  devil: {
    skyColor:       0x0c010a,
    fogColor:       0x15020e,
    fogNear:        35,
    fogFar:         110,
    ambientColor:   0x300518,
    ambientInt:     1.1,
    sunColor:       0xff4d79,
    sunInt:         1.8,
    rimColor:       0xff1744,
    rimInt:         1.2,
    islandStone:    0x18050e,
    islandTrim:     0x2c0a1a,
    edgeGlow:       0xff1744,
    platColor:      0x240815,
    platEmissive:   0xcc1144,
    platEmissiveInt:0.4,
    portalColor:    0xff1744,
    portalBeamColor:0xff4488,
    portalGlowInt:  3.0,
    particleColor:  0xff3366,
    playerStart:    new THREE.Vector3(0, 1.2, 9),
  },
}

// ── Portal position (same in both universes) ──────────────────────────
export const PORTAL_WORLD_POS = new THREE.Vector3(0, 1.6, -14)
export const PORTAL_CAPTURE_RADIUS = 2.4   // world units
export const PORTAL_COOLDOWN_SEC   = 3.5   // seconds before re-capture

// ── Platform layout (same geometry, different themes) ────────────────
const PLATFORM_DEFS = [
  { x: -5.5, y: 1.6, z:  1.5,  w: 4.5, h: 0.35, d: 2.5 },
  { x:  5.5, y: 1.6, z:  1.5,  w: 4.5, h: 0.35, d: 2.5 },
  { x:  0,   y: 3.5, z: -4.5,  w: 4.2, h: 0.35, d: 3.2 },
  { x: -4.2, y: 2.8, z: -9.0,  w: 3.2, h: 0.35, d: 2.2 },
  { x:  4.2, y: 2.8, z: -9.0,  w: 3.2, h: 0.35, d: 2.2 },
]

// ── Floating Sentinel Obelisks around perimeter ──────────────────────
const OBELISK_DEFS = [
  { x: -16.0, y:  2.0, z:   4.0, scale: 1.1, phase: 0.0 },
  { x:  16.0, y:  3.5, z:   4.0, scale: 1.2, phase: 1.2 },
  { x: -17.0, y:  5.0, z: -10.0, scale: 1.4, phase: 2.4 },
  { x:  17.0, y:  4.2, z: -10.0, scale: 1.3, phase: 3.6 },
  { x:  -8.0, y:  6.5, z: -23.0, scale: 1.5, phase: 4.8 },
  { x:   8.0, y:  7.0, z: -23.0, scale: 1.6, phase: 0.8 },
]

// ── Public build function ─────────────────────────────────────────────
/**
 * @param {'hero'|'devil'} themeName
 * @param {CANNON.World}   physicsWorld
 * @returns {object} Scene references and animation hooks
 */
export function buildWorld(themeName, physicsWorld) {
  const T = THEMES[themeName]
  const isHero = themeName === 'hero'

  // ── Scene & Atmospheric Fog ─────────────────────────────────────────
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(T.skyColor)
  scene.fog        = new THREE.Fog(T.fogColor, T.fogNear, T.fogFar)

  // ── Lighting ────────────────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(T.ambientColor, T.ambientInt)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(T.sunColor, T.sunInt)
  sun.position.set(isHero ? 14 : -14, 24, 16)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near   = 0.5
  sun.shadow.camera.far    = 90
  sun.shadow.camera.left   = -26
  sun.shadow.camera.right  =  26
  sun.shadow.camera.top    =  26
  sun.shadow.camera.bottom = -26
  sun.shadow.bias = -0.0008
  scene.add(sun)

  // Atmospheric rim light from opposite direction
  const rimLight = new THREE.DirectionalLight(T.rimColor, T.rimInt * 0.6)
  rimLight.position.set(isHero ? -14 : 14, 12, -20)
  scene.add(rimLight)

  // Portal point light
  const portalLight = new THREE.PointLight(T.portalColor, 2.5, 24, 1.2)
  portalLight.position.set(PORTAL_WORLD_POS.x, PORTAL_WORLD_POS.y + 1, PORTAL_WORLD_POS.z)
  scene.add(portalLight)

  // ── Procedural Celestial Sky Dome ───────────────────────────────────
  const skyMesh = _buildCelestialSky(themeName)
  scene.add(skyMesh)

  // ── Monolithic Floating Arena Island ────────────────────────────────
  const islandData = _buildFloatingIsland(themeName, physicsWorld)
  scene.add(islandData.group)

  // ── Floating Platforms ──────────────────────────────────────────────
  const platformCrystals = _buildPlatforms(themeName, physicsWorld, scene)

  // ── Floating Outer Sentinel Obelisks ────────────────────────────────
  const obeliskMeshes = _buildSentinelObelisks(themeName, scene)

  // ── Sea of Dimensional Clouds below Arena ───────────────────────────
  const cloudGroup = _buildCloudSea(themeName)
  scene.add(cloudGroup)

  // ── Ambient Rising Energy Motes ─────────────────────────────────────
  const particles = _buildAmbientParticles(themeName)
  scene.add(particles.mesh)

  // ── Dimensional Gateway Portal ──────────────────────────────────────
  const portalData = _buildDimensionalPortal(themeName, scene)

  return {
    scene,
    portalMesh:     portalData.portalMesh,
    outerRing:      portalData.outerRing,
    discMesh:       portalData.discMesh,
    portalBeam:     portalData.portalBeam,
    portalLight,
    vortexTexture:  portalData.vortexTexture,
    vortexParticles:portalData.vortexParticles,
    portalPosition: { x: PORTAL_WORLD_POS.x, y: PORTAL_WORLD_POS.y, z: PORTAL_WORLD_POS.z },
    playerStart:    T.playerStart.clone(),
    // Animation references
    skyMesh,
    cloudGroup,
    obeliskMeshes,
    platformCrystals,
    ambientParticles: particles,
  }
}

// ── Complete World Animation Hook ─────────────────────────────────────
/**
 * Called every frame by Game._loop to animate all dynamic environmental systems.
 */
export function animateWorld(world, dt, elapsed) {
  if (!world) return

  // 1. Animate Gateway Portal
  const pulse = 0.85 + 0.15 * Math.sin(elapsed * 3.0)
  if (world.portalMesh) {
    world.portalMesh.rotation.z = elapsed * 0.75
    world.portalMesh.material.emissiveIntensity = 2.2 + 1.2 * Math.sin(elapsed * 3.0)
  }

  if (world.outerRing) {
    world.outerRing.rotation.z = -elapsed * 0.45
    world.outerRing.material.opacity = 0.25 + 0.15 * Math.abs(Math.sin(elapsed * 1.8))
  }

  if (world.discMesh) {
    world.discMesh.material.opacity = 0.22 + 0.12 * pulse
  }

  // Rotate portal vortex texture
  if (world.vortexTexture) {
    world.vortexTexture.rotation = -elapsed * 0.6
  }

  // Pulse portal vertical light beam
  if (world.portalBeam) {
    world.portalBeam.material.opacity = 0.35 + 0.15 * Math.sin(elapsed * 4.0)
    world.portalBeam.rotation.y = elapsed * 0.3
  }

  // Animate inward swirling singularity particles
  if (world.vortexParticles) {
    const pos = world.vortexParticles.geometry.attributes.position.array
    const pData = world.vortexParticles.userData.particles
    for (let i = 0; i < pData.length; i++) {
      const p = pData[i]
      p.angle += p.speed * dt
      p.radius -= 0.35 * dt
      if (p.radius < 0.25) {
        p.radius = 2.4 + Math.random() * 0.5
        p.angle = Math.random() * Math.PI * 2
      }
      pos[i * 3]     = PORTAL_WORLD_POS.x + Math.cos(p.angle) * p.radius
      pos[i * 3 + 1] = PORTAL_WORLD_POS.y + Math.sin(p.angle) * p.radius
      pos[i * 3 + 2] = PORTAL_WORLD_POS.z + (Math.random() - 0.5) * 0.15
    }
    world.vortexParticles.geometry.attributes.position.needsUpdate = true
  }

  // 2. Animate Floating Sentinel Obelisks (slow levitation bob)
  if (world.obeliskMeshes) {
    for (let i = 0; i < world.obeliskMeshes.length; i++) {
      const ob = world.obeliskMeshes[i]
      const def = OBELISK_DEFS[i]
      ob.position.y = def.y + Math.sin(elapsed * 0.85 + def.phase) * 0.65
      ob.rotation.y = elapsed * 0.1 + def.phase
    }
  }

  // 3. Animate Platform Levitation Crystals (rotation & pulse)
  if (world.platformCrystals) {
    for (let i = 0; i < world.platformCrystals.length; i++) {
      const cry = world.platformCrystals[i]
      cry.rotation.y = elapsed * (1.2 + i * 0.2)
      cry.position.y = cry.userData.baseY + Math.sin(elapsed * 2.0 + i) * 0.08
    }
  }

  // 4. Drift Sea of Clouds below arena
  if (world.cloudGroup) {
    world.cloudGroup.rotation.y = elapsed * 0.012
  }

  // 5. Rise Ambient Energy Motes
  if (world.ambientParticles) {
    const pos = world.ambientParticles.geometry.attributes.position.array
    const vels = world.ambientParticles.userData.vels
    const count = pos.length / 3
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += vels[i] * dt
      if (pos[i * 3 + 1] > 22) {
        pos[i * 3 + 1] = -2
        pos[i * 3]     = (Math.random() - 0.5) * 28
        pos[i * 3 + 2] = (Math.random() - 0.5) * 36 - 2
      }
    }
    world.ambientParticles.geometry.attributes.position.needsUpdate = true
  }

  // 6. Slow celestial sky drift
  if (world.skyMesh) {
    world.skyMesh.rotation.y = elapsed * 0.003
  }
}

// ── Backwards compatibility helper for existing portal animation call ──
export function animatePortal(portalMesh, outerRing, discMesh, t) {
  portalMesh.rotation.z = t * 0.75
  portalMesh.material.emissiveIntensity = 2.2 + 1.2 * Math.sin(t * 3.0)
  outerRing.rotation.z = -t * 0.45
  outerRing.material.opacity = 0.25 + 0.15 * Math.abs(Math.sin(t * 1.8))
  discMesh.material.opacity = 0.22 + 0.12 * (0.85 + 0.15 * Math.sin(t * 3.0))
}

// ════════════════════════════════════════════════════════════════════════
// Internal Procedural Builders (Zero-Cost, No External Assets)
// ════════════════════════════════════════════════════════════════════════

/**
 * Procedural celestial sky sphere with split cosmic moon and nebulae.
 */
function _buildCelestialSky(themeName) {
  const canvas = document.createElement('canvas')
  canvas.width  = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  // Background deep space gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bgGrad.addColorStop(0.0, themeName === 'hero' ? '#010814' : '#0a0108')
  bgGrad.addColorStop(0.5, themeName === 'hero' ? '#031429' : '#1c0312')
  bgGrad.addColorStop(1.0, themeName === 'hero' ? '#08253f' : '#33081e')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Multiverse Nebulae Dust
  // Left side: Cyan / Electric Blue
  const nebHero = ctx.createRadialGradient(280, 200, 20, 280, 200, 260)
  nebHero.addColorStop(0.0, 'rgba(0, 229, 255, 0.45)')
  nebHero.addColorStop(0.5, 'rgba(0, 140, 255, 0.22)')
  nebHero.addColorStop(1.0, 'rgba(0, 30, 80, 0)')
  ctx.fillStyle = nebHero
  ctx.fillRect(0, 0, 600, canvas.height)

  // Right side: Crimson / Violet
  const nebDevil = ctx.createRadialGradient(740, 200, 20, 740, 200, 260)
  nebDevil.addColorStop(0.0, 'rgba(255, 23, 68, 0.45)')
  nebDevil.addColorStop(0.5, 'rgba(190, 20, 140, 0.22)')
  nebDevil.addColorStop(1.0, 'rgba(60, 0, 30, 0)')
  ctx.fillStyle = nebDevil
  ctx.fillRect(440, 0, 600, canvas.height)

  // Split Celestial Moon (Center top)
  const mx = canvas.width / 2
  const my = 150
  const mRad = 72

  // Moon glow aura
  const auraGrad = ctx.createRadialGradient(mx, my, mRad * 0.8, mx, my, mRad * 2.2)
  auraGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.45)')
  auraGrad.addColorStop(0.5, 'rgba(120, 180, 255, 0.15)')
  auraGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = auraGrad
  ctx.fillRect(mx - 180, my - 180, 360, 360)

  // Left Moon Hemisphere (Hero: Luminous Cyan/Silver)
  ctx.save()
  ctx.beginPath()
  ctx.arc(mx, my, mRad, Math.PI * 0.5, Math.PI * 1.5, false)
  ctx.closePath()
  ctx.clip()
  const moonHeroGrad = ctx.createRadialGradient(mx - 20, my - 20, 10, mx, my, mRad)
  moonHeroGrad.addColorStop(0.0, '#ffffff')
  moonHeroGrad.addColorStop(0.4, '#b0e8ff')
  moonHeroGrad.addColorStop(0.9, '#3075a0')
  moonHeroGrad.addColorStop(1.0, '#103048')
  ctx.fillStyle = moonHeroGrad
  ctx.fillRect(mx - mRad, my - mRad, mRad, mRad * 2)

  // Lunar crater details
  ctx.fillStyle = 'rgba(16, 50, 80, 0.25)'
  ctx.beginPath(); ctx.arc(mx - 32, my - 20, 14, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(mx - 48, my + 18, 10, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(mx - 24, my + 34, 8, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Right Moon Hemisphere (Devil: Crimson / Eclipse Coronal Rim)
  ctx.save()
  ctx.beginPath()
  ctx.arc(mx, my, mRad, Math.PI * 1.5, Math.PI * 0.5, false)
  ctx.closePath()
  ctx.clip()
  const moonDevilGrad = ctx.createRadialGradient(mx + 20, my - 20, 10, mx, my, mRad)
  moonDevilGrad.addColorStop(0.0, '#ffa0b0')
  moonDevilGrad.addColorStop(0.4, '#d81848')
  moonDevilGrad.addColorStop(0.85, '#5c061d')
  moonDevilGrad.addColorStop(1.0, '#26020c')
  ctx.fillStyle = moonDevilGrad
  ctx.fillRect(mx, my - mRad, mRad, mRad * 2)

  // Dark obsidian crater marks
  ctx.fillStyle = 'rgba(30, 2, 10, 0.45)'
  ctx.beginPath(); ctx.arc(mx + 30, my - 15, 15, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(mx + 45, my + 22, 12, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(mx + 20, my + 36, 9, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // Vertical dividing light seam down the celestial moon
  const beamGrad = ctx.createLinearGradient(mx, my - mRad - 30, mx, my + mRad + 30)
  beamGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0)')
  beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)')
  beamGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)')
  ctx.strokeStyle = beamGrad
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(mx, my - mRad - 24)
  ctx.lineTo(mx, my + mRad + 24)
  ctx.stroke()

  // Starfield
  for (let i = 0; i < 280; i++) {
    const sx = Math.random() * canvas.width
    const sy = Math.random() * (canvas.height * 0.75)
    const sr = Math.random() * 1.4 + 0.3
    const isHeroStar = sx < canvas.width / 2
    ctx.fillStyle = isHeroStar
      ? (Math.random() > 0.3 ? '#ffffff' : '#80e5ff')
      : (Math.random() > 0.3 ? '#ffffff' : '#ff80a0')
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  const skyGeo = new THREE.SphereGeometry(140, 32, 24)
  const skyMat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
  })
  return new THREE.Mesh(skyGeo, skyMat)
}

/**
 * Builds the massive floating monolithic arena island with beveled rim,
 * perimeter neon conduits, and underside stalactites.
 */
function _buildFloatingIsland(themeName, physicsWorld) {
  const T = THEMES[themeName]
  const group = new THREE.Group()

  const islandW = 24
  const islandD = 34
  const islandH = 3.2
  const islandY = -islandH / 2 // top surface sits exactly at y = 0

  // 1. Procedural Runic Floor Texture
  const floorTexture = _createFloorTexture(themeName)

  // 2. Main Island Stone Slab
  const slabGeo = new THREE.BoxGeometry(islandW, islandH, islandD)
  const slabMat = new THREE.MeshStandardMaterial({
    color:     T.islandStone,
    map:       floorTexture,
    roughness: 0.65,
    metalness: 0.35,
  })
  const slabMesh = new THREE.Mesh(slabGeo, slabMat)
  slabMesh.position.set(0, islandY, -2)
  slabMesh.receiveShadow = true
  group.add(slabMesh)

  // 3. Beveled Metallic Rim Border
  const rimMat = new THREE.MeshStandardMaterial({
    color:     T.islandTrim,
    roughness: 0.3,
    metalness: 0.8,
  })
  // North & South Rim
  const nsGeo = new THREE.BoxGeometry(islandW + 0.6, 0.4, 0.6)
  const rimN = new THREE.Mesh(nsGeo, rimMat)
  rimN.position.set(0, 0.05, -2 - islandD / 2)
  const rimS = new THREE.Mesh(nsGeo, rimMat)
  rimS.position.set(0, 0.05, -2 + islandD / 2)
  group.add(rimN, rimS)

  // East & West Rim
  const ewGeo = new THREE.BoxGeometry(0.6, 0.4, islandD + 0.6)
  const rimW = new THREE.Mesh(ewGeo, rimMat)
  rimW.position.set(-islandW / 2, 0.05, -2)
  const rimE = new THREE.Mesh(ewGeo, rimMat)
  rimE.position.set(islandW / 2, 0.05, -2)
  group.add(rimW, rimE)

  // 4. Glowing Neon Rim Conduits
  const glowMat = new THREE.MeshStandardMaterial({
    color:             T.edgeGlow,
    emissive:          T.edgeGlow,
    emissiveIntensity: 2.8,
    roughness: 0.1,
  })
  const conduitW = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, islandD), glowMat)
  conduitW.position.set(-islandW / 2 + 0.15, 0.12, -2)
  const conduitE = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, islandD), glowMat)
  conduitE.position.set(islandW / 2 - 0.15, 0.12, -2)
  const conduitS = new THREE.Mesh(new THREE.BoxGeometry(islandW, 0.1, 0.12), glowMat)
  conduitS.position.set(0, 0.12, -2 + islandD / 2 - 0.15)
  group.add(conduitW, conduitE, conduitS)

  // 5. Central Dividing Multiverse Rift Line (Seam between A & B)
  const riftGeo = new THREE.BoxGeometry(0.2, 0.08, islandD - 2)
  const riftMat = new THREE.MeshStandardMaterial({
    color:             0xffffff,
    emissive:          themeName === 'hero' ? 0x00e5ff : 0xff1744,
    emissiveIntensity: 3.2,
    roughness: 0.1,
  })
  const riftMesh = new THREE.Mesh(riftGeo, riftMat)
  riftMesh.position.set(0, 0.08, -2)
  group.add(riftMesh)

  // 6. Underside Monolithic Stalactites / Tapering Island Base
  const underBaseMat = new THREE.MeshStandardMaterial({
    color:     T.islandStone,
    roughness: 0.9,
    metalness: 0.2,
  })
  // Stepped lower tapering blocks
  const under1 = new THREE.Mesh(new THREE.BoxGeometry(islandW * 0.85, 2.5, islandD * 0.85), underBaseMat)
  under1.position.set(0, -islandH - 1.25, -2)
  const under2 = new THREE.Mesh(new THREE.BoxGeometry(islandW * 0.65, 3.5, islandD * 0.65), underBaseMat)
  under2.position.set(0, -islandH - 4.25, -2)
  group.add(under1, under2)

  // Tapering stalactite pyramids hanging into void
  const stalactiteGeo = new THREE.ConeGeometry(3.5, 9.0, 5)
  stalactiteGeo.rotateX(Math.PI) // point downwards
  const st1 = new THREE.Mesh(stalactiteGeo, underBaseMat)
  st1.position.set(-4.5, -islandH - 7.5, -4)
  const st2 = new THREE.Mesh(stalactiteGeo, underBaseMat)
  st2.position.set(5.0, -islandH - 8.5, -2)
  const st3 = new THREE.Mesh(stalactiteGeo, underBaseMat)
  st3.position.set(0, -islandH - 10.0, -8)
  group.add(st1, st2, st3)

  // 7. Physics Collision Body for Arena Platform
  const groundBody = new CANNON.Body({ mass: 0 })
  // Top surface at y = 0
  groundBody.addShape(
    new CANNON.Box(new CANNON.Vec3(islandW / 2, islandH / 2, islandD / 2)),
    new CANNON.Vec3(0, islandY, -2)
  )
  physicsWorld.addBody(groundBody)

  return { group, groundBody }
}

/**
 * Builds the elevated jumping platforms with runic trims and levitation crystals.
 */
function _buildPlatforms(themeName, physicsWorld, scene) {
  const T = THEMES[themeName]
  const crystals = []

  for (const p of PLATFORM_DEFS) {
    // 1. Platform Main Slab
    const geo = new THREE.BoxGeometry(p.w, p.h, p.d)
    const mat = new THREE.MeshStandardMaterial({
      color:             T.platColor,
      emissive:          T.platEmissive,
      emissiveIntensity: T.platEmissiveInt,
      roughness: 0.35,
      metalness: 0.7,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(p.x, p.y, p.z)
    mesh.castShadow    = true
    mesh.receiveShadow = true
    scene.add(mesh)

    // 2. Glowing Edge Insets
    const edgeGeo = new THREE.EdgesGeometry(geo)
    const edgeMat = new THREE.LineBasicMaterial({
      color:       T.edgeGlow,
      transparent: true,
      opacity:     0.85,
    })
    const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat)
    edgeMesh.position.set(p.x, p.y, p.z)
    scene.add(edgeMesh)

    // 3. Underside Levitating Energy Crystal
    const cryGeo = new THREE.OctahedronGeometry(0.35, 0)
    const cryMat = new THREE.MeshStandardMaterial({
      color:             T.portalColor,
      emissive:          T.portalColor,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    })
    const cryMesh = new THREE.Mesh(cryGeo, cryMat)
    cryMesh.position.set(p.x, p.y - p.h / 2 - 0.45, p.z)
    cryMesh.userData = { baseY: cryMesh.position.y }
    scene.add(cryMesh)
    crystals.push(cryMesh)

    // 4. Physics Static Body
    const body = new CANNON.Body({ mass: 0 })
    body.addShape(new CANNON.Box(new CANNON.Vec3(p.w / 2, p.h / 2, p.d / 2)))
    body.position.set(p.x, p.y, p.z)
    physicsWorld.addBody(body)
  }

  return crystals
}

/**
 * Builds floating sentinel obelisks hovering around the island perimeter.
 */
function _buildSentinelObelisks(themeName, scene) {
  const T = THEMES[themeName]
  const meshes = []

  const obeliskMat = new THREE.MeshStandardMaterial({
    color:     T.islandTrim,
    roughness: 0.3,
    metalness: 0.75,
  })
  const runeMat = new THREE.MeshStandardMaterial({
    color:             T.edgeGlow,
    emissive:          T.edgeGlow,
    emissiveIntensity: 2.8,
    roughness: 0.1,
  })

  for (const def of OBELISK_DEFS) {
    const obGroup = new THREE.Group()
    obGroup.position.set(def.x, def.y, def.z)

    // Tapered hexagonal pillar
    const pillarGeo = new THREE.CylinderGeometry(0.4 * def.scale, 0.7 * def.scale, 8.0 * def.scale, 6)
    const pillar = new THREE.Mesh(pillarGeo, obeliskMat)
    pillar.castShadow = true
    obGroup.add(pillar)

    // Inlaid vertical power rune stripe
    const runeGeo = new THREE.BoxGeometry(0.12 * def.scale, 6.0 * def.scale, 0.12 * def.scale)
    const rune = new THREE.Mesh(runeGeo, runeMat)
    obGroup.add(rune)

    // Floating cap crystal
    const capGeo = new THREE.OctahedronGeometry(0.5 * def.scale, 0)
    const cap = new THREE.Mesh(capGeo, runeMat)
    cap.position.set(0, 4.6 * def.scale, 0)
    obGroup.add(cap)

    scene.add(obGroup)
    meshes.push(obGroup)
  }

  return meshes
}

/**
 * Builds the sea of dimensional clouds below the arena.
 */
function _buildCloudSea(themeName) {
  const cloudGroup = new THREE.Group()
  cloudGroup.position.set(0, -14, -2)

  const cloudTex = _createCloudTexture()
  const cloudMat = new THREE.MeshBasicMaterial({
    map:         cloudTex,
    transparent: true,
    opacity:     0.45,
    depthWrite:  false,
  })

  // Multiple layered drifting cloud discs
  const cloudGeo1 = new THREE.PlaneGeometry(90, 90)
  const c1 = new THREE.Mesh(cloudGeo1, cloudMat)
  c1.rotation.x = -Math.PI / 2
  cloudGroup.add(c1)

  const cloudGeo2 = new THREE.PlaneGeometry(120, 120)
  const c2 = new THREE.Mesh(cloudGeo2, cloudMat)
  c2.position.set(0, -4, 0)
  c2.rotation.x = -Math.PI / 2
  c2.rotation.z = Math.PI / 4
  cloudGroup.add(c2)

  return cloudGroup
}

/**
 * Builds the ambient rising energy motes.
 */
function _buildAmbientParticles(themeName) {
  const T = THEMES[themeName]
  const count = 140
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const vels = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 26
    positions[i * 3 + 1] = Math.random() * 24 - 2
    positions[i * 3 + 2] = (Math.random() - 0.5) * 34 - 2
    vels[i] = 0.8 + Math.random() * 1.6
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color:       T.particleColor,
    size:        0.28,
    transparent: true,
    opacity:     0.75,
    blending:    THREE.AdditiveBlending,
  })

  const mesh = new THREE.Points(geometry, material)
  mesh.userData = { vels }

  return { mesh, geometry, material }
}

/**
 * Builds the epic Dimensional Gateway Portal with stepped dais, flanking monoliths,
 * counter-rotating segmented rings, swirling cosmic vortex, and vertical light beam.
 */
function _buildDimensionalPortal(themeName, scene) {
  const T = THEMES[themeName]
  const portalPos = PORTAL_WORLD_POS.clone()

  // 1. Stepped Altar Dais
  const daisMat = new THREE.MeshStandardMaterial({
    color:     T.islandTrim,
    roughness: 0.4,
    metalness: 0.6,
  })
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 0.35, 16), daisMat)
  step1.position.set(portalPos.x, 0.175, portalPos.z)
  step1.receiveShadow = true
  scene.add(step1)

  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 0.35, 16), daisMat)
  step2.position.set(portalPos.x, 0.525, portalPos.z)
  step2.receiveShadow = true
  scene.add(step2)

  // 2. Gateway Flanking Sentinel Monoliths
  const pillarGeo = new THREE.BoxGeometry(0.7, 5.2, 0.7)
  const pillarMat = new THREE.MeshStandardMaterial({
    color:     T.islandStone,
    roughness: 0.3,
    metalness: 0.8,
  })
  const runeMat = new THREE.MeshStandardMaterial({
    color:             T.portalColor,
    emissive:          T.portalColor,
    emissiveIntensity: 3.0,
    roughness: 0.1,
  })

  // Left Pillar
  const pillarL = new THREE.Mesh(pillarGeo, pillarMat)
  pillarL.position.set(portalPos.x - 3.2, 2.6, portalPos.z)
  pillarL.castShadow = true
  scene.add(pillarL)
  const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.75), runeMat)
  stripeL.position.set(portalPos.x - 3.2, 2.6, portalPos.z)
  scene.add(stripeL)

  // Right Pillar
  const pillarR = new THREE.Mesh(pillarGeo, pillarMat)
  pillarR.position.set(portalPos.x + 3.2, 2.6, portalPos.z)
  pillarR.castShadow = true
  scene.add(pillarR)
  const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.75), runeMat)
  stripeR.position.set(portalPos.x + 3.2, 2.6, portalPos.z)
  scene.add(stripeR)

  // 3. Primary Segmented Portal Ring
  const torusGeo = new THREE.TorusGeometry(1.8, 0.16, 12, 48)
  const torusMat = new THREE.MeshStandardMaterial({
    color:             T.portalColor,
    emissive:          T.portalColor,
    emissiveIntensity: T.portalGlowInt,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.95,
  })
  const portalMesh = new THREE.Mesh(torusGeo, torusMat)
  portalMesh.position.copy(portalPos)
  scene.add(portalMesh)

  // 4. Secondary Counter-Rotating Orbital Ring
  const outerGeo = new THREE.TorusGeometry(2.15, 0.05, 8, 48)
  const outerMat = new THREE.MeshBasicMaterial({
    color:       T.portalColor,
    transparent: true,
    opacity:     0.4,
  })
  const outerRing = new THREE.Mesh(outerGeo, outerMat)
  outerRing.position.copy(portalPos)
  scene.add(outerRing)

  // 5. Swirling Cosmic Vortex Disc
  const vortexTexture = _createVortexTexture(themeName)
  const discGeo = new THREE.CircleGeometry(1.68, 48)
  const discMat = new THREE.MeshBasicMaterial({
    map:         vortexTexture,
    transparent: true,
    opacity:     0.65,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
  })
  const discMesh = new THREE.Mesh(discGeo, discMat)
  discMesh.position.copy(portalPos)
  scene.add(discMesh)

  // 6. Towering Vertical Dimensional Light Beam
  const beamGeo = new THREE.CylinderGeometry(1.5, 2.2, 55, 24, 1, true)
  const beamMat = new THREE.MeshBasicMaterial({
    color:       T.portalBeamColor,
    transparent: true,
    opacity:     0.35,
    side:        THREE.DoubleSide,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  })
  const portalBeam = new THREE.Mesh(beamGeo, beamMat)
  portalBeam.position.set(portalPos.x, portalPos.y + 26, portalPos.z)
  scene.add(portalBeam)

  // 7. Inward-Swirling Singularity Particles
  const vortexPCount = 70
  const vPGeo = new THREE.BufferGeometry()
  const vPPos = new Float32Array(vPCount * 3)
  const vPData = []

  for (let i = 0; i < vortexPCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 0.4 + Math.random() * 2.2
    vPPos[i * 3]     = portalPos.x + Math.cos(angle) * radius
    vPPos[i * 3 + 1] = portalPos.y + Math.sin(angle) * radius
    vPPos[i * 3 + 2] = portalPos.z + (Math.random() - 0.5) * 0.2
    vPData.push({
      angle,
      radius,
      speed: 2.2 + Math.random() * 2.5,
    })
  }

  vPGeo.setAttribute('position', new THREE.BufferAttribute(vPPos, 3))
  const vPMat = new THREE.PointsMaterial({
    color:       T.portalColor,
    size:        0.22,
    transparent: true,
    opacity:     0.9,
    blending:    THREE.AdditiveBlending,
  })
  const vortexParticles = new THREE.Points(vPGeo, vPMat)
  vortexParticles.userData = { particles: vPData }
  scene.add(vortexParticles)

  return {
    portalMesh,
    outerRing,
    discMesh,
    portalBeam,
    vortexTexture,
    vortexParticles,
  }
}

/**
 * Generates procedural sci-fi runic floor texture for arena.
 */
function _createFloorTexture(themeName) {
  const canvas = document.createElement('canvas')
  canvas.width  = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')

  // Base stone/carbon grid
  ctx.fillStyle = themeName === 'hero' ? '#0d1d2b' : '#1c0812'
  ctx.fillRect(0, 0, 1024, 1024)

  // Subtle slate panels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 2
  const tileSize = 64
  for (let x = 0; x <= 1024; x += tileSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1024); ctx.stroke()
  }
  for (let y = 0; y <= 1024; y += tileSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke()
  }

  // Concentric Runic Rings in center
  const cx = 512, cy = 512
  const glowColor = themeName === 'hero' ? 'rgba(0, 229, 255, ' : 'rgba(255, 23, 68, '

  ctx.strokeStyle = glowColor + '0.6)'
  ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(cx, cy, 320, 0, Math.PI * 2); ctx.stroke()

  ctx.strokeStyle = glowColor + '0.4)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, cy, 240, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, 140, 0, Math.PI * 2); ctx.stroke()

  // Radiating sci-fi circuit traces
  for (let a = 0; a < 8; a++) {
    const angle = (a * Math.PI) / 4
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    ctx.beginPath()
    ctx.moveTo(cx + cos * 140, cy + sin * 140)
    ctx.lineTo(cx + cos * 320, cy + sin * 320)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

/**
 * Generates procedural spiral vortex texture for the portal disc.
 */
function _createVortexTexture(themeName) {
  const canvas = document.createElement('canvas')
  canvas.width  = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  const cx = 256, cy = 256
  const isHero = themeName === 'hero'

  // Transparent clear
  ctx.clearRect(0, 0, 512, 512)

  // Glowing center singularity
  const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 240)
  grad.addColorStop(0.0, '#ffffff')
  grad.addColorStop(0.2, isHero ? '#00e5ff' : '#ff1744')
  grad.addColorStop(0.6, isHero ? 'rgba(0, 80, 160, 0.45)' : 'rgba(140, 10, 60, 0.45)')
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(cx, cy, 240, 0, Math.PI * 2); ctx.fill()

  // Swirling spiral arms
  ctx.lineWidth = 5
  ctx.strokeStyle = isHero ? 'rgba(180, 245, 255, 0.7)' : 'rgba(255, 160, 190, 0.7)'
  for (let arm = 0; arm < 4; arm++) {
    const offset = (arm * Math.PI) / 2
    ctx.beginPath()
    for (let r = 20; r < 230; r += 4) {
      const theta = offset + r * 0.045
      const px = cx + Math.cos(theta) * r
      const py = cy + Math.sin(theta) * r
      if (r === 20) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.center.set(0.5, 0.5)
  return texture
}

/**
 * Generates soft procedural cloud puff texture.
 */
function _createCloudTexture() {
  const canvas = document.createElement('canvas')
  canvas.width  = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, 512, 512)

  // Multiple overlapping soft Gaussian cloud puffs
  for (let i = 0; i < 28; i++) {
    const px = 180 + Math.random() * 150
    const py = 180 + Math.random() * 150
    const pr = 70 + Math.random() * 80
    const puffGrad = ctx.createRadialGradient(px, py, 10, px, py, pr)
    puffGrad.addColorStop(0.0, 'rgba(240, 245, 255, 0.22)')
    puffGrad.addColorStop(0.5, 'rgba(200, 220, 255, 0.12)')
    puffGrad.addColorStop(1.0, 'rgba(200, 220, 255, 0)')
    ctx.fillStyle = puffGrad
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
  }

  return new THREE.CanvasTexture(canvas)
}
