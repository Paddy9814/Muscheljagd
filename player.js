const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const infoDisplay = document.getElementById('info-display');
const playerCountDisplay = document.getElementById('player-count');
const shellCountDisplay = document.getElementById('shell-count');
const colorNameDisplay = document.getElementById('color-name');
const colorSelectionContainer = document.getElementById('color-selection');
const shellCountPerColorContainer = document.getElementById('shell-count-per-color');

const colors = ['pink', 'black', 'lightblue', 'darkblue', 'white', 'peachpuff', 'plum', 'indigo'];
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
const socket = new WebSocket(webSocketServer);

let clientId = null;
let clientCount = 0;
let playerColor = null;
let assignedColors = new Set();
let currentShellSize = 20;

let shellCount = 0;

// Map speichert: key = "x,y", value = Farbe der Muschel an dieser Position
const shellMap = new Map();

// Zähler für jede Farbe (starten bei 0)
const shellCountPerColor = {};
colors.forEach(c => shellCountPerColor[c] = 0);

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

function updateCounters() {
  playerCountDisplay.textContent = `Spieler: ${clientCount}`;
  shellCount = Object.values(shellCountPerColor).reduce((a,b) => a+b, 0);
  shellCountDisplay.textContent = `Muscheln: ${shellCount}`;

  // Anzeige der Muscheln pro Farbe aktualisieren
  shellCountPerColorContainer.innerHTML = '';
  for (const color of colors) {
    const count = shellCountPerColor[color];
    if (count > 0) {
      const span = document.createElement('span');
      span.style.color = color;
      span.style.fontWeight = 'bold';
      span.style.marginRight = '1em';
      span.textContent = `${color}: ${count}`;
      shellCountPerColorContainer.appendChild(span);
    }
  }
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

// Hilfsfunktion: Koordinaten in Key für Map umwandeln (gerundet auf ganzzahlige Position)
function getShellKey(x, y) {
  const keyX = Math.round(x);
  const keyY = Math.round(y);
  return `${keyX},${keyY}`;
}

function drawShell(x, y, color, shouldBroadcast = true) {
  const key = getShellKey(x, y);
  const oldColor = shellMap.get(key);

  if (oldColor === color) {
    // Gleiche Farbe an gleicher Stelle, nix ändern
    return;
  }

  // Falls alte Farbe existiert, dann Zähler verringern
  if (oldColor) {
    shellCountPerColor[oldColor] = Math.max(0, shellCountPerColor[oldColor] - 1);
  }

  // Neue Farbe an Position speichern und Zähler erhöhen
  shellMap.set(key, color);
  shellCountPerColor[color] = (shellCountPerColor[color] || 0) + 1;

  // Muschel zeichnen (rund)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
  ctx.fill();

  updateCounters();

  // Nachricht senden, falls gewünscht (z.B. nicht bei eingehenden Nachrichten)
  if (shouldBroadcast) {
    socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, color]]));
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
      drawShell(x, y, color, false);
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
  const clientX = e.touches ? e.touches[0]
