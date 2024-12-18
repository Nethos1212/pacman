// Initialize canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Game constants
const CELL_SIZE = 20;
const PACMAN_SIZE = CELL_SIZE - 2;
const GHOST_SIZE = CELL_SIZE - 2;
const DOT_SIZE = 4;
const POWER_DOT_SIZE = 8;
const GHOST_SPEED = 0.25;
const PACMAN_SPEED = 0.5;

// Add frame rate control
const FPS = 60;
const FRAME_INTERVAL = 1000 / FPS;
let lastFrameTime = 0;

// Colors
const COLORS = {
    WALL: '#2121DE',
    DOT: '#FFB897',
    POWER_DOT: '#FFB897',
    PACMAN: '#FFFF00',
    GHOST: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852']
};

// Game state
let score = 0;
let gameOver = false;
let powerMode = false;
let powerModeTimer = null;

// Direction constants
const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// Maze layout (0: empty, 1: wall, 2: dot, 3: power dot)
const maze = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,1,1,0,1,1,0,1,2,1,1,1,1],
    [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
    [1,1,1,1,2,1,0,1,1,1,1,1,0,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
    [1,3,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,3,1],
    [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
    [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// Game objects
let pacman = {
    x: 9 * CELL_SIZE,
    y: 14 * CELL_SIZE,
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
    mouthOpen: 0,
    mouthDir: 1
};

let ghosts = [
    { x: 8 * CELL_SIZE, y: 9 * CELL_SIZE, direction: DIRECTIONS.RIGHT, color: COLORS.GHOST[0] },
    { x: 9 * CELL_SIZE, y: 9 * CELL_SIZE, direction: DIRECTIONS.UP, color: COLORS.GHOST[1] },
    { x: 10 * CELL_SIZE, y: 9 * CELL_SIZE, direction: DIRECTIONS.LEFT, color: COLORS.GHOST[2] }
];

// Initialize Telegram Game
try {
    TelegramGameProxy.initParams();
} catch (e) {
    console.log('Telegram Game Proxy not available');
}

// Set canvas size
function resizeCanvas() {
    const mazeWidth = maze[0].length * CELL_SIZE;
    const mazeHeight = maze.length * CELL_SIZE;
    canvas.width = mazeWidth;
    canvas.height = mazeHeight;
}
resizeCanvas();

// Input handling
function handleKeydown(e) {
    switch(e.key) {
        case 'ArrowUp':
            pacman.nextDirection = DIRECTIONS.UP;
            break;
        case 'ArrowDown':
            pacman.nextDirection = DIRECTIONS.DOWN;
            break;
        case 'ArrowLeft':
            pacman.nextDirection = DIRECTIONS.LEFT;
            break;
        case 'ArrowRight':
            pacman.nextDirection = DIRECTIONS.RIGHT;
            break;
    }
}

// Mobile controls
document.getElementById('upBtn').addEventListener('touchstart', () => pacman.nextDirection = DIRECTIONS.UP);
document.getElementById('downBtn').addEventListener('touchstart', () => pacman.nextDirection = DIRECTIONS.DOWN);
document.getElementById('leftBtn').addEventListener('touchstart', () => pacman.nextDirection = DIRECTIONS.LEFT);
document.getElementById('rightBtn').addEventListener('touchstart', () => pacman.nextDirection = DIRECTIONS.RIGHT);

document.addEventListener('keydown', handleKeydown);

// Game functions
function canMove(x, y) {
    const gridX = Math.floor((x + CELL_SIZE/2) / CELL_SIZE);
    const gridY = Math.floor((y + CELL_SIZE/2) / CELL_SIZE);
    return gridX >= 0 && gridX < maze[0].length && 
           gridY >= 0 && gridY < maze.length && 
           maze[gridY][gridX] !== 1;
}

function updatePacman() {
    // Get current grid position
    const currentGridX = Math.floor(pacman.x / CELL_SIZE);
    const currentGridY = Math.floor(pacman.y / CELL_SIZE);
    
    // Calculate center position of current cell
    const cellCenterX = currentGridX * CELL_SIZE + CELL_SIZE/2;
    const cellCenterY = currentGridY * CELL_SIZE + CELL_SIZE/2;
    
    // Check if we're near the center of a cell
    const nearCenterX = Math.abs(pacman.x + CELL_SIZE/2 - cellCenterX) < PACMAN_SPEED;
    const nearCenterY = Math.abs(pacman.y + CELL_SIZE/2 - cellCenterY) < PACMAN_SPEED;
    
    // Try to move in the next direction if possible
    if (nearCenterX && nearCenterY) {
        const nextX = cellCenterX - CELL_SIZE/2 + pacman.nextDirection.x * PACMAN_SPEED;
        const nextY = cellCenterY - CELL_SIZE/2 + pacman.nextDirection.y * PACMAN_SPEED;
        
        if (canMove(nextX, nextY)) {
            pacman.direction = pacman.nextDirection;
            pacman.x = cellCenterX - CELL_SIZE/2;
            pacman.y = cellCenterY - CELL_SIZE/2;
        }
    }
    
    // Move in current direction
    const newX = pacman.x + pacman.direction.x * PACMAN_SPEED;
    const newY = pacman.y + pacman.direction.y * PACMAN_SPEED;
    
    if (canMove(newX, newY)) {
        pacman.x = newX;
        pacman.y = newY;
    }

    // Wrap around
    if (pacman.x < -CELL_SIZE) {
        pacman.x = canvas.width;
    } else if (pacman.x > canvas.width) {
        pacman.x = -CELL_SIZE;
    }

    // Update mouth animation
    pacman.mouthOpen += 0.1 * pacman.mouthDir;
    if (pacman.mouthOpen >= 0.5) pacman.mouthDir = -1;
    if (pacman.mouthOpen <= 0) pacman.mouthDir = 1;

    // Check for dots
    const gridX = Math.floor((pacman.x + CELL_SIZE/2) / CELL_SIZE);
    const gridY = Math.floor((pacman.y + CELL_SIZE/2) / CELL_SIZE);
    
    if (gridX >= 0 && gridX < maze[0].length && gridY >= 0 && gridY < maze.length) {
        if (maze[gridY][gridX] === 2) {
            maze[gridY][gridX] = 0;
            score += 10;
            scoreElement.textContent = `Score: ${score}`;
        } else if (maze[gridY][gridX] === 3) {
            maze[gridY][gridX] = 0;
            score += 50;
            scoreElement.textContent = `Score: ${score}`;
            powerMode = true;
            if (powerModeTimer) clearTimeout(powerModeTimer);
            powerModeTimer = setTimeout(() => powerMode = false, 10000);
        }
    }
}

function updateGhosts() {
    ghosts.forEach(ghost => {
        // Get current grid position
        const currentGridX = Math.floor(ghost.x / CELL_SIZE);
        const currentGridY = Math.floor(ghost.y / CELL_SIZE);
        
        // Calculate center position of current cell
        const cellCenterX = currentGridX * CELL_SIZE + CELL_SIZE/2;
        const cellCenterY = currentGridY * CELL_SIZE + CELL_SIZE/2;
        
        // Check if we're near the center of a cell
        const nearCenterX = Math.abs(ghost.x + CELL_SIZE/2 - cellCenterX) < GHOST_SPEED;
        const nearCenterY = Math.abs(ghost.y + CELL_SIZE/2 - cellCenterY) < GHOST_SPEED;
        
        if (nearCenterX && nearCenterY) {
            // At intersection, decide direction
            const possibleDirections = [];
            for (const dir of Object.values(DIRECTIONS)) {
                const nextX = cellCenterX - CELL_SIZE/2 + dir.x * GHOST_SPEED;
                const nextY = cellCenterY - CELL_SIZE/2 + dir.y * GHOST_SPEED;
                if (canMove(nextX, nextY)) {
                    possibleDirections.push(dir);
                }
            }
            
            if (possibleDirections.length > 0) {
                ghost.direction = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
                ghost.x = cellCenterX - CELL_SIZE/2;
                ghost.y = cellCenterY - CELL_SIZE/2;
            }
        }

        const newX = ghost.x + ghost.direction.x * GHOST_SPEED;
        const newY = ghost.y + ghost.direction.y * GHOST_SPEED;

        if (canMove(newX, newY)) {
            ghost.x = newX;
            ghost.y = newY;
        }

        // Check collision with Pacman
        const dx = (ghost.x + CELL_SIZE/2) - (pacman.x + CELL_SIZE/2);
        const dy = (ghost.y + CELL_SIZE/2) - (pacman.y + CELL_SIZE/2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < CELL_SIZE/2) {
            if (powerMode) {
                // Reset ghost position
                ghost.x = 9 * CELL_SIZE;
                ghost.y = 9 * CELL_SIZE;
                score += 200;
                scoreElement.textContent = `Score: ${score}`;
            } else {
                gameOver = true;
            }
        }
    });
}

function drawMaze() {
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            if (maze[y][x] === 1) {
                ctx.fillStyle = COLORS.WALL;
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            } else if (maze[y][x] === 2) {
                ctx.fillStyle = COLORS.DOT;
                ctx.beginPath();
                ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, DOT_SIZE, 0, Math.PI * 2);
                ctx.fill();
            } else if (maze[y][x] === 3) {
                ctx.fillStyle = COLORS.POWER_DOT;
                ctx.beginPath();
                ctx.arc(x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2, POWER_DOT_SIZE, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

function drawPacman() {
    ctx.save();
    ctx.translate(pacman.x + CELL_SIZE/2, pacman.y + CELL_SIZE/2);
    
    // Rotate based on direction
    const angle = Math.atan2(pacman.direction.y, pacman.direction.x);
    ctx.rotate(angle);
    
    ctx.fillStyle = COLORS.PACMAN;
    ctx.beginPath();
    ctx.arc(0, 0, PACMAN_SIZE/2, pacman.mouthOpen * Math.PI, (2 - pacman.mouthOpen) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();
}

function drawGhosts() {
    ghosts.forEach(ghost => {
        ctx.fillStyle = powerMode ? '#0000FF' : ghost.color;
        
        // Ghost body
        ctx.beginPath();
        ctx.arc(ghost.x + CELL_SIZE/2, ghost.y + CELL_SIZE/2 - 2, GHOST_SIZE/2, Math.PI, 0, false);
        ctx.lineTo(ghost.x + CELL_SIZE, ghost.y + CELL_SIZE/2 + 6);
        
        // Ghost waves
        for(let i = 0; i < 3; i++) {
            const waveWidth = GHOST_SIZE/3;
            ctx.quadraticCurveTo(
                ghost.x + CELL_SIZE - (i * waveWidth) - waveWidth/2,
                ghost.y + CELL_SIZE/2 + 2,
                ghost.x + CELL_SIZE - ((i + 1) * waveWidth),
                ghost.y + CELL_SIZE/2 + 6
            );
        }
        
        ctx.lineTo(ghost.x, ghost.y + CELL_SIZE/2 + 6);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(ghost.x + 6, ghost.y + CELL_SIZE/2 - 2, 3, 0, Math.PI * 2);
        ctx.arc(ghost.x + 14, ghost.y + CELL_SIZE/2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(ghost.x + 6, ghost.y + CELL_SIZE/2 - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(ghost.x + 14, ghost.y + CELL_SIZE/2 - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function gameLoop(timestamp) {
    // Control frame rate
    if (timestamp - lastFrameTime < FRAME_INTERVAL) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gameOver) {
        updatePacman();
        updateGhosts();
        
        drawMaze();
        drawPacman();
        drawGhosts();
        
        requestAnimationFrame(gameLoop);
    } else {
        // Game Over screen
        ctx.fillStyle = '#FFF';
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width/2, canvas.height/2);
        ctx.font = '20px Arial';
        ctx.fillText(`Final Score: ${score}`, canvas.width/2, canvas.height/2 + 40);
        
        // Report score to Telegram
        try {
            TelegramGameProxy.shareScore(score);
        } catch (e) {
            console.log('Could not share score with Telegram');
        }
    }
}

// Start the game
gameLoop();
