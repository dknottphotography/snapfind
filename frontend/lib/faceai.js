// Browser-side face AI (face-api.js).
// Face detection + descriptor extraction run on the user's device;
// the server only stores descriptors and compares them (pure math).
// Models are bundled in /public/models (no CDN dependency at runtime).

import * as faceapi from "@vladmandic/face-api";

let modelsLoaded = false;
let loadPromise = null;

export async function loadFaceModels(onStep) {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // Try bundled models first, fall back to CDN.
    const sources = [
      "/models",
      "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights",
    ];
    let lastErr = null;
    for (const base of sources) {
      try {
        onStep && onStep("Loading face AI…");
        await faceapi.nets.tinyFaceDetector.loadFromUri(base);
        await faceapi.nets.faceLandmark68Net.loadFromUri(base);
        await faceapi.nets.faceRecognitionNet.loadFromUri(base);
        modelsLoaded = true;
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not load face AI models.");
  })();
  return loadPromise;
}

/** Load an image File/Blob into an HTMLImageElement. */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Detect all faces in an image file and return their 128-dim descriptors
 * as plain arrays. Returns [] if no faces found or on error.
 */
export async function getFaceDescriptors(file) {
  try {
    await loadFaceModels();
    const img = await loadImage(file);
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    return detections.map((d) => Array.from(d.descriptor));
  } catch {
    return [];
  }
}

/**
 * Single descriptor for a selfie — picks the largest detected face.
 * Returns null if no face found.
 */
export async function getSelfieDescriptor(file) {
  try {
    await loadFaceModels();
    const img = await loadImage(file);
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (!detections.length) return null;
    // Largest face = the selfie subject.
    detections.sort(
      (a, b) =>
        b.detection.box.width * b.detection.box.height -
        a.detection.box.width * a.detection.box.height
    );
    return Array.from(detections[0].descriptor);
  } catch {
    return null;
  }
}
