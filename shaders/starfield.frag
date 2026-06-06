varying vec2 vUv;
varying vec3 vPosition;
uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec3 bgColor = mix(uColor1, uColor2, vUv.y);
  float star = step(0.998, random(floor(vUv * 80.0 + uTime * 0.02)));
  float twinkle = random(vUv + uTime * 0.1) * 0.5 + 0.5;
  vec3 starColor = vec3(1.0, 0.95, 0.8) * twinkle;
  vec3 color = mix(bgColor, starColor, star);
  gl_FragColor = vec4(color, 1.0);
}
