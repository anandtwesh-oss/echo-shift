/* =====================================================================
   src/characters.js — High-Fidelity 3D Procedural Characters & Rigging
   
   Builds full humanoid 3D models for both HERO and DEVIL using detailed
   procedural geometry, custom PBR/emissive materials, and articulated joints.

   Features:
     - HERO: Sleek white/navy cyber-knight with glowing cyan energy visor,
       angular winged pauldrons, chest energy crystal, and back energy spear.
     - DEVIL: Jagged obsidian/crimson demonic warrior with curved horns,
       glowing red eyes, jagged shoulder spikes, and molten corruption core.
     - Articulated joint hierarchy: Head, Torso, Shoulders, Arms, Legs, Feet.
     - Procedural animation engine: Idle breathing, walk/run stride with knee
       bend, arm counter-swing, torso bob/lean, jump tuck, and landing.
     - Supports both solid local player rendering and ethereal ghost rendering.
   ===================================================================== */

import * as THREE from 'three'

// ── Shared Materials Cache ────────────────────────────────────────────
function createPalette(role, isGhost) {
  const isHero = role === 'hero'

  if (isGhost) {
    const mainColor = isHero ? 0x00e5ff : 0xff1744
    const darkColor = isHero ? 0x021c30 : 0x22000c
    return {
      armor: new THREE.MeshStandardMaterial({
        color: darkColor,
        emissive: mainColor,
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.8,
        transparent: true,
        opacity: 0.45,
      }),
      secondary: new THREE.MeshStandardMaterial({
        color: isHero ? 0x0a3050 : 0x3d0015,
        emissive: mainColor,
        emissiveIntensity: 0.8,
        roughness: 0.4,
        metalness: 0.6,
        transparent: true,
        opacity: 0.4,
      }),
      glow: new THREE.MeshBasicMaterial({
        color: mainColor,
        transparent: true,
        opacity: 0.75,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: mainColor,
        emissive: mainColor,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.6,
      }),
    }
  }

  // Solid Local Player Palette
  if (isHero) {
    return {
      armor: new THREE.MeshStandardMaterial({
        color: 0x0d1f33,        // deep cyber navy
        roughness: 0.25,
        metalness: 0.75,
      }),
      secondary: new THREE.MeshStandardMaterial({
        color: 0xd8edf8,        // polished white/silver ceramic plating
        roughness: 0.2,
        metalness: 0.85,
      }),
      glow: new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 3.5,
        roughness: 0.1,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: 0x0066aa,
        emissive: 0x00a8ff,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.6,
      }),
    }
  } else {
    return {
      armor: new THREE.MeshStandardMaterial({
        color: 0x14040b,        // obsidian black
        roughness: 0.35,
        metalness: 0.7,
      }),
      secondary: new THREE.MeshStandardMaterial({
        color: 0x420a1c,        // deep volcanic crimson steel
        roughness: 0.3,
        metalness: 0.8,
      }),
      glow: new THREE.MeshStandardMaterial({
        color: 0xff1744,
        emissive: 0xff1744,
        emissiveIntensity: 3.5,
        roughness: 0.1,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: 0x8a0028,
        emissive: 0xe040fb,
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.5,
      }),
    }
  }
}

// ── Build Full Humanoid Character ─────────────────────────────────────
export function buildCharacterModel(role, isGhost = false) {
  const isHero = role === 'hero'
  const pal = createPalette(role, isGhost)

  const root = new THREE.Group()

  // ── Hips / Pelvis ───────────────────────────────────────────────────
  const hips = new THREE.Group()
  hips.position.set(0, 0.75, 0)
  root.add(hips)

  const pelvisGeo = new THREE.BoxGeometry(0.36, 0.16, 0.24)
  const pelvisMesh = new THREE.Mesh(pelvisGeo, pal.armor)
  pelvisMesh.castShadow = !isGhost
  hips.add(pelvisMesh)

  // Belt / Core buckle
  const beltGeo = new THREE.BoxGeometry(0.12, 0.08, 0.26)
  const beltMesh = new THREE.Mesh(beltGeo, pal.glow)
  hips.add(beltMesh)

  // ── Torso & Chest ───────────────────────────────────────────────────
  const spine = new THREE.Group()
  spine.position.set(0, 0.1, 0)
  hips.add(spine)

  // Lower abdomen
  const abGeo = new THREE.BoxGeometry(0.32, 0.2, 0.22)
  const abMesh = new THREE.Mesh(abGeo, pal.secondary)
  abMesh.position.set(0, 0.08, 0)
  abMesh.castShadow = !isGhost
  spine.add(abMesh)

  // Main Chestplate
  const chestGroup = new THREE.Group()
  chestGroup.position.set(0, 0.24, 0)
  spine.add(chestGroup)

  const chestGeo = new THREE.BoxGeometry(0.44, 0.3, 0.28)
  const chestMesh = new THREE.Mesh(chestGeo, pal.armor)
  chestMesh.castShadow = !isGhost
  chestGroup.add(chestMesh)

  // Chest Armor Breastplate Facets
  const breastGeo = new THREE.ConeGeometry(0.18, 0.26, 4)
  breastGeo.rotateX(Math.PI / 2)
  breastGeo.rotateZ(Math.PI / 4)
  const breastMesh = new THREE.Mesh(breastGeo, pal.secondary)
  breastMesh.position.set(0, 0.02, 0.14)
  chestGroup.add(breastMesh)

  // Glowing Chest Core Crystal
  const coreGeo = new THREE.OctahedronGeometry(0.08, 0)
  const coreMesh = new THREE.Mesh(coreGeo, pal.glow)
  coreMesh.position.set(0, 0.04, 0.18)
  chestGroup.add(coreMesh)

  // ── Head & Helmet ───────────────────────────────────────────────────
  const neck = new THREE.Group()
  neck.position.set(0, 0.22, 0)
  chestGroup.add(neck)

  const headGroup = new THREE.Group()
  headGroup.position.set(0, 0.14, 0)
  neck.add(headGroup)

  // Helmet Base
  const headGeo = new THREE.BoxGeometry(0.24, 0.26, 0.26)
  const headMesh = new THREE.Mesh(headGeo, pal.armor)
  headMesh.castShadow = !isGhost
  headGroup.add(headMesh)

  if (isHero) {
    // Hero: Sleek Visor & Winged Crest
    const visorGeo = new THREE.BoxGeometry(0.25, 0.06, 0.1)
    const visorMesh = new THREE.Mesh(visorGeo, pal.glow)
    visorMesh.position.set(0, 0.02, 0.12)
    headGroup.add(visorMesh)

    // Forehead Crest / Fin
    const finGeo = new THREE.BoxGeometry(0.04, 0.12, 0.28)
    const finMesh = new THREE.Mesh(finGeo, pal.secondary)
    finMesh.position.set(0, 0.16, -0.02)
    headGroup.add(finMesh)

    // Side ear cowls
    const cowlGeo = new THREE.BoxGeometry(0.28, 0.1, 0.14)
    const cowlMesh = new THREE.Mesh(cowlGeo, pal.accent)
    cowlMesh.position.set(0, 0.04, -0.04)
    headGroup.add(cowlMesh)

    // Back-mounted Energy Spear
    const spearGeo = new THREE.CylinderGeometry(0.015, 0.02, 1.4, 6)
    const spearMesh = new THREE.Mesh(spearGeo, pal.secondary)
    spearMesh.position.set(-0.16, 0.1, -0.18)
    spearMesh.rotation.z = 0.35
    spearMesh.rotation.x = -0.15
    chestGroup.add(spearMesh)

    const tipGeo = new THREE.ConeGeometry(0.05, 0.24, 4)
    const tipMesh = new THREE.Mesh(tipGeo, pal.glow)
    tipMesh.position.set(0, 0.72, 0)
    spearMesh.add(tipMesh)
  } else {
    // Devil: Horned Helmet & Demonic Visor
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), pal.glow)
    eyeL.position.set(-0.06, 0.03, 0.13)
    eyeL.rotation.z = -0.15
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), pal.glow)
    eyeR.position.set(0.06, 0.03, 0.13)
    eyeR.rotation.z = 0.15
    headGroup.add(eyeL, eyeR)

    // Horns (Two curved horns curving upward & back)
    const hornLGroup = new THREE.Group()
    hornLGroup.position.set(-0.12, 0.12, -0.02)
    headGroup.add(hornLGroup)

    const hornGeo1 = new THREE.ConeGeometry(0.04, 0.22, 5)
    hornGeo1.rotateZ(0.4)
    hornGeo1.rotateX(-0.3)
    const hornMeshL = new THREE.Mesh(hornGeo1, pal.secondary)
    hornMeshL.position.set(-0.04, 0.08, 0)
    hornLGroup.add(hornMeshL)

    const hornRGroup = new THREE.Group()
    hornRGroup.position.set(0.12, 0.12, -0.02)
    headGroup.add(hornRGroup)

    const hornGeo2 = new THREE.ConeGeometry(0.04, 0.22, 5)
    hornGeo2.rotateZ(-0.4)
    hornGeo2.rotateX(-0.3)
    const hornMeshR = new THREE.Mesh(hornGeo2, pal.secondary)
    hornMeshR.position.set(0.04, 0.08, 0)
    hornRGroup.add(hornMeshR)

    // Back-mounted Spine Ridge / Greatsword
    const spineBladeGeo = new THREE.BoxGeometry(0.08, 1.2, 0.04)
    const spineBladeMesh = new THREE.Mesh(spineBladeGeo, pal.secondary)
    spineBladeMesh.position.set(0.14, 0.15, -0.18)
    spineBladeMesh.rotation.z = -0.32
    spineBladeMesh.rotation.x = -0.12
    chestGroup.add(spineBladeMesh)

    const bladeGlowGeo = new THREE.BoxGeometry(0.03, 0.9, 0.06)
    const bladeGlow = new THREE.Mesh(bladeGlowGeo, pal.glow)
    bladeGlow.position.set(0, 0.1, 0)
    spineBladeMesh.add(bladeGlow)
  }

  // ── Arms (Left & Right) ─────────────────────────────────────────────
  function buildArm(isLeft) {
    const sign = isLeft ? -1 : 1
    const shoulderPivot = new THREE.Group()
    shoulderPivot.position.set(sign * 0.28, 0.12, 0)
    chestGroup.add(shoulderPivot)

    // Pauldron (Shoulder Armor)
    let pauldronMesh
    if (isHero) {
      // Angular Winged Pauldron
      const pGeo = new THREE.ConeGeometry(0.12, 0.22, 4)
      pGeo.rotateZ(sign * -0.5)
      pGeo.rotateX(0.2)
      pauldronMesh = new THREE.Mesh(pGeo, pal.secondary)
      pauldronMesh.position.set(sign * 0.06, 0.04, 0)
    } else {
      // Spiked Demonic Pauldron
      const pGeo = new THREE.ConeGeometry(0.11, 0.24, 4)
      pGeo.rotateZ(sign * -0.7)
      pGeo.rotateY(0.4)
      pauldronMesh = new THREE.Mesh(pGeo, pal.secondary)
      pauldronMesh.position.set(sign * 0.08, 0.06, 0)
    }
    pauldronMesh.castShadow = !isGhost
    shoulderPivot.add(pauldronMesh)

    // Pauldron Trim Glow
    const pTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.12), pal.glow)
    pTrim.position.set(sign * 0.08, 0.02, 0)
    shoulderPivot.add(pTrim)

    // Upper Arm
    const upperArm = new THREE.Group()
    upperArm.position.set(sign * 0.04, -0.12, 0)
    shoulderPivot.add(upperArm)

    const upperMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 6), pal.armor)
    upperMesh.position.set(0, -0.04, 0)
    upperMesh.castShadow = !isGhost
    upperArm.add(upperMesh)

    // Forearm & Gauntlet
    const forearm = new THREE.Group()
    forearm.position.set(0, -0.16, 0)
    upperArm.add(forearm)

    const forearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.24, 6), pal.secondary)
    forearmMesh.position.set(0, -0.08, 0)
    forearmMesh.castShadow = !isGhost
    forearm.add(forearmMesh)

    // Gauntlet Accent / Hand
    const handMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.09), pal.accent)
    handMesh.position.set(0, -0.22, 0)
    forearm.add(handMesh)

    return { shoulderPivot, upperArm, forearm }
  }

  const leftArm  = buildArm(true)
  const rightArm = buildArm(false)

  // ── Legs (Left & Right) ─────────────────────────────────────────────
  function buildLeg(isLeft) {
    const sign = isLeft ? -1 : 1
    const hipPivot = new THREE.Group()
    hipPivot.position.set(sign * 0.14, -0.06, 0)
    hips.add(hipPivot)

    // Thigh
    const thighGroup = new THREE.Group()
    thighGroup.position.set(0, -0.04, 0)
    hipPivot.add(thighGroup)

    const thighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.32, 6), pal.armor)
    thighMesh.position.set(0, -0.14, 0)
    thighMesh.castShadow = !isGhost
    thighGroup.add(thighMesh)

    // Thigh Side Plate
    const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.14), pal.secondary)
    sidePlate.position.set(sign * 0.07, -0.12, 0)
    thighGroup.add(sidePlate)

    // Calf / Shin & Knee
    const kneeGroup = new THREE.Group()
    kneeGroup.position.set(0, -0.32, 0)
    thighGroup.add(kneeGroup)

    // Knee Cop
    const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.08), pal.accent)
    kneeCap.position.set(0, 0, 0.06)
    kneeGroup.add(kneeCap)

    const calfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 6), pal.secondary)
    calfMesh.position.set(0, -0.16, 0)
    calfMesh.castShadow = !isGhost
    kneeGroup.add(calfMesh)

    // Armored Boot / Foot
    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), pal.armor)
    footMesh.position.set(0, -0.34, 0.05)
    footMesh.castShadow = !isGhost
    kneeGroup.add(footMesh)

    // Boot Sole Glow
    const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.18), pal.glow)
    soleMesh.position.set(0, -0.39, 0.05)
    kneeGroup.add(soleMesh)

    return { hipPivot, thighGroup, kneeGroup }
  }

  const leftLeg  = buildLeg(true)
  const rightLeg = buildLeg(false)

  // Return root group and animated joint references
  return {
    root,
    parts: {
      hips,
      spine,
      chestGroup,
      headGroup,
      coreMesh,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
    },
  }
}

// ── Procedural Character Animation Engine ─────────────────────────────
/**
 * Updates joint rotations and positional bobs for rich procedural locomotion.
 *
 * @param {object} parts      Joint hierarchy from buildCharacterModel
 * @param {object} animState  { speed: number, isGrounded: boolean, vy: number }
 * @param {number} dt         Delta time in seconds
 * @param {number} time       Total elapsed time in seconds
 */
export function animateCharacter(parts, animState, dt, time) {
  if (!parts) return

  const {
    hips,
    spine,
    chestGroup,
    headGroup,
    coreMesh,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  } = parts

  const speed = animState.speed || 0
  const isGrounded = animState.isGrounded !== false
  const vy = animState.vy || 0
  const isMoving = speed > 0.4

  // Pulse chest core crystal
  if (coreMesh && coreMesh.material && coreMesh.material.emissiveIntensity !== undefined) {
    coreMesh.material.emissiveIntensity = 2.5 + 1.5 * Math.sin(time * 4)
  }

  if (isGrounded) {
    if (!isMoving) {
      // ── IDLE ANIMATION: Breathing & subtle stance sway ────────────────
      const breath = Math.sin(time * 2.2)

      // Hips subtle vertical breath
      hips.position.y = 0.75 + breath * 0.015

      // Torso breathing expand / contract
      spine.rotation.x = breath * 0.02
      chestGroup.rotation.x = breath * 0.025
      headGroup.rotation.x = -breath * 0.02

      // Reset yaw and roll
      spine.rotation.y = 0
      spine.rotation.z = 0

      // Arms rest gently at sides with light sway
      leftArm.shoulderPivot.rotation.x = breath * 0.04
      leftArm.shoulderPivot.rotation.z = 0.12 + breath * 0.02
      leftArm.forearm.rotation.x       = -0.25 - breath * 0.03

      rightArm.shoulderPivot.rotation.x = -breath * 0.04
      rightArm.shoulderPivot.rotation.z = -0.12 - breath * 0.02
      rightArm.forearm.rotation.x       = -0.25 - breath * 0.03

      // Legs rest firmly in stance
      leftLeg.hipPivot.rotation.x  = 0
      leftLeg.hipPivot.rotation.z  = -0.05
      leftLeg.kneeGroup.rotation.x = 0

      rightLeg.hipPivot.rotation.x  = 0
      rightLeg.hipPivot.rotation.z  = 0.05
      rightLeg.kneeGroup.rotation.x = 0
    } else {
      // ── RUN / WALK CYCLE: Dynamic athletic strides ────────────────────
      const strideFreq = Math.min(14, 6 + speed * 0.7)
      const strideCycle = time * strideFreq
      const strideAmp   = Math.min(0.85, 0.45 + speed * 0.05)

      // Torso forward lean into movement
      const forwardLean = Math.min(0.24, 0.08 + speed * 0.015)
      spine.rotation.x = forwardLean
      chestGroup.rotation.x = forwardLean * 0.5

      // Torso bob (drops twice per stride cycle)
      const bob = Math.abs(Math.sin(strideCycle)) * 0.07
      hips.position.y = 0.75 - bob

      // Torso twist counter to leg strides
      const torsoTwist = Math.sin(strideCycle) * 0.12
      spine.rotation.y = torsoTwist

      // Head remains level looking forward
      headGroup.rotation.x = -forwardLean * 0.6
      headGroup.rotation.y = -torsoTwist * 0.7

      // Leg Strides
      const leftStride  = Math.sin(strideCycle) * strideAmp
      const rightStride = -leftStride

      leftLeg.hipPivot.rotation.x  = leftStride
      leftLeg.hipPivot.rotation.z  = -0.04
      // Knee bends as leg swings back
      leftLeg.kneeGroup.rotation.x = leftStride < 0 ? Math.abs(leftStride) * 1.3 : 0.05

      rightLeg.hipPivot.rotation.x  = rightStride
      rightLeg.hipPivot.rotation.z  = 0.04
      rightLeg.kneeGroup.rotation.x = rightStride < 0 ? Math.abs(rightStride) * 1.3 : 0.05

      // Arm Counter-Swings (opposing leg movements)
      const armSwingAmp = strideAmp * 0.95
      leftArm.shoulderPivot.rotation.x = rightStride * armSwingAmp
      leftArm.shoulderPivot.rotation.z = 0.14
      leftArm.forearm.rotation.x       = -0.45 - Math.max(0, -rightStride) * 0.5

      rightArm.shoulderPivot.rotation.x = leftStride * armSwingAmp
      rightArm.shoulderPivot.rotation.z = -0.14
      rightArm.forearm.rotation.x       = -0.45 - Math.max(0, -leftStride) * 0.5
    }
  } else {
    // ── AIRBORNE / JUMP ANIMATION: Dynamic leap & fall poses ───────────
    if (vy > 0) {
      // Ascending Jump: Knees tuck slightly, arms reach up/back
      spine.rotation.x = -0.12
      headGroup.rotation.x = -0.15

      leftLeg.hipPivot.rotation.x  = -0.35
      leftLeg.kneeGroup.rotation.x = 0.7
      rightLeg.hipPivot.rotation.x  = -0.2
      rightLeg.kneeGroup.rotation.x = 0.45

      leftArm.shoulderPivot.rotation.x = -0.8
      leftArm.shoulderPivot.rotation.z = 0.4
      rightArm.shoulderPivot.rotation.x = -0.7
      rightArm.shoulderPivot.rotation.z = -0.4
    } else {
      // Descending Fall: Legs reach down for landing, arms spread for balance
      spine.rotation.x = 0.1
      headGroup.rotation.x = 0.08

      leftLeg.hipPivot.rotation.x  = 0.15
      leftLeg.kneeGroup.rotation.x = 0.25
      rightLeg.hipPivot.rotation.x  = 0.25
      rightLeg.kneeGroup.rotation.x = 0.35

      leftArm.shoulderPivot.rotation.x = 0.4
      leftArm.shoulderPivot.rotation.z = 0.55
      rightArm.shoulderPivot.rotation.x = 0.4
      rightArm.shoulderPivot.rotation.z = -0.55
    }
  }
}

