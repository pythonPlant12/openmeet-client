// Liquid drop engine for LiquidGlassSurface, adapted from the 21st.dev "liquid glass navbar".
// One spring-driven drop moves to the target item, squashes as it travels, and ripples when it settles.
// WebGL renders the drop; without WebGL the surface falls back to a CSS pill.

// The canvas overhangs the surface on every side so the drop's shadow and ripples are not clipped.
export const LIQUID_PAD = 14;

interface Ripple {
  x: number;
  y: number;
  age: number;
  amp: number;
}

export interface LiquidGl {
  gl: WebGLRenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
}

export interface LiquidState {
  // The drop's center x and horizontal velocity.
  drop: { x: number; v: number };
  // Vertical squash: scale and its velocity.
  sy: { s: number; v: number };
  rips: Ripple[];
  // Target pill: center x/y, half straight length q, radius r.
  t: { x: number; cy: number; q: number; r: number };
  // The drop's current half straight length, eased toward the target's.
  q: number;
  // The drop's current radius and center y, eased toward the target's (items can differ in size).
  r: number;
  cy: number;
  mouse: { x: number; y: number; s: number; on: boolean };
  moving: boolean;
  ready: boolean;
  w: number;
  h: number;
  time: number;
  reduce: boolean;
}

export function createLiquidState(): LiquidState {
  return {
    drop: { x: 0, v: 0 },
    sy: { s: 1, v: 0 },
    rips: [],
    t: { x: 0, cy: 0, q: 0, r: 21 },
    q: 0,
    r: 21,
    cy: 0,
    mouse: { x: 0, y: 0, s: 0, on: false },
    moving: false,
    ready: false,
    w: 0,
    h: 0,
    time: 0,
    reduce: false,
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Sets a new target pill from the target item's box (relative to the surface). */
export function setLiquidTarget(
  s: LiquidState,
  surface: { width: number; height: number },
  item: { left: number; top: number; width: number; height: number },
) {
  s.w = surface.width;
  s.h = surface.height;
  const t = s.t;
  t.r = item.height / 2;
  t.q = Math.max(0, item.width / 2 - t.r);
  t.cy = LIQUID_PAD + item.top + item.height / 2;
  const x = LIQUID_PAD + item.left + item.width / 2;
  if (!s.ready) {
    s.drop.x = x;
    s.drop.v = 0;
    s.q = t.q;
    s.r = t.r;
    s.cy = t.cy;
    s.ready = true;
  } else if (Math.abs(x - t.x) > 0.5) {
    s.moving = true;
  }
  t.x = x;
}

export function addRipple(s: LiquidState, x: number, y: number, amp: number) {
  if (!s.reduce) s.rips.push({ x, y, age: 0, amp });
}

/** Advances the simulation by dt seconds. */
export function stepLiquid(s: LiquidState, dt: number) {
  const t = s.t;
  const drop = s.drop;
  s.time += dt;
  const ease = Math.min(1, dt * 12);
  s.q += (t.q - s.q) * ease;
  s.r += (t.r - s.r) * ease;
  s.cy += (t.cy - s.cy) * ease;
  let settled = Math.abs(t.q - s.q) < 0.2 && Math.abs(t.r - s.r) < 0.2 && Math.abs(t.cy - s.cy) < 0.2;

  if (s.reduce) {
    drop.x = t.x;
    drop.v = 0;
    s.q = t.q;
    s.r = t.r;
    s.cy = t.cy;
    s.sy.s = 1;
    settled = true;
  } else {
    drop.v += (210 * (t.x - drop.x) - 25 * drop.v) * dt;
    drop.x += drop.v * dt;
    const min = LIQUID_PAD + 6 + s.q + s.r - 3;
    const max = LIQUID_PAD + s.w - 6 - s.q - s.r + 3;
    if (drop.x < min || drop.x > max) {
      // Hitting the surface's end squashes the drop vertically.
      s.sy.v -= Math.min(Math.abs(drop.v), 900) * 0.0016;
      drop.x = clamp(drop.x, min, max);
      drop.v *= -0.25;
    }
    if (Math.abs(t.x - drop.x) > 0.3 || Math.abs(drop.v) > 3) settled = false;

    // A fast drop flattens a little, then springs back to round.
    const squash = 1 - 0.2 * Math.min(Math.abs(drop.v) / 1500, 1);
    s.sy.v += (280 * (squash - s.sy.s) - 9 * s.sy.v) * dt;
    s.sy.s += s.sy.v * dt;
    if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) settled = false;
  }

  if (s.moving && settled) {
    s.moving = false;
    if (!s.reduce) s.rips.push({ x: t.x, y: t.cy, age: 0, amp: 0.7 });
  }
  s.rips.forEach((ripple) => (ripple.age += dt));
  s.rips = s.rips.filter((ripple) => ripple.age < 2.4);
  s.mouse.s += ((s.mouse.on ? 1 : 0) - s.mouse.s) * Math.min(1, dt * 7);
}

/** True while something still moves, so the render loop can stop when the surface is idle. */
export function isLiquidActive(s: LiquidState) {
  return s.moving || s.rips.length > 0 || s.mouse.s > 0.01;
}

/** Current drop geometry for the CSS fallback pill. */
export function liquidFallbackBox(s: LiquidState) {
  return {
    left: s.drop.x - s.q - s.r - LIQUID_PAD,
    top: s.cy - s.r - LIQUID_PAD,
    width: 2 * (s.q + s.r),
    height: 2 * s.r,
    scaleY: s.sy.s,
  };
}

const VERTEX_SHADER = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

// Colors are Harbor tokens in linear 0-1 RGB: shadow #102F35, rim #0B7A75, body a pale teal.
const FRAGMENT_SHADER = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*.11;
 vec3 c=vec3(.063,.184,.208)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.35*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=vec3(.85,.96,.94);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.3+.14*body);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.24;vec3 lc=vec3(.043,.478,.459);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.25)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

const UNIFORMS = ['uRes', 'uDpr', 'uTime', 'uPill', 'uBlob', 'uSy', 'uRip', 'uMouse', 'uAmb'];

export function initLiquidGl(canvas: HTMLCanvasElement): LiquidGl | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  // One oversized triangle covers the whole viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const u: LiquidGl['u'] = {};
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  return { gl, u };
}

export function renderLiquid(s: LiquidState, glc: LiquidGl, dpr: number) {
  const { gl, u } = glc;
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.uniform2f(u.uRes!, s.w + LIQUID_PAD * 2, s.h + LIQUID_PAD * 2);
  gl.uniform1f(u.uDpr!, dpr);
  gl.uniform1f(u.uTime!, s.time);
  gl.uniform4f(u.uPill!, LIQUID_PAD, LIQUID_PAD, s.w, s.h);

  // The shader blends up to six blobs; one drop uses the first slot and leaves the rest empty.
  const blobs = new Float32Array(24);
  const squash = new Float32Array(6).fill(1);
  blobs.set([s.drop.x, s.cy, s.q, s.r], 0);
  squash[0] = s.sy.s;
  gl.uniform4fv(u.uBlob!, blobs);
  gl.uniform1fv(u.uSy!, squash);

  const ripples = new Float32Array(24);
  s.rips.slice(-6).forEach((ripple, index) => ripples.set([ripple.x, ripple.y, ripple.age, ripple.amp], index * 4));
  gl.uniform4fv(u.uRip!, ripples);
  gl.uniform3f(u.uMouse!, s.mouse.x, s.mouse.y, s.mouse.s);
  gl.uniform1f(u.uAmb!, s.reduce ? 0 : 1);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** Chromium is the only engine that applies SVG filters inside backdrop-filter. */
export function supportsLiquidRefraction() {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false;
  const agent = navigator.userAgent;
  return (
    /Chrome\/|Chromium\/|Edg\//.test(agent) &&
    !/Firefox\//.test(agent) &&
    !!CSS.supports?.('backdrop-filter', 'url(#a)')
  );
}
