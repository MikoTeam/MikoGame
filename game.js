let game;

// --- SIMULASI DATABASE ---
function getGold() { return parseInt(localStorage.getItem('nova_gold') || '1000'); }
function setGold(amount) { 
    localStorage.setItem('nova_gold', amount); 
    document.getElementById('gold-amount').innerText = amount; 
}
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('gold-amount').innerText = getGold();
});

// --- FUNGSI FULLSCREEN & LANDSCAPE ---
async function goFullscreenAndStart() {
    let elem = document.documentElement; // Ambil seluruh layar
    
    try {
        // 1. Minta izin Fullscreen
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            await elem.webkitRequestFullscreen();
        }

        // 2. Kunci Layar jadi Landscape (Mendatar)
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    } catch (err) {
        console.log("Gagal fullscreen/lock orientation:", err);
        // Kalau gagal (misal karena iOS ngeblokir), ya udah biarin aja lanjut
    }

    // 3. Masuk Game
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
    if (!game) {
        initPhaser();
    } else {
        // Kalau game udah pernah jalan, restart scenenya
        game.scene.start('MainScene'); 
    }
}

// --- INISIALISASI PHASER ---
function initPhaser() {
    const config = {
        type: Phaser.AUTO,
        scale: {
            mode: Phaser.Scale.RESIZE, // Otomatis ngepasin ukuran layar HP
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        parent: 'game-container',
        backgroundColor: '#2d4c1e',
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: { preload: preload, create: create, update: update }
    };
    game = new Phaser.Game(config);
}

let player, bots = [], joystick, shootBtn, bullets, lastFired = 0;

function preload() {
    let g = this.add.graphics();
    g.fillStyle(0x3498db); g.fillRect(0, 0, 32, 32); g.generateTexture('player', 32, 32); g.clear();
    g.fillStyle(0xe74c3c); g.fillRect(0, 0, 32, 32); g.generateTexture('bot', 32, 32); g.clear();
    g.fillStyle(0xf1c40f); g.fillCircle(4, 4, 4); g.generateTexture('bullet', 8, 8); g.clear();
}

function create() {
    // Setup Player
    player = this.physics.add.sprite(100, 100, 'player');
    player.setCollideWorldBounds(true);
    player.hp = 100;

    // Setup Bot (3 Bot)
    bots = []; // Reset array
    for (let i = 0; i < 3; i++) {
        let bot = this.physics.add.sprite(Phaser.Math.Between(200, 800), Phaser.Math.Between(200, 800), 'bot');
        bot.hp = 100;
        bot.setCollideWorldBounds(true);
        bots.push(bot);
    }

    // Setup Peluru
    bullets = this.physics.add.group();
    this.physics.add.overlap(bullets, bots, (bullet, bot) => {
        bullet.destroy();
        bot.hp -= 25;
        bot.setTint(0xffffff);
        this.time.delayedCall(100, () => bot.clearTint());
        
        if (bot.hp <= 0) {
            bot.destroy();
            bots = bots.filter(b => b.active);
            setGold(getGold() + 50); // Dapet Gold

            if (bots.length === 0) {
                alert("MENANG! Dapet 150 Gold! 🏆");
                // Balik ke Lobby
                document.getElementById('lobby').style.display = 'flex';
                document.getElementById('game-container').style.display = 'none';
                // Keluar dari fullscreen
                if (document.exitFullscreen) { document.exitFullscreen(); }
            }
        }
    });

    // Joystick (Posisi menyesuaikan layar landscape)
    joystick = this.plugins.get('rexVirtualJoystick').add(this, {
        x: 100, y: this.scale.height - 100, radius: 50,
        base: this.add.circle(0, 0, 50, 0x888888).setAlpha(0.5),
        thumb: this.add.circle(0, 0, 25, 0xcccccc).setAlpha(0.8),
    });

    // Tombol Tembak (Posisi Kanan Bawah)
    shootBtn = this.add.circle(this.scale.width - 100, this.scale.height - 100, 40, 0xff0000).setAlpha(0.5).setInteractive();
    shootBtn.on('pointerdown', () => { shootBtn.setAlpha(1); });
    shootBtn.on('pointerup', () => { shootBtn.setAlpha(0.5); });
    
    // Biar aman kalau layar berubah (di-rotate)
    this.scale.on('resize', (gameSize) => {
        if(joystick) {
            joystick.x = 100;
            joystick.y = gameSize.height - 100;
        }
        if(shootBtn) {
            shootBtn.x = gameSize.width - 100;
            shootBtn.y = gameSize.height - 100;
        }
    });
}

function update(time, delta) {
    if (!player || !player.active) return;

    let speed = 200;
    player.setVelocity(joystick.forceX * speed, joystick.forceY * speed);

    bots.forEach(bot => {
        if (!bot.active) return;
        let distance = Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y);
        
        if (distance < 300) {
            this.physics.moveToObject(bot, player, 100);
            if (distance < 200) {
                bot.setVelocity(0, 0);
                if (time > bot.lastShot + 1000) {
                    fireBullet(bot.x, bot.y, player.x, player.y);
                    bot.lastShot = time;
                }
            }
        } else {
            if (time > bot.lastWander + 2000) {
                bot.setVelocity(Phaser.Math.Between(-100, 100), Phaser.Math.Between(-100, 100));
                bot.lastWander = time;
            }
        }
    });

    if (shootBtn.alpha === 1 && time > lastFired) {
        let target = getNearestBot(player.x, player.y);
        if (target) {
            fireBullet(player.x, player.y, target.x, target.y);
            lastFired = time + 300;
        }
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
    bots.forEach(bot => {
        let dist = Phaser.Math.Distance.Between(x, y, bot.x, bot.y);
        if (dist < minDist) { minDist = dist; nearest = bot; }
    });
    return nearest;
}
