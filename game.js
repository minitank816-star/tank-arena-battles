// --- CONSTANTS & GAME STATE ---
const CANVAS = document.getElementById('gameCanvas');
const CTR = CANVAS.getContext('2d');
const MAP_SIZE = 3000;
const VIEW_DISTANCE = 1000;

let unlockedLevel = parseInt(localStorage.getItem('tab_unlocked') || '1');
let currentLevel = unlockedLevel;
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER

let viewport = { x: 0, y: 0, w: 0, h: 0 };
let mousePos = { x: 0, y: 0, worldX: 0, worldY: 0 };
let keys = {};

let screenShake = 0;

// --- GAME OBJECTS ---
let player = null;
let tanks = [];
let bullets = [];
let particles = [];
let obstacles = [];
let powerups = [];
let damageTexts = [];
let roads = [];
let hazardZones = [];

// --- LEVEL DIFFICULTY CONFIGS ---
function getLevelConfig(lvl) {
    const factor = (lvl - 1) / 39;
    return {
        enemyHp: 100 + factor * 200,
        enemySpeed: 2.2 + factor * 1.0,
        enemyDamage: 12 + factor * 20,
        enemyAccuracy: 0.05 - factor * 0.035,
        respawnLimit: 20 + Math.floor(factor * 20)
    };
}

let levelKills = { team: 0, enemy: 0 };
let maxLevelKills = 20;

// --- INITIALIZATION ---
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    // Input Handlers
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    window.addEventListener('mousemove', e => {
        mousePos.x = e.clientX;
        mousePos.y = e.clientY;
    });
    window.addEventListener('mousedown', e => {
        if (e.button === 0 && gameState === 'PLAYING' && player && player.hp > 0) {
            player.shoot();
        }
    });

    buildMenuGrid();
    
    document.getElementById('play-btn').addEventListener('click', () => startLevel(currentLevel));
    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentLevel < 40) startLevel(currentLevel + 1);
        else startLevel(currentLevel);
    });
    document.getElementById('menu-btn').addEventListener('click', showMenu);

    requestAnimationFrame(gameLoop);
}

function resize() {
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;
    viewport.w = CANVAS.width;
    viewport.h = CANVAS.height;
}

function buildMenuGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 40; i++) {
        const btn = document.createElement('div');
        btn.className = `level-btn ${i <= unlockedLevel ? 'unlocked' : 'locked'} ${i === currentLevel ? 'active' : ''}`;
        btn.innerText = i;
        if (i <= unlockedLevel) {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLevel = i;
            });
        }
        grid.appendChild(btn);
    }
}

function showMenu() {
    gameState = 'MENU';
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    buildMenuGrid();
}

// --- MAP & LEVEL GENERATION ---
function generateMap() {
    obstacles = [];
    roads = [];
    hazardZones = [];
    powerups = [];

    // Roads (paved area grid)
    roads.push({ x: 500, y: 0, w: 200, h: MAP_SIZE });
    roads.push({ x: 2000, y: 0, w: 200, h: MAP_SIZE });
    roads.push({ x: 0, y: 1400, w: MAP_SIZE, h: 200 });

    // Hazard Zones (Glowing radiation areas)
    for (let i = 0; i < 4; i++) {
        hazardZones.push({
            x: 400 + Math.random() * (MAP_SIZE - 800),
            y: 400 + Math.random() * (MAP_SIZE - 800),
            r: 120 + Math.random() * 80
        });
    }

    // Destructible and Indestructible Buildings/Walls
    const gridCells = 12;
    const cellSize = MAP_SIZE / gridCells;

    for (let r = 0; r < gridCells; r++) {
        for (let c = 0; c < gridCells; c++) {
            if (Math.random() < 0.35) {
                let x = c * cellSize + Math.random() * (cellSize - 120);
                let y = r * cellSize + Math.random() * (cellSize - 120);
                
                if (Math.hypot(x - MAP_SIZE/2, y - MAP_SIZE/2) < 400) continue;

                let isBarrel = Math.random() < 0.2;
                let isDestructible = Math.random() < 0.5 || isBarrel;

                obstacles.push({
                    x: x,
                    y: y,
                    w: isBarrel ? 30 : 80 + Math.random() * 60,
                    h: isBarrel ? 30 : 80 + Math.random() * 60,
                    hp: isBarrel ? 20 : (isDestructible ? 150 : Infinity),
                    maxHp: isBarrel ? 20 : 150,
                    destructible: isDestructible,
                    isBarrel: isBarrel,
                    color: isBarrel ? '#e74c3c' : (isDestructible ? '#8e44ad' : '#2c3e50')
                });
            }
        }
    }
}

function startLevel(lvl) {
    currentLevel = lvl;
    const config = getLevelConfig(lvl);
    maxLevelKills = config.respawnLimit;
    levelKills = { team: 0, enemy: 0 };

    document.getElementById('hud-level').innerText = currentLevel;
    document.getElementById('ally-score').innerText = '0';
    document.getElementById('enemy-score').innerText = '0';

    generateMap();

    tanks = [];
    bullets = [];
    particles = [];
    powerups = [];
    damageTexts = [];

    // Create Player
    player = new Tank(MAP_SIZE / 2 - 200, MAP_SIZE / 2, 0, false);
    tanks.push(player);

    // Create 4 Ally AIs
    for (let i = 0; i < 4; i++) {
        tanks.push(new Tank(MAP_SIZE / 2 - 300 + (i * 50), MAP_SIZE / 2 + 100 * (i - 1.5), 0, true, false));
    }

    // Create 5 Enemy AIs
    for (let i = 0; i < 5; i++) {
        tanks.push(new Tank(MAP_SIZE / 2 + 300, MAP_SIZE / 2 + 100 * (i - 2), 1, true, true, config));
    }

    gameState = 'PLAYING';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
}

// --- TANK CLASS ---
class Tank {
    constructor(x, y, team, isAI = false, isEnemy = false, config = null) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.isAI = isAI;
        this.isEnemy = isEnemy;
        this.radius = 24;

        const baseHp = isEnemy && config ? config.enemyHp : 100;
        this.maxHp = baseHp;
        this.hp = baseHp;
        
        this.speed = isEnemy && config ? config.enemySpeed : 2.5;
        this.damage = isEnemy && config ? config.enemyDamage : 20;
        this.accuracy = isEnemy && config ? config.enemyAccuracy : 0.02;

        this.bodyAngle = 0;
        this.turretAngle = 0;

        this.reloadTime = 45;
        this.reloadTimer = 0;
        
        this.speedBoostTimer = 0;
        this.damageBoostTimer = 0;

        // AI States
        this.target = null;
        this.aiState = 'PATROL';
        this.aiWaypoint = { x: x, y: y };
        this.aiTimer = 0;
    }

    update() {
        if (this.hp <= 0) return;

        if (this.speedBoostTimer > 0) this.speedBoostTimer--;
        if (this.damageBoostTimer > 0) this.damageBoostTimer--;
        if (this.reloadTimer > 0) this.reloadTimer--;

        let moveSpeed = this.speed * (this.speedBoostTimer > 0 ? 1.5 : 1.0);

        if (!this.isAI) {
            // Player Controls
            let dx = 0, dy = 0;
            if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
            if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
            if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
            if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

            if (dx !== 0 || dy !== 0) {
                let targetAngle = Math.atan2(dy, dx);
                let angleDiff = Math.atan2(Math.sin(targetAngle - this.bodyAngle), Math.cos(targetAngle - this.bodyAngle));
                this.bodyAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.08);

                let moveX = Math.cos(this.bodyAngle) * moveSpeed;
                let moveY = Math.sin(this.bodyAngle) * moveSpeed;
                this.moveWithCollision(moveX, moveY);
            }

            this.turretAngle = Math.atan2(mousePos.worldY - this.y, mousePos.worldX - this.x);

            document.getElementById('cooldown-fill').style.width = `${(1 - this.reloadTimer / this.reloadTime) * 100}%`;

        } else {
            this.updateAI(moveSpeed);
        }

        // Hazard damage check
        for (let h of hazardZones) {
            if (Math.hypot(this.x - h.x, this.y - h.y) < h.r) {
                this.takeDamage(0.2, null);
            }
        }

        // Powerup Collection
        for (let i = powerups.length - 1; i >= 0; i--) {
            let p = powerups[i];
            if (Math.hypot(this.x - p.x, this.y - p.y) < this.radius + 15) {
                if (p.type === 'HEALTH') this.hp = Math.min(this.maxHp, this.hp + 40);
                if (p.type === 'BOOST') this.speedBoostTimer = 300;
                if (p.type === 'DAMAGE') this.damageBoostTimer = 300;
                
                for (let k = 0; k < 10; k++) {
                    particles.push(new Particle(p.x, p.y, p.color, (Math.random()-0.5)*4, (Math.random()-0.5)*4, 20));
                }
                powerups.splice(i, 1);
            }
        }
    }

    moveWithCollision(dx, dy) {
        let nextX = this.x + dx;
        let nextY = this.y + dy;

        nextX = Math.max(this.radius, Math.min(MAP_SIZE - this.radius, nextX));
        nextY = Math.max(this.radius, Math.min(MAP_SIZE - this.radius, nextY));

        for (let obs of obstacles) {
            if (circleRectIntersect(nextX, this.y, this.radius, obs.x, obs.y, obs.w, obs.h)) {
                nextX = this.x;
            }
            if (circleRectIntersect(this.x, nextY, this.radius, obs.x, obs.y, obs.w, obs.h)) {
                nextY = this.y;
            }
        }

        for (let t of tanks) {
            if (t !== this && t.hp > 0) {
                let dist = Math.hypot(nextX - t.x, nextY - t.y);
                if (dist < this.radius + t.radius) {
                    nextX = this.x;
                    nextY = this.y;
                }
            }
        }

        this.x = nextX;
        this.y = nextY;
    }

    updateAI(moveSpeed) {
        this.aiTimer++;

        // Find nearest enemy
        let nearestEnemy = null;
        let minDist = Infinity;
        
        for (let t of tanks) {
            if (t !== this && t.hp > 0 && t.team !== this.team) {
                let dist = Math.hypot(t.x - this.x, t.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearestEnemy = t;
                }
            }
        }

        // Decide AI state
        if (nearestEnemy && minDist < 800) {
            this.aiState = 'ATTACK';
            this.target = nearestEnemy;
        } else if (this.hp < this.maxHp * 0.3) {
            this.aiState = 'RETREAT';
        } else {
            this.aiState = 'PATROL';
        }

        // Execute state
        if (this.aiState === 'ATTACK' && this.target) {
            let dx = this.target.x - this.x;
            let dy = this.target.y - this.y;
            let targetAngle = Math.atan2(dy, dx);

            let angleDiff = Math.atan2(Math.sin(targetAngle - this.bodyAngle), Math.cos(targetAngle - this.bodyAngle));
            this.bodyAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.1);

            let moveX = Math.cos(this.bodyAngle) * moveSpeed;
            let moveY = Math.sin(this.bodyAngle) * moveSpeed;
            this.moveWithCollision(moveX, moveY);

            this.turretAngle = targetAngle + (Math.random() - 0.5) * this.accuracy;

            if (this.reloadTimer === 0) {
                this.shoot();
            }

        } else if (this.aiState === 'RETREAT') {
            if (this.target) {
                let dx = this.x - this.target.x;
                let dy = this.y - this.target.y;
                let targetAngle = Math.atan2(dy, dx);

                let angleDiff = Math.atan2(Math.sin(targetAngle - this.bodyAngle), Math.cos(targetAngle - this.bodyAngle));
                this.bodyAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.08);

                let moveX = Math.cos(this.bodyAngle) * moveSpeed;
                let moveY = Math.sin(this.bodyAngle) * moveSpeed;
                this.moveWithCollision(moveX, moveY);
            }

        } else {
            // Patrol
            let dx = this.aiWaypoint.x - this.x;
            let dy = this.aiWaypoint.y - this.y;
            let dist = Math.hypot(dx, dy);

            if (dist < 50 || this.aiTimer > 300) {
                this.aiWaypoint.x = 200 + Math.random() * (MAP_SIZE - 400);
                this.aiWaypoint.y = 200 + Math.random() * (MAP_SIZE - 400);
                this.aiTimer = 0;
            }

            let targetAngle = Math.atan2(dy, dx);
            let angleDiff = Math.atan2(Math.sin(targetAngle - this.bodyAngle), Math.cos(targetAngle - this.bodyAngle));
            this.bodyAngle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.05);

            let moveX = Math.cos(this.bodyAngle) * moveSpeed * 0.7;
            let moveY = Math.sin(this.bodyAngle) * moveSpeed * 0.7;
            this.moveWithCollision(moveX, moveY);

            this.turretAngle += (Math.random() - 0.5) * 0.05;
        }
    }

    shoot() {
        if (this.reloadTimer > 0 || this.hp <= 0) return;

        let bulletX = this.x + Math.cos(this.turretAngle) * 35;
        let bulletY = this.y + Math.sin(this.turretAngle) * 35;

        bullets.push(new Bullet(bulletX, bulletY, this.turretAngle, this.damage, this.team));

        this.reloadTimer = this.reloadTime;
        screenShake = 5;

        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(bulletX, bulletY, '#ff9800', (Math.random()-0.5)*3, (Math.random()-0.5)*3, 10));
        }
    }

    takeDamage(dmg, shooter) {
        this.hp -= dmg;
        screenShake = Math.max(screenShake, 8);

        damageTexts.push(new DamageText(this.x, this.y - 40, Math.floor(dmg)));

        if (this.hp <= 0) {
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(this.x, this.y, this.team === 0 ? '#3498db' : '#e74c3c', (Math.random()-0.5)*6, (Math.random()-0.5)*6, 30));
            }

            if (shooter) {
                if (this.isEnemy) {
                    levelKills.team++;
                    document.getElementById('ally-score').innerText = levelKills.team;
                } else {
                    levelKills.enemy++;
                    document.getElementById('enemy-score').innerText = levelKills.enemy;
                }
            }

            // Powerup drop
            if (Math.random() < 0.3) {
                let types = ['HEALTH', 'BOOST', 'DAMAGE'];
                let type = types[Math.floor(Math.random() * types.length)];
                powerups.push({
                    x: this.x,
                    y: this.y,
                    type: type,
                    color: type === 'HEALTH' ? '#2ecc71' : (type === 'BOOST' ? '#3498db' : '#f39c12'),
                    life: 300
                });
            }
        }
    }

    draw(ctx) {
        if (this.hp <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.rotate(this.bodyAngle);
        ctx.fillStyle = this.team === 0 ? '#3498db' : '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Tread marks
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
        ctx.stroke();

        // Turret
        ctx.rotate(this.turretAngle - this.bodyAngle);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -6, 35, 12);
        ctx.fillStyle = this.team === 0 ? '#5dade2' : '#ec7063';
        ctx.fillRect(20, -4, 15, 8);

        ctx.restore();

        // Health Bar
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(this.x - 30, this.y - this.radius - 20, 60, 8);
        ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#2ecc71' : (this.hp > this.maxHp * 0.25 ? '#f39c12' : '#e74c3c');
        ctx.fillRect(this.x - 30, this.y - this.radius - 20, (this.hp / this.maxHp) * 60, 8);
    }
}

// --- BULLET CLASS ---
class Bullet {
    constructor(x, y, angle, damage, team) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.vx = Math.cos(angle) * 8;
        this.vy = Math.sin(angle) * 8;
        this.damage = damage;
        this.team = team;
        this.radius = 6;
        this.life = 300;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        if (this.x < 0 || this.x > MAP_SIZE || this.y < 0 || this.y > MAP_SIZE) {
            this.life = 0;
            return;
        }

        // Obstacle collision
        for (let obs of obstacles) {
            if (circleRectIntersect(this.x, this.y, this.radius, obs.x, obs.y, obs.w, obs.h)) {
                obs.takeDamage(this.damage);
                this.life = 0;
                
                for (let i = 0; i < 8; i++) {
                    particles.push(new Particle(this.x, this.y, '#ff6b00', (Math.random()-0.5)*4, (Math.random()-0.5)*4, 15));
                }
                return;
            }
        }

        // Tank collision
        for (let t of tanks) {
            if (t.hp > 0 && t.team !== this.team) {
                if (Math.hypot(this.x - t.x, this.y - t.y) < this.radius + t.radius) {
                    t.takeDamage(this.damage, true);
                    this.life = 0;
                    
                    for (let i = 0; i < 12; i++) {
                        particles.push(new Particle(this.x, this.y, '#ffff00', (Math.random()-0.5)*5, (Math.random()-0.5)*5, 20));
                    }
                    return;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.team === 0 ? '#3498db' : '#e74c3c';
        ctx.fillRect(0, -4, 15, 8);
        
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(12, -2, 3, 4);
        
        ctx.restore();
    }
}

// --- PARTICLE CLASS ---
class Particle {
    constructor(x, y, color, vx, vy, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravity
        this.life--;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- DAMAGE TEXT CLASS ---
class DamageText {
    constructor(x, y, damage) {
        this.x = x;
        this.y = y;
        this.text = damage.toString();
        this.life = 60;
        this.vy = -2;
    }

    update() {
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / 60;
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// --- COLLISION DETECTION ---
function circleRectIntersect(cx, cy, cr, rx, ry, rw, rh) {
    let closestX = Math.max(rx, Math.min(cx, rx + rw));
    let closestY = Math.max(ry, Math.min(cy, ry + rh));
    let dx = cx - closestX;
    let dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

// --- RENDERING ---
function draw() {
    CTR.fillStyle = '#1a1a1a';
    CTR.fillRect(0, 0, viewport.w, viewport.h);

    // Update viewport (follow player)
    if (player && player.hp > 0) {
        viewport.x = player.x - viewport.w / 2;
        viewport.y = player.y - viewport.h / 2;
        viewport.x = Math.max(0, Math.min(MAP_SIZE - viewport.w, viewport.x));
        viewport.y = Math.max(0, Math.min(MAP_SIZE - viewport.h, viewport.y));
    }

    // Screen shake
    let shakeX = (Math.random() - 0.5) * screenShake;
    let shakeY = (Math.random() - 0.5) * screenShake;
    CTR.translate(shakeX, shakeY);
    screenShake = Math.max(0, screenShake - 0.5);

    CTR.save();
    CTR.translate(-viewport.x, -viewport.y);

    // Draw roads
    CTR.fillStyle = '#444';
    for (let r of roads) {
        CTR.fillRect(r.x, r.y, r.w, r.h);
    }

    // Draw hazard zones
    for (let h of hazardZones) {
        CTR.fillStyle = 'rgba(76, 175, 80, 0.1)';
        CTR.beginPath();
        CTR.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        CTR.fill();

        CTR.strokeStyle = 'rgba(76, 175, 80, 0.5)';
        CTR.lineWidth = 2;
        CTR.stroke();
    }

    // Draw obstacles
    for (let obs of obstacles) {
        CTR.fillStyle = obs.color;
        CTR.fillRect(obs.x, obs.y, obs.w, obs.h);

        if (obs.destructible) {
            CTR.fillStyle = 'rgba(0,0,0,0.3)';
            CTR.fillRect(obs.x, obs.y - 15, obs.w, 8);
            CTR.fillStyle = '#2ecc71';
            CTR.fillRect(obs.x, obs.y - 15, (obs.hp / obs.maxHp) * obs.w, 8);
        }
    }

    // Draw tanks
    for (let t of tanks) {
        t.draw(CTR);
    }

    // Draw bullets
    for (let b of bullets) {
        b.draw(CTR);
    }

    // Draw particles
    for (let p of particles) {
        p.draw(CTR);
    }

    // Draw powerups
    for (let p of powerups) {
        CTR.fillStyle = p.color;
        CTR.beginPath();
        CTR.arc(p.x, p.y, 12, 0, Math.PI * 2);
        CTR.fill();
        CTR.strokeStyle = 'rgba(255,255,255,0.5)';
        CTR.lineWidth = 2;
        CTR.stroke();
    }

    // Draw damage texts
    for (let dt of damageTexts) {
        dt.draw(CTR);
    }

    CTR.restore();
}

// --- UPDATE ---
function update() {
    if (gameState !== 'PLAYING') return;

    // Update mouse world position
    mousePos.worldX = viewport.x + mousePos.x;
    mousePos.worldY = viewport.y + mousePos.y;

    // Update tanks
    for (let t of tanks) {
        t.update();
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].life <= 0) {
            bullets.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    // Update damage texts
    for (let i = damageTexts.length - 1; i >= 0; i--) {
        damageTexts[i].update();
        if (damageTexts[i].life <= 0) {
            damageTexts.splice(i, 1);
        }
    }

    // Update powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].life--;
        if (powerups[i].life <= 0) {
            powerups.splice(i, 1);
        }
    }

    // Check level completion
    if (levelKills.team >= maxLevelKills) {
        gameState = 'GAMEOVER';
        document.getElementById('end-title').innerText = 'VICTORY!';
        document.getElementById('end-sub').innerText = `Level ${currentLevel} Complete!`;
        document.getElementById('end-screen').style.display = 'flex';

        if (currentLevel === unlockedLevel) {
            unlockedLevel = Math.min(40, unlockedLevel + 1);
            localStorage.setItem('tab_unlocked', unlockedLevel);
        }
    }

    // Check defeat
    if (!player || player.hp <= 0) {
        gameState = 'GAMEOVER';
        document.getElementById('end-title').innerText = 'DEFEAT!';
        document.getElementById('end-sub').innerText = `You were defeated. Try again!`;
        document.getElementById('end-screen').style.display = 'flex';
    }
}

// --- GAME LOOP ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- START ---
init();
