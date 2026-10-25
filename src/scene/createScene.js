import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createRenderScheduler } from './renderScheduler.js';
import { configureAppearance, legacyColor } from './appearance.js';

export function createScene({ THREE, canvas, container, host }) {
  configureAppearance(THREE);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e7e1);
  scene.fog = new THREE.Fog(legacyColor(THREE, 0xa0a0a0), 300, 350);
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    5000,
  );
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(host.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.toneMapping = THREE.CustomToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // r186 removed PCFSoftShadowMap. Keep the full authored shadow resolution.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(0xffffff, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.screenSpacePanning = false;
  const hemisphere = new THREE.HemisphereLight(
    legacyColor(THREE, 0xffffff),
    legacyColor(THREE, 0x444444),
    0.7 * Math.PI,
  );
  hemisphere.position.set(0, 100, 40);
  scene.add(hemisphere);
  const light = new THREE.SpotLight(
    legacyColor(THREE, 0x444444),
    1.5 * Math.PI,
  );
  light.decay = 0; // r116's non-physical, unlimited-distance light had no falloff.
  light.position.set(0, 100, 40);
  light.shadow.bias = -0.00001;
  light.shadow.mapSize.set(4096, 4096);
  light.castShadow = true;
  scene.add(light);

  const transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.enabled = true;
  transformControls.size = 0.7;
  transformControls.showY = false;
  scene.add(transformControls.getHelper());

  let interacting = false;
  const scheduler = createRenderScheduler({
    host,
    update: () => controls.update(),
    render: () => renderer.render(scene, camera),
    isAnimating: () => controls.enabled && (interacting || controls.autoRotate),
  });
  const invalidate = () => scheduler.invalidate();
  const startInteraction = () => {
    interacting = true;
    invalidate();
  };
  const endInteraction = () => {
    interacting = false;
    invalidate();
  };
  function invalidateScene() {
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }
  controls.addEventListener('change', invalidate);
  controls.addEventListener('start', startInteraction);
  controls.addEventListener('end', endInteraction);
  transformControls.addEventListener('change', invalidate);
  transformControls.addEventListener('objectChange', invalidateScene);

  function resetCamera() {
    controls.reset();
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.rotateSpeed = 0.7;
    camera.position.set(0, 61.27639300930197, 21.183811053080007);
    camera.rotation.set(-0.3618175319112695, 0, -0.004617427467257444);
    controls.update();
    controls.target.set(0, 30.55, -60);
    controls.enabled = true;
    camera.lookAt(25, 8.5, 35);
    controls.update();
    invalidate();
  }
  resetCamera();
  invalidateScene();

  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(host.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    invalidate();
  }
  host.addEventListener('resize', resize);
  const observer = host.ResizeObserver ? new host.ResizeObserver(resize) : null;
  observer?.observe(container);
  const visibility = () => scheduler.setSuspended(host.document.hidden);
  host.document.addEventListener('visibilitychange', visibility);
  visibility();

  return {
    scene,
    camera,
    renderer,
    controls,
    transformControls,
    resetCamera,
    invalidate,
    invalidateScene,
    dispose() {
      scheduler.dispose();
      observer?.disconnect();
      host.removeEventListener('resize', resize);
      host.document.removeEventListener('visibilitychange', visibility);
      controls.removeEventListener('change', invalidate);
      controls.removeEventListener('start', startInteraction);
      controls.removeEventListener('end', endInteraction);
      transformControls.removeEventListener('change', invalidate);
      transformControls.removeEventListener('objectChange', invalidateScene);
      transformControls.dispose();
      controls.dispose();
      if (light.shadow.map) light.shadow.map.dispose();
      renderer.dispose();
    },
  };
}
