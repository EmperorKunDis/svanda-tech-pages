import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RAY_VERT, RAY_FRAG, COMPOSITE_VERT, COMPOSITE_FRAG } from "./shaders.js";

const canvas = document.getElementById("gargantua");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = matchMedia("(max-width: 767px)").matches;
const quality = isMobile
  ? { steps: 130, dpr: 0.85, pixels: 650_000, bloom: 0.42 }
  : { steps: 220, dpr: 1.25, pixels: 1_500_000, bloom: 0.5 };

if (!canvas || reducedMotion) {
  document.body.classList.add("failed");
} else {
  start();
}

function start() {
  let renderer;
  let composer;
  let rayMaterial;
  let geometry;
  let bloom;
  let composite;
  let resizeObserver;
  let animationFrame = 0;
  let resizeFrame = 0;
  let contextLost = false;
  let disposed = false;
  let previousTime = performance.now();
  let simulationTime = 0;
  let lastDpr = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let slowFrames = 0;

  const fail = () => {
    pause();
    document.body.classList.remove("ready");
    document.body.classList.add("failed");
  };

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    fail();
    return;
  }

  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const observer = new THREE.PerspectiveCamera(44, 1, 0.01, 200);
  const target = new THREE.Vector3(0, 0, 0);
  const bufferSize = new THREE.Vector2();

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3(4.49, 2.72, 25.46) },
    uCamTarget: { value: target },
    uFov: { value: 1 / Math.tan(THREE.MathUtils.degToRad(observer.fov) / 2) },
    uSteps: { value: quality.steps },
    uRotSign: { value: 1 },
    uDebug: { value: 0 },
    uDin: { value: 2.75 },
    uDout: { value: 40 },
    uDopMax: { value: 1.85 },
    uOpNear: { value: 0.9 },
    uOpFar: { value: 0.8 },
    uDiskBright: { value: 1 },
    uStarBright: { value: 1 },
    uSkyFloor: { value: 0.04 },
    uRotSpeed: { value: 0.48 },
  };

  rayMaterial = new THREE.ShaderMaterial({
    vertexShader: RAY_VERT,
    fragmentShader: RAY_FRAG,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  geometry = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(geometry, rayMaterial));

  let halfFloat = true;
  try {
    const gl = renderer.getContext();
    halfFloat = Boolean(
      gl.getExtension("EXT_color_buffer_float") ||
        gl.getExtension("EXT_color_buffer_half_float"),
    );
  } catch {
    halfFloat = false;
  }

  const targetType = halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const renderTarget = new THREE.WebGLRenderTarget(2, 2, {
    type: targetType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
  renderTarget.texture.generateMipmaps = false;

  composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, renderCamera));

  bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), quality.bloom, 0.34, 0.58);
  bloom.enabled = halfFloat;
  composer.addPass(bloom);

  composite = new ShaderPass(
    new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uVignette: { value: 0.92 },
        uGrain: { value: 0.026 },
        uCA: { value: 0.0018 },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  composite.renderToScreen = true;
  composer.addPass(composite);

  function resize() {
    resizeFrame = 0;
    if (disposed || contextLost) return;

    const root = document.documentElement;
    const width = Math.max(1, Math.round(canvas.clientWidth || root.clientWidth || innerWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight || root.clientHeight || innerHeight));
    const pixelLimit = Math.sqrt(quality.pixels / Math.max(1, width * height));
    const dpr = Math.max(0.65, Math.min(devicePixelRatio || 1, quality.dpr, pixelLimit));
    if (width === lastWidth && height === lastHeight && Math.abs(dpr - lastDpr) < 0.01) return;

    lastWidth = width;
    lastHeight = height;
    lastDpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    observer.aspect = width / height;
    observer.updateProjectionMatrix();
    uniforms.uFov.value = 1 / Math.tan(THREE.MathUtils.degToRad(observer.fov) / 2);
    renderer.getDrawingBufferSize(bufferSize);
    uniforms.uRes.value.copy(bufferSize);
    composite.uniforms.uRes.value.copy(bufferSize);
  }

  function queueResize() {
    if (resizeFrame || disposed) return;
    resizeFrame = requestAnimationFrame(resize);
  }

  function updateCamera(time) {
    const angle = (time / 216) * Math.PI * 2 - 0.45;
    const radius = 24 + 4.5 * Math.sin(angle * 2);
    const inclination = 0.22 + 0.24 * Math.sin(angle * 0.72 + 0.4);
    const horizontal = radius * Math.cos(inclination);
    observer.position.set(
      horizontal * Math.sin(angle),
      radius * Math.sin(inclination),
      horizontal * Math.cos(angle),
    );
    observer.lookAt(target);
  }

  function frame(now) {
    animationFrame = 0;
    if (contextLost || disposed || document.hidden) return;

    const currentWidth = Math.max(1, canvas.clientWidth);
    const currentHeight = Math.max(1, canvas.clientHeight);
    const currentPixelLimit = Math.sqrt(
      quality.pixels / Math.max(1, currentWidth * currentHeight),
    );
    const currentDpr = Math.max(
      0.65,
      Math.min(devicePixelRatio || 1, quality.dpr, currentPixelLimit),
    );
    if (
      Math.abs(currentDpr - lastDpr) > 0.01 ||
      currentWidth !== lastWidth ||
      currentHeight !== lastHeight
    ) {
      resize();
    }

    const delta = Math.min(0.1, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    simulationTime += delta;
    slowFrames = delta > 0.09 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames > 40) {
      fail();
      return;
    }

    updateCamera(simulationTime);
    uniforms.uTime.value = simulationTime;
    uniforms.uCamPos.value.copy(observer.position);
    composite.uniforms.uTime.value = simulationTime;

    try {
      composer.render();
      if (!document.body.classList.contains("ready")) {
        document.body.classList.remove("failed");
        document.body.classList.add("ready");
      }
    } catch {
      fail();
      return;
    }

    animationFrame = requestAnimationFrame(frame);
  }

  function resume() {
    if (animationFrame || contextLost || disposed || document.hidden) return;
    previousTime = performance.now();
    animationFrame = requestAnimationFrame(frame);
  }

  function pause() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    cancelAnimationFrame(resizeFrame);
    resizeObserver?.disconnect();
    removeEventListener("resize", queueResize);
    removeEventListener("orientationchange", queueResize);
    window.visualViewport?.removeEventListener("resize", queueResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    geometry?.dispose();
    rayMaterial?.dispose();
    composite?.material?.dispose();
    bloom?.dispose();
    composer?.dispose();
    renderer?.dispose();
  }

  function handleVisibility() {
    if (document.hidden) pause();
    else {
      queueResize();
      resume();
    }
  }

  function handleContextLost(event) {
    event.preventDefault();
    contextLost = true;
    pause();
    document.body.classList.remove("ready");
    document.body.classList.add("failed");
  }

  function handleContextRestored() {
    contextLost = false;
    lastWidth = 0;
    lastHeight = 0;
    slowFrames = 0;
    document.body.classList.remove("failed");
    resize();
    resume();
  }

  addEventListener("resize", queueResize, { passive: true });
  addEventListener("orientationchange", queueResize, { passive: true });
  window.visualViewport?.addEventListener("resize", queueResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);
  addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) pause();
      else dispose();
    },
    { once: true },
  );
  addEventListener("pageshow", () => {
    if (!disposed) {
      queueResize();
      resume();
    }
  });

  resizeObserver = new ResizeObserver(queueResize);
  resizeObserver.observe(document.documentElement);
  resize();
  updateCamera(0);
  resume();
}
