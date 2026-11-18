/**
 * The hero's "AI scan": a teal contour line where a horizontal plane cuts the house, with a
 * faint trail below it. Injected into the house's standard materials, driven by shared uniforms.
 */
import * as THREE from "three";

export interface ScanUniforms {
  uScanY: { value: number };
  uScanStrength: { value: number };
  uScanColor: { value: THREE.Color };
}

export function createScanUniforms(color: string): ScanUniforms {
  return {
    uScanY: { value: -10 },
    uScanStrength: { value: 0 },
    uScanColor: { value: new THREE.Color(color) },
  };
}

export function applyScan(material: THREE.MeshStandardMaterial, uniforms: ScanUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vScanY;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 scanWorld = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        scanWorld = instanceMatrix * scanWorld;
      #endif
      vScanY = ( modelMatrix * scanWorld ).y;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vScanY;\nuniform float uScanY;\nuniform float uScanStrength;\nuniform vec3 uScanColor;",
      )
      .replace(
        "#include <opaque_fragment>",
        `float scanD = vScanY - uScanY;
      float scanW = max( fwidth( vScanY ) * 1.2, 0.03 );
      float scanLine = 1.0 - smoothstep( scanW, scanW * 2.6, abs( scanD ) );
      float scanTrail = ( 1.0 - smoothstep( 0.0, 1.4, -scanD ) ) * step( scanD, 0.0 );
      outgoingLight = mix( outgoingLight, uScanColor * 1.15, uScanStrength * clamp( scanLine * 0.92 + scanTrail * 0.16, 0.0, 1.0 ) );
      #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => "husryni-scan";
  material.needsUpdate = true;
}
