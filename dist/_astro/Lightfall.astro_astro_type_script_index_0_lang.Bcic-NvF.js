var e=Math.PI*2,t=(e,t,n)=>Math.min(n,Math.max(t,e)),n=`#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,r=`#version 300 es
precision highp float;
precision highp int;
uniform vec2 uView;
uniform float uZoom;
uniform float uPhase;
uniform float uTwinkleClock;
uniform float uRings;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform int uStreakCount;
uniform int uColumns;
uniform float uWidth;
uniform float uTail;
uniform float uTwinkle;
uniform float uHead;
uniform float uDepth;
uniform vec4 uMouse;
uniform vec3 uLens;
uniform float uLightMode;
uniform float uEncode;
out vec4 outColor;

const vec3 CAMERA = vec3(0.0, -0.8888889, -0.2222222);
const float TAU = 6.28318530718;
const float SPACING = 0.005;
const float REACH = 0.32;

uint scramble(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

float unit(uint x) {
  return float(x & 0xffffu) / 65535.0;
}

float stroke(float d, float w) {
  float s = max(0.75 * w, 0.55);
  return 0.75 * w / s * exp(-0.5 * d * d / (s * s));
}

float orb(float d, float r) {
  float s = max(0.6 * r, 0.7);
  float e = 0.6 * r / s;
  return e * e * exp(-0.5 * d * d / (s * s));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 screen = (2.0 * frag - uView) / uView.x;
  vec2 p = screen;
  mat2 warp = mat2(1.0);
  if (uLens.z > 0.0) {
    vec2 o = p - uLens.xy;
    float e = uLens.z * exp(-dot(o, o) / (REACH * REACH));
    p -= o * e;
    warp = mat2(1.0 - e) + outerProduct(o, o) * (2.0 * e / (REACH * REACH));
  }

  vec3 dir = vec3(p, uZoom);
  vec3 exits = (1.0 - CAMERA * sign(dir)) / max(abs(dir), vec3(1e-6));
  float u = min(exits.x, min(exits.y, exits.z));
  for (int i = 0; i < 5; i++) {
    vec3 h = CAMERA + u * dir;
    vec3 h2 = h * h;
    u -= (dot(h2, h2) - 1.0) / (4.0 * dot(dir, h2 * h));
  }
  vec3 hit = CAMERA + u * dir;
  vec3 normal = hit * hit * hit;
  float facing = dot(normal, dir);
  vec3 stepX = u * (vec3(1.0, 0.0, 0.0) - dir * (normal.x / facing));
  vec3 stepY = u * (vec3(0.0, 1.0, 0.0) - dir * (normal.y / facing));
  float ring = hit.y * hit.y + hit.z * hit.z;
  float theta = atan(hit.z, hit.y);
  mat2 jacobian = mat2(
    stepX.x,
    (hit.y * stepX.z - hit.z * stepX.y) / ring,
    stepY.x,
    (hit.y * stepY.z - hit.z * stepY.y) / ring
  ) * warp * (2.0 / uView.x);

  vec2 gradX = vec2(jacobian[0][0], jacobian[1][0]);
  vec2 gradTheta = vec2(jacobian[0][1], jacobian[1][1]);
  float scale = max(length(gradX), 1e-8);
  float det = max(abs(gradX.x * gradTheta.y - gradX.y * gradTheta.x), 1e-12);
  float along = scale / det;
  float skew = dot(gradX, gradTheta) / det;
  float spacing = SPACING / scale;
  float detail = smoothstep(1.6, 3.2, spacing);
  if (detail <= 0.0) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float halfWidth = min(uWidth / scale, 0.2 * spacing);
  float headRadius = min(2.0 * uWidth / scale, 0.35 * spacing);
  float headReach = 4.0 * max(0.6 * headRadius, 0.7);
  float edge = uColumns > 1 ? 1.0 : 0.5;
  float period = TAU / uRings;
  float fog = exp(-max(u * length(dir) - 0.6, 0.0) * 1.6 * uDepth);

  float boost = 1.0;
  if (uMouse.z > 0.0) {
    vec2 m = screen - uMouse.xy;
    boost += 2.0 * uMouse.z * exp(-dot(m, m) / max(uMouse.w * uMouse.w, 1e-4));
  }

  int count = max(uColorCount, 1);
  vec3 total = vec3(0.0);
  for (int layer = 0; layer < 16; layer++) {
    if (layer >= uStreakCount) break;
    float x = hit.x + float(layer) * SPACING / 8.0;
    float nearest = floor(x / SPACING + 0.5);
    float side = x >= nearest * SPACING ? 1.0 : -1.0;
    for (int k = 0; k < 2; k++) {
      if (k >= uColumns) break;
      float column = nearest + side * float(k);
      float across = (x - column * SPACING) / scale;
      uint seed = scramble(uint(int(column) + 65536) + uint(layer) * 0x9e3779b9u);
      uint next = scramble(seed);
      float hue = unit(seed >> 16);
      float delta = theta - uPhase * (1.0 + floor(unit(seed) * 16.0) / 16.0) - unit(next) * period;
      delta -= period * floor(delta / period + 0.5);
      float ahead = delta * along - across * skew;
      if (abs(ahead) > headReach && (delta > 0.0 || -delta * uTail > 3.2)) continue;
      float behind = max(-delta, 0.0);
      float fall = exp(-uTail * behind) * (1.0 - smoothstep(0.5, 0.95, behind / (0.5 * period)));
      fall *= 1.0 - smoothstep(1.2, 3.2, uTail * behind);
      float reach = length(vec2(across, ahead));
      float trail = stroke(ahead > 0.0 ? reach : abs(across), halfWidth * mix(0.4, 1.0, fall)) * fall;
      float glint = orb(reach, headRadius) * mix(3.0, 1.8, uLightMode);
      float weight = mix(1.5, 1.0 + sin(uTwinkleClock + 7.0 * hue + 4.0), uTwinkle);
      weight *= 1.0 - smoothstep(0.72 * edge, edge, abs(across) / spacing);
      vec3 color = uColors[min(int(hue * float(count)), count - 1)];
      vec3 hot = mix(color, vec3(1.0), uHead * (1.0 - uLightMode));
      total += (trail * color + glint * hot) * weight;
    }
  }

  outColor = vec4(total * fog * boost * detail * uEncode, 1.0);
}`,i=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSource;
uniform vec2 uTarget;
uniform vec2 uTexel;
uniform float uLimit;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec3 color = texture(uSource, uv - uTexel).rgb;
  color += texture(uSource, uv + uTexel).rgb;
  color += texture(uSource, uv + vec2(uTexel.x, -uTexel.y)).rgb;
  color += texture(uSource, uv + vec2(-uTexel.x, uTexel.y)).rgb;
  outColor = vec4(min(color * 0.25, vec3(uLimit)), 1.0);
}`,a=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uSource;
uniform vec2 uTarget;
uniform vec2 uStep;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec3 color = texture(uSource, uv).rgb * 0.181862;
  color += (texture(uSource, uv + uStep * 1.423135).rgb + texture(uSource, uv - uStep * 1.423135).rgb) * 0.284316;
  color += (texture(uSource, uv + uStep * 3.326702).rgb + texture(uSource, uv - uStep * 3.326702).rgb) * 0.106598;
  color += (texture(uSource, uv + uStep * 5.242989).rgb + texture(uSource, uv - uStep * 5.242989).rgb) * 0.018156;
  outColor = vec4(color, 1.0);
}`,o=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform vec2 uView;
uniform float uDecode;
uniform float uGlow;
uniform float uBloom;
uniform float uPresence;
uniform float uOpacity;
uniform float uFade;
uniform float uLightMode;
uniform vec3 uTopColor;
uniform float uTopGlow;
out vec4 outColor;

float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  vec3 light = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  if (uBloom > 0.0) {
    vec3 halo = texture(uBloom0, uv).rgb * 0.42;
    halo += texture(uBloom1, uv).rgb * 0.3;
    halo += texture(uBloom2, uv).rgb * 0.18;
    halo += texture(uBloom3, uv).rgb * 0.1;
    light += halo * uBloom * (uLightMode > 0.5 ? 0.2 : 1.0);
  }
  light *= uDecode * uGlow * uPresence;

  if (uLightMode < 0.5 && uTopGlow > 0.0) {
    float aspect = uView.x / uView.y;
    vec2 q = vec2((uv.x - 0.5) * aspect, 1.04 - uv.y);
    float spread = 0.34 * max(aspect, 0.75);
    float core = exp(-q.x * q.x / (spread * spread) - q.y * q.y / 0.06);
    float halo = exp(-q.x * q.x / (3.6 * spread * spread) - q.y * q.y / 0.18);
    light += uTopColor * uTopGlow * (core * 0.85 + halo * 0.3) * uPresence;
  }

  vec3 lit = max(light, 0.0);
  vec3 mapped = sqrt(1.0 - exp(-1.3 * lit * lit / (lit + 0.025)));
  float peak = max(mapped.r, max(mapped.g, mapped.b));

  float mask = uOpacity;
  float edge = uFade * 0.5;
  if (edge > 0.0) {
    mask *= smootherstep01(uv.x / edge) * smootherstep01((1.0 - uv.x) / edge);
    mask *= smootherstep01(uv.y / edge) * smootherstep01((1.0 - uv.y) / edge);
  }
  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;

  if (uLightMode > 0.5) {
    float coverage = clamp(smoothstep(0.0, 0.5, peak) * mask * 0.94 + grain, 0.0, 1.0);
    vec3 chroma = sqrt(clamp(lit / max(max(lit.r, max(lit.g, lit.b)), 1e-6), 0.0, 1.0));
    chroma = pow(chroma, vec3(1.35));
    chroma /= max(max(chroma.r, max(chroma.g, chroma.b)), 1e-4);
    float saturation = 1.0 - min(chroma.r, min(chroma.g, chroma.b));
    chroma = mix(vec3(0.3), chroma, smoothstep(0.08, 0.35, saturation));
    outColor = vec4(chroma * coverage, coverage);
  } else {
    vec3 color = clamp(mapped + grain, 0.0, 1.0) * mask;
    outColor = vec4(color, max(color.r, max(color.g, color.b)));
  }
}`,s=(e,t,n)=>{let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(console.error(`[Lightfall] shader compile failed:`,e.getShaderInfoLog(r)),e.deleteShader(r),null)):null},c=(e,t)=>{let r=s(e,e.VERTEX_SHADER,n),i=s(e,e.FRAGMENT_SHADER,t),a=e.createProgram();if(!r||!i||!a)return null;if(e.attachShader(a,r),e.attachShader(a,i),e.bindAttribLocation(a,0,`aPosition`),e.linkProgram(a),e.deleteShader(r),e.deleteShader(i),!e.getProgramParameter(a,e.LINK_STATUS))return console.error(`[Lightfall] program link failed:`,e.getProgramInfoLog(a)),e.deleteProgram(a),null;let o={},c=e.getProgramParameter(a,e.ACTIVE_UNIFORMS);for(let t=0;t<c;t++){let n=e.getActiveUniform(a,t);n&&(o[n.name.replace(/\[0\]$/,``)]=e.getUniformLocation(a,n.name))}return{program:a,uniforms:o}},l=()=>document.documentElement.classList.contains(`dark`);function u(n,s={}){let u=n.querySelector(`canvas`);u||(u=document.createElement(`canvas`),n.appendChild(u)),u.classList.add(`lightfall-canvas`),u.setAttribute(`aria-hidden`,`true`);let d=u.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:`high-performance`});if(!d)return null;let f={colors:(Array.isArray(s.colors)&&s.colors.length?s.colors:[`#ffffff`]).slice(0,8).map(String),backgroundColor:String(s.backgroundColor??`#94a3b8`),speed:s.speed??.3,streakCount:Math.round(t(s.streakCount??2,1,16)),streakWidth:Math.max(.05,s.streakWidth??.8),streakLength:Math.max(.05,s.streakLength??1),glow:Math.max(0,s.glow??1),density:s.density??.6,twinkle:t(s.twinkle??.3,0,1),zoom:Math.max(.1,s.zoom??3),backgroundGlow:Math.max(0,s.backgroundGlow??.1),headGlow:t(s.headGlow??.6,0,1),depth:Math.max(0,s.depth??.5),bloom:Math.max(0,s.bloom??.35),opacity:t(s.opacity??1,0,1),mouseInteraction:s.mouseInteraction??!0,mouseStrength:Math.max(0,s.mouseStrength??.4),mouseRadius:Math.max(.01,s.mouseRadius??.45),mouseDampening:Math.max(0,s.mouseDampening??.15),lens:t(s.lens??.5,0,1),holdToWarp:s.holdToWarp??!0,intro:s.intro??!0,fade:t(s.fade??0,0,1),lightMode:s.lightMode??!1,paused:s.paused??!1,dpr:s.dpr},p=()=>{let e=l()?s.dark:s.light;e&&(Array.isArray(e.colors)&&e.colors.length&&(f.colors=e.colors.slice(0,8).map(String)),e.backgroundColor&&(f.backgroundColor=String(e.backgroundColor)),e.lightMode!==void 0&&(f.lightMode=e.lightMode),e.opacity!==void 0&&(f.opacity=t(e.opacity,0,1)),e.bloom!==void 0&&(f.bloom=Math.max(0,e.bloom)),e.backgroundGlow!==void 0&&(f.backgroundGlow=Math.max(0,e.backgroundGlow)),e.glow!==void 0&&(f.glow=Math.max(0,e.glow)),e.twinkle!==void 0&&(f.twinkle=t(e.twinkle,0,1)),e.fade!==void 0&&(f.fade=t(e.fade,0,1)),w?.())},m=()=>p();window.addEventListener(`theme-change`,m);let h=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0}),g=new Map,_=e=>{let t=g.get(e);if(t)return t;let n=[1,1,1];if(h){h.clearRect(0,0,1,1),h.fillStyle=`#ffffff`,h.fillStyle=e,h.fillRect(0,0,1,1);let[t,r,i]=h.getImageData(0,0,1,1).data;n=[t/255,r/255,i/255]}return g.set(e,n),n},v=e=>_(e).map(e=>e*e),y=window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches??!1,b=new Float32Array(24),x={x:0,y:0,inside:!1,held:!1},S={travel:0,intro:f.intro&&!y?0:1,mouseX:0,mouseY:0,lensX:0,lensY:0,touch:0,warp:0},C=null,w=null,T=()=>{let t=!!d.getExtension(`EXT_color_buffer_float`),s=c(d,r),l=c(d,i),p=c(d,a),m=c(d,o);if(!s||!l||!p||!m)return;let h=d.createBuffer(),g=d.createVertexArray();d.bindVertexArray(g),d.bindBuffer(d.ARRAY_BUFFER,h),d.bufferData(d.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),d.STATIC_DRAW),d.enableVertexAttribArray(0),d.vertexAttribPointer(0,2,d.FLOAT,!1,0,0);let _=t?d.RGBA16F:d.RGBA8,E=t?1:.25,D=()=>({texture:null,framebuffer:d.createFramebuffer(),width:0,height:0}),O=D(),k=Array.from({length:4},()=>[D(),D()]),A=(e,t,n)=>{e.texture&&e.width===t&&e.height===n||(e.texture&&d.deleteTexture(e.texture),e.texture=d.createTexture(),e.width=t,e.height=n,d.bindTexture(d.TEXTURE_2D,e.texture),d.texStorage2D(d.TEXTURE_2D,1,_,t,n),d.texParameteri(d.TEXTURE_2D,d.TEXTURE_MIN_FILTER,d.LINEAR),d.texParameteri(d.TEXTURE_2D,d.TEXTURE_MAG_FILTER,d.LINEAR),d.texParameteri(d.TEXTURE_2D,d.TEXTURE_WRAP_S,d.CLAMP_TO_EDGE),d.texParameteri(d.TEXTURE_2D,d.TEXTURE_WRAP_T,d.CLAMP_TO_EDGE),d.bindFramebuffer(d.FRAMEBUFFER,e.framebuffer),d.framebufferTexture2D(d.FRAMEBUFFER,d.COLOR_ATTACHMENT0,d.TEXTURE_2D,e.texture,0))},j=(e,t)=>(d.bindFramebuffer(d.FRAMEBUFFER,e?e.framebuffer:null),d.viewport(0,0,e?e.width:u.width,e?e.height:u.height),d.useProgram(t.program),t.uniforms),M=(e,t)=>{d.activeTexture(d.TEXTURE0+e),d.bindTexture(d.TEXTURE_2D,t)},N=()=>{let t=u.width,r=u.height,i=Math.max(1,n.clientWidth),a=Math.max(1,n.clientHeight);d.bindVertexArray(g),A(O,t,r),k.forEach((e,t)=>{A(e[0],Math.max(1,Math.round(i/2**(t+1))),Math.max(1,Math.round(a/2**(t+1)))),A(e[1],Math.max(1,Math.round(i/2**(t+1))),Math.max(1,Math.round(a/2**(t+1))))});let o=S.intro,c=Math.min(1,o*2.2),h=1+5*(1-o)**2+2.5*S.warp,_=Math.max(1,Math.floor(e*Math.max(f.density,.05)+.5)),y=e/_,x=9+S.travel,C=f.colors.map(v);b.fill(0);for(let e=0;e<8;e++)b.set(C[Math.min(e,C.length-1)],e*3);let w=e=>(2*e-t)/t,T=e=>(2*e-r)/t,D=j(O,s);if(d.uniform2f(D.uView,t,r),d.uniform1f(D.uZoom,f.zoom),d.uniform1f(D.uPhase,x%(16*y)),d.uniform1f(D.uTwinkleClock,x%e),d.uniform1f(D.uRings,_),d.uniform3fv(D.uColors,b),d.uniform1i(D.uColorCount,C.length),d.uniform1i(D.uStreakCount,f.streakCount),d.uniform1i(D.uColumns,f.streakWidth>1?2:1),d.uniform1f(D.uWidth,5e-4*f.streakWidth),d.uniform1f(D.uTail,19/(f.streakLength*h)),d.uniform1f(D.uTwinkle,f.twinkle),d.uniform1f(D.uHead,f.headGlow),d.uniform1f(D.uDepth,f.depth),d.uniform4f(D.uMouse,w(S.mouseX),T(S.mouseY),f.mouseInteraction?f.mouseStrength*S.touch:0,f.mouseRadius),d.uniform3f(D.uLens,w(S.lensX),T(S.lensY),f.mouseInteraction?.5*f.lens*S.touch:0),d.uniform1f(D.uLightMode,+!!f.lightMode),d.uniform1f(D.uEncode,E),d.drawArrays(d.TRIANGLES,0,3),f.bloom>0){let e=O;k.forEach(([t,n])=>{let r=j(t,l);M(0,e.texture),d.uniform1i(r.uSource,0),d.uniform2f(r.uTarget,t.width,t.height),d.uniform2f(r.uTexel,1/e.width,1/e.height),d.uniform1i(r.uLimit,4*E),d.drawArrays(d.TRIANGLES,0,3);let i=j(n,p);M(0,t.texture),d.uniform1i(i.uSource,0),d.uniform2f(i.uTarget,n.width,n.height),d.uniform2f(i.uStep,1/t.width,0),d.drawArrays(d.TRIANGLES,0,3),i=j(t,p),M(0,n.texture),d.uniform1i(i.uSource,0),d.uniform2f(i.uTarget,t.width,t.height),d.uniform2f(i.uStep,0,1/n.height),d.drawArrays(d.TRIANGLES,0,3),e=t})}let N=j(null,m);M(0,O.texture),d.uniform1i(N.uScene,0),k.forEach(([e],t)=>{M(t+1,e.texture),d.uniform1i(N[`uBloom${t}`]??null,t+1)}),d.uniform2f(N.uView,t,r),d.uniform1f(N.uDecode,1/E),d.uniform1f(N.uGlow,f.glow),d.uniform1f(N.uBloom,f.bloom),d.uniform1f(N.uPresence,c),d.uniform1f(N.uOpacity,f.opacity),d.uniform1f(N.uFade,f.fade),d.uniform1f(N.uLightMode,+!!f.lightMode),d.uniform3fv(N.uTopColor,v(f.backgroundColor)),d.uniform1f(N.uTopGlow,f.backgroundGlow),d.drawArrays(d.TRIANGLES,0,3);for(let e=4;e>=0;e--)M(e,null)},P=0,F=0,I=!0,L=e=>{if(P=0,!I||document.hidden)return;let t=F?Math.min(.05,(e-F)/1e3):1/60;F=e,!f.intro||y?S.intro=1:S.intro<1&&(S.intro=Math.min(1,S.intro+t/2.6));let r=f.holdToWarp&&x.held&&x.inside&&!y;S.warp+=(+!!r-S.warp)*(1-Math.exp(-t*(r?2.2:1.6)));let i=9*(1-S.intro)**2+6*S.warp,a=!f.paused&&!y;a&&(S.travel+=t*.1*f.speed*(1+i));let o=u.width/Math.max(1,n.clientWidth),s=x.x*o,c=(n.clientHeight-x.y)*o,l=f.mouseInteraction&&x.inside&&!y;l&&S.touch<.01&&(S.mouseX=s,S.mouseY=c,S.lensX=s,S.lensY=c);let d=f.mouseDampening>0?1-Math.exp(-t/f.mouseDampening):1;S.mouseX+=(s-S.mouseX)*d,S.mouseY+=(c-S.mouseY)*d;let p=1-Math.exp(-t*6);S.lensX+=(s-S.lensX)*p,S.lensY+=(c-S.lensY)*p,S.touch+=(+!!l-S.touch)*(1-Math.exp(-t*(l?4:2))),N();let m=S.intro<1||S.warp>.001||Math.abs(+!!l-S.touch)>.002;a&&f.speed!==0||m?P=requestAnimationFrame(L):F=0},R=()=>{!P&&I&&!document.hidden&&(P=requestAnimationFrame(L))},z=()=>{f.dpr===B?(P||N(),R()):(B=f.dpr,V())},B=f.dpr,V=()=>{let e=Math.max(1,n.clientWidth),t=Math.max(1,n.clientHeight),r=Math.min(f.dpr||window.devicePixelRatio||1,2);u.width=Math.max(1,Math.round(e*r)),u.height=Math.max(1,Math.round(t*r)),P||N(),R()};w=z;let H=e=>{let t=n.getBoundingClientRect(),r=e.clientX-t.left,i=e.clientY-t.top;return{x:r,y:i,inside:r>=0&&i>=0&&r<=t.width&&i<=t.height}},U=e=>{let t=H(e);x.x=t.x,x.y=t.y,x.inside=t.inside,R()},W=e=>{let t=H(e);t.inside&&(x.x=t.x,x.y=t.y,x.inside=!0,x.held=!0,R())},G=()=>{x.held=!1,R()},K=()=>{x.inside=!1,x.held=!1,R()},q=()=>{F=0,R()},J=e=>{e.preventDefault()},Y=()=>{C?.(),T()},X=new ResizeObserver(V);X.observe(n);let Z=new IntersectionObserver(e=>{I=e.some(e=>e.isIntersecting),I&&(F=0,R())});Z.observe(n),window.addEventListener(`pointermove`,U,{passive:!0}),window.addEventListener(`pointerdown`,W,{passive:!0}),window.addEventListener(`pointerup`,G,{passive:!0}),window.addEventListener(`pointercancel`,G,{passive:!0}),document.documentElement.addEventListener(`pointerleave`,K),document.addEventListener(`visibilitychange`,q),u.addEventListener(`webglcontextlost`,J),u.addEventListener(`webglcontextrestored`,Y),V(),C=()=>{cancelAnimationFrame(P),P=0,w=null,X.disconnect(),Z.disconnect(),window.removeEventListener(`pointermove`,U),window.removeEventListener(`pointerdown`,W),window.removeEventListener(`pointerup`,G),window.removeEventListener(`pointercancel`,G),document.documentElement.removeEventListener(`pointerleave`,K),document.removeEventListener(`visibilitychange`,q),u.removeEventListener(`webglcontextlost`,J),u.removeEventListener(`webglcontextrestored`,Y),[O,...k.flat()].forEach(e=>{e.texture&&d.deleteTexture(e.texture),d.deleteFramebuffer(e.framebuffer)}),[s,l,p,m].forEach(e=>d.deleteProgram(e.program)),d.deleteBuffer(h),d.deleteVertexArray(g)}};return T(),p(),()=>{window.removeEventListener(`theme-change`,m),C?.(),d.isContextLost()||d.getExtension(`WEBGL_lose_context`)?.loseContext()}}function d(e=document){e.querySelectorAll(`[data-lightfall]`).forEach(e=>{if(e.dataset.lightfallReady===`1`)return;e.dataset.lightfallReady=`1`;let t={},n=e.dataset.lightfall;if(n)try{t=JSON.parse(n)}catch{}u(e,t)})}d();