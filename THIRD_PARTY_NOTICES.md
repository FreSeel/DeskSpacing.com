# Third-party code and asset notices

Inventory reviewed 2026-10-24. This document records evidence and gaps; it does
not grant a license or establish ownership of inherited content. No root license
for the original application was found. Do not apply a blanket MIT or Creative
Commons license to the repository without establishing the relevant rights.

| Material                                         | Evidence retained / required follow-up                                                                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modern Three.js and legacy r116                  | Package LICENSE files are copied to `dist/vendor/THREE-LICENSE.txt` and `THREE-LEGACY-LICENSE.txt`; historical `vendor/three/LICENSE` remains in the checkout.                                                                                   |
| Bootstrap and Popper JS                          | Package licenses copied to `dist/vendor/BOOTSTRAP-LICENSE.txt` and `POPPER-LICENSE.txt`. Retained Bootstrap CSS includes its MIT notice.                                                                                                         |
| Meshopt decoder                                  | `dist/vendor/MESHOPT-LICENSE.txt` accompanies the bundled decoder.                                                                                                                                                                               |
| GSAP / ScrollTrigger                             | Distributed script headers and `dist/vendor/GSAP-README.md` preserve the package's license reference. Do not describe this as MIT.                                                                                                               |
| uiCookies template, demo imagery                 | Existing page footers credit uiCookies and Unsplash. Preserve those credits. Generic “Under CC 3.0 License” template text does not identify exact terms or establish model rights. Original acquisition/license evidence still needs collection. |
| Open Iconic / IcoMoon fonts                      | Font binaries and existing stylesheet references remain. Exact distributions, license notices and icon-set provenance need confirmation.                                                                                                         |
| Models, textures, thumbnails and tutorial media  | No complete per-asset source/author/license ledger was found. Branded product names are not evidence of redistribution permission. Confirm rights for original and optimized copies before wider publication.                                    |
| Historical Three.js examples and retired scripts | Retained in the checkout with their existing notices. Example assets may have their own licenses; the engine license is not a blanket license for them. Most vendor example content is excluded from the build.                                  |

For each newly added or subsequently verified asset, record its repository path,
creator/rightsholder, original source URL, exact license and version, acquisition
or permission evidence, required credit, and modifications (including compression).
Keep any required license files alongside the asset and ensure the build copies
them. If rights cannot be established, track the asset for replacement rather than
silently claiming permission or stripping its attribution.

The audit preserved existing author/template credits and did not delete original
3D assets, textures, legacy pages or the historical vendor tree. The modernized
fork still contains upstream analytics and contact references; these need an
explicit ownership/privacy decision before a public fork launch.

## Apple Pro Display XDR

- File: `public/models/GLTFs/monitors/16 9 monitor/apple_pro_display_xdr.glb`.
- Creator: polyman Studio (https://sketchfab.com/Polyman_3D).
- Source: https://sketchfab.com/3d-models/apple-pro-display-xdr-7e92cfb7c84d41f886c7748be6c567da.
- License: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/).
- Evidence: creator, source and license are embedded in the downloaded GLB's
  `asset.extras` metadata; supplied by the user on 2026-10-25.
- Credit: “Apple Pro Display XDR” by polyman Studio, licensed under CC BY 4.0.
- Modifications: original GLB unchanged; runtime instance converts meters to
  inches and offsets the stand to the desk surface. `public/images/Model thumbnails/apple_pro_display_xdr.jpg` is a rendered
  derivative of this model, with the same attribution and license.

## Apple Studio Display

- File: `public/models/GLTFs/monitors/16 9 monitor/apple_studio_display.glb`.
- Creator: alboxer2000_ (https://sketchfab.com/alboxer2000_).
- Source: https://sketchfab.com/3d-models/apple-studio-display-f56b9892c6b941168f64bc8323c98875.
- License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- Evidence: attribution embedded in the user-supplied GLB's `asset.extras`.
- Credit: “Apple Studio Display” by alboxer2000_, licensed under CC BY 4.0.
- Modifications: original GLB unchanged; runtime scale and placement adjusted.
  `public/images/Model thumbnails/apple_studio_display.jpg` is a rendered derivative
  of this model, with the same attribution and license.

## BenQ ScreenBar Halo

- File: `public/models/GLTFs/lamps/benq_screenbar_halo.glb`.
- Creator: Anthony.Ackermans (https://sketchfab.com/Anthony.Ackermans).
- Source: https://sketchfab.com/3d-models/benq-screenbar-halo-af29991f303748b4a49b06e6e1e07baa.
- License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- Evidence: attribution embedded in the user-supplied GLB's `asset.extras`.
- Credit: “BenQ Screenbar Halo” by Anthony.Ackermans, licensed under CC BY 4.0.
- Modifications: original GLB unchanged; runtime scale and placement adjusted.
  `public/images/Model thumbnails/benq_screenbar_halo.jpg` is a rendered derivative
  of this model, with the same attribution and license.

## Mac Studio

- File: `public/models/GLTFs/computer towers/mac_studio.glb`.
- Creator: Ibrahim.Bhl (https://sketchfab.com/Ibrahim.Bhl).
- Source: https://sketchfab.com/3d-models/mac-studio-8ada33e4b51649b9a996e9e630caeb6e.
- License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- Evidence: attribution embedded in the user-supplied GLB's `asset.extras`.
- Credit: “Mac Studio” by Ibrahim.Bhl, licensed under CC BY 4.0.
- Modifications: original GLB unchanged; runtime scale and placement adjusted.
  `public/images/Model thumbnails/mac_studio.jpg` is a rendered derivative
  of this model, with the same attribution and license.

Mac Studio runtime width is normalized to 19.7 cm, preserving model proportions.
Dimension reference: https://support.apple.com/en-au/122211.
