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
const GHOST_SPEED = 1.0;    // Increased by 4x (from 0.25)
const PACMAN_SPEED = 2.0;   // Increased by 4x (from 0.5)

// Maze dimensions
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 15;

// Add frame rate control
const FPS = 60;
const FRAME_INTERVAL = 1000 / FPS;
let lastFrameTime = 0;

// Colors
const COLORS = {
    WALL: '#0000FF',
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

// Initialize maze
let maze = generateMaze();

// Game objects
let pacman = {
    x: Math.floor(MAZE_WIDTH / 2) * CELL_SIZE,
    y: (MAZE_HEIGHT - 4) * CELL_SIZE,
    direction: DIRECTIONS.RIGHT,
    nextDirection: DIRECTIONS.RIGHT,
    mouthOpen: 0,
    mouthDir: 1
};

let ghosts = [
    { x: (MAZE_WIDTH/2 - 1) * CELL_SIZE, y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE, direction: DIRECTIONS.RIGHT, color: COLORS.GHOST[0] },
    { x: (MAZE_WIDTH/2) * CELL_SIZE, y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE, direction: DIRECTIONS.UP, color: COLORS.GHOST[1] },
    { x: (MAZE_WIDTH/2 + 1) * CELL_SIZE, y: Math.floor(MAZE_HEIGHT/2) * CELL_SIZE, direction: DIRECTIONS.LEFT, color: COLORS.GHOST[2] }
];

// Initialize Telegram Game
try {
    TelegramGameProxy.initParams();
} catch (e) {
    console.log('Telegram Game Proxy not available');
}

// Set canvas size
function resizeCanvas() {
    const mazeWidth = MAZE_WIDTH * CELL_SIZE;
    const mazeHeight = MAZE_HEIGHT * CELL_SIZE;
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
    return gridX >= 0 && gridX < MAZE_WIDTH && 
           gridY >= 0 && gridY < MAZE_HEIGHT && 
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
                ghost.x = (MAZE_WIDTH/2 - 1) * CELL_SIZE;
                ghost.y = Math.floor(MAZE_HEIGHT/2) * CELL_SIZE;
                score += 200;
                scoreElement.textContent = `Score: ${score}`;
            } else {
                gameOver = true;
            }
        }
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
