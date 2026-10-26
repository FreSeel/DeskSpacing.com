// Repository paths are independent of historical public URLs. Keep this map shared
// by development, production copying, asset tools and path tests. Values never
// contain generated output; vendor/three and legacy SCSS are intentionally absent.
export const siteMounts = {
  'src/theme/bootstrap.js': 'src/theme/bootstrap.js',
  '16x9Monitors': 'public/models/16x9Monitors',
  '3d': 'public/models/3d',
  GLTFs: 'public/models/GLTFs',
  desk0: 'public/models/desk0',
  desks: 'public/models/desks',
  keyboards: 'public/models/keyboards',
  lamps: 'public/models/lamps',
  monitors: 'public/models/monitors',
  mousepads: 'public/models/mousepads',
  mouses: 'public/models/mouses',
  rooms: 'public/models/rooms',
  ultrawideMonitor: 'public/models/ultrawideMonitor',
  'optimized-models': 'public/models/optimized-models',
  textures: 'public/textures',
  images: 'public/images/site',
  'Model thumbnails': 'public/images/Model thumbnails',
  'Click Through Tutorial': 'public/images/Click Through Tutorial',
  fonts: 'public/fonts',
  css: 'public/styles/css',
  'bootstrap.min.css': 'public/styles/bootstrap.min.css',
  'favicon.ico': 'public/images/favicon.ico',
  'mainAppMobile.html': 'legacy/pages/mainAppMobile.html',
  'about.html': 'legacy/pages/about.html',
  'white_monitor_mockup.png': 'public/images/white_monitor_mockup.png',
  'contact.html': 'legacy/pages/contact.html',
  'website_image.png': 'public/images/website_image.png',
  'myDeskSETUP.gltf': 'public/models/demo/myDeskSETUP.gltf',
  'scene.gltf': 'public/models/demo/scene.gltf',
  'favicon.png': 'public/images/favicon.png',
  'website_img.png': 'public/images/website_img.png',
  'styleNew.css': 'public/styles/styleNew.css',
  'style.css': 'public/styles/style.css',
  'scene.bin': 'public/models/demo/scene.bin',
  'services.html': 'legacy/pages/services.html',
  'laptop_mockup.png': 'public/images/laptop_mockup.png',
  'testHTMLfile.html': 'legacy/pages/testHTMLfile.html',
  'mobileOnlyCSS.css': 'public/styles/mobileOnlyCSS.css',
  'mainAppOld.html': 'legacy/pages/mainAppOld.html',
  'services - Copy.html': 'legacy/pages/services - Copy.html',
  'GLTFLoader.js': 'vendor/legacy/GLTFLoader.js',
  'OrbitControls.js': 'vendor/legacy/OrbitControls.js',
  'three.min.js': 'vendor/legacy/three.min.js',
  'three.module.js': 'vendor/legacy/three.module.js',
  'app.js': 'legacy/scripts/app.js',
  'js/animation.gsap.min.js': 'legacy/scripts/js/animation.gsap.min.js',
  'js/ui.js': 'src/legacy/ui.js',
  'js/ScrollMagic.min.js': 'legacy/scripts/js/ScrollMagic.min.js',
  'js/share-url.js': 'src/legacy/share-url.js',
  'js/debug.addIndicators.min.js':
    'legacy/scripts/js/debug.addIndicators.min.js',
  'js/main.js': 'src/legacy/main.js',
  'js/bootstrap.min.js': 'legacy/scripts/js/bootstrap.min.js',
  'js/jquery-3.2.1.slim.min.js': 'legacy/scripts/js/jquery-3.2.1.slim.min.js',
  'js/imageLooper.js': 'legacy/scripts/js/imageLooper.js',
  'js/TweenMax.min.js': 'legacy/scripts/js/TweenMax.min.js',
  'js/popper.min.js': 'legacy/scripts/js/popper.min.js',
};

export function siteSourcePath(urlPath) {
  if (
    urlPath.includes('\\') ||
    urlPath.split('/').some((part) => part === '..' || part === '.')
  )
    throw new Error(`Invalid site path: ${urlPath}`);
  for (const [url, source] of Object.entries(siteMounts)) {
    if (urlPath === url || urlPath.startsWith(`${url}/`))
      return source + urlPath.slice(url.length);
  }
  return urlPath;
}
