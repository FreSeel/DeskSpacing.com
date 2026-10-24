// Keep the pinned r116 settings and authored camera pose unchanged during extraction.
export function createScene({ THREE, canvas, container, host }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a363b);
  scene.fog = new THREE.Fog(0xa0a0a0, 300, 350);
  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(host.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0xffffff, 0);
  renderer.gammaFactor = 2.2;
  renderer.gammaOutput = true;

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
  hemisphere.position.set(0, 100, 40);
  scene.add(hemisphere);
  const light = new THREE.SpotLight(0x444444, 1.5);
  light.position.set(0, 100, 40);
  light.shadow.bias = -0.00001;
  light.shadow.mapSize.set(4096, 4096);
  light.castShadow = true;
  scene.add(light);

  const transformControls = new THREE.TransformControls(camera, renderer.domElement);
  transformControls.enabled = true;
  transformControls.size = 0.7;
  transformControls.showY = false;
  scene.add(transformControls);

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
  }
  resetCamera();

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  host.addEventListener('resize', resize);
  let frame;
  function animate() {
    frame = host.requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    scene, camera, renderer, controls, transformControls, resetCamera,
    dispose() {
      host.cancelAnimationFrame(frame);
      host.removeEventListener('resize', resize);
      transformControls.dispose();
      controls.dispose();
      if (light.shadow.map) light.shadow.map.dispose();
      renderer.dispose();
    },
  };
}
