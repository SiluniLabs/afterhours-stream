"use strict";

const WORLD = { width: 1920, height: 1080 };
const CONFIG = window.STREAM_CONFIG;
const MAX_ACTORS = CONFIG.maxActors;
const ARENA = { left: 125, right: 1795, top: 325, bottom: 905 };
const STATES = Object.freeze({ IDLE: "IDLE", WALK: "WALK", SEARCH: "SEARCH", ATTACK: "ATTACK", HEAL: "HEAL", HIT: "HIT", DEAD: "DEAD" });
const ARCHETYPES = CONFIG.archetypes;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distanceBetween(first, second) {
  return Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

class ArenaScene extends Phaser.Scene {
  constructor() {
    super("arena");
    this.actors = [];
    this.projectiles = [];
    this.teamKills = new Map(CONFIG.teams.map((team) => [team.id, 0]));
    this.nextActorId = 1;
    this.arrivalAt = 0;
    this.spawnEvent = null;
    this.uiRefreshAt = 0;
  }

  create() {
    this.drawWorld();
    this.events.on("actor-removed", this.removeActor, this);
    this.updateHud();
    this.scheduleSpawn(randomBetween(...CONFIG.spawnDelays.firstAppearanceMs));
    this.updateArrivalLabel();
  }

  drawWorld() {
    const background = this.add.graphics();
    background.fillGradientStyle(0x0b1915, 0x0b1915, 0x07110f, 0x07110f, 1);
    background.fillRect(0, 0, WORLD.width, WORLD.height);

    const ambient = this.add.graphics();
    ambient.fillStyle(0x93d9a7, 0.025);
    ambient.fillEllipse(960, 650, 1460, 720);
    ambient.fillStyle(0x9b83de, 0.025);
    ambient.fillEllipse(300, 720, 560, 420);
    ambient.fillStyle(0xffaa73, 0.018);
    ambient.fillEllipse(1620, 510, 500, 450);

    const ground = this.add.graphics();
    ground.lineStyle(1, 0x8db79a, 0.08);
    for (let y = 360; y <= 900; y += 54) {
      ground.beginPath();
      ground.moveTo(ARENA.left, y);
      ground.lineTo(ARENA.right, y);
      ground.strokePath();
    }
    for (let x = 180; x <= 1740; x += 78) {
      ground.fillStyle(0xc0d8c4, 0.15);
      ground.fillCircle(x, 420 + Math.sin(x * 0.04) * 13, 1.5);
      ground.fillCircle(x + 37, 775 + Math.cos(x * 0.031) * 17, 1);
    }

    const boundaries = this.add.graphics();
    boundaries.lineStyle(1, 0xa9edc0, 0.15);
    boundaries.beginPath();
    boundaries.moveTo(ARENA.left, ARENA.top);
    boundaries.lineTo(ARENA.right, ARENA.top);
    boundaries.lineTo(ARENA.right, ARENA.bottom);
    boundaries.lineTo(ARENA.left, ARENA.bottom);
    boundaries.closePath();
    boundaries.strokePath();
    const middleX = (ARENA.left + ARENA.right) / 2;

    const maskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
    this.environmentMask = maskGraphics.createGeometryMask();

    this.drawEnvironment();
    this.drawCampLabels(middleX);
  }

  drawCampLabels(middleX) {
    const leftTeam = CONFIG.teams.find((team) => team.side === "left");
    const rightTeam = CONFIG.teams.find((team) => team.side === "right");
    const labelTop = ARENA.top + 8;
    const labelHeight = 34;
    const labels = this.add.container(0, 0);
    const panels = this.add.graphics();
    panels.fillStyle(0x07110f, 0.88);
    panels.fillRect(ARENA.left + 10, labelTop, middleX - ARENA.left - 20, labelHeight);
    panels.fillRect(middleX + 10, labelTop, ARENA.right - middleX - 20, labelHeight);
    panels.lineStyle(1, leftTeam.color, 0.48);
    panels.strokeRect(ARENA.left + 10, labelTop, middleX - ARENA.left - 20, labelHeight);
    panels.lineStyle(1, rightTeam.color, 0.48);
    panels.strokeRect(middleX + 10, labelTop, ARENA.right - middleX - 20, labelHeight);

    const labelStyle = (team) => ({
      fontFamily: "DM Sans, sans-serif",
      fontSize: "10px",
      color: `#${team.color.toString(16).padStart(6, "0")}`,
      letterSpacing: 2
    });
    const leftLabel = this.add.text(ARENA.left + 24, labelTop + 11, `${leftTeam.name}`, labelStyle(leftTeam));
    const rightLabel = this.add.text(ARENA.right - 24, labelTop + 11, `${rightTeam.name}`, labelStyle(rightTeam));
    leftLabel.setOrigin(0, 0);
    rightLabel.setOrigin(1, 0);
    labels.add([panels, leftLabel, rightLabel]);
    labels.setDepth(ARENA.bottom + 1000);
  }

  drawPlant(graphics, x, y, scale) {
    graphics.lineStyle(2, 0x83ad8e, 0.34);
    graphics.lineBetween(x, y, x - 5 * scale, y - 24 * scale);
    graphics.lineBetween(x - 2 * scale, y - 12 * scale, x - 13 * scale, y - 19 * scale);
    graphics.lineBetween(x - 3 * scale, y - 17 * scale, x + 8 * scale, y - 26 * scale);
    graphics.fillStyle(0x7eab8c, 0.3);
    graphics.fillEllipse(x - 13 * scale, y - 20 * scale, 11 * scale, 5 * scale);
    graphics.fillEllipse(x + 8 * scale, y - 27 * scale, 11 * scale, 5 * scale);
  }

  drawEnvironment() {
    const area = (ARENA.right - ARENA.left) * (ARENA.bottom - ARENA.top);
    const densityScale = area / 1_000_000;
    const bounds = {
      left: ARENA.left + 12,
      right: ARENA.right - 12,
      top: ARENA.top + 32,
      bottom: ARENA.bottom - 8
    };
    const environment = CONFIG.environment;

    this.drawRiver();

    const grass = this.add.graphics();
    const grassCount = Math.floor(environment.grassPerMillionPixels * densityScale);
    for (let index = 0; index < grassCount; index++) {
      const scale = randomBetween(0.45, 1.15);
      const position = this.randomLandPoint(bounds, environment.grassRiverClearance, 18 * scale);
      this.drawPlant(grass, position.x, position.y, scale);
    }
    grass.setMask(this.environmentMask);

    const treeCount = Math.floor(environment.treesPerMillionPixels * densityScale);
    for (let index = 0; index < treeCount; index++) {
      const scale = randomBetween(0.65, 1.2);
      const position = this.randomLandPoint(bounds, environment.treeRiverClearance, 70 * scale);
      this.drawTree(position.x, position.y, scale);
    }

    const rockCount = Math.floor(environment.rocksPerMillionPixels * densityScale);
    for (let index = 0; index < rockCount; index++) {
      this.drawRock(
        randomBetween(bounds.left, bounds.right),
        randomBetween(bounds.top, bounds.bottom),
        randomBetween(0.65, 1.55)
      );
    }

  }

  randomLandPoint(bounds, clearance, verticalRadius) {
    const minY = ARENA.top - 20;
    const maxY = ARENA.bottom + 20;
    const riverHalfWidth = CONFIG.environment.riverBankWidth / 2 + clearance;

    while (true) {
      const x = randomBetween(bounds.left, bounds.right);
      const y = randomBetween(bounds.top, bounds.bottom);
      const sampleTop = Math.max(minY, y - verticalRadius);
      const sampleBottom = Math.min(maxY, y + verticalRadius);
      let overlapsRiver = false;

      for (let sampleY = sampleTop; sampleY <= sampleBottom; sampleY += 8) {
        const progress = Phaser.Math.Clamp((sampleY - minY) / (maxY - minY), 0, 1);
        const riverX = (ARENA.left + ARENA.right) / 2 + Phaser.Math.Interpolation.CatmullRom(this.riverOffsets, progress);
        if (Math.abs(x - riverX) < riverHalfWidth) {
          overlapsRiver = true;
          break;
        }
      }

      if (!overlapsRiver) return { x, y };
    }
  }

  drawRiver() {
    const graphics = this.add.graphics();
    const points = [];
    const middleX = (ARENA.left + ARENA.right) / 2;
    const startY = ARENA.top - 20;
    const endY = ARENA.bottom + 20;
    const controlPointCount = 9;
    const segmentCount = 88;
    this.riverOffsets = Array.from(
      { length: controlPointCount },
      () => randomBetween(-CONFIG.environment.riverWinding, CONFIG.environment.riverWinding)
    );

    for (let index = 0; index <= segmentCount; index++) {
      const progress = index / segmentCount;
      const y = startY + (endY - startY) * progress;
      const x = middleX + Phaser.Math.Interpolation.CatmullRom(this.riverOffsets, progress);
      points.push({ x, y });
    }

    graphics.lineStyle(CONFIG.environment.riverBankWidth, 0x334f43, 0.76);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.strokePath();

    graphics.lineStyle(CONFIG.environment.riverWidth, 0x236759, 0.92);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.strokePath();

    graphics.setMask(this.environmentMask);
  }

  drawTree(x, y, scale) {
    const foliageColors = [0x557d57, 0x668d60, 0x789b67, 0x517766];
    const foliage = choose(foliageColors);
    const lighterFoliage = Phaser.Display.Color.ValueToColor(foliage).lighten(12).color;
    const tree = this.add.container(x, y);
    const parts = [
      this.add.ellipse(0, 0, 47, 12, 0x000000, 0.25),
      this.add.rectangle(0, -18, 8, 34, 0x68513b, 1),
      this.add.ellipse(0, -38, 43, 39, foliage, 1),
      this.add.ellipse(-13, -32, 25, 24, lighterFoliage, 0.9),
      this.add.ellipse(13, -48, 28, 26, foliage, 1),
      this.add.ellipse(1, -59, 23, 20, lighterFoliage, 0.85)
    ];
    tree.add(parts);
    tree.setScale(scale);
    tree.setRotation(randomBetween(-0.12, 0.12));
    tree.setDepth(y);
    tree.setMask(this.environmentMask);
  }

  drawRock(x, y, scale) {
    const rock = this.add.container(x, y);
    const stoneColors = [0x77877a, 0x87958a, 0x9aa394, 0x6c7d75];
    const baseColor = choose(stoneColors);
    const highlightColor = Phaser.Display.Color.ValueToColor(baseColor).lighten(17).color;
    rock.add([
      this.add.ellipse(0, 2, 44, 14, 0x000000, 0.24),
      this.add.ellipse(-2, -5, 33, 21, baseColor, 1),
      this.add.ellipse(-7, -9, 18, 11, highlightColor, 0.8),
      this.add.ellipse(11, -3, 14, 12, baseColor, 1)
    ]);
    rock.setScale(scale);
    rock.setRotation(randomBetween(-0.4, 0.4));
    rock.setDepth(y);
    rock.setMask(this.environmentMask);
  }

  scheduleSpawn(delay) {
    if (this.actors.filter((actor) => actor.active).length >= MAX_ACTORS) {
      this.spawnEvent = null;
      return;
    }
    this.arrivalAt = this.time.now + delay;
    this.spawnEvent = this.time.delayedCall(delay, () => {
      this.spawnEvent = null;
      this.spawnActor();
      this.scheduleSpawn(randomBetween(...CONFIG.spawnDelays.appearanceIntervalMs));
    });
  }

  spawnActor() {
    if (this.actors.filter((actor) => actor.active).length >= MAX_ACTORS) return;
    const archetype = choose(ARCHETYPES);
    const team = this.chooseSpawnTeam();
    const teamBounds = this.getTeamBounds(team);
    const x = randomBetween(teamBounds.left + CONFIG.spawnArea.horizontalInset, teamBounds.right - CONFIG.spawnArea.horizontalInset);
    const y = randomBetween(ARENA.top + CONFIG.spawnArea.topInset, ARENA.bottom - CONFIG.spawnArea.bottomInset);
    const actor = new ArenaActor(this, this.nextActorId++, x, y, archetype, team);
    this.actors.push(actor);
    this.updateHud();
  }

  chooseSpawnTeam() {
    const populations = CONFIG.teams.map((team) => ({
      team,
      count: this.actors.filter((actor) => actor.active && actor.team.id === team.id).length
    }));
    const leastPopulated = Math.min(...populations.map((entry) => entry.count));
    return choose(populations.filter((entry) => entry.count === leastPopulated)).team;
  }

  getTeamBounds(team) {
    const middleX = (ARENA.left + ARENA.right) / 2;
    return team.side === "left"
      ? { left: ARENA.left, right: middleX }
      : { left: middleX, right: ARENA.right };
  }

  removeActor(actor, killer) {
    this.actors = this.actors.filter((candidate) => candidate !== actor);
    if (killer && killer.team.id !== actor.team.id) {
      this.teamKills.set(killer.team.id, this.teamKills.get(killer.team.id) + 1);
    }
    this.updateHud();
    if (!this.spawnEvent && this.actors.length < MAX_ACTORS) {
      this.scheduleSpawn(randomBetween(...CONFIG.spawnDelays.replacementAfterRemovalMs));
    }
  }

  fireProjectile(source, target, kind = "attack", amount = source.archetype.damage) {
    if (!source.active || !target.active) return;
    const tint = kind === "heal" ? source.archetype.color : source.archetype.color;
    const halo = this.add.circle(source.x, source.y - 4, 11, tint, 0.16);
    const core = source.archetype.role === "archer"
      ? this.add.triangle(source.x, source.y - 4, 0, -7, -4, 5, 4, 5, tint, 1)
      : this.add.circle(source.x, source.y - 4, source.archetype.role === "mage" ? 6 : 4.5, tint, 1);
    core.setDepth(source.y);
    this.projectiles.push({
      source,
      target,
      halo,
      core,
      kind,
      amount,
      areaRadius: source.archetype.areaRadius ?? 0,
      speed: source.archetype.projectileSpeed ?? CONFIG.projectileSpeed,
      active: true
    });
  }

  updateProjectiles(delta) {
    const step = delta / 1000;
    this.projectiles = this.projectiles.filter((projectile) => {
      const { source, target, core, halo, kind, amount, areaRadius } = projectile;
      if (!projectile.active || !source.active || !target.active) {
        core.destroy();
        halo.destroy();
        return false;
      }

      const angle = Phaser.Math.Angle.Between(core.x, core.y, target.x, target.y - 5);
      const travel = projectile.speed * step;
      core.x += Math.cos(angle) * travel;
      core.y += Math.sin(angle) * travel;
      if (source.archetype.role === "archer") core.setRotation(angle + Math.PI / 2);
      halo.setPosition(core.x, core.y);

      if (Phaser.Math.Distance.Between(core.x, core.y, target.x, target.y - 5) < CONFIG.projectileHitRadius) {
        projectile.active = false;
        if (kind === "heal") target.receiveHealing(amount);
        else if (kind === "aoe") {
          this.applyAreaDamage(core.x, core.y, areaRadius, amount, source);
          this.showAreaEffect(core.x, core.y, areaRadius, source.archetype.color);
        }
        else target.takeHit(amount, source);
        core.destroy();
        halo.destroy();
        return false;
      }
      if (core.x < ARENA.left || core.x > ARENA.right || core.y < ARENA.top || core.y > ARENA.bottom) {
        core.destroy();
        halo.destroy();
        return false;
      }
      return true;
    });
  }

  applyAreaDamage(x, y, radius, damage, source) {
    for (const actor of this.actors) {
      if (!actor.active || actor.team.id === source.team.id) continue;
      if (distanceBetween(actor, { x, y }) <= radius) actor.takeHit(damage, source);
    }
  }

  showAreaEffect(x, y, radius, color) {
    const effect = this.add.circle(x, y, 9, color, 0.34);
    effect.setStrokeStyle(2, color, 0.95);
    effect.setDepth(y + 1);
    this.tweens.add({
      targets: effect,
      scale: radius / 9,
      alpha: 0,
      duration: CONFIG.combat.areaEffectMs,
      ease: "Cubic.easeOut",
      onComplete: () => effect.destroy()
    });
  }

  updateHud() {
    const counter = document.getElementById("actor-count");
    if (counter) counter.textContent = String(this.actors.filter((actor) => actor.active).length);
    const limit = document.getElementById("actor-limit");
    if (limit) limit.textContent = String(MAX_ACTORS);
    for (const team of CONFIG.teams) {
      const row = document.querySelector(`[data-team="${team.id}"]`);
      if (!row) continue;
      const alive = this.actors.filter((actor) => actor.active && actor.team.id === team.id).length;
      row.querySelector(".team-name").textContent = team.name;
      row.querySelector(".team-alive-count").textContent = String(alive);
      row.querySelector(".team-kill-count").textContent = String(this.teamKills.get(team.id));
      row.style.setProperty("--team-color", `#${team.color.toString(16).padStart(6, "0")}`);
    }
  }

  updateArrivalLabel() {
    const label = document.getElementById("arrival-copy");
    if (!label) return;
    const remaining = Math.max(0, Math.ceil((this.arrivalAt - this.time.now) / 1000));
    label.textContent = this.spawnEvent ? `PROCHAINE ARRIVÉE  ·  00:${String(remaining).padStart(2, "0")}` : "LE MONDE EST AU COMPLET";
  }

  update(time, delta) {
    this.actors.forEach((actor) => actor.update(time, delta));
    this.updateProjectiles(delta);
    if (time >= this.uiRefreshAt) {
      this.updateArrivalLabel();
      this.uiRefreshAt = time + 250;
    }
  }
}

class ArenaActor {
  constructor(scene, id, x, y, archetype, team) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.speed = archetype.speed;
    this.health = archetype.health;
    this.maxHealth = archetype.health;
    this.attackCooldown = archetype.attackCooldown;
    this.attackRange = archetype.attackRange;
    this.detectionRange = archetype.detectionRange ?? CONFIG.detectionRange;
    this.state = STATES.IDLE;
    this.direction = 1;
    this.archetype = archetype;
    this.team = team;
    this.active = true;
    this.target = null;
    this.nextDecisionAt = 0;
    this.nextAttackAt = 0;
    this.nextHealAt = 0;
    this.destination = { x, y };
    this.container = scene.add.container(x, y);
    this.createAppearance();
    this.chooseIdleDuration();
  }

  createAppearance() {
    const shadow = this.scene.add.ellipse(0, 15, 39, 13, 0x000000, 0.32);
    const aura = this.scene.add.circle(0, -5, 23, this.archetype.color, 0.12);
    const teamRing = this.scene.add.circle(0, -5, 19, this.team.color, 0);
    teamRing.setStrokeStyle(2, this.team.color, 0.76);
    const healthRing = this.scene.add.graphics();
    const outline = this.scene.add.circle(0, -5, 15, this.archetype.accent, 0.38);
    const body = this.scene.add.circle(0, -5, 11, this.archetype.color, 1);
    const core = this.scene.add.circle(0, -5, 4, 0xf7f5df, 0.96);
    const roleIcon = this.scene.add.graphics();
    const directionMark = this.scene.add.triangle(0, -5, 0, -5, -5, 4, 5, 4, 0xf8f1dc, 0.9);
    directionMark.setVisible(false);

    const drawOutlinedIcon = (draw) => {
      roleIcon.lineStyle(3, 0x244537, 1);
      draw();
      roleIcon.lineStyle(1.5, 0xf7f5df, 1);
      draw();
    };

    if (this.archetype.role === "healer") {
      drawOutlinedIcon(() => {
        roleIcon.lineBetween(-4, -5, 4, -5);
        roleIcon.lineBetween(0, -9, 0, -1);
      });
    } else if (this.archetype.role === "soldier") {
      drawOutlinedIcon(() => {
        roleIcon.beginPath();
        roleIcon.moveTo(0, -10);
        roleIcon.lineTo(5, -8);
        roleIcon.lineTo(4, -4);
        roleIcon.lineTo(0, 0);
        roleIcon.lineTo(-4, -4);
        roleIcon.lineTo(-5, -8);
        roleIcon.closePath();
        roleIcon.strokePath();
      });
    } else if (this.archetype.role === "mage") {
      drawOutlinedIcon(() => {
        roleIcon.beginPath();
        roleIcon.moveTo(0, -10);
        roleIcon.lineTo(1.5, -6.5);
        roleIcon.lineTo(5, -5);
        roleIcon.lineTo(1.5, -3.5);
        roleIcon.lineTo(0, 0);
        roleIcon.lineTo(-1.5, -3.5);
        roleIcon.lineTo(-5, -5);
        roleIcon.lineTo(-1.5, -6.5);
        roleIcon.closePath();
        roleIcon.strokePath();
      });
    } else if (this.archetype.role === "archer") {
      drawOutlinedIcon(() => {
        roleIcon.beginPath();
        roleIcon.moveTo(-3, -10);
        roleIcon.lineTo(-1, -5);
        roleIcon.lineTo(-3, 0);
        roleIcon.moveTo(-4, -5);
        roleIcon.lineTo(4, -5);
        roleIcon.moveTo(1, -8);
        roleIcon.lineTo(4, -5);
        roleIcon.lineTo(1, -2);
        roleIcon.strokePath();
      });
    } else if (this.archetype.role === "assassin") {
      drawOutlinedIcon(() => {
        roleIcon.beginPath();
        roleIcon.moveTo(-4, -10);
        roleIcon.lineTo(4, -2);
        roleIcon.moveTo(4, -10);
        roleIcon.lineTo(-4, -2);
        roleIcon.moveTo(-5, -9);
        roleIcon.lineTo(-3, -11);
        roleIcon.moveTo(5, -9);
        roleIcon.lineTo(3, -11);
        roleIcon.strokePath();
      });
    }

    this.container.add([shadow, aura, teamRing, healthRing, outline, body, core, roleIcon, directionMark]);
    this.container.setSize(32, 38);
    this.aura = aura;
    this.healthRing = healthRing;
    this.outline = outline;
    this.body = body;
    this.core = core;
    this.roleIcon = roleIcon;
    this.directionMark = directionMark;
    this.drawHealthRing();
    this.container.setDepth(this.y);
    this.scene.tweens.add({
      targets: aura,
      alpha: { from: 0.1, to: 0.24 },
      scale: { from: 0.9, to: 1.12 },
      duration: randomBetween(...CONFIG.appearance.auraPulseMs),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.scene.tweens.add({ targets: this.container, alpha: { from: 0, to: 1 }, duration: CONFIG.appearance.spawnFadeMs, ease: "Quad.easeOut" });
  }

  chooseIdleDuration() {
    this.state = STATES.IDLE;
    this.target = null;
    this.nextDecisionAt = this.scene.time.now + randomBetween(...CONFIG.movement.idleDurationMs);
    this.nextSearchAt = this.scene.time.now + randomBetween(...CONFIG.movement.idleSearchIntervalMs);
  }

  chooseDestination() {
    const arenaWidth = ARENA.right - ARENA.left;
    const currentZone = Math.max(0, Math.min(2, Math.floor((this.x - ARENA.left) / (arenaWidth / 3))));
    const selectedZone = Math.random() < CONFIG.movement.stayInZoneChance ? currentZone : Math.floor(Math.random() * 3);
    const zoneWidth = arenaWidth / 3;
    this.destination.x = randomBetween(ARENA.left + zoneWidth * selectedZone + 42, ARENA.left + zoneWidth * (selectedZone + 1) - 42);
    this.destination.y = randomBetween(ARENA.top + 82, ARENA.bottom - 35);
    this.state = STATES.WALK;
    this.target = null;
    this.nextDecisionAt = this.scene.time.now + randomBetween(...CONFIG.movement.walkDurationMs);
    this.nextSearchAt = this.scene.time.now + randomBetween(...CONFIG.movement.walkSearchIntervalMs);
  }

  findTarget() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const candidate of this.scene.actors) {
      if (candidate === this || !candidate.active || candidate.team.id === this.team.id || candidate.state === STATES.HIT || candidate.state === STATES.DEAD) continue;
      const distance = distanceBetween(this, candidate);
      if (distance <= this.detectionRange && distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  findHealTarget() {
    let mostInjured = null;
    let lowestHealthRatio = 1;
    const range = Math.max(this.detectionRange, this.archetype.healRange);
    for (const candidate of this.scene.actors) {
      if (candidate === this || !candidate.active || candidate.team.id !== this.team.id || candidate.health >= candidate.maxHealth) continue;
      const ratio = candidate.health / candidate.maxHealth;
      if (ratio < lowestHealthRatio && distanceBetween(this, candidate) <= range) {
        mostInjured = candidate;
        lowestHealthRatio = ratio;
      }
    }
    return mostInjured;
  }

  startHealing(target) {
    if (this.scene.time.now < this.nextHealAt || !target.active || target.health >= target.maxHealth) return;
    this.target = target;
    this.state = STATES.HEAL;
    this.nextHealAt = this.scene.time.now + this.archetype.healCooldown;
    this.faceTarget(target.x);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: CONFIG.combat.attackWindupMs,
      yoyo: true,
      onComplete: () => {
        if (this.active && target.active) this.scene.fireProjectile(this, target, "heal", this.archetype.healAmount);
        if (this.active && this.state === STATES.HEAL) {
          this.state = STATES.SEARCH;
          this.nextSearchAt = this.scene.time.now + randomBetween(...CONFIG.combat.postAttackSearchMs);
        }
      }
    });
  }

  updateHealer(time, delta) {
    if (this.target && (!this.target.active || this.target.team.id !== this.team.id || this.target.health >= this.target.maxHealth)) {
      this.target = null;
    }
    if (!this.target) this.target = this.findHealTarget();
    if (!this.target) {
      if (time >= this.nextDecisionAt) this.chooseDestination();
      return;
    }
    const distance = distanceBetween(this, this.target);
    if (distance <= this.archetype.healRange) {
      this.startHealing(this.target);
      return;
    }
    this.moveToward(this.target.x, this.target.y, delta);
  }

  startAttack(target) {
    if (this.scene.time.now < this.nextAttackAt || !target.active) return;
    this.target = target;
    this.state = STATES.ATTACK;
    this.nextAttackAt = this.scene.time.now + this.attackCooldown * randomBetween(...CONFIG.combat.cooldownVariation);
    this.faceTarget(target.x);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.2,
      scaleY: 0.84,
      duration: CONFIG.combat.attackWindupMs,
      yoyo: true,
      onComplete: () => {
        if (this.active && target.active) {
          if (this.archetype.role === "assassin") {
            if (distanceBetween(this, target) <= this.attackRange + CONFIG.projectileHitRadius) {
              const slash = this.scene.add.graphics();
              slash.lineStyle(4, 0x24301e, 0.9);
              slash.lineBetween(-11, -11, 11, 11);
              slash.lineStyle(2, 0xf7f5df, 1);
              slash.lineBetween(-11, -11, 11, 11);
              slash.setPosition(target.x, target.y - 5).setDepth(target.y + 2);
              this.scene.tweens.add({
                targets: slash,
                alpha: 0,
                scale: 1.35,
                duration: 180,
                onComplete: () => slash.destroy()
              });
              target.takeHit(this.archetype.damage, this);
            }
          } else {
            const kind = this.archetype.role === "mage" ? "aoe" : "attack";
            this.scene.fireProjectile(this, target, kind, this.archetype.damage);
          }
        }
        if (this.active && this.state === STATES.ATTACK) {
          this.state = STATES.SEARCH;
          this.nextSearchAt = this.scene.time.now + randomBetween(...CONFIG.combat.postAttackSearchMs);
        }
      }
    });
  }

  takeHit(damage, attacker) {
    if (!this.active || this.state === STATES.DEAD) return;
    this.health = Math.max(0, this.health - damage);
    this.drawHealthRing();
    this.lastHitBy = attacker;
    if (this.state === STATES.HIT) {
      if (this.health <= 0) this.die(this.lastHitBy);
      return;
    }
    this.state = STATES.HIT;
    this.target = null;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0.25,
      scale: 1.45,
      duration: CONFIG.combat.hitAnimationMs,
      yoyo: true,
      onComplete: () => {
        if (this.health <= 0) {
          this.die(this.lastHitBy);
          return;
        }
        this.state = STATES.SEARCH;
        this.nextDecisionAt = this.scene.time.now + randomBetween(...CONFIG.combat.hitRecoveryMs);
        this.nextSearchAt = this.scene.time.now;
      }
    });
  }

  receiveHealing(amount) {
    if (!this.active) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.drawHealthRing();
  }

  drawHealthRing() {
    const healthRatio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    const color = healthRatio > 0.6 ? 0x9be6a7 : healthRatio > 0.3 ? 0xffd17a : 0xff8077;
    this.healthRing.clear();
    this.healthRing.lineStyle(2, 0x18201b, 0.92);
    this.healthRing.strokeCircle(0, -5, 14);
    if (healthRatio === 0) return;
    this.healthRing.lineStyle(2, color, 1);
    this.healthRing.beginPath();
    this.healthRing.arc(0, -5, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * healthRatio, false);
    this.healthRing.strokePath();
  }

  die(killer = this.lastHitBy) {
    if (!this.active) return;
    this.state = STATES.DEAD;
    this.active = false;
    this.scene.tweens.killTweensOf(this.aura);
    this.container.destroy();
    this.scene.events.emit("actor-removed", this, killer);
  }

  faceTarget(targetX) {
    this.direction = targetX < this.x ? -1 : 1;
    this.container.setScale(this.direction, 1);
  }

  moveToward(x, y, delta) {
    const wobble = Math.sin(this.scene.time.now * 0.003 + this.id * 2.7) * CONFIG.movement.pathVariation;
    const dx = x - this.x;
    const dy = y + wobble - this.y;
    const length = Math.hypot(dx, dy);
    if (length < 2) return true;
    const step = Math.min(length, this.speed * delta / 1000);
    this.x += dx / length * step;
    this.y += dy / length * step;
    this.x = Phaser.Math.Clamp(this.x, ARENA.left + 22, ARENA.right - 22);
    this.y = Phaser.Math.Clamp(this.y, ARENA.top + 65, ARENA.bottom - 24);
    this.faceTarget(this.x + dx);
    this.container.setPosition(this.x, this.y);
    this.container.setDepth(this.y);
    return length <= step + 3;
  }

  update(time, delta) {
    if (!this.active || this.state === STATES.HIT || this.state === STATES.DEAD || this.state === STATES.HEAL) return;
    if (this.state === STATES.IDLE) {
      if (time >= this.nextSearchAt) {
        this.nextSearchAt = time + randomBetween(...CONFIG.movement.targetSearchIntervalMs);
        this.state = STATES.SEARCH;
      }
      if (time >= this.nextDecisionAt && this.state === STATES.IDLE) this.chooseDestination();
      return;
    }

    if (this.state === STATES.WALK) {
      const arrived = this.moveToward(this.destination.x, this.destination.y, delta);
      if (arrived) this.chooseIdleDuration();
      if (time >= this.nextSearchAt) {
        this.nextSearchAt = time + randomBetween(...CONFIG.movement.walkSearchIntervalMs);
        const target = this.archetype.role === "healer" ? this.findHealTarget() : this.findTarget();
        if (target) {
          this.target = target;
          this.state = STATES.SEARCH;
        }
      }
      if (time >= this.nextDecisionAt && this.state === STATES.WALK) this.chooseIdleDuration();
      return;
    }

    if (this.state === STATES.SEARCH) {
      if (this.archetype.role === "healer") {
        this.updateHealer(time, delta);
        return;
      }
      if (this.target && (!this.target.active || this.target.state === STATES.HIT || this.target.state === STATES.DEAD)) this.target = null;
      if (!this.target) this.target = this.findTarget();
      if (!this.target) {
        if (time >= this.nextDecisionAt) this.chooseDestination();
        return;
      }

      const distance = distanceBetween(this, this.target);
      if (distance > this.detectionRange * 1.45) {
        this.target = null;
        this.chooseDestination();
        return;
      }
      if (distance <= this.attackRange && time >= this.nextAttackAt) {
        if (Math.random() < CONFIG.combat.attackChance) {
          this.startAttack(this.target);
          return;
        }
        this.nextAttackAt = time + randomBetween(...CONFIG.combat.attackRetryMs);
      }
      if (distance > this.attackRange * 0.76) this.moveToward(this.target.x, this.target.y, delta);
    }
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: "game",
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: "#07110f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD.width, height: WORLD.height },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scene: [ArenaScene]
});