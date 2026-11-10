import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createRenderScheduler } from './renderScheduler.js';
import { configureAppearance, legacyColor } from './appearance.js';

export function createScene({
  THREE,
  canvas,
  container,
  host,
  onContextLost = () => {},
  onContextRecovered = () => {},
}) {
  const owned = [];
  try {
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
    owned.push(() => renderer.dispose());
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
    owned.push(() => controls.dispose());
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
    owned.push(() => light.shadow.map?.dispose());
    light.decay = 0; // r116's non-physical, unlimited-distance light had no falloff.
    light.position.set(0, 100, 40);
    light.shadow.bias = -0.00001;
    light.shadow.mapSize.set(4096, 4096);
    light.castShadow = true;
    scene.add(light);

    const transformControls = new TransformControls(
      camera,
      renderer.domElement,
    );
    owned.push(() => transformControls.dispose());
    transformControls.enabled = true;
    transformControls.size = 0.7;
    transformControls.showY = false;
    scene.add(transformControls.getHelper());

    const renderListeners = new Set();
    let interacting = false;
    let contextLost = false;
    let recovering = false;
    const scheduler = createRenderScheduler({
      host,
      update: () => controls.update(),
      render: () => {
        renderer.render(scene, camera);
        renderListeners.forEach((update) => update());
        if (recovering) {
          recovering = false;
          onContextRecovered();
        }
      },
      isAnimating: () =>
        controls.enabled && (interacting || controls.autoRotate),
    });
    owned.push(() => scheduler.dispose());
    const lost = () => {
      contextLost = true;
      recovering = false;
      scheduler.setSuspended(true);
      onContextLost();
    };
    const restored = () => {
      if (!contextLost) return;
      contextLost = false;
      recovering = true;
      renderer.shadowMap.needsUpdate = true;
      scheduler.setSuspended(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    owned.push(() => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
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
    owned.push(() => controls.removeEventListener('change', invalidate));
    controls.addEventListener('start', startInteraction);
    owned.push(() => controls.removeEventListener('start', startInteraction));
    controls.addEventListener('end', endInteraction);
    owned.push(() => controls.removeEventListener('end', endInteraction));
    transformControls.addEventListener('change', invalidate);
    owned.push(() =>
      transformControls.removeEventListener('change', invalidate),
    );
    transformControls.addEventListener('objectChange', invalidateScene);
    owned.push(() =>
      transformControls.removeEventListener('objectChange', invalidateScene),
    );

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
    owned.push(() => host.removeEventListener('resize', resize));
    const observer = host.ResizeObserver
      ? new host.ResizeObserver(resize)
      : null;
    owned.push(() => observer?.disconnect());
    observer?.observe(container);
    const visibility = () => scheduler.setSuspended(host.document.hidden);
    host.document.addEventListener('visibilitychange', visibility);
    owned.push(() =>
      host.document.removeEventListener('visibilitychange', visibility),
    );
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
      subscribeRender(update) {
        renderListeners.add(update);
        return () => renderListeners.delete(update);
      },
      dispose() {
        renderListeners.clear();
        owned.reverse().forEach((release) => release());
      },
    };
  } catch (error) {
    owned.reverse().forEach((release) => {
      try {
        release();
      } catch {
        /* Continue cleanup. */
      }
    });
    throw error;
  }
}
