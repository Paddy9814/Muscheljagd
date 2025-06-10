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
//const playerColors = ['pink', 'black', 'lightblue', 'darkblue', 'white'];
//let playerColor = 'pink'; // Standard, falls etwas schiefläuft
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
  function generateRandomColor() {
  return `#${Math.floor(Math.random()*16777215).toString(16)}`;
}

const clientColorMap = {}; // Map zur Speicherung der Farben für jeden Client
let playerColor = 'pink'; // Standardfarbe für den Fall von Fehlern

socket.addEventListener('message', (event) => {
  if (!event.data) return;
  const incoming = JSON.parse(event.data);
  const type = incoming[0];

  switch (type) {
    case '*client-id*':
      clientId = incoming[1];

      // Falls dieser Client bereits eine Farbe hat, nutze sie
      if (clientColorMap[clientId]) {
        playerColor = clientColorMap[clientId];
      } else {
        // Neue zufällige Farbe generieren und speichern
        playerColor = generateRandomColor();
        clientColorMap[clientId] = playerColor;
      }

      socket.send(JSON.stringify(['*whoami*'])); // Triggert Aktualisierung
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
  }
});

  
  switch (type) {
    
  case '*client-id*':
  clientId = incoming[1];

  // Farbe anhand der Reihenfolge vergeben (1. Spieler = pink, 2. = schwarz, ...)
  // ACHTUNG: clientCount wird erst kurz danach empfangen, daher kleinen Workaround:
  socket.send(JSON.stringify(['*whoami*'])); // Triggert serverseitig keine Antwort, aber clientCount wird hoffentlich bald aktualisiert
  break;

case '*client-count*':
  clientCount = incoming[1];

   /* if (clientId && clientCount <= playerColors.length) {
    playerColor = playerColors[clientCount - 1];
  } */
  
  // Spielerfarbe zuweisen, aber nur wenn clientId bereits gesetzt wurde:
 if (clientId) {
  playerColor = playerColors[(clientCount - 1) % playerColors.length];
  }

  updateCounters();
  break;
  }

/*
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
      // Wichtig: kein shellCount++ hier!
      break;
      */
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

// Klick auf Canvas → pinkes rundes Rechteck
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
