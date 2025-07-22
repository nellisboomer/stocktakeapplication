window.onload = function() {
  
  // project constants
  const LOCAL_PROJECTS_KEY = 'projects';
  const SESSION_USER_KEY = 'user';
  const SESSION_PROJECT_KEY = 'currentProjectId';

  function getUser() {
    return JSON.parse(sessionStorage.getItem(SESSION_USER_KEY));
  }

  function getProjects() {
    return JSON.parse(localStorage.getItem(LOCAL_PROJECTS_KEY));
  }

  function saveProjects(projects) {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  }

  function setCurrentProjectId(id) {
    sessionStorage.setItem(SESSION_PROJECT_KEY, id);
  }

  // animation constants
  const animatedMarkerSizes = new Map(); // key: shapeID:index => currentsize
  const DEFAULT_MARKER_SIZE = 2;
  const ACTIVE_MARKER_SIZE = 4;

  // canvas constants
  let canvas, ctx;
  let gridSize = [50, 25, 12.5];
  let zoomLevel = 0;
  let undoStack = []

  // interaction modes
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

  // displays current section
  function showPage(pageId) {
    const loginPage = document.getElementById('loginPage');
    const projectPage = document.getElementById('projectPage');
    const canvasPage = document.getElementById('canvasPage');

    [loginPage, projectPage, canvasPage].forEach(sec => sec.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    if (pageId === 'canvasPage') {
      setTimeout(() => {
        initCanvas()
      }, 0);
    }
  }

  document.getElementById('loginForm').style.display = 'flex';
  document.getElementById('loginFormBtn').addEventListener('click', submitLogin);

  function submitLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
      alert('Please enter both fields');
      return;
    }

    const user = { id: crypto.randomUUID(), name: username, password: password}
    sessionStorage.setItem('user', JSON.stringify(user));

    showPage("projectPage")
  }
  
  // navigates creation and joining of projects
  document.getElementById('createProjectBtn').onclick = () => {
    const user = getUser()
    const projectName = prompt("Project Name?");

    const newProject = {
      id: crypto.randomUUID(),
      name: projectName,
      createdBy: user.id,
      shapes: [],
      masterShape: null,
      users: [user.id],
    };

    const projects = getProjects();
    projects.push(newProject);
    saveProjects(projects);
    setCurrentProjectId(newProject.id);

    showPage("canvasPage");
    setTimeout(() => {
      initCanvas()
    }, 0);
  }

  function renderProjectList() {
    const list = document.getElementById('projectList');
    const projects = getProjects();
    const user = getUser()

    list.innerHTML = '';

    projects.forEach(project => {
      const item = document.createElement('div');
      item.className = 'project-item'

      item.innerHTML = `
        <span>${project.name}</span>
        <small>Created by: ${project.createdBy === user.id ? "You" : project.createdBy}</small>
        <button>Join</button>
      `;

      const joinButton = item.querySelector('button');
      joinButton.addEventListener("click", () => joinProject(project.id));

      list.appendChild(item)
    });
  }

  document.getElementById('joinProjectBtn').onclick = renderProjectList

  function joinProject(projectId) {
    const user = JSON.parse(sessionStorage.getItem('user'));
    let projects = JSON.parse(localStorage.getItem('projects'));
    let project = projects.find(p => p.id === projectId);

    if (!project) return alert('Project not found');

    if (!project.users.includes(user.id)) {
      project.users.push(user.id);
      localStorage.setItem('projects', JSON.stringify(projects));
    }

    sessionStorage.setItem('currentProjectId', projectId);
    
    setCurrentProjectId(projectId)
    initCanvas()
    showPage("canvasPage")
  }

  function initCanvas() {
    console.log(ctx)
    selectedShape = null;
    document.getElementById('sectionInfoContainer').style.display = 'none';

    canvas = document.getElementById('userCanvas');
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2d context');
      return;
    }

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    render();

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

      console.log(currentMode);
      console.log('form in progress:', formInProgress);

      const { x, y } = getSnappedMousePosition(e);

      const allShapes = [...shapes];
      if (editingShape) allShapes.push(editingShape);

      const clickedShape = allShapes.find(shape => {
        if (!shape || !shape.isClosed || shape.markers.length < 3) return false;

        // Build path for isPointInPath
        ctx.beginPath();
        ctx.moveTo(shape.markers[0].x, shape.markers[0].y);
        for (let i = 1; i < shape.markers.length; i++) {
          ctx.lineTo(shape.markers[i].x, shape.markers[i].y);
        }
        ctx.closePath();

        const inPath = ctx.isPointInPath(x, y);
        const near = isNearMarker({ x, y }, shape.markers, 10);

        if (inPath || near) {
          console.log("Detected shape click on shape:", shape.id, "inPath:", inPath, "near:", near);
        }

        return inPath || near;
      });

      if (clickedShape) {
        selectedShape = clickedShape;
        highlightShape(clickedShape);

        const shapeName = document.getElementById('contextNameInput');
        shapeName.value = selectedShape.section;

        const menu = document.getElementById('customContextMenu');
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        menu.style.display = 'block';

        menu.dataset.shapeId = clickedShape.id || shapes.indexOf(clickedShape);
      } else {
        selectedShape = null;
        document.getElementById('sectionInfoContainer').style.display = 'none';
        document.getElementById('customContextMenu').style.display = 'none';
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
      
      console.log("Updated marker", draggingMarkerIndex, editingShape.markers[draggingMarkerIndex]);

      render();
    });

    canvas.addEventListener('mouseup', function() {
      if (currentMode === MODES.EDITING) {
        draggingMarkerIndex = null;
        render();
      }
    });

    canvas.addEventListener('click', function(e) {

    if (e.button !== 0) return;
    
    if (currentMode === MODES.VIEWING && selectedShape) {
      selectedShape = null;
      currentMode = MODES.DRAWING;
      panel = document.getElementById('sectionInfoContainer')
      panel.style.display = 'none';
      render()
    }

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
    render();
  }

  document.getElementById('contextViewBtn').addEventListener('click', () => {
    const menu = document.getElementById('customContextMenu');
    menu.style.display = 'none';

    if (!selectedShape) return;
    currentMode = MODES.VIEWING;
    showSectionInfoPanel(selectedShape);
    drawGrid(zoomLevel);
  })

  document.getElementById('contextEditBtn').addEventListener('click', () => {
    const menu = document.getElementById('customContextMenu');
    menu.style.display = 'none';

    if (!selectedShape) return;
    editingShape = selectedShape;
    selectedShape = null;
    currentMode = MODES.EDITING;
    drawGrid(zoomLevel);
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('customContextMenu');
    if (!menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  function drawGrid(zoomLevel) {
    if (!ctx) {
      console.warn('ctx not ready when trying to clearRect');
      return;
    }

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

      const isSelected = shape === selectedShape;
      const isEditing = currentMode === MODES.EDITING && isSelected;
      const isHighlighted = (currentMode === MODES.VIEWING || currentMode === MODES.EDITING) && isSelected;

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
        ctx.fillStyle = isEditing ? 'rgba(255,165,0,0.2)' : 'rgba(0, 162, 255, 0.2)';
        ctx.fill();
      }

      ctx.stroke();

      for (const marker of shape.markers) {
        shape.markers.forEach((marker, i) => {
          const key = `${shape.id}:${i}`;
          const isActive = isEditing || isHighlighted;

          const targetSize = isActive ? ACTIVE_MARKER_SIZE : DEFAULT_MARKER_SIZE;
          let currentSize = animatedMarkerSizes.get(key) ?? DEFAULT_MARKER_SIZE;

          currentSize += (targetSize - currentSize) * 0.2;
          if (Math.abs(currentSize - targetSize) < 0.1) currentSize = targetSize;

          animatedMarkerSizes.set(key, currentSize);
          drawMarker(marker.x, marker.y, currentSize)
        });
      }
    }
  }

  function render() {
    if (!ctx || !canvas) {
      console.warn('Render called before canvas or context is ready');
      return;
    }

    drawGrid(zoomLevel);
    drawAllShapes();
    requestAnimationFrame(render);
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
    currentShape = createNewShape( );
    currentMode = MODES.IDLE;
    formInProgress = false;
    drawGrid(zoomLevel);
  }

  function drawMarker(x, y, size = 2) {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function highlightShape(shape) {
    if (!shape || !shape.markers || shape.markers.length === 0) {
      console.warn('Invalid shape provided to highlightShape');
      return;
    }

    selectedShape = shape;

    currentMode = MODES.VIEWING
    // showSectionInfoPanel(shape);

    drawGrid(zoomLevel);
    }
  
  function getClickedShape(x, y) {
    for (const shape of shapes) {
      if (!shape.isClosed) continue;

      ctx.beginPath();
      ctx.moveTo(shape.markers[0].x, shape.markers[0].y);
      for (let i = 1; i < shape.markers.length; i++) {
        ctx.lineTo(shape.markers[i].x, shape.markers[i].y);
      }
      ctx.closePath();

      if (ctx.isPointInPath(x, y)) {
        return shape;
      }
    }
    return null;
  }

  function pointInPolygon(point, polygon) {
    let [x, y] = [point.x, point.y];
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].x, yi = polygon[i].y;
      let xj = polygon[j].x, yj = polygon[j].y;

      const isIntersecting = 
        yi > y !== yj > y &&
        x < ((xj -xi) * (y - yi)) / (yj - yi || 1e-10) + xi;

        if (isIntersecting) inside = !inside;
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
    panel = document.getElementById('sectionInfoContainer');
    panel.style.display = 'none';
    selectedShape = null
  })

  function saveStateForUndo() {
    // create clone
    undoStack.push(JSON.parse(JSON.stringify(shapes)));
    if (undoStack.length > 50) undoStack.shift(); // prevents memory bloat
  }

  document.getElementById('undoBtn').addEventListener('click', function() {
    if (currentMode === MODES.DRAWING && currentShape && currentShape.markers.length > 0) {
      currentShape.markers.pop();
      drawGrid(zoomLevel);
    } else {
      console.log('Nothing to undo');
    }
  })

  document.getElementById('deleteBtn').addEventListener('click', function() {
    if (!selectedShape) return;

    saveStateForUndo();

    shapes = shapes.filter(shape => shape !== selectedShape);
    selectedShape = null;
    editingShape = null;
    currentMode = MODES.DRAWING;

    document.getElementById('sectionInfoContainer').style.display = 'none';
    document.getElementById('customContextMenu').style.display = 'none';
    
    drawGrid(zoomLevel);
  })

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') undoLastAction();
    if (e.key === 'Delete') deleteSelectedShape();
  });

}

