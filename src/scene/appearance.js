// r116 used the Narkowicz ACES approximation. Modern ACES uses a different curve.
// Keep the authored look via the supported CustomToneMapping shader hook.
export function configureAppearance(THREE) {
  THREE.ShaderChunk.tonemapping_pars_fragment =
    THREE.ShaderChunk.tonemapping_pars_fragment.replace(
      'vec3 CustomToneMapping( vec3 color ) { return color; }',
      `vec3 CustomToneMapping( vec3 color ) {
      color *= toneMappingExposure;
      return saturate( ( color * ( 2.51 * color + 0.03 ) ) /
        ( color * ( 2.43 * color + 0.59 ) + 0.14 ) );
    }`,
    );
}

// Legacy numeric material/light colors were already treated as linear values.
export function legacyColor(THREE, hex) {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
}
