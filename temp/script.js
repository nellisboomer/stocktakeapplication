window.onload = function() {
  
  let canvas, ctx;
  let gridSize = [50, 25, 12.5];
  let zoomLevel = 0;

  let formInProgress = true;
  let drawingMode = true;
  let selectedShape = null;
  let shapes = [];
  currentShape = createNewShape()

  function createNewShape() {
    return {
      id: crypto.randomUUID(),
      markers: [],
      author: '',
      location: '',
      section: '',
      isClosed: false,
      isVerified: false, 
    }
  }

  function getShapeById(id) {
    return shapes.find(shape => shape.id === id);
  }

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

    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault(); 
      console.log('form in progress:', formInProgress)

      if (formInProgress) {
        console.log('Right click is blocked until form is submitted');
        return;
      }

      if (currentShape.markers.length > 0 && !currentShape.isClosed) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedShape = shapes.find(shape =>
        shape.isClosed && pointInPolygon({ x, y }, shape.markers)
      );

      if (clickedShape) {
        document.getElementById('sectionInfoContainer').style.display = 'flex';
        console.log('You right clicked shape:', clickedShape); //console
        highlightShape(clickedShape);
      } else {
        selectedShape = null;
        document.getElementById('sectionInfoContainer').style.display = 'none';
        console.log('No shape found under your click');
      }
    });

    canvas.addEventListener('click', function(e) {

    if (!drawingMode) return;
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
        showSectionForm(currentShape);
        drawGrid(zoomLevel);
        drawingMode = false;
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
    const form = document.getElementById('sectionCreationForm');
    form.style.display = 'flex';
    form.currentShape = shape;
    formInProgress = true;
  }

  document.getElementById('sectionFormBtn').addEventListener('click', saveSectionInfo);
  
  function saveSectionInfo() {
    const form = document.getElementById('sectionCreationForm');
    const location = document.getElementById('stocktakeLocation');
    const section = document.getElementById('stocktakeSection');
    const author = document.getElementById('stocktakeSectionAuthor');

    if (form.currentShape) {
      form.currentShape.location = location.value;
      form.currentShape.section = section.value;
      form.currentShape.author = author.value;
    } else {
      console.error('no current shape is attached to the form');
    }

    location.value = '';
    section.value = '';
    author.value = '';

    form.style.display = 'none';
    selectedShape = null;
    currentShape = createNewShape();
    drawingMode = true;
    formInProgress = false;
    drawGrid(zoomLevel);
  }

  function drawMarker(x, y) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function highlightShape(shape) {
    drawGrid(zoomLevel);
    selectedShape = shape;
    showSectionInfoPanel(shape);

    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(shape.markers[0].x, shape.markers[0].y);
    for (let i = 1; i < shape.markers.length; i++) {
      ctx.lineTo(shape.markers[i].x, shape.markers[i].y);
    }
    if (shape.isClosed) ctx.closePath();
      ctx.stroke();
    }
  
  function pointInPolygon(point, polygon) {
    let [x, y] = [point.x, point.y];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].x, yi = polygon[i].y;
      let xj = polygon[j].x, yj = polygon[j].y;

      let intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function showSectionInfoPanel(shape) {
    const panel = document.getElementById('sectionInfoContainer');
    panel.style.display = 'flex';
   
    document.getElementById('infoID').placeholder = shape.id;

    const locationInput = document.getElementById('infoLocation');
    const sectionInput = document.getElementById('infoName');
    const authorInput = document.getElementById('infoAuthor');
    const infoIdCode = document.getElementById('infoID').innerHTML = shape.id;
    locationInput.placeholder = shape.location;
    sectionInput.placeholder = shape.section;
    authorInput.placeholder = shape.author;

    document.getElementById('infoCloseBtn').addEventListener('click', function () {
      drawGrid(zoomLevel);
      panel.style.display = 'none';
      selectedShape = null
    })

    document.getElementById('infoSaveBtn').addEventListener('click', function () {
      
      if (authorInput.value.trim() !== '') {
        selectedShape.author = authorInput.value.trim();
      };

      if (locationInput.value.trim() !== '') {
        selectedShape.location = locationInput.value.trim();
      };

      if (sectionInput.value.trim() !== '') {
        selectedShape.section = sectionInput.value.trim();
      };
      console.log('Shape updated:', selectedShape);
      
      authorInput.value = '';
      locationInput.value = '';
      sectionInput.value = '';
      
      drawGrid(zoomLevel)
      panel.style.display = 'none';
      selectedShape = null;
    });
  }
}