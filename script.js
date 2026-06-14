/* ============================================================
   MOBILE / TABLET RESPONSIVE FIXES
   ============================================================ */

.scene,
.cube-container {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

button,
.layer-btn,
.axis-tab {
  touch-action: manipulation;
}

body {
  min-height: 100dvh;
}

/* Tablet */

@media (max-width: 780px) {

  :root {
    --cubie-size: 26px;
  }

  .main-layout {
    grid-template-columns: 1fr;
  }

  .cube-viewport {
    padding: 20px 10px;
  }

  .scene {
    width: min(90vw, 340px);
    height: min(90vw, 340px);
    perspective: 800px;
  }

  .controls-panel {
    border-left: none;
    border-top: 1px solid var(--border);
    grid-template-columns: 1fr 1fr;
  }

  .btn {
    min-height: 46px;
  }

}

/* Phones */

@media (max-width: 480px) {

  :root {
    --cubie-size: 24px;
  }

  .header {
    padding: 8px 12px;
  }

  .header-logo .logo-text {
    display: none;
  }

  .scene {
    width: min(95vw, 320px);
    height: min(95vw, 320px);
    perspective: 700px;
  }

  .controls-panel {
    grid-template-columns: 1fr;
  }

  .btn {
    min-height: 48px;
    font-size: 14px;
  }

  .layer-btn {
    min-height: 42px;
    font-size: 12px;
  }

  .btn-grid {
    grid-template-columns: 1fr 1fr;
  }

  .key-grid {
    grid-template-columns: 1fr 1fr;
  }

}

/* Small phones */

@media (max-width: 360px) {

  :root {
    --cubie-size: 20px;
  }

  .scene {
    width: 95vw;
    height: 95vw;
    perspective: 500px;
  }

  .btn-grid {
    grid-template-columns: 1fr;
  }

  .key-grid {
    grid-template-columns: 1fr;
  }

}
