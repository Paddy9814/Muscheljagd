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
let clientCount = 0;

// Farben fest definieren
const playerColors = ['pink', 'black', 'lightblue', 'darkblue', 'white'];
let playerColor = 'pink'; // wird beim *client-id*-Event gesetzt

function updateCounters() {
  document.getElementById('player-count').textContent = `Spieler: ${clientCount}`;
  document.getElementById('shell-count').textContent = `Muscheln: ${shellCount}`;
}

// Board zu Beginn sandfarben füllen
ctx.fillStyle = backgroundColor;
ctx.fillRect(0, 0, canvasSize, canvasSize);

// Verbindung aufgebaut
socket.addEventListener('open', () => {
  socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
  socket.send(JSON.stringify(['*subscribe-client-count*']));
  setInterval(() => socket.send(''), 30000);
});

// Nachrichten vom Server
socket.addEventListener('message', (event) => {
  if (!event.data) return;
  const incoming = JSON.parse(event.data);
  const type = incoming[0];

  switch (type) {
    case '*client-id*':
      clientId = incoming[1];
      // Hash der clientId für Farbe
      const hash = [...clientId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const colorIndex = hash % playerColors.length;
      playerColor = playerColors[colorIndex];
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

// Canvas-Klick → zeichne Muschel in Spielerfarbe
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

  socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
});

// Board löschen
clearBtn.addEventListener('click', () => {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  shellCount = 0;
  updateCounters();
});
