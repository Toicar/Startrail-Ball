// 与 pipe.js 内联版本保持同步
varying vec2 vUv;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec3 bgColor = mix(uColor1, uColor2, vUv.y);
  float star = step(0.998, random(floor(vUv * 80.0 + uTime * 0.03)));
  float twinkle = random(vUv + uTime * 0.07) * 0.6 + 0.4;
  vec3 starColor = vec3(0.9, 0.85, 1.0) * twinkle;
  float bigStar = step(0.9995, random(floor(vUv * 20.0)));
  star = max(star, bigStar * 1.8);
  // 网格线 —— 管壁结构线
  float gridX = abs(fract(vUv.x * 8.0) - 0.5) * 2.0;
  float gridY = abs(fract(vUv.y * 3.0) - 0.5) * 2.0;
  float grid = 1.0 - min(gridX, gridY);
  float line = step(0.96, grid) * 0.08;
  vec3 color = mix(bgColor, starColor, star);
  color += line * vec3(0.3, 0.4, 0.8);
  gl_FragColor = vec4(color, 1.0);
}
