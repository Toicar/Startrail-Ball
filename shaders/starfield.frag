// 与 pipe.js 内联版本保持同步
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec3 nebula = mix(uColor1, uColor2, vUv.y);
  nebula += vec3(0.35, 0.08, 0.55) * pow(max(0.0, sin(vUv.x * 6.28 + uTime * 0.15)), 3.0) * 0.25;
  nebula += vec3(0.15, 0.05, 0.35) * pow(max(0.0, cos(vUv.y * 4.0 - uTime * 0.1)), 2.0) * 0.2;
  float star = step(0.998, random(floor(vUv * 90.0 + uTime * 0.03)));
  float twinkle = random(vUv + uTime * 0.07) * 0.6 + 0.4;
  vec3 starColor = vec3(0.9, 0.92, 1.0) * twinkle;
  float bigStar = step(0.9995, random(floor(vUv * 24.0)));
  star = max(star, bigStar * 1.8);
  float vertLine = smoothstep(0.93, 1.0, 1.0 - abs(fract(vUv.x * 12.0) - 0.5) * 2.0);
  float horizLine = smoothstep(0.94, 1.0, 1.0 - abs(fract(vUv.y * 0.8) - 0.5) * 2.0);
  float gridLine = max(vertLine, horizLine);
  vec3 gridColor = vec3(0.0, 0.92, 1.0) * gridLine;
  vec3 trackBase = vec3(0.04, 0.12, 0.35);
  vec3 color = mix(nebula, starColor, star);
  color = mix(color, trackBase, 0.35);
  color += gridColor * 1.26;
  float edge = pow(abs(vUv.y - 0.5) * 2.0, 2.0);
  color += vec3(0.0, 0.7, 1.0) * edge * 0.105;
  float alpha = 0.28 + gridLine * 0.385 + edge * 0.084;
  gl_FragColor = vec4(color, alpha);
}
