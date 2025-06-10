const titleDisplay = document.getElementById('title-display');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clear-btn');
const infoDisplay = document.getElementById('info-display');

const canvasSize = 256;
const backgroundColor = '#f4e3c1';

// WebSocket-Verbindung
const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
const socket = new WebSocket(webSocketServer);

let shellCount = 0;

let clientId = null;
const playerColors = ['pink', 'black', 'lightblue', 'darkblue', 'white', 'flieder', 'dunkellila', 'hellgrau', 'dunkelgrau', 'peach'];
let playerColor = 'pink'; // Default falls kein clientId
let clientCount = 0;

function updateCounters() {
  document.getElementById('player-count').textContent = `Spieler: ${clientCount}`;
  document.getElementById('shell-count').textContent = `Muscheln: ${shellCount}`;
}

// Board beim Start leeren (sandfarben)
ctx.fillStyle = backgroundColor;
ctx.fillRect(0, 0, canvasSize, canvasSize);

// Verbindung geöffnet
socket.addEventListener('open', () => {
  socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
  socket.send(JSON.stringify(['*subscribe-client-count*']));
  setInterval(() => socket.send(''), 30000); // Verbindung aktiv halten
});

// Nachrichten vom Server verarbeiten
socket.addEventListener('message', (event) => {
  if (!event.data) return;
  const incoming = JSON.parse(event.data);
  const type = incoming[0];

  switch (type) {
    case '*client-id*':
      clientId = incoming[1];
      console.log("clientId received:", clientId);

      if (typeof clientId === 'string' && clientId.length > 0) {
        const hash = Array.from(clientId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const colorIndex = hash % playerColors.length;
        playerColor = playerColors[colorIndex];
        console.log("Assigned playerColor:", playerColor);
      } else {
        playerColor = 'pink'; // Fallback
      }
      break;

    case '*client-count*':
      clientCount = incoming[1];
      updateCounters();
      break;

    case 'draw-shell':
      const [_, drawX, drawY, color] = incoming;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(drawX, drawY, 10, 10, 5);
      ctx.fill();
      break;

    case '*error*':
      console.warn('Server-Fehler:', ...incoming[1]);
      break;
  }
});

socket.addEventListener('close', () => {
  if (infoDisplay) {
    infoDisplay.textContent = 'Verbindung getrennt';
  }
});

// Klick auf Canvas → muschel in Spielerfarbe zeichnen & senden
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left);
  const clickY = (e.clientY - rect.top);

  const size = 10;
  const x = clickX - size / 2;
  const y = clickY - size / 2;

  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size / 2);
  ctx.fill();

  shellCount++;
  updateCounters();

  // An andere Spieler senden
  socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
});

// Board leeren
clearBtn.addEventListener('click', () => {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  shellCount = 0;
  updateCounters();
});
