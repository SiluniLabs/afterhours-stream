"use strict";

window.STREAM_CONFIG = {
  maxActors: 50,
  spawnDelays: {
    firstAppearanceMs: [900, 2200],
    appearanceIntervalMs: [2000, 2000],
    replacementAfterRemovalMs: [1300, 4200]
  },
  spawnArea: {
    horizontalInset: 55,
    topInset: 100,
    bottomInset: 55
  },
  detectionRange: 315,
  projectileSpeed: 330,
  projectileHitRadius: 19,
  movement: {
    stayInZoneChance: 0.7,
    pathVariation: 4,
    idleDurationMs: [550, 1800],
    idleSearchIntervalMs: [220, 500],
    walkDurationMs: [2200, 5200],
    walkSearchIntervalMs: [350, 800],
    targetSearchIntervalMs: [400, 850]
  },
  combat: {
    attackChance: 0.57,
    cooldownVariation: [0.88, 1.18],
    attackWindupMs: 110,
    postAttackSearchMs: [250, 650],
    attackRetryMs: [450, 1000],
    hitRecoveryMs: [250, 650],
    hitAnimationMs: 180,
    areaEffectMs: 260
  },
  appearance: {
    auraPulseMs: [1000, 1600],
    spawnFadeMs: 380
  },
  environment: {
    treesPerMillionPixels: 46,
    rocksPerMillionPixels: 28,
    grassPerMillionPixels: 150,
    riverWidth: 58,
    riverBankWidth: 82,
    riverWinding: 56,
    treeRiverClearance: 30,
    grassRiverClearance: 16
  },
  teams: [
    { id: "left", name: "EQUIPE VERTE", side: "left", color: 0x7cdbc9 },
    { id: "right", name: "EQUIPE ROUGE", side: "right", color: 0xffa17f }
  ],
  archetypes: [
    { id: "soldier", name: "Soldat", role: "soldier", speed: 58, health: 320, attackCooldown: 2200, attackRange: 135, damage: 52, color: 0x83d7c3, accent: 0x56a997 },
    { id: "assassin", name: "Assassin", role: "assassin", speed: 126, health: 105, attackCooldown: 1100, attackRange: 145, damage: 92, color: 0xc0a5ef, accent: 0x8b72d1 },
    { id: "archer", name: "Archer", role: "archer", speed: 92, health: 115, attackCooldown: 1450, attackRange: 470, damage: 42, projectileSpeed: 520, color: 0xf0c36e, accent: 0xc28e35 },
    { id: "mage", name: "Mage", role: "mage", speed: 62, health: 110, attackCooldown: 2800, attackRange: 360, damage: 48, areaRadius: 112, projectileSpeed: 260, color: 0xb79aff, accent: 0x8564ce },
    { id: "healer", name: "Soigneur", role: "healer", speed: 72, health: 135, healAmount: 45, healRange: 290, healCooldown: 1700, color: 0x9be6a7, accent: 0x62b879 }
  ]
};