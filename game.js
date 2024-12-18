// Initialize canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Game constants
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;
const FPS = 60;
const FRAME_INTERVAL = 1000 / FPS;
const GHOST_SPEED = 40.0;   // Increased ghost speed
const PACMAN_SPEED = 120.0;  // Increased pacman speed to maintain ratio

// Initialize variables
let CELL_SIZE = 20;  // Initial value, will be recalculated
let PACMAN_SIZE = CELL_SIZE - 2;
let GHOST_SIZE = CELL_SIZE - 2;
let DOT_SIZE = 4;
let POWER_DOT_SIZE = 8;
let lastFrameTime = 0;
let prevCellSize = CELL_SIZE;
let score = 0;
let gameOver = false;
let powerMode = false;
let powerModeTimer = null;

// Colors
const COLORS = {
    WALL: '#0000FF',
    DOT: '#FFB897',
    POWER_DOT: '#FFB897',
    PACMAN: '#FFFF00',
    GHOST: ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852']
};

// Direction constants
const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// Maze generation functions
function generateMaze() {
    // Initialize maze with walls
    const maze = Array(MAZE_HEIGHT).fill().map(() => Array(MAZE_WIDTH).fill(1));
    
    // Create a list of potential walls to remove
    const walls = [];
    
    // Start from the center
    const startY = Math.floor(MAZE_HEIGHT / 2);
    const startX = Math.floor(MAZE_WIDTH / 2);
    maze[startY][startX] = 2; // Make it a dot
    
    // Add surrounding walls to the list
    addWalls(startX, startY, walls);
    
    // Process walls until none remain
    while (walls.length > 0) {
        // Pick a random wall
        const wallIndex = Math.floor(Math.random() * walls.length);
        const [x, y, fromX, fromY] = walls[wallIndex];
        walls.splice(wallIndex, 1);
        
        // Check if the cell on the opposite side of the wall is still a wall
        const toX = x + (x - fromX);
        const toY = y + (y - fromY);
        
        if (isValidCell(toX, toY) && maze[toY][toX] === 1) {
            // Create a passage
            maze[y][x] = 2; // Make it a dot
            maze[toY][toX] = 2; // Make the next cell a dot too
            
            // Add new walls to the list
            addWalls(toX, toY, walls);
        }
    }
    
    // Ensure ghost house area
    const ghostHouseY = Math.floor(MAZE_HEIGHT / 2);
    const ghostHouseX = Math.floor(MAZE_WIDTH / 2);
    
    // Create ghost house
    for (let y = ghostHouseY - 1; y <= ghostHouseY + 1; y++) {
        for (let x = ghostHouseX - 2; x <= ghostHouseX + 2; x++) {
            maze[y][x] = y === ghostHouseY ? 0 : 1;
        }
    }
    
    // Add power dots in corners
    const margin = 2;
    maze[margin][margin] = 3;
    maze[margin][MAZE_WIDTH - margin - 1] = 3;
    maze[MAZE_HEIGHT - margin - 1][margin] = 3;
    maze[MAZE_HEIGHT - margin - 1][MAZE_WIDTH - margin - 1] = 3;
    
    // Ensure outer walls
    for (let x = 0; x < MAZE_WIDTH; x++) {
        maze[0][x] = 1;
        maze[MAZE_HEIGHT - 1][x] = 1;
    }
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        maze[y][0] = 1;
        maze[y][MAZE_WIDTH - 1] = 1;
    }
    
    // Add some random tunnels
    const tunnelY = Math.floor(MAZE_HEIGHT / 2);
    for (let x = 0; x < MAZE_WIDTH; x++) {
        if (Math.random() < 0.3) {
            maze[tunnelY][x] = 2;
        }
    }
    
    // Ensure paths are connected
    ensureConnectivity(maze);
    
    return maze;
}

function addWalls(x, y, walls) {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dx, dy] of directions) {
        const newX = x + dx * 2;
        const newY = y + dy * 2;
        
        if (isValidCell(newX, newY)) {
            walls.push([x + dx, y + dy, x, y]);
        }
    }
}

function isValidCell(x, y) {
    return x >= 0 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT;
}

function ensureConnectivity(maze) {
    const visited = Array(MAZE_HEIGHT).fill().map(() => Array(MAZE_WIDTH).fill(false));
    const stack = [];
    let dotCount = 0;
    
    // Start from a dot
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[y][x] === 2) {
                stack.push([x, y]);
                visited[y][x] = true;
                dotCount++;
                break;
            }
        }
        if (stack.length > 0) break;
    }
    
    // DFS to check connectivity
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            
            if (isValidCell(newX, newY) && !visited[newY][newX] && maze[newY][newX] !== 1) {
                stack.push([newX, newY]);
                visited[newY][newX] = true;
                if (maze[newY][newX] === 2) dotCount++;
            }
        }
    }
    
    // If not all dots are connected, add paths
    for (let y = 1; y < MAZE_HEIGHT - 1; y++) {
        for (let x = 1; x < MAZE_WIDTH - 1; x++) {
            if (maze[y][x] === 2 && !visited[y][x]) {
                // Connect to nearest visited cell
                let connected = false;
                const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                
                for (const [dx, dy] of directions) {
                    let nx = x + dx;
                    let ny = y + dy;
                    
                    while (isValidCell(nx, ny)) {
                        if (visited[ny][nx]) {
                            // Create path
                            let px = x;
                            let py = y;
                            while (px !== nx || py !== ny) {
                                maze[py][px] = 2;
                                visited[py][px] = true;
                                px += Math.sign(nx - px);
                                py += Math.sign(ny - py);
                            }
                            connected = true;
                            break;
                        }
                        nx += dx;
                        ny += dy;
                    }
                    if (connected) break;
                }
            }
        }
    }
}

// Initialize game objects with proper positions
let pacman = {
    x: Math.floor(MAZE_WIDTH / 2) * CELL_SIZE,
    y: (MAZE_HEIGHT - 4) * CELL_SIZE,
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
    mouthOpen: 0
};

let ghosts = [
    {
        x: (MAZE_WIDTH/2 - 1) * CELL_SIZE,
        y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE,
        direction: DIRECTIONS.RIGHT,
        color: COLORS.GHOST[0]
    },
    {
        x: (MAZE_WIDTH/2) * CELL_SIZE,
        y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE,
        direction: DIRECTIONS.UP,
        color: COLORS.GHOST[1]
    },
    {
        x: (MAZE_WIDTH/2 + 1) * CELL_SIZE,
        y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE,
        direction: DIRECTIONS.LEFT,
        color: COLORS.GHOST[2]
    }
];

// Function to reset positions
function resetPositions() {
    pacman.x = Math.floor(MAZE_WIDTH / 2) * CELL_SIZE;
    pacman.y = (MAZE_HEIGHT - 4) * CELL_SIZE;
    pacman.direction = DIRECTIONS.RIGHT;
    pacman.nextDirection = DIRECTIONS.RIGHT;

    ghosts[0].x = (MAZE_WIDTH/2 - 1) * CELL_SIZE;
    ghosts[0].y = Math.floor(MAZE_HEIGHT/2) * CELL_SIZE;
    ghosts[1].x = (MAZE_WIDTH/2) * CELL_SIZE;
    ghosts[1].y = Math.floor(MAZE_HEIGHT/2) * CELL_SIZE;
    ghosts[2].x = (MAZE_WIDTH/2 + 1) * CELL_SIZE;
    ghosts[2].y = Math.floor(MAZE_HEIGHT/2) * CELL_SIZE;
}

// Initialize Telegram Game
try {
    TelegramGameProxy.initParams();
} catch (e) {
    console.log('Telegram Game Proxy not available');
}

// Set canvas size
function resizeCanvas() {
    calculateCellSize(); // Recalculate cell size
    const mazeWidth = MAZE_WIDTH * CELL_SIZE;
    const mazeHeight = MAZE_HEIGHT * CELL_SIZE;
    canvas.width = mazeWidth;
    canvas.height = mazeHeight;
    
    // Center the canvas on screen
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
}

// Add window resize listener
window.addEventListener('resize', () => {
    const oldCellSize = CELL_SIZE;
    resizeCanvas();
    const scale = CELL_SIZE / oldCellSize;
    
    // Scale all positions
    pacman.x *= scale;
    pacman.y *= scale;
    ghosts.forEach(ghost => {
        ghost.x *= scale;
        ghost.y *= scale;
    });
});

// Initialize game
function initGame() {
    calculateCellSize();
    resizeCanvas();
    resetPositions();
    maze = generateMaze();
    score = 0;
    gameOver = false;
    powerMode = false;
    if (powerModeTimer) clearTimeout(powerModeTimer);
}

// Input handling
function handleKeydown(e) {
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
            pacman.nextDirection = DIRECTIONS.UP;
            break;
        case 'ArrowDown':
        case 's':
            pacman.nextDirection = DIRECTIONS.DOWN;
            break;
        case 'ArrowLeft':
        case 'a':
            pacman.nextDirection = DIRECTIONS.LEFT;
            break;
        case 'ArrowRight':
        case 'd':
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
    return gridX >= 0 && gridX < MAZE_WIDTH && 
           gridY >= 0 && gridY < MAZE_HEIGHT && 
           maze[gridY][gridX] !== 1;
}

function updatePacman(deltaTime) {
    // Check if we can move in the next direction
    const nextX = pacman.x + pacman.nextDirection.x * PACMAN_SPEED * deltaTime;
    const nextY = pacman.y + pacman.nextDirection.y * PACMAN_SPEED * deltaTime;
    
    if (canMove(nextX, nextY)) {
        pacman.direction = pacman.nextDirection;
    }
    
    // Move in current direction
    const newX = pacman.x + pacman.direction.x * PACMAN_SPEED * deltaTime;
    const newY = pacman.y + pacman.direction.y * PACMAN_SPEED * deltaTime;
    
    if (canMove(newX, newY)) {
        pacman.x = newX;
        pacman.y = newY;
    }
    
    // Handle screen wrapping
    if (pacman.x < -CELL_SIZE) pacman.x = canvas.width;
    if (pacman.x > canvas.width) pacman.x = -CELL_SIZE;
    if (pacman.y < -CELL_SIZE) pacman.y = canvas.height;
    if (pacman.y > canvas.height) pacman.y = -CELL_SIZE;
    
    // Check for dots
    const gridX = Math.floor((pacman.x + CELL_SIZE/2) / CELL_SIZE);
    const gridY = Math.floor((pacman.y + CELL_SIZE/2) / CELL_SIZE);
    
    if (gridX >= 0 && gridX < MAZE_WIDTH && gridY >= 0 && gridY < MAZE_HEIGHT) {
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
            powerModeTimer = setTimeout(() => {
                powerMode = false;
            }, 10000);
        }
    }
}

// Get available directions at a position
function getAvailableDirections(x, y) {
    const directions = [];
    const gridX = Math.floor((x + CELL_SIZE/2) / CELL_SIZE);
    const gridY = Math.floor((y + CELL_SIZE/2) / CELL_SIZE);
    
    // Check each direction
    if (gridX >= 0 && gridX < MAZE_WIDTH && gridY >= 0 && gridY < MAZE_HEIGHT) {
        if (maze[gridY][Math.max(0, gridX - 1)] !== 1) directions.push(DIRECTIONS.LEFT);
        if (maze[gridY][Math.min(MAZE_WIDTH - 1, gridX + 1)] !== 1) directions.push(DIRECTIONS.RIGHT);
        if (maze[Math.max(0, gridY - 1)][gridX] !== 1) directions.push(DIRECTIONS.UP);
        if (maze[Math.min(MAZE_HEIGHT - 1, gridY + 1)][gridX] !== 1) directions.push(DIRECTIONS.DOWN);
    }
    
    return directions;
}

// Get opposite direction
function getOppositeDirection(direction) {
    if (direction === DIRECTIONS.LEFT) return DIRECTIONS.RIGHT;
    if (direction === DIRECTIONS.RIGHT) return DIRECTIONS.LEFT;
    if (direction === DIRECTIONS.UP) return DIRECTIONS.DOWN;
    if (direction === DIRECTIONS.DOWN) return DIRECTIONS.UP;
}

// Update ghost movement
function updateGhosts(deltaTime) {
    ghosts.forEach(ghost => {
        const nextX = ghost.x + ghost.direction.x * GHOST_SPEED * deltaTime;
        const nextY = ghost.y + ghost.direction.y * GHOST_SPEED * deltaTime;
        
        // Check if ghost can move in current direction
        if (canMove(nextX, nextY)) {
            ghost.x = nextX;
            ghost.y = nextY;
            
            // Randomly change direction at intersections (20% chance)
            if (Math.random() < 0.2) {
                const availableDirections = getAvailableDirections(ghost.x, ghost.y);
                if (availableDirections.length > 1) {
                    // Remove opposite direction to prevent immediate backtracking
                    const oppositeDir = getOppositeDirection(ghost.direction);
                    const filteredDirections = availableDirections.filter(dir => 
                        dir !== oppositeDir || availableDirections.length === 1);
                    
                    // Choose random direction
                    ghost.direction = filteredDirections[Math.floor(Math.random() * filteredDirections.length)];
                }
            }
        } else {
            // Hit a wall - choose random valid direction
            const availableDirections = getAvailableDirections(ghost.x, ghost.y);
            if (availableDirections.length > 0) {
                ghost.direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
            }
        }
        
        // Handle screen wrapping
        if (ghost.x < -CELL_SIZE) ghost.x = canvas.width;
        if (ghost.x > canvas.width) ghost.x = -CELL_SIZE;
        if (ghost.y < -CELL_SIZE) ghost.y = canvas.height;
        if (ghost.y > canvas.height) ghost.y = -CELL_SIZE;
    });
}

function drawMaze() {
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
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
    
    // Move to Pacman's position
    ctx.translate(pacman.x + CELL_SIZE/2, pacman.y + CELL_SIZE/2);
    
    // Rotate based on direction
    let angle = 0;
    if (pacman.direction === DIRECTIONS.UP) angle = -Math.PI/2;
    if (pacman.direction === DIRECTIONS.DOWN) angle = Math.PI/2;
    if (pacman.direction === DIRECTIONS.LEFT) angle = Math.PI;
    if (pacman.direction === DIRECTIONS.RIGHT) angle = 0;
    ctx.rotate(angle);
    
    // Draw Pacman body
    ctx.beginPath();
    const mouthAngle = 0.2 * Math.PI * Math.sin(pacman.mouthOpen);
    ctx.arc(0, 0, PACMAN_SIZE/2, mouthAngle, 2 * Math.PI - mouthAngle, true); 
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#FFFF00';  
    ctx.fill();
    
    ctx.restore();
    
    // Update mouth animation
    pacman.mouthOpen += 0.3;
}

function drawGhosts() {
    ghosts.forEach(ghost => {
        ctx.beginPath();
        ctx.arc(ghost.x + CELL_SIZE/2, ghost.y + CELL_SIZE/2, GHOST_SIZE/2, 0, Math.PI, true);
        
        // Draw ghost body
        const bottomY = ghost.y + CELL_SIZE/2 + GHOST_SIZE/2;
        ctx.lineTo(ghost.x, bottomY);
        
        // Draw wavy bottom
        const waveWidth = GHOST_SIZE/3;
        for (let i = 0; i < 3; i++) {
            ctx.quadraticCurveTo(
                ghost.x + waveWidth * (i + 0.5),
                bottomY + 5,
                ghost.x + waveWidth * (i + 1),
                bottomY
            );
        }
        
        ctx.lineTo(ghost.x + GHOST_SIZE, ghost.y + CELL_SIZE/2);
        ctx.fillStyle = powerMode ? '#2121ff' : ghost.color;
        ctx.fill();
        
        // Draw eyes
        const eyeX = ghost.x + CELL_SIZE/2;
        const eyeY = ghost.y + CELL_SIZE/2;
        const eyeSize = GHOST_SIZE/6;
        
        // Left eye
        ctx.beginPath();
        ctx.arc(eyeX - eyeSize*2, eyeY - eyeSize, eyeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        // Right eye
        ctx.beginPath();
        ctx.arc(eyeX + eyeSize*2, eyeY - eyeSize, eyeSize, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    });
}

function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!gameOver) {
        updatePacman(deltaTime);
        updateGhosts(deltaTime);
        
        drawMaze();
        drawPacman();
        drawGhosts();
    } else {
        ctx.fillStyle = '#FFF';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start the game
initGame();
gameLoop();

// Calculate cell size based on screen size
function calculateCellSize() {
    const maxWidth = window.innerWidth * 0.95; // 95% of screen width
    const maxHeight = window.innerHeight * 0.85; // 85% of screen height
    
    // Calculate cell size that would fit both width and height
    const cellByWidth = Math.floor(maxWidth / MAZE_WIDTH);
    const cellByHeight = Math.floor(maxHeight / MAZE_HEIGHT);
    
    // Use the smaller value to ensure game fits on screen
    CELL_SIZE = Math.min(cellByWidth, cellByHeight);
    
    // Update dependent sizes
    PACMAN_SIZE = CELL_SIZE - 2;
    GHOST_SIZE = CELL_SIZE - 2;
    DOT_SIZE = Math.max(4, Math.floor(CELL_SIZE / 5));
    POWER_DOT_SIZE = Math.max(8, Math.floor(CELL_SIZE / 2.5));
}
