  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const clearBtn = document.getElementById('clear-btn');
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
  let clientCount = 0;
  let playerColor = null;
  let assignedColors = new Set();
  const shellSize = 10; // Feste Größe, keine dynamische Anpassung

  function updatePlayerColorDisplay() {
    if (colorNameDisplay) {
      colorNameDisplay.textContent = playerColor || '...';
      colorNameDisplay.style.backgroundColor = playerColor || 'transparent';
      colorNameDisplay.style.color =
        playerColor && ['black', 'darkblue', 'indigo', 'plum', 'rebeccapurple'].includes(playerColor.toLowerCase())
          ? '#fff'
          : '#000';
      colorNameDisplay.style.padding = playerColor ? '0.3em 0.8em' : '';
      colorNameDisplay.style.borderRadius = playerColor ? '12px' : '';
      colorNameDisplay.style.fontWeight = playerColor ? '700' : '';
    }
  }

  function updateCounters() {
    playerCountDisplay.textContent = \`Spieler: \${clientCount}\`;
    shellCountDisplay.textContent = \`Muscheln: \${shellCount}\`;
  }

  function clearCanvas() {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  clearCanvas();

  function renderColorSelection() {
    colorSelectionContainer.innerHTML = '';
    colors.forEach(color => {
      const button = document.createElement('button');
      button.style.backgroundColor = color;
      button.type = 'button';
      button.disabled = assignedColors.has(color);
      if (color === playerColor) {
        button.classList.add('selected');
      } else {
        button.classList.remove('selected');
      }
      button.addEventListener('click', () => {
        if (button.disabled) return;
        playerColor = color;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(['*color-selection*', playerColor]));
        }
        updatePlayerColorDisplay();
        renderColorSelection();
      });
      colorSelectionContainer.appendChild(button);
    });
  }

  function updateAssignedColors(colorsArray) {
    assignedColors = new Set(colorsArray);
    renderColorSelection();
  }

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
    socket.send(JSON.stringify(['*subscribe-client-count*']));
    socket.send(JSON.stringify(['*request-color-status*']));
  });

  socket.addEventListener('message', event => {
    if (!event.data) return;
    let incoming;
    try {
      incoming = JSON.parse(event.data);
    } catch {
      return;
    }

    const type = incoming[0];

    switch (type) {
      case '*client-count*':
        clientCount = incoming[1];
        updateCounters();
        break;

      case '*color-selection*':
        if (incoming[1] && incoming[1].color) {
          assignedColors.add(incoming[1].color);
          renderColorSelection();
        }
        break;

      case '*color-status*':
        if (Array.isArray(incoming[1])) {
          updateAssignedColors(incoming[1]);
        }
        renderColorSelection();
        break;

      case 'draw-shell':
        {
          const [_, drawX, drawY, color] = incoming;
          ctx.fillStyle = color;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(drawX, drawY, shellSize, shellSize, shellSize / 2);
          } else {
            ctx.rect(drawX, drawY, shellSize, shellSize);
          }
          ctx.fill();
        }
        break;
    }
  });

  socket.addEventListener('close', () => {
    const infoDisplay = document.getElementById('info-display');
    if (infoDisplay) {
      infoDisplay.textContent = 'Verbindung getrennt';
    }
  });

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handleCanvasInput(e) {
    e.preventDefault();
    if (!playerColor) {
      alert('Bitte wähle zuerst eine Farbe!');
      return;
    }
    const pos = getCanvasCoordinates(e);

    const x = pos.x - shellSize / 2;
    const y = pos.y - shellSize / 2;

    ctx.fillStyle = playerColor;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, shellSize, shellSize, shellSize / 2);
    } else {
      ctx.rect(x, y, shellSize, shellSize);
    }
    ctx.fill();

    shellCount++;
    updateCounters();

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
    }
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
})();

