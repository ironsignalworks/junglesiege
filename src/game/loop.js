// loop.js - Optimized game loop with performance monitoring
import { state } from "../core/state.js";

/**
 * Creates an optimized RAF loop with frame timing control and performance monitoring
 */
export function gameLoopFactory(update, render) {
  const safeUpdate = typeof update === "function" ? update : () => {};
  const safeRender = typeof render === "function" ? render : () => {};
  
  // Performance tracking
  let frameCount = 0;
  let lastFpsUpdate = 0;
  let lastFrameTime = 0;
  let deltaAccumulator = 0;
  
  // Target frame rate (can be adjusted based on device performance)
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const MAX_DELTA = FRAME_TIME * 3; // Prevent spiral of death
  
  // Performance adaptive settings
  let performanceMode = 'high'; // 'high', 'medium', 'low'
  let frameDropCount = 0;
  let performanceCheckInterval = 0;
  
  // Detect performance and adjust settings
  function adjustPerformanceMode(deltaTime) {
    performanceCheckInterval++;
    
    if (performanceCheckInterval % 300 === 0) { // Check every 5 seconds at 60fps
      if (deltaTime > FRAME_TIME * 1.5) {
        frameDropCount++;
      }
      
      if (frameDropCount > 30 && performanceMode === 'high') { // More than 30 drops in 5 seconds
        performanceMode = 'medium';
        console.log('[loop] Switching to medium performance mode');
        frameDropCount = 0;
      } else if (frameDropCount > 60 && performanceMode === 'medium') {
        performanceMode = 'low';
        console.log('[loop] Switching to low performance mode');
        frameDropCount = 0;
      } else if (frameDropCount < 5 && performanceMode !== 'high') {
        performanceMode = 'high';
        console.log('[loop] Switching to high performance mode');
        frameDropCount = 0;
      }
      
      // Reset counters
      if (performanceCheckInterval >= 1800) { // Reset every 30 seconds
        performanceCheckInterval = 0;
        frameDropCount = 0;
      }
    }
    
    // Store performance mode in state for other systems to use
    state.performanceMode = performanceMode;
  }

  return function gameLoop(currentTime) {
    // Always schedule next frame to keep chain alive
    requestAnimationFrame(gameLoop);
    
    if (!state.gameStarted) {
      return;
    }
    
    // Calculate delta time
    if (lastFrameTime === 0) {
      lastFrameTime = currentTime;
      return;
    }
    
    const rawDelta = currentTime - lastFrameTime;
    const deltaTime = Math.min(rawDelta, MAX_DELTA); // Cap delta to prevent spiral of death
    
    // Accumulate delta for fixed timestep updates
    deltaAccumulator += deltaTime;
    
    // Performance monitoring and adaptation
    adjustPerformanceMode(rawDelta);
    
    // Update with fixed timestep for consistent physics
    let updateCount = 0;
    const maxUpdates = performanceMode === 'low' ? 2 : 4; // Limit updates in low performance mode
    
    while (deltaAccumulator >= FRAME_TIME && updateCount < maxUpdates) {
      try {
        safeUpdate(currentTime, FRAME_TIME);
      } catch (e) {
        console.error("Update crashed:", e);
        // Continue execution instead of breaking the game loop
      }
      deltaAccumulator -= FRAME_TIME;
      updateCount++;
    }
    
    // If we're way behind, reset accumulator to prevent catch-up spiral
    if (deltaAccumulator > FRAME_TIME * 3) {
      deltaAccumulator = 0;
    }
    
    // Render at display refresh rate
    try {
      safeRender(currentTime, deltaTime);
    } catch (e) {
      console.error("Render crashed:", e);
    }
    
    // FPS bookkeeping (optimized to update less frequently)
    frameCount++;
    if (currentTime - lastFpsUpdate >= 1000) {
      state.fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
      state.frameCount = frameCount;
      frameCount = 0;
      lastFpsUpdate = currentTime;
      
      // Log performance warnings in development
      if (state.fps < 45 && performanceMode === 'high') {
        console.warn(`[loop] Performance warning: ${state.fps} FPS`);
      }
    }
    
    lastFrameTime = currentTime;
  };
}
