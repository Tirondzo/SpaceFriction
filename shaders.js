export const VERTEX_SHADER = `\
attribute vec3 positions;
attribute vec4 colors;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

varying vec4 vColor;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(positions, 1.0);
  vColor = colors;
}
`;

export const FRAGMENT_SHADER = `\
precision highp float;

varying vec4 vColor;

void main(void) {
  gl_FragColor = vColor;
}
`;

export const V_SHADER = `\
// APPLICATION DEFINES
#define MAX_LIGHTS 3
#define LIGHTING_FRAGMENT 1
#define USE_TEX_LOD 1
#define MANUAL_SRGB 1
#define SRGB_FAST_APPROXIMATION 1
#define HAS_NORMALS 1
#define HAS_TANGENTS 1
#define HAS_UV 1
#define USE_LIGHTS 1
#define HAS_BASECOLORMAP 1
#define HAS_METALROUGHNESSMAP 1
#define HAS_NORMALMAP 1
#define HAS_EMISSIVEMAP 1

#if (__VERSION__ < 300)
  #define _attr attribute
#else
  #define _attr in
#endif

_attr vec4 POSITION;

#ifdef HAS_NORMALS
  _attr vec4 NORMAL;
#endif

#ifdef HAS_TANGENTS
  _attr vec4 TANGENT;
#endif

#ifdef HAS_UV
  _attr vec2 TEXCOORD_0;
#endif

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * POSITION;
}
`;

export const F_SHADER = `\
void main(void) {
  gl_FragColor = vec4(1,0,1,1);
}
`;

export const VS_PBR_SHADER = `\
#version 300 es

#define HAS_NORMALS 1
#define HAS_TANGENTS 1
#define HAS_UV 1

uniform mat4 u_MVPMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;


#if (__VERSION__ < 300)
  #define _attr attribute
#else
  #define _attr in
#endif

  _attr vec4 POSITION;

  #ifdef HAS_NORMALS
    _attr vec4 NORMAL;
  #endif

  #ifdef HAS_TANGENTS
    _attr vec4 TANGENT;
  #endif

  #ifdef HAS_UV
    _attr vec2 TEXCOORD_0;
  #endif

  void main(void) {
    vec4 _NORMAL = vec4(0.);
    vec4 _TANGENT = vec4(0.);
    vec2 _TEXCOORD_0 = vec2(0.);

    #ifdef HAS_NORMALS
      _NORMAL = NORMAL;
    #endif

    #ifdef HAS_TANGENTS
      _TANGENT = TANGENT;
    #endif

    #ifdef HAS_UV
      _TEXCOORD_0 = TEXCOORD_0;
    #endif

    //pbr_setPositionNormalTangentUV(POSITION, _NORMAL, _TANGENT, _TEXCOORD_0);
    gl_Position = u_MVPMatrix * POSITION;
  }
`;

export const PS_PBR_SHADER = `\
#version 300 es

precision highp float;


in vec3 pbr_vPosition;

in vec2 pbr_vUV;

  out vec4 fragmentColor;


  void main(void) {
    fragmentColor = vec4(1,1,0,1);
    //fragmentColor = pbr_filterColor(vec4(0));
  }
`;