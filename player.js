const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const infoDisplay = document.getElementById('info-display');
  const playerCountDisplay = document.getElementById('player-count');
  const shellCountDisplay = document.getElementById('shell-count');
  const colorNameDisplay = document.getElementById('color-name');
  const colorSelectionContainer = document.getElementById('color-selection');
  const colors = ['pink', 'black', 'lightblue', 'darkblue', 'white'];

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const backgroundColor = '#f4e3c1';

  const webSocketServer = 'wss://nosch.uber.space/web-rooms/';
  const socket = new WebSocket(webSocketServer);

  let shellCount = 0;
  let clientId = null;
  let clientCount = 0;
  let playerColor = null;
  let assignedColors = new Set();

  function updatePlayerColorDisplay(){
    if(colorNameDisplay){
      if(playerColor){
        colorNameDisplay.textContent = playerColor;
        const darkColors = ['black', 'darkblue'];
        colorNameDisplay.style.backgroundColor = playerColor;
        colorNameDisplay.style.color = darkColors.includes(playerColor.toLowerCase()) ? '#fff' : '#000';
        colorNameDisplay.style.padding = '0.3em 0.8em';
        colorNameDisplay.style.borderRadius = '12px';
        colorNameDisplay.style.fontWeight = '700';
      } else {
        colorNameDisplay.textContent = '...';
        colorNameDisplay.style.backgroundColor = 'transparent';
        colorNameDisplay.style.color = '#333';
        colorNameDisplay.style.padding = '';
      }
    }
  }

  function updateCounters(){
    playerCountDisplay.textContent = `Spieler: ${clientCount}`;
    shellCountDisplay.textContent = `Muscheln: ${shellCount}`;
  }

  function clearCanvas(){
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0,0,canvasWidth,canvasHeight);
  }
  clearCanvas();

  function renderColorSelection(){
    colorSelectionContainer.innerHTML = '';
    colors.forEach(color => {
      const button = document.createElement('button');
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', `Wähle Farbe ${color}`);
      button.type = 'button';

      if(assignedColors.has(color)){
        button.disabled = true;
      }

      if(color === playerColor){
        button.classList.add('selected');
      }

      button.addEventListener('click', () => {
        if(button.disabled) return;
        if(playerColor !== color){
          playerColor = color;
          if(socket.readyState === WebSocket.OPEN){
            socket.send(JSON.stringify(['*color-selection*', playerColor]));
          }
          updatePlayerColorDisplay();
          renderColorSelection();
        }
      });

      colorSelectionContainer.appendChild(button);
    });
  }

  function updateAssignedColors(colorsArray){
    assignedColors = new Set(colorsArray);
    renderColorSelection();
  }

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify(['*enter-room*', 'muschelraum']));
    socket.send(JSON.stringify(['*subscribe-client-count*']));
    socket.send(JSON.stringify(['*request-color-status*']));
    setInterval(() => socket.send(''), 30000);
  });

  socket.addEventListener('message', (event) => {
    if(!event.data) return;
    let incoming;
    try {
      incoming = JSON.parse(event.data);
    } catch {
      return;
    }

    const type = incoming[0];

    switch(type){
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
        {
          let selection = incoming[1];
          if(typeof selection === 'object' && selection.color){
            assignedColors.add(selection.color);
            renderColorSelection();
          }
        }
        break;

      case '*color-status*':
        {
          let colorsTaken = incoming[1];
          if(Array.isArray(colorsTaken)){
            updateAssignedColors(colorsTaken);
          }
          renderColorSelection();
        }
        break;

      case 'draw-shell':
        {
          const [_, drawX, drawY, color] = incoming;
          ctx.fillStyle = color;
          ctx.beginPath();
          if(typeof ctx.roundRect === 'function'){
            ctx.roundRect(drawX, drawY, 10, 10, 5);
          } else {
            ctx.rect(drawX, drawY, 10, 10);
          }
          ctx.fill();
        }
        break;

      case '*error*':
        console.warn('Server-Fehler:', ...incoming[1]);
        break;
    }
  });

  socket.addEventListener('close', () => {
    if(infoDisplay){
      infoDisplay.textContent = 'Verbindung getrennt';
    }
  });

  canvas.addEventListener('click', (e) => {
    if(!playerColor){
      alert('Bitte wähle zuerst eine Farbe!');
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const size = 10;
    const x = clickX - size/2;
    const y = clickY - size/2;

    ctx.fillStyle = playerColor;
    ctx.beginPath();
    if(typeof ctx.roundRect === 'function'){
      ctx.roundRect(x, y, size, size, size/2);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.fill();

    shellCount++;
    updateCounters();

    if(socket.readyState === WebSocket.OPEN){
      socket.send(JSON.stringify(['*broadcast-message*', ['draw-shell', x, y, playerColor]]));
    }
  });

  updateCounters();
  updatePlayerColorDisplay();
  renderColorSelection();
