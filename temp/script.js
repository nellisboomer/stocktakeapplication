window.onload = function() {
  
  let canvas, ctx;
  let gridSize = [50, 25, 12.5];
  let zoomLevel = 0;

  const MODES = {
    IDLE: 'idle',
    DRAWING: 'drawing',
    EDITING: 'editing',
    VIEWING: 'viewing'
  };

  let currentMode = MODES.IDLE;
  let draggingMarkerIndex = null;

  let formInProgress = true;
  currentMode = MODES.DRAWING;

  let editingShape = null;
  let selectedShape = null;
  
  let shapes = [];
  let currentShape = createNewShape()

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

      // blocks the right click until the form is completed
      if (formInProgress) {
        console.log('Right click is blocked until form is submitted');
        return;
      }
      
      // prevents interaction if shape is being edited
      if (currentMode === MODES.EDITING) {
        console.log('Right click is blocked whilst editing');
        return;
      }

      // prevents right click if shape is being drawn
      if (currentMode === MODES.DRAWING && !currentShape.isClosed) {
        console.log('Right click is bloked whilst drawing in progress')
        return;
      }

      const { x, y } = getSnappedMousePosition(e);

      const clickedShape = shapes.find(shape => {
        if (!shape.isClosed) return false;
        if (pointInPolygon({ x, y }, shape.markers)) return true;
        if (isNearMarker({ x, y }, shape.markers, 10)) return true;
        return false;
      });

      if (clickedShape) {
        selectedShape = clickedShape;
        currentMode = MODES.VIEWING;

        document.getElementById('sectionInfoContainer').style.display = 'flex';
        console.log('You right clicked shape:', clickedShape); //console

        highlightShape(clickedShape);
      } else {
        selectedShape = null;
        currentMode = MODES.IDLE;

        document.getElementById('sectionInfoContainer').style.display = 'none';
        console.log('No shape found under your click');
      }
      drawGrid(zoomLevel);
    });

    canvas.addEventListener('mousedown', function(e) {
      if (currentMode !== MODES.EDITING || !editingShape) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const spacing = gridSize[zoomLevel];
      const threshold = spacing / 2;

      editingShape.markers.forEach((marker, index) => {
        const dx = mouseX - marker.x;
        const dy = mouseY - marker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) {
          draggingMarkerIndex = index;
        }
      });
    });

    canvas.addEventListener('mousemove', function(e) {
      if (currentMode !== MODES.EDITING || draggingMarkerIndex === null) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const spacing = gridSize[zoomLevel];

      const snappedX = Math.round(mouseX / spacing) * spacing;
      const snappedY = Math.round(mouseY / spacing) * spacing;

      editingShape.markers[draggingMarkerIndex] = { x: snappedX, y: snappedY };
      drawGrid(zoomLevel);
    });

    canvas.addEventListener('mouseup', function() {
      if (currentMode === MODES.EDITING) {
        draggingMarkerIndex = null;
      }
    });

    canvas.addEventListener('click', function(e) {

    const infoPanel = document.getElementById('sectionInfoContainer');
    if (infoPanel.style.display === 'flex') return;
    
    if (currentMode !== MODES.DRAWING) return;
    if (!currentShape || currentShape.isClosed) return;

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
        currentMode = MODES.IDLE;
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

  function getSnappedMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const spacing = gridSize[zoomLevel];

    return {
      x: Math.round(mouseX / spacing) * spacing,
      y: Math.round(mouseY / spacing) * spacing
    };
  }

  function drawAllShapes() {
    const allShapes = [...shapes];
    if (currentShape) allShapes.push(currentShape); // only once

    for (const shape of allShapes) {
      if (!shape || !shape.markers || shape.markers.length === 0) continue;

      const isEditing = currentMode === MODES.EDITING && shape === selectedShape;
      const isHighlighted = currentMode === MODES.VIEWING && shape === selectedShape;

      if (isEditing) {
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 3;
      } else if (isHighlighted) {
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
      }

      ctx.beginPath();
      ctx.moveTo(shape.markers[0].x, shape.markers[0].y);

      for (let i = 1; i < shape.markers.length; i++) {
        ctx.lineTo(shape.markers[i].x, shape.markers[i].y);
      }

      if (shape.isClosed) {
        ctx.closePath();
        ctx.fillStyle = isEditing ? 'rgba(255,165,0,0.2)' : 'blue';
        ctx.fill();
      }

      ctx.stroke();

      if (!shape.isClosed || isEditing) {
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

    activeUsername = sessionStorage.getItem('username');
    shapeAuthor = document.getElementById('stocktakeSectionAuthor');
    shapeAuthor.value = activeUsername;
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
    currentMode = MODES.IDLE;
    formInProgress = false;
    drawGrid(zoomLevel);
  }

  function drawMarker(x, y) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function highlightShape(shape) {
    if (!shape || !shape.markers || shape.markers.length === 0) {
      console.warn('Invalid shape provided to highlightShape');
      return;
    }

    selectedShape = shape;

    currentMode = MODES.VIEWING
    showSectionInfoPanel(shape);

    drawGrid(zoomLevel);
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

  function isNearMarker(point, markers, threshold = 10) {
    for (const marker of markers) {
      const dx = point.x - marker.x;
      const dy = point.y - marker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold) {
        return true;
      }
    }
    return false;
  }

  function showSectionInfoPanel(shape) {

    const panel = document.getElementById('sectionInfoContainer');
    panel.style.display = 'flex';

    document.getElementById('infoID').innerText = shape.id;

    const locationInput = document.getElementById('infoLocation');
    const sectionInput = document.getElementById('infoName');
    const authorInput = document.getElementById('infoAuthor');

    locationInput.placeholder = shape.location;
    sectionInput.placeholder = shape.section;
    authorInput.placeholder = shape.author;

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

      authorInput.placeholder = '';
      locationInput.placeholder = '';
      sectionInput.placeholder = '';
      
      drawGrid(zoomLevel)
      panel.style.display = 'none';
      selectedShape = null;
    });
  }

  document.getElementById('infoCloseBtn').addEventListener('click', function () {
    drawGrid(zoomLevel);
    panel.style.display = 'none';
    selectedShape = null
  })

  document.getElementById('toggleEditMode').addEventListener('click', () => {
    console.log('editing button clicked');
    if (currentMode === MODES.EDITING) {
      currentMode = MODES.IDLE;
      editingShape = null
    } else {
      currentMode = MODES.EDITING;
      selectedShape = null;
      currentShape = null;
    }
    drawGrid(zoomLevel)
  });
}