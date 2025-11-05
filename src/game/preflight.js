// src/systems/preflight.js
export async function verifyResources(resources, {
  timeoutMs = 8000,
  criticalImages = [],
  criticalAudio = [],
  onProgress = () => {}
} = {}) {
  const missing = { images: [], audio: [] };

  const loadImage = (key, url) => new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; missing.images.push(key); resolve(false); } }, timeoutMs);
    img.onload = () => { if (!done) { done = true; clearTimeout(t); resolve(true); } };
    img.onerror = () => { if (!done) { done = true; clearTimeout(t); missing.images.push(key); resolve(false); } };
    img.src = url;
  });

  const loadAudio = (key, url) => new Promise((resolve) => {
    const audio = new Audio();
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; missing.audio.push(key); resolve(false); } }, timeoutMs);
    audio.addEventListener('canplaythrough', () => { if (!done) { done = true; clearTimeout(t); resolve(true); } }, { once: true });
    audio.onerror = () => { if (!done) { done = true; clearTimeout(t); missing.audio.push(key); resolve(false); } };
    // Some servers require user gesture to playthis just tests loading metadata:
    audio.preload = 'auto';
    audio.src = url;
    audio.load();
  });

  const imageEntries = Object.entries(resources.images || {});
  const audioEntries = Object.entries(resources.audio || {});

  let doneCount = 0;
  const total = imageEntries.length + audioEntries.length;

  await Promise.all([
    ...imageEntries.map(([k, u]) => loadImage(k, u).then(() => onProgress(++doneCount, total))),
    ...audioEntries.map(([k, u]) => loadAudio(k, u).then(() => onProgress(++doneCount, total))),
  ]);

  // Block start if any *critical* failed:
  const critMissing = {
    images: criticalImages.filter(k => missing.images.includes(k)),
    audio: criticalAudio.filter(k => missing.audio.includes(k)),
  };

  return { missing, critMissing };
}
