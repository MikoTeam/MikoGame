let game;
function getGold() { return parseInt(localStorage.getItem('nova_gold') || '1000'); }
function setGold(amount) { localStorage.setItem('nova_gold', amount); document.getElementById('gold-amount').innerText = amount; }

// CEK ORIENTASI SAAT PERTAMA BUKA
window.addEventListener("load", () => {
    if (window.innerWidth < window.innerHeight) {
        // Kalau Portrait, suruh miringin
        alert("Miringkan HP (Landscape) lalu klik OK untuk masuk ke Lobby!");
    }
    document.getElementById('lobby').style.display = 'flex';
    document.getElementById('gold-amount').innerText = getGold();
});

// FUNGSI START GAME
async function startGame() {
    let elem = document.documentElement;
    try {
        // 1. Fullscreen (Hilangin address bar)
        if (elem.requestFullscreen) await elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
        
        // 2. Kunci Miring (Landscape)
        if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (err) { console.log("Gagal lock:", err); }

    // 3. Pindah layar
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('controls').style.display = 'block';

    if (!game) initPhaser();
    else game.scene.start('MainScene');
}

function initPhaser() {
    const config = {
        type: Phaser.AUTO,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        parent: 'game-container',
        backgroundColor: '#2d4c1e',
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: { key: 'MainScene', preload: preload, create: create, update: update }
    };
    game = new Phaser.Game(config);
}

let player, bots = [], bullets, lastFired = 0;
let inputState = { up: false, down: false, left: false, right: false, shoot: false };

// Binding Tombol
function setupControls() {
    const bind = (id, key) => {
        let el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); inputState[key] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); inputState[key] = false; });
        el.addEventListener('mousedown', () => { inputState[key] = true; });
        el.addEventListener('mouseup', () => { inputState[key] = false; });
    };
    bind('btn-up', 'up'); bind('btn-down', 'down'); bind('btn-left', 'left'); bind('btn-right', 'right'); bind('btn-shoot', 'shoot');
}
setupControls();

function preload() {
    let g = this.add.graphics();
    g.fillStyle(0x3498db); g.fillRect(0, 0, 32, 32); g.generateTexture('player', 32, 32); g.clear();
    g.fillStyle(0xe74c3c); g.fillRect(0, 0, 32, 32); g.generateTexture('bot', 32, 32); g.clear();
    g.fillStyle(0xf1c40f); g.fillCircle(4, 4, 4); g.generateTexture('bullet', 8, 8); g.clear();
}

function create() {
    player = this.physics.add.sprite(100, 100, 'player'); player.setCollideWorldBounds(true); player.hp = 100;
    bots = [];
    for (let i = 0; i < 3; i++) {
        let bot = this.physics.add.sprite(Phaser.Math.Between(200, 800), Phaser.Math.Between(200, 800), 'bot');
        bot.hp = 100; bot.setCollideWorldBounds(true); bots.push(bot);
    }
    bullets = this.physics.add.group();
    this.physics.add.overlap(bullets, bots, (bullet, bot) => {
        bullet.destroy(); bot.hp -= 25; bot.setTint(0xffffff);
        this.time.delayedCall(100, () => bot.clearTint());
        if (bot.hp <= 0) {
            bot.destroy(); bots = bots.filter(b => b.active); setGold(getGold() + 50);
            if (bots.length === 0) {
                alert("MENANG! Dapet 150 Gold! 🏆");
                document.getElementById('lobby').style.display = 'flex';
                document.getElementById('game-container').style.display = 'none';
                document.getElementById('controls').style.display = 'none';
                if (document.exitFullscreen) document.exitFullscreen();
            }
        }
    });
}

function update(time, delta) {
    if (!player || !player.active) return;
    let speed = 200; let vx = 0, vy = 0;
    if (inputState.left) vx = -1; if (inputState.right) vx = 1; if (inputState.up) vy = -1; if (inputState.down) vy = 1;
    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    player.setVelocity(vx * speed, vy * speed);

    bots.forEach(bot => {
        if (!bot.active) return;
        let distance = Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y);
        if (distance < 300) {
            this.physics.moveToObject(bot, player, 100);
            if (distance < 200) {
                bot.setVelocity(0, 0);
                if (time > bot.lastShot + 1000) { fireBullet(bot.x, bot.y, player.x, player.y); bot.lastShot = time; }
            }
        } else {
            if (time > bot.lastWander + 2000) { bot.setVelocity(Phaser.Math.Between(-100, 100), Phaser.Math.Between(-100, 100)); bot.lastWander = time; }
        }
    });

    if (inputState.shoot && time > lastFired) {
        let target = getNearestBot(player.x, player.y);
        if (target) { fireBullet(player.x, player.y, target.x, target.y); lastFired = time + 300; }
    }
}

function fireBullet(startX, startY, targetX, targetY) {
    let bullet = bullets.create(startX, startY, 'bullet');
    let angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
    bullet.setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500);
    this.time.delayedCall(1000, () => { if(bullet.active) bullet.destroy(); });
}
function getNearestBot(x, y) {
    let nearest = null, minDist = Infinity;
    bots.forEach(bot => { let dist = Phaser.Math.Distance.Between(x, y, bot.x, bot.y); if (dist < minDist) { minDist = dist; nearest = bot; } });
    return nearest;
}
