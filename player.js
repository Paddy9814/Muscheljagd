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

// WebSocket Verbindung zum Server
const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
const socket = new WebSocket(webSocketServer);

const SHELL_LIMIT = 100; //100 Punkte Grenze Gewinn
let gameOver = false;

let shellCountsByColor = {}; //speichert Anzahl Muscheln pro Farbe, Start bei 0
colors.forEach(color => {
  shellCountsByColor[color] = 0;
});

let clientCount = 0; //ID client und verbundene Spieler
let playerColor = null; //eigene Farbe
let assignedColors = new Set(); //andere Spieler Farbe
let currentShellSize = 20;
const sandColor = '#f4e3c1'; //Farbe Muscheln übermalen

let shells = []; //Array Muscheln Position, Farbe

function updatePlayerColorDisplay() { //aktuelle Teamfarbe
  if (colorNameDisplay) {
    if (playerColor) {
      colorNameDisplay.textContent = playerColor;
      const darkColors = ['black', 'darkblue']; //Farbe Schrift bei dunklen Farben weiß
      colorNameDisplay.style.backgroundColor = playerColor;
      colorNameDisplay.style.color = darkColors.includes(playerColor.toLowerCase()) ? '#fff' : '#000'; //Textfarbe unterschiedlich je nach Hintergrund
    } else { //noch keine Farbe ausgewählt
      colorNameDisplay.textContent = '...';
      colorNameDisplay.style.backgroundColor = 'transparent';
      colorNameDisplay.style.color = '#333';
    }
  }
}

function incrementShellCount(color) { //erhöht Muschelpunktanzahl
  if (!shellCountsByColor[color]) shellCountsByColor[color] = 0;
  shellCountsByColor[color]++;
}

function decrementShellCount(color) { //verringert
  if (!shellCountsByColor[color]) shellCountsByColor[color] = 0;
  if (shellCountsByColor[color] > 0) shellCountsByColor[color]--;
}

function updateShellCountsDisplay() { //aktualisiert Punkte pro Team
  if (!shellCountPerColorDisplay) return;

  shellCountPerColorDisplay.innerHTML = '';
  colors.forEach(color => {
    const count = shellCountsByColor[color] || 0; //leert Anzeige für jede Farbe
    //Muschel
    const colorDot = `<span style="display:inline-block; width: 14px; height:14px; background-color:${color}; border-radius:50%; margin-right:6px; vertical-align:middle;"></span>`;
    const countText = `${count}`;
    const span = document.createElement('span');
    span.style.marginRight = '16px';
    span.style.fontWeight = '600';
    span.style.fontSize = '1rem';
    span.style.color = '#333';
    span.innerHTML = colorDot + countText;
    shellCountPerColorDisplay.appendChild(span); //hinzufügen Display
  });
}

function updateCounters() { //aktuelle Spieleranzahl
  playerCountDisplay.textContent = `Spieler: ${clientCount}`;
  updateShellCountsDisplay(); //aktualisiert Muschelanzahl pro Team
}

function renderColorSelection() { //Farbauswahl Button
  colorSelectionContainer.innerHTML = '';
  colors.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.type = 'button';
    if (assignedColors.has(color)) button.disabled = true;
    if (color === playerColor) button.classList.add('selected');
    button.addEventListener('click', () => { //Farbe wählen und anderen mitteilen
      if (button.disabled) return;
      playerColor = color;
      socket.send(JSON.stringify(['*color-selection*', playerColor]));
      updatePlayerColorDisplay();
      renderColorSelection();
    });
    colorSelectionContainer.appendChild(button);
  });
}

function updateAssignedColors(arr) { //aktualisiert vergebene Farben von Server
  assignedColors = new Set(arr);
  renderColorSelection();
}

function checkForWin(color) { //Gewinnprüfung
  if (shellCountsByColor[color] >= SHELL_LIMIT && !gameOver) {
    gameOver = true; // Sperrt alle weiteren Klicks 

    socket.send(JSON.stringify(['*broadcast-message*', ['game-over', color]])); //sendet die Message an alle

    setTimeout(() => {
      alert(`🎉 Team ${color.toUpperCase()} hat mit ${SHELL_LIMIT} Muscheln gewonnen!\nDas Spiel startet jetzt neu...`);
      location.reload();
    }, 100);
  }
}


function findShellAtPosition(x, y) { //speichert Position Muschel zum Übermalen
  for (const shell of shells) {
    const dx = shell.x - x;
    const dy = shell.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= currentShellSize) {
      return shell;
    }
  }
  return null;
}

function overpaintShell(existingShell) { //Muschel übermalen
  const size = currentShellSize * 2;
  ctx.fillStyle = sandColor;
  ctx.beginPath();
  ctx.arc(existingShell.x + currentShellSize / 2, existingShell.y + currentShellSize / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function handleCanvasInput(e) { //Reaktion Klick o. Touch Canva
  e.preventDefault();
  if (!playerColor) return alert('Bitte wähle zuerst eine Farbe!');
  if (gameOver) return;

  const pos = getCanvasCoordinates(e);
  const x = pos.x - currentShellSize / 2;
  const y = pos.y - currentShellSize / 2;

  const existingShell = findShellAtPosition(x, y);
  if (existingShell) { //nicht Muschel doppelt malen
    if (existingShell.color === playerColor) return;

    overpaintShell(existingShell); //alte Muschel löschen
    decrementShellCount(existingShell.color);
    incrementShellCount(playerColor);
    shells = shells.filter(s => !(s.x === existingShell.x && s.y === existingShell.y)); //alte Muschel aus Liste
    shells.push({ x, y, color: playerColor });

    ctx.fillStyle = playerColor; //neue Muschel malen
    ctx.beginPath();
    ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
    ctx.fill();

    checkForWin(playerColor);
    updateCounters();
    //Nachricht an andere Spieler senden
    socket.send(JSON.stringify(['*broadcast-message*', ['overpaint-shell', existingShell.x, existingShell.y, existingShell.color, x, y, playerColor]]));

  } else {
    ctx.fillStyle = playerColor; //neue Muschel platzieren
    ctx.beginPath();
    ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
    ctx.fill();

    incrementShellCount(playerColor);
    checkForWin(playerColor);
    shells.push({ x, y, color: playerColor });
    updateCounters();
    //an andere Spieler senden
    socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
  }
}

socket.addEventListener('open', () => { //Verbindung Server öffnen, Daten abfragen
  socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
  socket.send(JSON.stringify(['*subscribe-client-count*']));
  socket.send(JSON.stringify(['*request-color-status*']));
  setInterval(() => socket.send(''), 30000); //Verbindung erhalten
});

socket.addEventListener('message', (event) => { //Nachrichten verarbeiten: Spieleranzahl, Farbauswahl, gezeichnete Muscheln usw.
  const incoming = JSON.parse(event.data);
  const type = incoming[0];

  switch (type) {
    case '*client-id*':
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

    case 'draw-shell': {
      const [_, x, y, color] = incoming;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + currentShellSize / 2, y + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
      ctx.fill();
      incrementShellCount(color);
      checkForWin(color);
      shells.push({ x, y, color });
      updateCounters();
      break;
    }

    case 'overpaint-shell': {
      const [_, oldX, oldY, oldColor, newX, newY, newColor] = incoming;
      ctx.fillStyle = sandColor;
      ctx.beginPath();
      ctx.arc(oldX + currentShellSize / 2, oldY + currentShellSize / 2, currentShellSize, 0, Math.PI * 2);
      ctx.fill();

      decrementShellCount(oldColor);
      incrementShellCount(newColor);

      shells = shells.filter(s => !(s.x === oldX && s.y === oldY));
      shells.push({ x: newX, y: newY, color: newColor });

      ctx.fillStyle = newColor;
      ctx.beginPath();
      ctx.arc(newX + currentShellSize / 2, newY + currentShellSize / 2, currentShellSize / 2, 0, Math.PI * 2);
      ctx.fill();

      checkForWin(newColor);
      updateCounters();
      break;
    }

    case 'game-over': {
      const [_, winningColor] = incoming;
      if (!gameOver) {
        gameOver = true;
        setTimeout(() => {
          alert(`🎉 Team ${winningColor.toUpperCase()} hat mit ${SHELL_LIMIT} Muscheln gewonnen!\nDas Spiel startet jetzt neu...`);
          location.reload();
        }, 100);
      }
      break;
    }
  }
});

socket.addEventListener('close', () => { //Verbindung getrennt
  if (infoDisplay) {
    infoDisplay.textContent = 'Verbindung getrennt';
  }
});

function getCanvasCoordinates(e) { //Mausposition o. Touch zu Canva
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
//Canva Klick und Touch aktivieren
canvas.addEventListener('click', handleCanvasInput);
canvas.addEventListener('touchstart', handleCanvasInput, { passive: false });

updateCounters(); //Update Anzeige
updatePlayerColorDisplay();
renderColorSelection();
