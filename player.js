const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoDisplay = document.getElementById('info-display');
const playerCountDisplay = document.getElementById('player-count');
const shellCountPerColorDisplay = document.getElementById('shell-count-per-color');
const colorNameDisplay = document.getElementById('color-name');
const colorSelectionContainer = document.getElementById('color-selection');

const colors = ['pink', 'black', 'white', 'lightblue', 'darkblue'];
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
const backgroundColor = '#faedcd';

const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
const socket = new WebSocket(webSocketServer);

const SHELL_LIMIT = 100;
let gameOver = false;

let shellCount = 0;
let shellCountsByColor = {};
colors.forEach(color => {
  shellCountsByColor[color] = 0;
});

let clientId = null;
let clientCount = 0;
let playerColor = null;
let assignedColors = new Set();
let currentShellSize = 20; // Größe der Muscheln

function updatePlayerColorDisplay() {
  if (colorNameDisplay) {
    if (playerColor) {
      colorNameDisplay.textContent = playerColor;
      const darkColors = ['black', 'darkblue', 'indigo', 'plum'];
      colorNameDisplay.style.backgroundColor = playerColor;
      colorNameDisplay.style.color = darkColors.includes(playerColor.toLowerCase()) ? '#fff' : '#000';
    } else {
      colorNameDisplay.textContent = '...';
      colorNameDisplay.style.backgroundColor = 'transparent';
      colorNameDisplay.style.color = '#333';
    }
  }
}

function incrementShellCount(color) {
  if (!shellCountsByColor[color]) shellCountsByColor[color] = 0;
  shellCountsByColor[color]++;
}

function updateShellCountsDisplay() {
  if (!shellCountPerColorDisplay) return;

  shellCountPerColorDisplay.innerHTML = '';

  colors.forEach(color => {
    const count = shellCountsByColor[color] || 0;
    const colorDot = `<span style="display:inline-block; width: 14px; height:14px; background-color:${color}; border-radius:50%; margin-right:6px; vertical-align:middle;"></span>`;
    const countText = `${count}`;
    const span = document.createElement('span');
    span.style.marginRight = '16px';
    span.style.fontWeight = '600';
    span.style.fontSize = '1rem';
    span.style.color = '#333';
    span.innerHTML = colorDot + countText;

    shellCountPerColorDisplay.appendChild(span);
  });
}

function updateCounters() {
  playerCountDisplay.textContent = `Spieler: ${clientCount}`;

  shellCount = Object.values(shellCountsByColor).reduce((a, b) => a + b, 0);
  updateShellCountsDisplay();
}

function renderColorSelection() {
  colorSelectionContainer.innerHTML = '';
  colors.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.type = 'button';
    if (assignedColors.has(color)) button.disabled = true;
    if (color === playerColor) button.classList.add('selected');
    button.addEventListener('click', () => {
      if (button.disabled) return;
      playerColor = color;
      socket.send(JSON.stringify(['*color-selection*', playerColor]));
      updatePlayerColorDisplay();
      renderColorSelection();
    });
    colorSelectionContainer.appendChild(button);
  });
}

function updateAssignedColors(arr) {
  assignedColors = new Set(arr);
  renderColorSelection();
}

function checkForWin(color) {
  if (gameOver) return;
  if (shellCountsByColor[color] >= SHELL_LIMIT) {
    gameOver = true;

    // Kurze Pause, dann Seite neu laden
    setTimeout(() => {
      alert(`🎉 Team ${color.toUpperCase()} hat mit ${SHELL_LIMIT} Muscheln gewonnen!\nDas Spiel startet jetzt neu...`);
      location.reload();
    }, 100); // kleine Verzögerung erlaubt UI-Update
  }
}

socket.addEventListener('open', () => {
  socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
  socket.send(JSON.stringify(['*subscribe-client-count*']));
  socket.send(JSON.stringify(['*request-color-status*']));
  setInterval(() => socket.send(''), 30000);
});

socket.addEventListener('message', (event) => {
  const incoming = JSON.parse(event.data);
  const type = incoming[0];

  switch (type) {
    case '*client-id*':
      clientId = incoming[1];
      updatePlayerColorDisplay();
      renderColorSelection();
      break;

    case '*client-count*':
      clientCount = incoming[1];
      updateCounters();
      break;

    case '*color-selection*':
      if (typeof incoming[1] === 'object' && incoming[1].color) {
        assignedColors.add(incoming[1].color);
        renderColorSelection();
      }
      break;

    case '*color-status*':
      if (Array.isArray(incoming[1])) {
        updateAssignedColors(incoming[1]);
      }
      break;

    case 'draw-shell':
      const [_, x, y, color] = incoming;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
      ctx.fill();

      incrementShellCount(color);
      checkForWin(color); 
      updateCounters();
      break;
  }
});

socket.addEventListener('close', () => {
  if (infoDisplay) {
    infoDisplay.textContent = 'Verbindung getrennt';
  }
});

function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function handleCanvasInput(e) {
  e.preventDefault();
  if (!playerColor) return alert('Bitte wähle zuerst eine Farbe!');
  if (gameOver) return;
  const pos = getCanvasCoordinates(e);
  const x = pos.x - currentShellSize / 2;
  const y = pos.y - currentShellSize / 2;

  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
  ctx.fill();

  //incrementShellCount(playerColor);
  //checkForWin(playerColor);
  updateCounters();

  socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
}

canvas.addEventListener('click', handleCanvasInput);
canvas.addEventListener('touchstart', handleCanvasInput, { passive: false });

updateCounters();
updatePlayerColorDisplay();
renderColorSelection();
