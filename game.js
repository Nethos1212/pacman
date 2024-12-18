// Constants
const PACMAN_COLOR = '#FFFF00';
const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852']; // Red, Pink, Cyan, Orange
const WALL_COLOR = '#2121FF';
const DOT_COLOR = '#FFFFFF';
const POWER_PELLET_COLOR = '#FFFF00';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.gameOver = false;
        this.resizeCanvas();
        this.initGame();
        
        // Initialize Telegram game
        if (window.TelegramGameProxy) {
            TelegramGameProxy.initParams();
        }
    }

    resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / 28; // Standard Pacman maze is 28x28
    }

    initGame() {
        this.pacman = new Pacman(this);
        this.ghosts = [
            new Ghost(this, 'aggressive', 0),
            new Ghost(this, 'ambush', 1),
            new Ghost(this, 'random', 2),
            new Ghost(this, 'patrol', 3)
        ];
        this.generateMaze();
        this.setupControls();
        this.gameLoop();
    }

    generateMaze() {
        // Initialize maze grid (28x28)
        this.maze = Array(28).fill().map(() => Array(28).fill(1));
        // Generate paths using a modified DFS algorithm
        this.generatePaths(1, 1);
        // Add dots and power pellets
        this.addCollectibles();
    }

    generatePaths(x, y) {
        const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        directions.sort(() => Math.random() - 0.5);

        this.maze[y][x] = 0;

        for (let [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            
            if (newX > 0 && newX < 27 && newY > 0 && newY < 27 && this.maze[newY][newX] === 1) {
                this.maze[y + dy/2][x + dx/2] = 0;
                this.maze[newY][newX] = 0;
                this.generatePaths(newX, newY);
            }
        }
    }

    addCollectibles() {
        for (let y = 0; y < 28; y++) {
            for (let x = 0; x < 28; x++) {
                if (this.maze[y][x] === 0) {
                    // Add regular dots
                    this.maze[y][x] = 2;
                }
            }
        }
        // Add power pellets in corners
        const powerPelletPositions = [[1, 1], [1, 26], [26, 1], [26, 26]];
        powerPelletPositions.forEach(([x, y]) => {
            if (this.maze[y][x] === 2) {
                this.maze[y][x] = 3;
            }
        });
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'arrowup' || key === 'w') this.pacman.setDirection('up');
            if (key === 'arrowdown' || key === 's') this.pacman.setDirection('down');
            if (key === 'arrowleft' || key === 'a') this.pacman.setDirection('left');
            if (key === 'arrowright' || key === 'd') this.pacman.setDirection('right');
        });

        // Mobile controls
        const mobileControls = document.getElementById('mobileControls');
        if (mobileControls) {
            const buttons = mobileControls.getElementsByClassName('control-btn');
            Array.from(buttons).forEach(btn => {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    this.pacman.setDirection(btn.dataset.direction);
                });
            });
        }
    }

    updateScore(points) {
        this.score += points;
        document.getElementById('score').textContent = `Score: ${this.score}`;
        // Report score to Telegram
        if (window.TelegramGameProxy) {
            TelegramGameProxy.shareScore(this.score);
        }
    }

    gameLoop() {
        if (!this.gameOver) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Update and draw game elements
            this.drawMaze();
            this.pacman.update();
            this.ghosts.forEach(ghost => ghost.update());
            
            // Check collisions
            this.checkCollisions();
            
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    drawMaze() {
        for (let y = 0; y < 28; y++) {
            for (let x = 0; x < 28; x++) {
                const cell = this.maze[y][x];
                if (cell === 1) { // Wall
                    this.ctx.fillStyle = WALL_COLOR;
                    this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                } else if (cell === 2) { // Dot
                    this.ctx.fillStyle = DOT_COLOR;
                    this.ctx.beginPath();
                    this.ctx.arc(
                        x * this.cellSize + this.cellSize/2,
                        y * this.cellSize + this.cellSize/2,
                        this.cellSize/8,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();
                } else if (cell === 3) { // Power Pellet
                    this.ctx.fillStyle = POWER_PELLET_COLOR;
                    this.ctx.beginPath();
                    this.ctx.arc(
                        x * this.cellSize + this.cellSize/2,
                        y * this.cellSize + this.cellSize/2,
                        this.cellSize/3,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();
                }
            }
        }
    }

    checkCollisions() {
        // Check ghost collisions
        this.ghosts.forEach(ghost => {
            const distance = Math.hypot(
                this.pacman.x - ghost.x,
                this.pacman.y - ghost.y
            );
            if (distance < this.cellSize) {
                this.gameOver = true;
                if (window.TelegramGameProxy) {
                    TelegramGameProxy.shareScore(this.score);
                }
            }
        });

        // Check dot collection
        const gridX = Math.floor(this.pacman.x / this.cellSize);
        const gridY = Math.floor(this.pacman.y / this.cellSize);
        
        if (this.maze[gridY][gridX] === 2) { // Dot
            this.maze[gridY][gridX] = 0;
            this.updateScore(10);
        } else if (this.maze[gridY][gridX] === 3) { // Power Pellet
            this.maze[gridY][gridX] = 0;
            this.updateScore(50);
            this.activatePowerMode();
        }
    }

    activatePowerMode() {
        this.ghosts.forEach(ghost => ghost.setVulnerable());
        setTimeout(() => {
            this.ghosts.forEach(ghost => ghost.setNormal());
        }, 10000); // 10 seconds of power mode
    }
}

class Pacman {
    constructor(game) {
        this.game = game;
        this.x = game.cellSize * 14; // Center of maze
        this.y = game.cellSize * 23; // Standard Pacman starting position
        this.direction = 'right';
        this.nextDirection = 'right';
        this.speed = 2;
        this.mouthOpen = 0;
        this.mouthSpeed = 0.1;
    }

    setDirection(dir) {
        this.nextDirection = dir;
    }

    update() {
        // Update mouth animation
        this.mouthOpen += this.mouthSpeed;
        if (this.mouthOpen > 0.5 || this.mouthOpen < 0) this.mouthSpeed *= -1;

        // Try to change direction
        if (this.canMove(this.nextDirection)) {
            this.direction = this.nextDirection;
        }

        // Move if possible
        if (this.canMove(this.direction)) {
            switch(this.direction) {
                case 'up': this.y -= this.speed; break;
                case 'down': this.y += this.speed; break;
                case 'left': this.x -= this.speed; break;
                case 'right': this.x += this.speed; break;
            }
        }

        // Screen wrapping
        if (this.x < 0) this.x = this.game.canvas.width;
        if (this.x > this.game.canvas.width) this.x = 0;
        if (this.y < 0) this.y = this.game.canvas.height;
        if (this.y > this.game.canvas.height) this.y = 0;

        this.draw();
    }

    canMove(dir) {
        const nextX = this.x + (dir === 'right' ? this.speed : dir === 'left' ? -this.speed : 0);
        const nextY = this.y + (dir === 'down' ? this.speed : dir === 'up' ? -this.speed : 0);
        
        const gridX = Math.floor(nextX / this.game.cellSize);
        const gridY = Math.floor(nextY / this.game.cellSize);
        
        return gridX >= 0 && gridX < 28 && gridY >= 0 && gridY < 28 && 
               this.game.maze[gridY][gridX] !== 1;
    }

    draw() {
        const ctx = this.game.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Rotate based on direction
        const rotation = {
            'right': 0,
            'down': Math.PI/2,
            'left': Math.PI,
            'up': -Math.PI/2
        }[this.direction];
        ctx.rotate(rotation);

        // Draw Pacman body
        ctx.fillStyle = PACMAN_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, this.game.cellSize/2, 
                this.mouthOpen * Math.PI, 
                (2 - this.mouthOpen) * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.restore();
    }
}

class Ghost {
    constructor(game, personality, colorIndex) {
        this.game = game;
        this.personality = personality;
        this.color = GHOST_COLORS[colorIndex];
        this.vulnerable = false;
        this.reset();
    }

    reset() {
        // Random starting position in the top half of the maze
        do {
            this.x = Math.floor(Math.random() * 28) * this.game.cellSize;
            this.y = Math.floor(Math.random() * 14) * this.game.cellSize;
        } while (this.game.maze[Math.floor(this.y/this.game.cellSize)]
                                [Math.floor(this.x/this.game.cellSize)] === 1);
        
        this.speed = 1.5;
        this.direction = 'down';
    }

    setVulnerable() {
        this.vulnerable = true;
        this.speed = 1;
    }

    setNormal() {
        this.vulnerable = false;
        this.speed = 1.5;
    }

    update() {
        // Update position based on personality
        switch(this.personality) {
            case 'aggressive':
                this.chaseTarget(this.game.pacman.x, this.game.pacman.y);
                break;
            case 'ambush':
                // Predict where Pacman will be
                const predictX = this.game.pacman.x + 
                    (this.game.pacman.direction === 'right' ? 100 : 
                     this.game.pacman.direction === 'left' ? -100 : 0);
                const predictY = this.game.pacman.y +
                    (this.game.pacman.direction === 'down' ? 100 : 
                     this.game.pacman.direction === 'up' ? -100 : 0);
                this.chaseTarget(predictX, predictY);
                break;
            case 'random':
                if (!this.canMove(this.direction) || Math.random() < 0.02) {
                    this.pickRandomDirection();
                }
                this.move();
                break;
            case 'patrol':
                this.patrol();
                break;
        }

        this.draw();
    }

    chaseTarget(targetX, targetY) {
        // Simple A* pathfinding to target
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
            if (!this.canMove(this.direction)) {
                this.direction = dy > 0 ? 'down' : 'up';
            }
        } else {
            this.direction = dy > 0 ? 'down' : 'up';
            if (!this.canMove(this.direction)) {
                this.direction = dx > 0 ? 'right' : 'left';
            }
        }
        
        this.move();
    }

    patrol() {
        // Move in a square pattern
        if (!this.canMove(this.direction)) {
            switch(this.direction) {
                case 'right': this.direction = 'down'; break;
                case 'down': this.direction = 'left'; break;
                case 'left': this.direction = 'up'; break;
                case 'up': this.direction = 'right'; break;
            }
        }
        this.move();
    }

    pickRandomDirection() {
        const directions = ['up', 'down', 'left', 'right'];
        do {
            this.direction = directions[Math.floor(Math.random() * directions.length)];
        } while (!this.canMove(this.direction));
    }

    move() {
        switch(this.direction) {
            case 'up': this.y -= this.speed; break;
            case 'down': this.y += this.speed; break;
            case 'left': this.x -= this.speed; break;
            case 'right': this.x += this.speed; break;
        }

        // Screen wrapping
        if (this.x < 0) this.x = this.game.canvas.width;
        if (this.x > this.game.canvas.width) this.x = 0;
        if (this.y < 0) this.y = this.game.canvas.height;
        if (this.y > this.game.canvas.height) this.y = 0;
    }

    canMove(dir) {
        const nextX = this.x + (dir === 'right' ? this.speed : dir === 'left' ? -this.speed : 0);
        const nextY = this.y + (dir === 'down' ? this.speed : dir === 'up' ? -this.speed : 0);
        
        const gridX = Math.floor(nextX / this.game.cellSize);
        const gridY = Math.floor(nextY / this.game.cellSize);
        
        return gridX >= 0 && gridX < 28 && gridY >= 0 && gridY < 28 && 
               this.game.maze[gridY][gridX] !== 1;
    }

    draw() {
        const ctx = this.game.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw ghost body
        ctx.fillStyle = this.vulnerable ? '#0000FF' : this.color;
        ctx.beginPath();
        ctx.arc(0, -this.game.cellSize/4, this.game.cellSize/2, Math.PI, 0);
        ctx.lineTo(this.game.cellSize/2, this.game.cellSize/4);
        
        // Draw wavy bottom
        const waveHeight = this.game.cellSize/8;
        for (let i = 0; i < 3; i++) {
            ctx.quadraticCurveTo(
                this.game.cellSize/3 - (i * this.game.cellSize/3),
                this.game.cellSize/4 + waveHeight,
                this.game.cellSize/6 - (i * this.game.cellSize/3),
                this.game.cellSize/4
            );
        }
        
        ctx.lineTo(-this.game.cellSize/2, this.game.cellSize/4);
        ctx.closePath();
        ctx.fill();

        // Draw eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-this.game.cellSize/4, -this.game.cellSize/4, this.game.cellSize/6, 0, Math.PI * 2);
        ctx.arc(this.game.cellSize/4, -this.game.cellSize/4, this.game.cellSize/6, 0, Math.PI * 2);
        ctx.fill();

        // Draw pupils
        ctx.fillStyle = 'black';
        const pupilOffset = {
            'up': [0, -1],
            'down': [0, 1],
            'left': [-1, 0],
            'right': [1, 0]
        }[this.direction];
        
        ctx.beginPath();
        ctx.arc(
            -this.game.cellSize/4 + pupilOffset[0] * this.game.cellSize/8,
            -this.game.cellSize/4 + pupilOffset[1] * this.game.cellSize/8,
            this.game.cellSize/10,
            0,
            Math.PI * 2
        );
        ctx.arc(
            this.game.cellSize/4 + pupilOffset[0] * this.game.cellSize/8,
            -this.game.cellSize/4 + pupilOffset[1] * this.game.cellSize/8,
            this.game.cellSize/10,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }
}

// Start the game when the window loads
window.addEventListener('load', () => {
    const game = new Game();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        game.resizeCanvas();
    });
});
