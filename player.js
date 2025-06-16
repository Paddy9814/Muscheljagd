const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const clearBtn = document.getElementById('clear-btn');
  const infoDisplay = document.getElementById('info-display');
  const playerCountDisplay = document.getElementById('player-count');
  const shellCountDisplay = document.getElementById('shell-count');
  const colorNameDisplay = document.getElementById('color-name');
  const colorSelectionContainer = document.getElementById('color-selection');

  const colors = ['pink', 'black', 'lightblue', 'darkblue', 'white', 'peachpuff', 'plum', 'indigo'];
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const backgroundColor = '#faedcd';

  const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
  const socket = new WebSocket(webSocketServer);

  let shellCount = 0;
  let clientId = null;
  let clientCount = 0;
  let playerColor = null;
  let assignedColors = new Set();

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
    shellCountDisplay.textContent = `Muscheln: ${shellCount}`;
  }

  function clearCanvas() {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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
        if (ctx.roundRect) {
          ctx.roundRect(x, y, currentShellSize, currentShellSize, currentShellSize / 2);
        } else {
          ctx.rect(x, y, currentShellSize, currentShellSize);
        }
        ctx.fill();
        break;
    }
  });

  socket.addEventListener('close', () => {
    if (infoDisplay) {
      infoDisplay.textContent = 'Verbindung getrennt';
    }
  });

  let currentShellSize = 10;
  function updateShellSize() {
    currentShellSize = window.innerWidth <= 640 ? 18 : 10;
  }
  updateShellSize();
  window.addEventListener('resize', updateShellSize);

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
    const pos = getCanvasCoordinates(e);
    const x = pos.x - currentShellSize / 2;
    const y = pos.y - currentShellSize / 2;
    ctx.fillStyle = playerColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, currentShellSize, currentShellSize, currentShellSize / 2);
    } else {
      ctx.rect(x, y, currentShellSize, currentShellSize);
    }
    ctx.fill();
    shellCount++;
    updateCounters();
    socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
  }

  canvas.addEventListener('click', handleCanvasInput);
  canvas.addEventListener('touchstart', handleCanvasInput, { passive: false });

  clearBtn.addEventListener('click', () => {
    clearCanvas();
    shellCount = 0;
    updateCounters();
  });

  updateCounters();
  updatePlayerColorDisplay();
  renderColorSelection();
