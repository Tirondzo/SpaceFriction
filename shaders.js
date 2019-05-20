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

export const SHADOWMAP_VERTEX = `#version 300 es
#define SHADER_TYPE_VERTEX

uniform mat4 u_MVPMatrix;


#if (__VERSION__ < 300)
  #define _attr attribute
#else
  #define _attr in
#endif

  _attr vec4 POSITION;
  _attr vec4 NORMAL;
  _attr vec4 TANGENT;
  _attr vec2 TEXCOORD_0;

  void main(void) {
    vec4 _NORMAL = vec4(0.);
    vec4 _TANGENT = vec4(0.);
    vec2 _TEXCOORD_0 = vec2(0.);

    _NORMAL = NORMAL;
    _TANGENT = TANGENT;
    _TEXCOORD_0 = TEXCOORD_0;

    gl_Position = u_MVPMatrix * POSITION;
  }
`;


export const SHADOWMAP_FRAGMENT = `#version 300 es
precision highp float;
out vec4 fragColor;
void main(void) {
  fragColor = vec4(gl_FragCoord.z,0,0,1);
}
`;

export const PBR_VS_WITH_SHADOWMAP =`\
#version 300 es


#define SHADER_TYPE_VERTEX

#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1

#if (__VERSION__ > 120)

# define FRAG_DEPTH
# define DERIVATIVES
# define DRAW_BUFFERS
# define TEXTURE_LOD

#endif // __VERSION
// FRAG_DEPTH => gl_FragDepth is available
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
# define FRAG_DEPTH
# define gl_FragDepth gl_FragDepthEXT
#endif
// DERIVATIVES => dxdF, dxdY and fwidth are available
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
# define DERIVATIVES
#endif
// DRAW_BUFFERS => gl_FragData[] is available
#ifdef GL_EXT_draw_buffers
#extension GL_EXT_draw_buffers : require
#define DRAW_BUFFERS
#endif
// TEXTURE_LOD => texture2DLod etc are available
#ifdef GL_EXT_shader_texture_lod
#extension GL_EXT_shader_texture_lod : enable
# define TEXTURE_LOD
#define texture2DLod texture2DLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define textureCubeLod textureCubeLodEXT
#define texture2DGrad texture2DGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define textureCubeGrad textureCubeGradEXT
#endif


// APPLICATION DEFINES
#define MAX_LIGHTS 3
#define LIGHTING_FRAGMENT 1
#define USE_TEX_LOD 1
#define MANUAL_SRGB 1
#define SRGB_FAST_APPROXIMATION 1
#define HAS_NORMALS 1
#define HAS_TANGENTS 1
#define HAS_UV 1
#define USE_IBL 1
#define USE_LIGHTS 1
#define PBR_DEBUG 0
#define HAS_BASECOLORMAP 1
#define HAS_NORMALMAP 1


#define MODULE_PROJECT2
uniform mat4 u_MVPMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;
// END MODULE_project2

#define MODULE_LIGHTS
#if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))

struct AmbientLight {
 vec3 color;
};

struct PointLight {
 vec3 color;
 vec3 position;
 vec3 attenuation;
};

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

uniform AmbientLight lighting_uAmbientLight;
uniform PointLight lighting_uPointLight[MAX_LIGHTS];
uniform DirectionalLight lighting_uDirectionalLight[MAX_LIGHTS];
uniform int lighting_uPointLightCount;
uniform int lighting_uDirectionalLightCount;

uniform bool lighting_uEnabled;

float getPointLightAttenuation(PointLight pointLight, float distance) {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

#endif
// END MODULE_lights

#define MODULE_PBR
out vec3 pbr_vPosition;
out vec2 pbr_vUV;

#ifdef HAS_NORMALS
# ifdef HAS_TANGENTS
out mat3 pbr_vTBN;
# else
out vec3 pbr_vNormal;
# endif
#endif

void pbr_setPositionNormalTangentUV(vec4 position, vec4 normal, vec4 tangent, vec2 uv)
{
  vec4 pos = u_ModelMatrix * position;
  pbr_vPosition = vec3(pos.xyz) / pos.w;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
  vec3 normalW = normalize(vec3(u_NormalMatrix * vec4(normal.xyz, 0.0)));
  vec3 tangentW = normalize(vec3(u_ModelMatrix * vec4(tangent.xyz, 0.0)));
  vec3 bitangentW = cross(normalW, tangentW) * tangent.w;
  pbr_vTBN = mat3(tangentW, bitangentW, normalW);
#else
  pbr_vNormal = normalize(vec3(u_ModelMatrix * vec4(normal.xyz, 0.0)));
#endif
#endif

#ifdef HAS_UV
  pbr_vUV = uv;
#else
  pbr_vUV = vec2(0.,0.);
#endif
}
// END MODULE_pbr

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
  
  uniform mat4 u_MSVSPMatirx;
  out vec4 shadowCoord;

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

    pbr_setPositionNormalTangentUV(POSITION, _NORMAL, _TANGENT, _TEXCOORD_0);
    gl_Position = u_MVPMatrix * POSITION;

    mat4 bias = mat4(
      0.5, 0.0, 0.0, 0.0,
      0.0, 0.5, 0.0, 0.0,
      0.0, 0.0, 0.5, 0.0,
      0.5, 0.5, 0.5, 1.0
    );
    shadowCoord = bias * u_MSVSPMatirx * POSITION;
  }
`;

export const PBR_FS_WITH_SHADOWMAP = `\
#version 300 es


#define SHADER_TYPE_FRAGMENT

#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1

#if (__VERSION__ > 120)

# define FRAG_DEPTH
# define DERIVATIVES
# define DRAW_BUFFERS
# define TEXTURE_LOD

#endif // __VERSION
// FRAG_DEPTH => gl_FragDepth is available
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
# define FRAG_DEPTH
# define gl_FragDepth gl_FragDepthEXT
#endif
// DERIVATIVES => dxdF, dxdY and fwidth are available
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
# define DERIVATIVES
#endif
// DRAW_BUFFERS => gl_FragData[] is available
#ifdef GL_EXT_draw_buffers
#extension GL_EXT_draw_buffers : require
#define DRAW_BUFFERS
#endif
// TEXTURE_LOD => texture2DLod etc are available
#ifdef GL_EXT_shader_texture_lod
#extension GL_EXT_shader_texture_lod : enable
# define TEXTURE_LOD
#define texture2DLod texture2DLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define textureCubeLod textureCubeLodEXT
#define texture2DGrad texture2DGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define textureCubeGrad textureCubeGradEXT
#endif


// APPLICATION DEFINES
#define MAX_LIGHTS 3
#define LIGHTING_FRAGMENT 1
#define USE_TEX_LOD 1
#define MANUAL_SRGB 1
#define SRGB_FAST_APPROXIMATION 1
#define HAS_NORMALS 1
#define HAS_TANGENTS 1
#define HAS_UV 1
#define USE_IBL 1
#define USE_LIGHTS 1
#define PBR_DEBUG 0
#define HAS_BASECOLORMAP 1
#define HAS_NORMALMAP 1

precision highp float;


#define MODULE_PROJECT2
uniform mat4 u_MVPMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;
// END MODULE_project2

#define MODULE_LIGHTS
#if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))

struct AmbientLight {
 vec3 color;
};

struct PointLight {
 vec3 color;
 vec3 position;
 vec3 attenuation;
};

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

uniform AmbientLight lighting_uAmbientLight;
uniform PointLight lighting_uPointLight[MAX_LIGHTS];
uniform DirectionalLight lighting_uDirectionalLight[MAX_LIGHTS];
uniform int lighting_uPointLightCount;
uniform int lighting_uDirectionalLightCount;

uniform bool lighting_uEnabled;

float getPointLightAttenuation(PointLight pointLight, float distance) {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

#endif
// END MODULE_lights

#define MODULE_PBR
#if (__VERSION__ < 300)
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable
#endif


#if (__VERSION__ < 300)
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL1COND; INCR)
#else
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL2COND; INCR)
#endif

precision highp float;

#ifdef USE_IBL
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;
uniform samplerCube u_SpecularEnvSampler2;
uniform float u_SkyInterpolation;
uniform sampler2D u_brdfLUT;
uniform vec2 u_ScaleIBLAmbient;
#endif

#ifdef HAS_BASECOLORMAP
uniform sampler2D u_BaseColorSampler;
#endif
#ifdef HAS_NORMALMAP
uniform sampler2D u_NormalSampler;
uniform float u_NormalScale;
#endif
#ifdef HAS_EMISSIVEMAP
uniform sampler2D u_EmissiveSampler;
uniform vec3 u_EmissiveFactor;
#endif
#ifdef HAS_METALROUGHNESSMAP
uniform sampler2D u_MetallicRoughnessSampler;
#endif
#ifdef HAS_OCCLUSIONMAP
uniform sampler2D u_OcclusionSampler;
uniform float u_OcclusionStrength;
#endif

#ifdef ALPHA_CUTOFF
uniform float u_AlphaCutoff;
#endif

uniform vec2 u_MetallicRoughnessValues;
uniform vec4 u_BaseColorFactor;

uniform vec3 u_Camera;
#ifdef PBR_DEBUG
uniform vec4 u_ScaleDiffBaseMR;
uniform vec4 u_ScaleFGDSpec;
#endif

in vec3 pbr_vPosition;

in vec2 pbr_vUV;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
in mat3 pbr_vTBN;
#else
in vec3 pbr_vNormal;
#endif
#endif
uniform sampler2D u_ShadowMap;
in vec4 shadowCoord;

struct PBRInfo
{
  float NdotL;
  float NdotV;
  float NdotH;
  float LdotH;
  float VdotH;
  float perceptualRoughness;
  float metalness;
  vec3 reflectance0;
  vec3 reflectance90;
  float alphaRoughness;
  vec3 diffuseColor;
  vec3 specularColor;
  vec3 n;
  vec3 v;
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
#ifdef MANUAL_SRGB
#ifdef SRGB_FAST_APPROXIMATION
  vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
#else
  vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
  vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
#endif
  return vec4(linOut,srgbIn.w);;
#else
  return srgbIn;
#endif
}

vec3 getNormal()
{
#ifndef HAS_TANGENTS
  vec3 pos_dx = dFdx(pbr_vPosition);
  vec3 pos_dy = dFdy(pbr_vPosition);
  vec3 tex_dx = dFdx(vec3(pbr_vUV, 0.0));
  vec3 tex_dy = dFdy(vec3(pbr_vUV, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
  vec3 ng = normalize(pbr_vNormal);
#else
  vec3 ng = cross(pos_dx, pos_dy);
#endif

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);
#else
  mat3 tbn = pbr_vTBN;
#endif

#ifdef HAS_NORMALMAP
  vec3 n = texture(u_NormalSampler, pbr_vUV).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_NormalScale, u_NormalScale, 1.0)));
#else
  vec3 n = normalize(tbn[2].xyz);
#endif

  return n;
}


#ifdef USE_IBL
vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
  float mipCount = 9.0;
  float lod = (pbrInputs.perceptualRoughness * mipCount);
  vec3 brdf = SRGBtoLINEAR(texture(u_brdfLUT,
    vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
  vec3 diffuseLight = SRGBtoLINEAR(texture(u_DiffuseEnvSampler, n)).rgb;

#ifdef USE_TEX_LOD
  vec3 specularLight = SRGBtoLINEAR(textureLod(u_SpecularEnvSampler, reflection, lod)).rgb;
  vec3 specularLight2 = SRGBtoLINEAR(textureLod(u_SpecularEnvSampler2, reflection, lod)).rgb;
  specularLight = mix(specularLight,specularLight2,u_SkyInterpolation);
#else
  vec3 specularLight = SRGBtoLINEAR(texture(u_SpecularEnvSampler, reflection)).rgb;
  vec3 specularLight2 = SRGBtoLINEAR(texture(u_SpecularEnvSampler2, reflection)).rgb;
  specularLight = mix(specularLight,specularLight2,u_SkyInterpolation);
#endif

  vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
  vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);
  diffuse *= u_ScaleIBLAmbient.x;
  specular *= u_ScaleIBLAmbient.y;

  return diffuse + specular;
}
#endif


vec3 diffuse(PBRInfo pbrInputs)
{
  return pbrInputs.diffuseColor / M_PI;
}

vec3 specularReflection(PBRInfo pbrInputs)
{
  return pbrInputs.reflectance0 +
    (pbrInputs.reflectance90 - pbrInputs.reflectance0) *
    pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}



float geometricOcclusion(PBRInfo pbrInputs)
{
  float NdotL = pbrInputs.NdotL;
  float NdotV = pbrInputs.NdotV;
  float r = pbrInputs.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}





float microfacetDistribution(PBRInfo pbrInputs)
{
  float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
  float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

void PBRInfo_setAmbientLight(inout PBRInfo pbrInputs) {
  pbrInputs.NdotL = 1.0;
  pbrInputs.NdotH = 0.0;
  pbrInputs.LdotH = 0.0;
  pbrInputs.VdotH = 1.0;
}

void PBRInfo_setDirectionalLight(inout PBRInfo pbrInputs, vec3 lightDirection) {
  vec3 n = pbrInputs.n;
  vec3 v = pbrInputs.v;
  vec3 l = normalize(lightDirection);
  vec3 h = normalize(l+v);

  pbrInputs.NdotL = clamp(dot(n, l), 0.001, 1.0);
  pbrInputs.NdotH = clamp(dot(n, h), 0.0, 1.0);
  pbrInputs.LdotH = clamp(dot(l, h), 0.0, 1.0);
  pbrInputs.VdotH = clamp(dot(v, h), 0.0, 1.0);
}

void PBRInfo_setPointLight(inout PBRInfo pbrInputs, PointLight pointLight) {
  vec3 light_direction = normalize(pointLight.position - pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInputs, light_direction);
}

vec3 calculateFinalColor(PBRInfo pbrInputs, vec3 lightColor) {
  vec3 F = specularReflection(pbrInputs);
  float G = geometricOcclusion(pbrInputs);
  float D = microfacetDistribution(pbrInputs);
  vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
  vec3 specContrib = F * G * D / (4.0 * pbrInputs.NdotL * pbrInputs.NdotV);
  return pbrInputs.NdotL * lightColor * (diffuseContrib + specContrib);
}

vec4 pbr_filterColor(vec4 colorUnused)
{


  float perceptualRoughness = u_MetallicRoughnessValues.y;
  float metallic = u_MetallicRoughnessValues.x;
#ifdef HAS_METALROUGHNESSMAP

  vec4 mrSample = texture(u_MetallicRoughnessSampler, pbr_vUV);
  perceptualRoughness = mrSample.g * perceptualRoughness;
  metallic = mrSample.b * metallic;
#endif
  perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
  metallic = clamp(metallic, 0.0, 1.0);

  float alphaRoughness = perceptualRoughness * perceptualRoughness;
#ifdef HAS_BASECOLORMAP
  vec4 baseColor = SRGBtoLINEAR(texture(u_BaseColorSampler, pbr_vUV)) * u_BaseColorFactor;
#else
  vec4 baseColor = u_BaseColorFactor;
#endif

#ifdef ALPHA_CUTOFF
  if (baseColor.a < u_AlphaCutoff) {
    discard;
  }
#endif

  vec3 f0 = vec3(0.04);
  vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
  diffuseColor *= 1.0 - metallic;
  vec3 specularColor = mix(f0, baseColor.rgb, metallic);
  float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);



  float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
  vec3 specularEnvironmentR0 = specularColor.rgb;
  vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

  vec3 n = getNormal();
  vec3 v = normalize(u_Camera - pbr_vPosition);

  float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
  vec3 reflection = -normalize(reflect(v, n));

  PBRInfo pbrInputs = PBRInfo(
    0.0,
    NdotV,
    0.0,
    0.0,
    0.0,
    perceptualRoughness,
    metallic,
    specularEnvironmentR0,
    specularEnvironmentR90,
    alphaRoughness,
    diffuseColor,
    specularColor,
    n,
    v
  );

  vec3 color = vec3(0, 0, 0);

#ifdef USE_LIGHTS
  PBRInfo_setAmbientLight(pbrInputs);
  color += calculateFinalColor(pbrInputs, lighting_uAmbientLight.color);
  float out_shadow = 1.0;
  

  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uDirectionalLightCount, i++) {
    if (i < lighting_uDirectionalLightCount) {
      PBRInfo_setDirectionalLight(pbrInputs, lighting_uDirectionalLight[i].direction);
      color += calculateFinalColor(pbrInputs, lighting_uDirectionalLight[i].color);
    }
  }
  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uPointLightCount, i++) {
    if (i < lighting_uPointLightCount) {
      PBRInfo_setPointLight(pbrInputs, lighting_uPointLight[i]);
      float attenuation = getPointLightAttenuation(lighting_uPointLight[i], distance(lighting_uPointLight[i].position, pbr_vPosition));
      //out_shadow = shadowCoord.z;
      out_shadow = 1.0;
      if(i == 0 && (texture(u_ShadowMap, shadowCoord.xy).r < shadowCoord.z - 0.005)) out_shadow = 0.0;
      color += calculateFinalColor(pbrInputs, lighting_uPointLight[i].color / attenuation)*out_shadow;
    }
  }
#endif
#ifdef USE_IBL
  color += getIBLContribution(pbrInputs, n, reflection);
#endif
#ifdef HAS_OCCLUSIONMAP
  float ao = texture(u_OcclusionSampler, pbr_vUV).r;
  color = mix(color, color * ao, u_OcclusionStrength);
#endif

#ifdef HAS_EMISSIVEMAP
  vec3 emissive = SRGBtoLINEAR(texture(u_EmissiveSampler, pbr_vUV)).rgb * u_EmissiveFactor;
  color += emissive;
#endif

#ifdef PBR_DEBUG
  color = mix(color, baseColor.rgb, u_ScaleDiffBaseMR.y);
  color = mix(color, vec3(metallic), u_ScaleDiffBaseMR.z);
  color = mix(color, vec3(perceptualRoughness), u_ScaleDiffBaseMR.w);
#endif

  return vec4(pow(color,vec3(1.0/2.2)), baseColor.a);
}
// END MODULE_pbr


#if (__VERSION__ < 300)
  #define fragmentColor gl_FragColor
#else
  out vec4 fragmentColor;
#endif

  void main(void) {
    fragmentColor = pbr_filterColor(vec4(0));
    //Visual debug: Shadow area
    //if(texture(u_ShadowMap, shadowCoord.xy).z < shadowCoord.z - 0.005) fragmentColor=vec4(1,0,0,1);
  }
`;

export const PBR_FS = `#version 300 es


#define SHADER_TYPE_FRAGMENT

#define INTEL_GPU
// Intel optimizes away the calculation necessary for emulated fp64
#define LUMA_FP64_CODE_ELIMINATION_WORKAROUND 1
// Intel's built-in 'tan' function doesn't have acceptable precision
#define LUMA_FP32_TAN_PRECISION_WORKAROUND 1
// Intel GPU doesn't have full 32 bits precision in same cases, causes overflow
#define LUMA_FP64_HIGH_BITS_OVERFLOW_WORKAROUND 1

#if (__VERSION__ > 120)

# define FRAG_DEPTH
# define DERIVATIVES
# define DRAW_BUFFERS
# define TEXTURE_LOD

#endif // __VERSION
// FRAG_DEPTH => gl_FragDepth is available
#ifdef GL_EXT_frag_depth
#extension GL_EXT_frag_depth : enable
# define FRAG_DEPTH
# define gl_FragDepth gl_FragDepthEXT
#endif
// DERIVATIVES => dxdF, dxdY and fwidth are available
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
# define DERIVATIVES
#endif
// DRAW_BUFFERS => gl_FragData[] is available
#ifdef GL_EXT_draw_buffers
#extension GL_EXT_draw_buffers : require
#define DRAW_BUFFERS
#endif
// TEXTURE_LOD => texture2DLod etc are available
#ifdef GL_EXT_shader_texture_lod
#extension GL_EXT_shader_texture_lod : enable
# define TEXTURE_LOD
#define texture2DLod texture2DLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define texture2DProjLod texture2DProjLodEXT
#define textureCubeLod textureCubeLodEXT
#define texture2DGrad texture2DGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define texture2DProjGrad texture2DProjGradEXT
#define textureCubeGrad textureCubeGradEXT
#endif


// APPLICATION DEFINES
#define MAX_LIGHTS 3
#define LIGHTING_FRAGMENT 1
#define USE_TEX_LOD 1
#define MANUAL_SRGB 1
#define SRGB_FAST_APPROXIMATION 1
#define HAS_NORMALS 1
#define HAS_TANGENTS 1
#define HAS_UV 1
#define USE_IBL 1
#define USE_LIGHTS 1
#define PBR_DEBUG 0
#define HAS_NORMALMAP 1

precision highp float;


#define MODULE_PROJECT2
uniform mat4 u_MVPMatrix;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;
// END MODULE_project2

#define MODULE_LIGHTS
#if (defined(SHADER_TYPE_FRAGMENT) && defined(LIGHTING_FRAGMENT)) || (defined(SHADER_TYPE_VERTEX) && defined(LIGHTING_VERTEX))

struct AmbientLight {
 vec3 color;
};

struct PointLight {
 vec3 color;
 vec3 position;
 vec3 attenuation;
};

struct DirectionalLight {
  vec3 color;
  vec3 direction;
};

uniform AmbientLight lighting_uAmbientLight;
uniform PointLight lighting_uPointLight[MAX_LIGHTS];
uniform DirectionalLight lighting_uDirectionalLight[MAX_LIGHTS];
uniform int lighting_uPointLightCount;
uniform int lighting_uDirectionalLightCount;

uniform bool lighting_uEnabled;

float getPointLightAttenuation(PointLight pointLight, float distance) {
  return pointLight.attenuation.x
       + pointLight.attenuation.y * distance
       + pointLight.attenuation.z * distance * distance;
}

#endif
// END MODULE_lights

#define MODULE_PBR
#if (__VERSION__ < 300)
#extension GL_EXT_shader_texture_lod: enable
#extension GL_OES_standard_derivatives : enable
#endif


#if (__VERSION__ < 300)
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL1COND; INCR)
#else
  #define SMART_FOR(INIT, WEBGL1COND, WEBGL2COND, INCR) for (INIT; WEBGL2COND; INCR)
#endif

precision highp float;

#ifdef USE_IBL
uniform samplerCube u_DiffuseEnvSampler;
uniform samplerCube u_SpecularEnvSampler;
uniform samplerCube u_SpecularEnvSampler2;
uniform float u_SkyInterpolation;
uniform sampler2D u_brdfLUT;
uniform vec2 u_ScaleIBLAmbient;
#endif

#ifdef HAS_BASECOLORMAP
uniform sampler2D u_BaseColorSampler;
#endif
#ifdef HAS_NORMALMAP
uniform sampler2D u_NormalSampler;
uniform float u_NormalScale;
#endif
#ifdef HAS_EMISSIVEMAP
uniform sampler2D u_EmissiveSampler;
uniform vec3 u_EmissiveFactor;
#endif
#ifdef HAS_METALROUGHNESSMAP
uniform sampler2D u_MetallicRoughnessSampler;
#endif
#ifdef HAS_OCCLUSIONMAP
uniform sampler2D u_OcclusionSampler;
uniform float u_OcclusionStrength;
#endif

#ifdef ALPHA_CUTOFF
uniform float u_AlphaCutoff;
#endif

uniform vec2 u_MetallicRoughnessValues;
uniform vec4 u_BaseColorFactor;

uniform vec3 u_Camera;
#ifdef PBR_DEBUG
uniform vec4 u_ScaleDiffBaseMR;
uniform vec4 u_ScaleFGDSpec;
#endif

in vec3 pbr_vPosition;

in vec2 pbr_vUV;

#ifdef HAS_NORMALS
#ifdef HAS_TANGENTS
in mat3 pbr_vTBN;
#else
in vec3 pbr_vNormal;
#endif
#endif


struct PBRInfo
{
  float NdotL;
  float NdotV;
  float NdotH;
  float LdotH;
  float VdotH;
  float perceptualRoughness;
  float metalness;
  vec3 reflectance0;
  vec3 reflectance90;
  float alphaRoughness;
  vec3 diffuseColor;
  vec3 specularColor;
  vec3 n;
  vec3 v;
};

const float M_PI = 3.141592653589793;
const float c_MinRoughness = 0.04;

vec4 SRGBtoLINEAR(vec4 srgbIn)
{
#ifdef MANUAL_SRGB
#ifdef SRGB_FAST_APPROXIMATION
  vec3 linOut = pow(srgbIn.xyz,vec3(2.2));
#else
  vec3 bLess = step(vec3(0.04045),srgbIn.xyz);
  vec3 linOut = mix( srgbIn.xyz/vec3(12.92), pow((srgbIn.xyz+vec3(0.055))/vec3(1.055),vec3(2.4)), bLess );
#endif
  return vec4(linOut,srgbIn.w);;
#else
  return srgbIn;
#endif
}

vec3 getNormal()
{
#ifndef HAS_TANGENTS
  vec3 pos_dx = dFdx(pbr_vPosition);
  vec3 pos_dy = dFdy(pbr_vPosition);
  vec3 tex_dx = dFdx(vec3(pbr_vUV, 0.0));
  vec3 tex_dy = dFdy(vec3(pbr_vUV, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

#ifdef HAS_NORMALS
  vec3 ng = normalize(pbr_vNormal);
#else
  vec3 ng = cross(pos_dx, pos_dy);
#endif

  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);
#else
  mat3 tbn = pbr_vTBN;
#endif

#ifdef HAS_NORMALMAP
  vec3 n = texture(u_NormalSampler, pbr_vUV).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(u_NormalScale, u_NormalScale, 1.0)));
#else
  vec3 n = normalize(tbn[2].xyz);
#endif

  return n;
}


#ifdef USE_IBL
vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection)
{
  float mipCount = 9.0;
  float lod = (pbrInputs.perceptualRoughness * mipCount);
  vec3 brdf = SRGBtoLINEAR(texture(u_brdfLUT,
    vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
  vec3 diffuseLight = SRGBtoLINEAR(texture(u_DiffuseEnvSampler, n)).rgb;

#ifdef USE_TEX_LOD
  vec3 specularLight = SRGBtoLINEAR(textureLod(u_SpecularEnvSampler, reflection, lod)).rgb;
  vec3 specularLight2 = SRGBtoLINEAR(textureLod(u_SpecularEnvSampler2, reflection, lod)).rgb;
  specularLight = mix(specularLight,specularLight2,u_SkyInterpolation);
#else
  vec3 specularLight = SRGBtoLINEAR(texture(u_SpecularEnvSampler, reflection)).rgb;
  vec3 specularLight2 = SRGBtoLINEAR(texture(u_SpecularEnvSampler2, reflection)).rgb;
  specularLight = mix(specularLight,specularLight2,u_SkyInterpolation);
#endif

  vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
  vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);
  diffuse *= u_ScaleIBLAmbient.x;
  specular *= u_ScaleIBLAmbient.y;

  return diffuse + specular;
}
#endif


vec3 diffuse(PBRInfo pbrInputs)
{
  return pbrInputs.diffuseColor / M_PI;
}

vec3 specularReflection(PBRInfo pbrInputs)
{
  return pbrInputs.reflectance0 +
    (pbrInputs.reflectance90 - pbrInputs.reflectance0) *
    pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}



float geometricOcclusion(PBRInfo pbrInputs)
{
  float NdotL = pbrInputs.NdotL;
  float NdotV = pbrInputs.NdotV;
  float r = pbrInputs.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}





float microfacetDistribution(PBRInfo pbrInputs)
{
  float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
  float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

void PBRInfo_setAmbientLight(inout PBRInfo pbrInputs) {
  pbrInputs.NdotL = 1.0;
  pbrInputs.NdotH = 0.0;
  pbrInputs.LdotH = 0.0;
  pbrInputs.VdotH = 1.0;
}

void PBRInfo_setDirectionalLight(inout PBRInfo pbrInputs, vec3 lightDirection) {
  vec3 n = pbrInputs.n;
  vec3 v = pbrInputs.v;
  vec3 l = normalize(lightDirection);
  vec3 h = normalize(l+v);

  pbrInputs.NdotL = clamp(dot(n, l), 0.001, 1.0);
  pbrInputs.NdotH = clamp(dot(n, h), 0.0, 1.0);
  pbrInputs.LdotH = clamp(dot(l, h), 0.0, 1.0);
  pbrInputs.VdotH = clamp(dot(v, h), 0.0, 1.0);
}

void PBRInfo_setPointLight(inout PBRInfo pbrInputs, PointLight pointLight) {
  vec3 light_direction = normalize(pointLight.position - pbr_vPosition);
  PBRInfo_setDirectionalLight(pbrInputs, light_direction);
}

vec3 calculateFinalColor(PBRInfo pbrInputs, vec3 lightColor) {
  vec3 F = specularReflection(pbrInputs);
  float G = geometricOcclusion(pbrInputs);
  float D = microfacetDistribution(pbrInputs);
  vec3 diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
  vec3 specContrib = F * G * D / (4.0 * pbrInputs.NdotL * pbrInputs.NdotV);
  return pbrInputs.NdotL * lightColor * (diffuseContrib + specContrib);
}

vec4 pbr_filterColor(vec4 colorUnused)
{


  float perceptualRoughness = u_MetallicRoughnessValues.y;
  float metallic = u_MetallicRoughnessValues.x;
#ifdef HAS_METALROUGHNESSMAP

  vec4 mrSample = texture(u_MetallicRoughnessSampler, pbr_vUV);
  perceptualRoughness = mrSample.g * perceptualRoughness;
  metallic = mrSample.b * metallic;
#endif
  perceptualRoughness = clamp(perceptualRoughness, c_MinRoughness, 1.0);
  metallic = clamp(metallic, 0.0, 1.0);

  float alphaRoughness = perceptualRoughness * perceptualRoughness;
#ifdef HAS_BASECOLORMAP
  vec4 baseColor = SRGBtoLINEAR(texture(u_BaseColorSampler, pbr_vUV)) * u_BaseColorFactor;
#else
  vec4 baseColor = u_BaseColorFactor;
#endif

#ifdef ALPHA_CUTOFF
  if (baseColor.a < u_AlphaCutoff) {
    discard;
  }
#endif

  vec3 f0 = vec3(0.04);
  vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
  diffuseColor *= 1.0 - metallic;
  vec3 specularColor = mix(f0, baseColor.rgb, metallic);
  float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);



  float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
  vec3 specularEnvironmentR0 = specularColor.rgb;
  vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

  vec3 n = getNormal();
  vec3 v = normalize(u_Camera - pbr_vPosition);

  float NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
  vec3 reflection = -normalize(reflect(v, n));

  PBRInfo pbrInputs = PBRInfo(
    0.0,
    NdotV,
    0.0,
    0.0,
    0.0,
    perceptualRoughness,
    metallic,
    specularEnvironmentR0,
    specularEnvironmentR90,
    alphaRoughness,
    diffuseColor,
    specularColor,
    n,
    v
  );

  vec3 color = vec3(0, 0, 0);

#ifdef USE_LIGHTS
  PBRInfo_setAmbientLight(pbrInputs);
  color += calculateFinalColor(pbrInputs, lighting_uAmbientLight.color);
  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uDirectionalLightCount, i++) {
    if (i < lighting_uDirectionalLightCount) {
      PBRInfo_setDirectionalLight(pbrInputs, lighting_uDirectionalLight[i].direction);
      color += calculateFinalColor(pbrInputs, lighting_uDirectionalLight[i].color);
    }
  }
  SMART_FOR(int i = 0, i < MAX_LIGHTS, i < lighting_uPointLightCount, i++) {
    if (i < lighting_uPointLightCount) {
      PBRInfo_setPointLight(pbrInputs, lighting_uPointLight[i]);
      float attenuation = getPointLightAttenuation(lighting_uPointLight[i], distance(lighting_uPointLight[i].position, pbr_vPosition));
      color += calculateFinalColor(pbrInputs, lighting_uPointLight[i].color / attenuation);
    }
  }
#endif
#ifdef USE_IBL
  color += getIBLContribution(pbrInputs, n, reflection);
#endif
#ifdef HAS_OCCLUSIONMAP
  float ao = texture(u_OcclusionSampler, pbr_vUV).r;
  color = mix(color, color * ao, u_OcclusionStrength);
#endif

#ifdef HAS_EMISSIVEMAP
  vec3 emissive = SRGBtoLINEAR(texture(u_EmissiveSampler, pbr_vUV)).rgb * u_EmissiveFactor;
  color += emissive;
#endif

#ifdef PBR_DEBUG
  color = mix(color, baseColor.rgb, u_ScaleDiffBaseMR.y);
  color = mix(color, vec3(metallic), u_ScaleDiffBaseMR.z);
  color = mix(color, vec3(perceptualRoughness), u_ScaleDiffBaseMR.w);
#endif

  return vec4(pow(color,vec3(1.0/2.2)), baseColor.a);
}
// END MODULE_pbr


#if (__VERSION__ < 300)
  #define fragmentColor gl_FragColor
#else
  out vec4 fragmentColor;
#endif

  void main(void) {
    fragmentColor = pbr_filterColor(vec4(0));
  }
`;