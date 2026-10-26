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
  inches and offsets the stand to the desk surface. Catalog thumbnail temporarily
  reuses the inherited 16:9 monitor image and does not depict this asset.
