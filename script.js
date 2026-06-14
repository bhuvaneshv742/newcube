/* ============================================================
   CUBE4 — 4×4 Rubik's Cube Game
   script.js — Complete game logic
   ============================================================

   Architecture:
     CubeState   — pure data model (4×4×4 colour arrays per face)
     CubeRenderer — DOM/CSS 3D rendering of cubies
     CubeGame    — orchestration: input, timer, UI, win detection
   ============================================================ */

'use strict';

/* ── Constants ──────────────────────────────────────────── */

const N = 4; // cube dimension (4×4×4)

// Face indices
const FACE = { U: 0, D: 1, F: 2, B: 3, L: 4, R: 5 };
// Colour names map to CSS classes in style.css
const FACE_COLORS = ['white', 'yellow', 'red', 'orange', 'blue', 'green'];
// CSS transform offsets for each face of a cubie (in cubie-size units)
const FACE_TRANSFORMS = {
  front:  'translateZ(calc(var(--cubie-size) / 2))',
  back:   'rotateY(180deg) translateZ(calc(var(--cubie-size) / 2))',
  left:   'rotateY(-90deg) translateZ(calc(var(--cubie-size) / 2))',
  right:  'rotateY(90deg)  translateZ(calc(var(--cubie-size) / 2))',
  top:    'rotateX(90deg)  translateZ(calc(var(--cubie-size) / 2))',
  bottom: 'rotateX(-90deg) translateZ(calc(var(--cubie-size) / 2))',
};

/* ── Utility helpers ────────────────────────────────────── */

/** Clamp a number between min and max */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Deep-clone a 3-D array */
function deepClone3D(arr) {
  return arr.map(f => f.map(r => [...r]));
}

/** Rotate a square 2-D matrix 90 ° clockwise in place */
function rotateFaceCW(face) {
  const n = face.length;
  const result = Array.from({ length: n }, () => Array(n));
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      result[c][n - 1 - r] = face[r][c];
  return result;
}

/** Rotate a matrix counter-clockwise */
function rotateFaceCCW(face) {
  return rotateFaceCW(rotateFaceCW(rotateFaceCW(face)));
}

/* ============================================================
   CubeState — data model
   Stores 6 faces each as an N×N array of colour indices.
   Implements all valid 4×4 moves as pure transforms.
   ============================================================ */

class CubeState {
  constructor() {
    this.reset();
  }

  /**
   * Reset to solved state.
   * faces[FACE.U][row][col] = colour index
   */
  reset() {
    // Each face gets its own solid colour (index 0-5)
    this.faces = Array.from({ length: 6 }, (_, fi) =>
      Array.from({ length: N }, () => Array(N).fill(fi))
    );
    this.moveHistory = [];
  }

  /** Clone this state */
  clone() {
    const s = new CubeState();
    s.faces = deepClone3D(this.faces);
    s.moveHistory = [...this.moveHistory];
    return s;
  }

  /** Check if cube is solved */
  isSolved() {
    return this.faces.every(face =>
      face.every(row => row.every(c => c === face[0][0]))
    );
  }

  /* ── Core move engine ─────────────────────────────────── */

  /**
   * Apply a rotation of one slice.
   * axis: 'x' | 'y' | 'z'
   * layer: 0..N-1  (0 = front/left/bottom side)
   * dir: 1 = CW, -1 = CCW  (from positive-axis viewpoint)
   */
  applyMove(axis, layer, dir) {
    const move = { axis, layer, dir };
    this.moveHistory.push(move);

    if (axis === 'y') this._rotateY(layer, dir);
    else if (axis === 'x') this._rotateX(layer, dir);
    else if (axis === 'z') this._rotateZ(layer, dir);
  }

  /** Undo the last move */
  undoMove() {
    const m = this.moveHistory.pop();
    if (!m) return null;
    // Apply reverse
    if (m.axis === 'y') this._rotateY(m.layer, -m.dir);
    else if (m.axis === 'x') this._rotateX(m.layer, -m.dir);
    else if (m.axis === 'z') this._rotateZ(m.layer, -m.dir);
    return m;
  }

  /* ── Y-axis (horizontal layer, top=0) ────────────────── */
  _rotateY(layer, dir) {
    const f = this.faces;
    // For each column in the layer row, cycle F→R→B→L (CW) or reverse
    const row = layer; // layer 0 = top row (U face side)

    // Cycle the 4 side faces' rows
    const fRow = f[FACE.F][row].slice();
    const rRow = f[FACE.R][row].slice();
    const bRow = f[FACE.B][row].slice();
    const lRow = f[FACE.L][row].slice();

    if (dir === 1) {
      // CW looking from top: F→L, R→F, B→R, L→B  (wait – standard: F→R→B→L)
      f[FACE.F][row] = lRow;
      f[FACE.R][row] = fRow;
      f[FACE.B][row] = rRow;
      f[FACE.L][row] = bRow;
    } else {
      f[FACE.F][row] = rRow;
      f[FACE.L][row] = fRow;
      f[FACE.B][row] = lRow;
      f[FACE.R][row] = bRow;
    }

    // Rotate face sticker grid for top (layer 0) or bottom (layer N-1)
    if (layer === 0) {
      f[FACE.U] = dir === 1 ? rotateFaceCW(f[FACE.U]) : rotateFaceCCW(f[FACE.U]);
    }
    if (layer === N - 1) {
      f[FACE.D] = dir === 1 ? rotateFaceCCW(f[FACE.D]) : rotateFaceCW(f[FACE.D]);
    }
  }

  /* ── X-axis (vertical left/right layer) ──────────────── */
  _rotateX(layer, dir) {
    const f = this.faces;
    const col = layer; // layer 0 = left column

    // Extract columns from U, F, D, B
    const uCol = f[FACE.U].map(r => r[col]);
    const fCol = f[FACE.F].map(r => r[col]);
    const dCol = f[FACE.D].map(r => r[col]);
    // B is mirrored: col from B corresponds to (N-1-col) visually
    const bCol = f[FACE.B].map(r => r[N - 1 - col]).reverse();

    const setCol = (face, colIdx, vals) => {
      vals.forEach((v, r) => { face[r][colIdx] = v; });
    };

    if (dir === 1) {
      // CW from right: U→F, F→D, D→B(reversed), B→U(reversed)
      setCol(f[FACE.F], col, uCol);
      setCol(f[FACE.D], col, fCol);
      // B gets dCol reversed, placed at mirrored col
      [...dCol].reverse().forEach((v, r) => { f[FACE.B][r][N - 1 - col] = v; });
      setCol(f[FACE.U], col, bCol);
    } else {
      setCol(f[FACE.U], col, fCol);
      setCol(f[FACE.F], col, dCol);
      [...uCol].reverse().forEach((v, r) => { f[FACE.B][r][N - 1 - col] = v; });
      setCol(f[FACE.D], col, bCol);
    }

    // Rotate face grid for left (layer 0) or right (layer N-1)
    if (layer === 0) {
      f[FACE.L] = dir === 1 ? rotateFaceCCW(f[FACE.L]) : rotateFaceCW(f[FACE.L]);
    }
    if (layer === N - 1) {
      f[FACE.R] = dir === 1 ? rotateFaceCW(f[FACE.R]) : rotateFaceCCW(f[FACE.R]);
    }
  }

  /* ── Z-axis (front/back layer) ───────────────────────── */
  _rotateZ(layer, dir) {
    const f = this.faces;
    // layer 0 = front face

    // Row from top: U bottom row (row N-1-layer) read L→R
    // Col from right: R left col (col layer) read T→B
    // Row from bottom: D top row (row layer) read R→L
    // Col from left: L right col (col N-1-layer) read B→T

    const uRow = f[FACE.U][N - 1 - layer].slice();
    const rCol = f[FACE.R].map(r => r[layer]);
    const dRow = f[FACE.D][layer].slice();
    const lCol = f[FACE.L].map(r => r[N - 1 - layer]);

    if (dir === 1) {
      // CW from front: U→R, R→D, D→L, L→U
      // U row (L→R) → R col (T→B)
      rCol.forEach((_, r) => { f[FACE.R][r][layer] = uRow[r]; });
      // R col (T→B) → D row (R→L reversed)
      [...rCol].forEach((v, i) => { f[FACE.D][layer][N - 1 - i] = v; });
      // D row (R→L) → L col (B→T)
      dRow.forEach((v, i) => { f[FACE.L][N - 1 - i][N - 1 - layer] = v; });
      // L col (B→T) → U row (L→R)
      lCol.forEach((v, i) => { f[FACE.U][N - 1 - layer][i] = v; });
    } else {
      // CCW from front: U→L, L→D, D→R, R→U
      lCol.forEach((v, i) => { f[FACE.U][N - 1 - layer][N - 1 - i] = v; });
      uRow.forEach((v, i) => { f[FACE.L][i][N - 1 - layer] = v; });
      [...dRow].reverse().forEach((v, i) => { f[FACE.R][i][layer] = v; });
      rCol.forEach((v, i) => { f[FACE.D][layer][i] = v; });
    }

    if (layer === 0) {
      f[FACE.F] = dir === 1 ? rotateFaceCW(f[FACE.F]) : rotateFaceCCW(f[FACE.F]);
    }
    if (layer === N - 1) {
      f[FACE.B] = dir === 1 ? rotateFaceCCW(f[FACE.B]) : rotateFaceCW(f[FACE.B]);
    }
  }
}

/* ============================================================
   CubeRenderer — builds and updates DOM cubies
   ============================================================ */

class CubeRenderer {
  /**
   * @param {HTMLElement} containerEl — the .cube-container div
   * @param {CubeState}   state
   */
  constructor(containerEl, state) {
    this.container = containerEl;
    this.state = state;

    // Size of one cubie in px (read from CSS variable)
    this.cubieSize = this._getCubieSize();
    // Small gap between cubies
    this.gap = 2;
    // Total span of one dimension: N cubies + gaps
    this.span = N * this.cubieSize + (N - 1) * this.gap;
    // Offset to center the cube in the container
    this.offset = -this.span / 2 + this.cubieSize / 2;

    this.cubies = []; // DOM elements, indexed [x][y][z]
    this._build();
  }

  _getCubieSize() {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue('--cubie-size').trim();
    return parseInt(val, 10) || 38;
  }

  /** Create all 4×4×4 cubie DOM elements */
  _build() {
    this.container.innerHTML = '';
    this.cubies = [];

    for (let x = 0; x < N; x++) {
      this.cubies[x] = [];
      for (let y = 0; y < N; y++) {
        this.cubies[x][y] = [];
        for (let z = 0; z < N; z++) {
          const el = document.createElement('div');
          el.className = 'cubie';
          el.dataset.x = x;
          el.dataset.y = y;
          el.dataset.z = z;

          // Create 6 faces
          ['front','back','left','right','top','bottom'].forEach(faceName => {
            const face = document.createElement('div');
            face.className = `cubie-face face-${faceName}`;
            face.dataset.face = faceName;
            el.appendChild(face);
          });

          this._positionCubie(el, x, y, z);
          this.container.appendChild(el);
          this.cubies[x][y][z] = el;
        }
      }
    }

    this.updateColors();
  }

  _positionCubie(el, x, y, z) {
    const cs = this.cubieSize;
    const g  = this.gap;
    const o  = this.offset;

    const tx = o + x * (cs + g);
    const ty = o + y * (cs + g);
    const tz = o + z * (cs + g);
    el.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px)`;
  }

  /**
   * Update all cubie face colours from the current state.
   * Mapping from cube faces to cubie face directions:
   *   FACE.U → top face   → y=0  → face-top
   *   FACE.D → bot face   → y=N-1→ face-bottom
   *   FACE.F → front face → z=N-1→ face-front
   *   FACE.B → back face  → z=0  → face-back
   *   FACE.L → left face  → x=0  → face-left
   *   FACE.R → right face → x=N-1→ face-right
   */
  updateColors() {
    const f = this.state.faces;
    const cs = FACE_COLORS;

    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        for (let z = 0; z < N; z++) {
          const el = this.cubies[x][y][z];
          if (!el) continue;

          // Determine colour for each of the 6 face directions.
          // Exposed faces get their colour; internal faces get 'inner'.
          const colours = {
            top:    y === 0     ? cs[f[FACE.U][x][z]]       : 'inner',
            bottom: y === N - 1 ? cs[f[FACE.D][x][N-1-z]]   : 'inner',
            front:  z === N - 1 ? cs[f[FACE.F][y][x]]        : 'inner',
            back:   z === 0     ? cs[f[FACE.B][y][N-1-x]]    : 'inner',
            left:   x === 0     ? cs[f[FACE.L][y][z]]         : 'inner',
            right:  x === N - 1 ? cs[f[FACE.R][y][N-1-z]]    : 'inner',
          };

          el.querySelectorAll('.cubie-face').forEach(faceEl => {
            const faceName = faceEl.dataset.face;
            // Remove previous colour class
            faceEl.className = `cubie-face face-${faceName} color-${colours[faceName]}`;
          });
        }
      }
    }
  }

  /**
   * Animate a layer rotation visually.
   * axis: 'x'|'y'|'z', layer: 0..N-1, dir: 1|-1
   * Returns a promise that resolves when animation ends.
   */
  animateLayer(axis, layer, dir) {
    return new Promise(resolve => {
      // Collect cubies in this layer
      const layerCubies = [];
      for (let a = 0; a < N; a++) {
        for (let b = 0; b < N; b++) {
          let el;
          if (axis === 'y') el = this.cubies[a][layer][b];
          else if (axis === 'x') el = this.cubies[layer][a][b];
          else el = this.cubies[a][b][layer]; // z
          if (el) layerCubies.push(el);
        }
      }

      const angle = 90 * dir;
      const rotStr = axis === 'y' ? `rotateY(${-angle}deg)`
                   : axis === 'x' ? `rotateX(${angle}deg)`
                   :                `rotateZ(${-angle}deg)`;

      // Add transition class
      layerCubies.forEach(el => {
        el.classList.add('animating');
        // Apply rotation on top of existing translate
        const existing = el.style.transform;
        el.style.transform = existing + ' ' + rotStr;
      });

      // After transition, remove class and re-sync positions
      const ANIM_DURATION = 280; // ms — matches CSS
      setTimeout(() => {
        layerCubies.forEach(el => el.classList.remove('animating'));
        // Refresh all colours and transforms from state
        this.updateColors();
        // Re-set exact positions (clearing accumulated rotations)
        for (let x = 0; x < N; x++)
          for (let y = 0; y < N; y++)
            for (let z = 0; z < N; z++)
              if (this.cubies[x][y][z])
                this._positionCubie(this.cubies[x][y][z], x, y, z);
        resolve();
      }, ANIM_DURATION);
    });
  }
}

/* ============================================================
   CubeGame — orchestrates everything
   ============================================================ */

class CubeGame {
  constructor() {
    this.state    = new CubeState();
    this.renderer = new CubeRenderer(
      document.getElementById('cube-container'),
      this.state
    );

    // UI state
    this.moveCount      = 0;
    this.timerRunning   = false;
    this.timerSeconds   = 0;
    this.timerInterval  = null;
    this.isAnimating    = false;
    this.isSolving      = false;

    // Layer selection
    this.selectedAxis   = 'x';
    this.selectedLayer  = 0;

    // Mouse drag for whole-cube rotation
    this._drag = { active: false, startX: 0, startY: 0, rotX: -30, rotY: 45 };

    this._bindUI();
    this._bindKeyboard();
    this._bindDrag();
    this._renderLayerControls();
    this._updateStats();
  }

  /* ── UI Binding ─────────────────────────────────────────── */

  _bindUI() {
    document.getElementById('btn-shuffle').addEventListener('click', () => this.shuffle());
    document.getElementById('btn-reset').addEventListener('click',   () => this.reset());
    document.getElementById('btn-solve').addEventListener('click',   () => this.solve());
    document.getElementById('btn-timer').addEventListener('click',   () => this.toggleTimer());
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this._hideModal();
      this.reset();
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => this._hideModal());

    // Axis tabs
    document.querySelectorAll('.axis-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.axis-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        this.selectedAxis = tab.dataset.axis;
        this._renderLayerControls();
      });
    });
  }

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 's': if (!e.ctrlKey) this.shuffle(); break;
        case 'r': this.reset(); break;
        case 't': this.toggleTimer(); break;
        case 'u': this._undoMove(); break;
        case '[': this._applySelectedLayer(1);  break;
        case ']': this._applySelectedLayer(-1); break;
        case '1': this.selectedLayer = 0; this._highlightLayer(); break;
        case '2': this.selectedLayer = 1; this._highlightLayer(); break;
        case '3': this.selectedLayer = 2; this._highlightLayer(); break;
        case '4': this.selectedLayer = 3; this._highlightLayer(); break;
      }
    });
  }

  /* ── Mouse drag for full-cube rotation ──────────────────── */

  _bindDrag() {
    const scene = document.getElementById('scene');
    const cc    = document.getElementById('cube-container');

    const onStart = (clientX, clientY) => {
      this._drag.active = true;
      this._drag.startX = clientX;
      this._drag.startY = clientY;
    };
    const onMove = (clientX, clientY) => {
      if (!this._drag.active) return;
      const dx = clientX - this._drag.startX;
      const dy = clientY - this._drag.startY;
      this._drag.startX = clientX;
      this._drag.startY = clientY;
      this._drag.rotY += dx * 0.5;
      this._drag.rotX -= dy * 0.5;
      this._drag.rotX = clamp(this._drag.rotX, -85, 85);
      cc.style.transform =
        `rotateX(${this._drag.rotX}deg) rotateY(${this._drag.rotY}deg)`;
    };
    const onEnd = () => { this._drag.active = false; };

    // Mouse
    scene.addEventListener('mousedown',  e => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup',   onEnd);

    // Touch
    scene.addEventListener('touchstart', e => {
      e.preventDefault();
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchmove', e => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  /* ── Layer controls rendering ───────────────────────────── */

  _renderLayerControls() {
    const container = document.getElementById('layer-controls');
    container.innerHTML = '';

    const axisLabels = {
      x: ['Left',  'Mid-L', 'Mid-R', 'Right'],
      y: ['Top',   'Up',    'Down',  'Bottom'],
      z: ['Front', 'Fr-2',  'Bk-2',  'Back'],
    };

    for (let i = 0; i < N; i++) {
      const row = document.createElement('div');
      row.className = 'layer-row';

      const label = document.createElement('span');
      label.className = 'layer-label';
      label.textContent = axisLabels[this.selectedAxis][i];
      row.appendChild(label);

      // CW button
      const cw = document.createElement('button');
      cw.className = 'layer-btn';
      cw.textContent = 'CW ↻';
      cw.dataset.layer = i;
      cw.dataset.dir   = '1';
      cw.addEventListener('click', () => this._applyMove(this.selectedAxis, i, 1));
      row.appendChild(cw);

      // CCW button
      const ccw = document.createElement('button');
      ccw.className = 'layer-btn';
      ccw.textContent = '↺ CCW';
      ccw.dataset.layer = i;
      ccw.dataset.dir   = '-1';
      ccw.addEventListener('click', () => this._applyMove(this.selectedAxis, i, -1));
      row.appendChild(ccw);

      container.appendChild(row);
    }
  }

  _applySelectedLayer(dir) {
    this._applyMove(this.selectedAxis, this.selectedLayer, dir);
  }

  _highlightLayer() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.classList.toggle(
        'selected-layer',
        parseInt(btn.dataset.layer, 10) === this.selectedLayer
      );
    });
  }

  /* ── Move application ───────────────────────────────────── */

  async _applyMove(axis, layer, dir, countMove = true) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    // Animate visual first, then update state
    await this.renderer.animateLayer(axis, layer, dir);
    this.state.applyMove(axis, layer, dir);
    this.renderer.updateColors();

    if (countMove) {
      this.moveCount++;
      this._updateStats();

      // Auto-start timer on first move
      if (!this.timerRunning && this.moveCount === 1) {
        this.startTimer();
      }

      // Win detection
      if (this.state.isSolved() && this.moveCount > 0) {
        this._onSolved();
      }
    }

    this.isAnimating = false;
  }

  async _undoMove() {
    if (this.isAnimating || this.state.moveHistory.length === 0) return;
    const m = this.state.moveHistory[this.state.moveHistory.length - 1];
    this.state.undoMove();
    // Visual: animate reverse
    this.isAnimating = true;
    await this.renderer.animateLayer(m.axis, m.layer, -m.dir);
    this.renderer.updateColors();
    this.isAnimating = false;

    if (this.moveCount > 0) this.moveCount--;
    this._updateStats();
  }

  /* ── Shuffle ────────────────────────────────────────────── */

  async shuffle(moves = 30) {
    if (this.isAnimating || this.isSolving) return;
    this.reset(true); // reset quietly

    const axes   = ['x', 'y', 'z'];
    const dirs   = [1, -1];
    const layers = [0, 1, 2, 3];

    // Generate random moves
    const randomMoves = [];
    for (let i = 0; i < moves; i++) {
      const axis  = axes[Math.floor(Math.random() * axes.length)];
      const layer = layers[Math.floor(Math.random() * layers.length)];
      const dir   = dirs[Math.floor(Math.random() * dirs.length)];
      randomMoves.push({ axis, layer, dir });
    }

    // Apply moves quickly (faster animation for shuffle)
    for (const m of randomMoves) {
      if (this.isAnimating) {
        // Wait briefly between moves during fast shuffle
        await new Promise(r => setTimeout(r, 10));
      }
      // Apply directly to state without heavy animation for speed
      this.state.applyMove(m.axis, m.layer, m.dir);
    }

    // Clear history so undo doesn't affect shuffle
    this.state.moveHistory = [];
    this.renderer.updateColors();
    this.moveCount = 0;
    this._updateStats();
  }

  /* ── Reset ──────────────────────────────────────────────── */

  reset(quiet = false) {
    if (this.isSolving) return;
    this.stopTimer();
    this.timerSeconds = 0;
    this.moveCount    = 0;
    this.state.reset();
    this.renderer.updateColors();
    if (!quiet) this._updateStats();
    this._hideModal();
  }

  /* ── Solve (reverse history) ────────────────────────────── */

  async solve() {
    if (this.isAnimating || this.isSolving) return;
    if (this.state.moveHistory.length === 0) {
      // Already solved or no history — just reset
      this.reset();
      return;
    }

    this.isSolving = true;
    const history = [...this.state.moveHistory];

    // Replay moves in reverse
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      await this._applyMove(m.axis, m.layer, -m.dir, false);
      await new Promise(r => setTimeout(r, 30));
    }

    this.state.moveHistory = [];
    this.moveCount = 0;
    this.stopTimer();
    this.timerSeconds = 0;
    this._updateStats();
    this.isSolving = false;
  }

  /* ── Timer ──────────────────────────────────────────────── */

  startTimer() {
    if (this.timerRunning) return;
    this.timerRunning = true;
    const btn = document.getElementById('btn-timer');
    btn.classList.add('active');
    document.getElementById('timer-btn-text').textContent = 'Stop Timer';

    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this._updateStats();
    }, 1000);
  }

  stopTimer() {
    if (!this.timerRunning) return;
    this.timerRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    const btn = document.getElementById('btn-timer');
    btn.classList.remove('active');
    document.getElementById('timer-btn-text').textContent = 'Start Timer';
  }

  toggleTimer() {
    if (this.timerRunning) this.stopTimer();
    else this.startTimer();
  }

  _formatTime(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  /* ── Stats display ──────────────────────────────────────── */

  _updateStats() {
    document.getElementById('move-counter').textContent  = this.moveCount;
    document.getElementById('timer-display').textContent = this._formatTime(this.timerSeconds);
  }

  /* ── Win detection & modal ──────────────────────────────── */

  _onSolved() {
    this.stopTimer();
    setTimeout(() => {
      document.getElementById('win-moves').textContent = this.moveCount;
      document.getElementById('win-time').textContent  = this._formatTime(this.timerSeconds);
      this._showModal();
      this._launchConfetti();
    }, 350);
  }

  _showModal() {
    const modal = document.getElementById('win-modal');
    modal.removeAttribute('hidden');
  }

  _hideModal() {
    document.getElementById('win-modal').setAttribute('hidden', '');
    // Clear confetti
    document.getElementById('confetti-container').innerHTML = '';
  }

  _launchConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#00d4ff', '#ffb347', '#a855f7', '#22c55e', '#ef4444', '#f0f0f0'];
    container.innerHTML = '';

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.cssText = `
        left: ${Math.random() * 100}%;
        top: -10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        width: ${6 + Math.random() * 6}px;
        height: ${6 + Math.random() * 6}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation-duration: ${1.5 + Math.random() * 2}s;
        animation-delay: ${Math.random() * 0.8}s;
      `;
      container.appendChild(piece);
    }
  }
}

/* ============================================================
   Bootstrap
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  window.game = new CubeGame();
});
