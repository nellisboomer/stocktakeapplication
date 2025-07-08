window.onload = function() {
  
  let canvas, ctx;
  let gridSize = [50, 25, 12.5];
  let zoomLevel = 0;

  let shapes = [];
  let currentShape = { 
    markers: [],
    isClosed: false,
    isVerified: false, 
  };

  document.getElementById('loginForm').style.display = 'flex';
  document.getElementById('canvasContainer').style.display = 'none';

  document.getElementById('loginFormBtn').addEventListener('click', submitLogin);

  function submitLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
      alert('Please enter both fields');
      return;
    }

    sessionStorage.setItem('username', username);
    sessionStorage.setItem('password', password);

    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('canvasContainer').style.display = 'block';

    initCanvas();
  }
  
  function initCanvas() {
    canvas = document.getElementById('userCanvas');
    ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    const gridZoom = document.getElementById('gridZoom');
    gridZoom.addEventListener('click', function() {
      if (zoomLevel > 1) {
        zoomLevel = 0;
      } else {
        zoomLevel++;
      }
      drawGrid(zoomLevel);
    });

    canvas.addEventListener('click', function(e) {

    if (currentShape.isClosed) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const spacing = gridSize[zoomLevel];
    const snappedX = Math.round(mouseX / spacing) * spacing;
    const snappedY = Math.round(mouseY / spacing) * spacing;

    const markers = currentShape.markers;
    const snapThreshold = spacing / 2;

    if (markers.length > 2) {
      const first = markers[0];
      const dx = snappedX - first.x;
      const dy = snappedY - first.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= snapThreshold) {
        currentShape.isClosed = true;
        shapes.push(currentShape);

        showSectionForm();

        currentShape = { markers: [], isClosed: false };
        drawGrid(zoomLevel);
        return;
      }
    }
    if (!markers.some(m => m.x === snappedX && m.y === snappedY)) {
      markers.push({ x: snappedX, y: snappedY });
      drawGrid(zoomLevel);
    }
    console.log('Click detected at:', snappedX, snappedY);
  });
    drawGrid(zoomLevel);
  }

  const markers = [];

  function drawGrid(zoomLevel) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    const spacing = gridSize[zoomLevel];

    for (let x = 0; x <= canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    drawAllShapes();
  }

  function drawAllShapes() {
    const allShapes = [...shapes, currentShape];
    for (const shape of allShapes) {
      if(shape.markers.length === 0) continue;

      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shape.markers[0].x, shape.markers[0].y);

      for (let i = 1; i < shape.markers.length; i++) {
        ctx.lineTo(shape.markers[i].x, shape.markers[i].y);
      }

      if (shape.isClosed) {
        ctx.closePath();
        ctx.fillStyle = 'blue';
        ctx.fill()
      }

      ctx.stroke();
      
      if (!shape.isClosed) {
        for (const marker of shape.markers) {
          drawMarker(marker.x, marker.y);
        }
      }
  }
}

  function showSectionForm(shape) {
    const form = document.getElementById('sectionCreatorForm');
    form.style.display = 'flex';
    form.currentShape = shape;
  }

  document.getElementById('sectionFormBtn').addEventListener('click', saveSectionInfo);
  
  function saveSectionInfo() {
    const form = document.getElementById('sectionCreationForm');
    const location = document.getElementById('stocktakeLocation');
    const section = document.getElementById('stocktakeSection');
    const author = document.getElementById('stocktakeSectionAuthor');

    if (form.currentShape) {
      form.currentShape.location = location;
      form.currentShape.section = section;
      form.currentShape.author = author;
    }

    form.style.display = 'none';
  }

  function drawMarker(x, y) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}