import { perlin, lerp, shuffle, range } from './perlin';
import { Vector3 } from 'math.gl';
import { TextureCube, Framebuffer, Renderbuffer, Texture2D, Buffer, Program } from '@luma.gl/core';
import { Model, CubeGeometry, Geometry } from '@luma.gl/core';
import GL from '@luma.gl/constants';
import {SIMPLEX_NOISE_3D_SHADER} from './simplex';
import {CLASSIC_NOISE_3D_SHADER} from './perlin';
import { throws } from 'assert';

const FULLSC_GEOMETRY = new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]);

const BOX_PLANES = [new Float32Array([1,-1,1,1,-1,-1,1,1,-1,1,1,1]),
                    new Float32Array([-1,-1,-1,-1,-1,1,-1,1,1,-1,1,-1]),
                    new Float32Array([-1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1]),
                    new Float32Array([-1,1,1,1,1,1,1,1,-1,-1,1,-1]),
                    new Float32Array([-1,-1,1,1,-1,1,1,1,1,-1,1,1]),
                    new Float32Array([1,-1,-1,-1,-1,-1,-1,1,-1,1,1,-1])];

export function getSpaceSkyboxTextures(pos, size=512) {
  const textures = {pos: {}, neg: {}};

  //front up right
  const coords = [[[1,0,0], [0,1,0], [0,0,-1]], //pos-x
                  [[-1,0,0], [0,1,0], [0,0,1]], //neg-x
                  [[0,-1,0], [0,0,1], [1,0,0]], //neg-y
                  [[0,1,0], [0,0,-1], [1,0,0]], //pos-y
                  [[0,0,1], [0,1,0], [1,0,0]], //pos-z
                  [[0,0,-1], [0,1,0], [-1,0,0]] //neg-z
  ];

  const noise = perlin({
    interpolation: lerp,
    permutation: shuffle(range(0, 255), Math.random)
  });

  let face = 0;
  for (const coord of coords){
    const textureData = new Uint8Array(size*size*3);
    let textureIndex = 0;
    for(let i = 0; i < size; ++i)
      for(let j = 0; j < size; ++j){
        let delta = new Vector3(coord[0])
                    .add(new Vector3(coord[1]).scale((i/size)*2-1))
                    .add(new Vector3(coord[2]).scale((j/size)*2-1));
        let p = new Vector3(pos).add(delta).normalize().scale(50);
        textureData[textureIndex++] = (0.5 + 0.5*noise(p[0],p[1],p[2]))*255;
        textureData[textureIndex++] = (0.5 + 0.5*noise(p[0],p[1],p[2]))*255;
        textureData[textureIndex++] = (0.5 + 0.5*noise(p[0],p[1],p[2]))*255;

        /*//Debug skybox
        textureData[textureIndex++] = (p[0]+1)*.5*255;
        textureData[textureIndex++] = (p[1]+1)*.5*255;
        textureData[textureIndex++] = (p[2]+1)*.5*255;*/
      }

    textures[TextureCube.FACES[face++]] = textureData;
  }

  return textures;
}

export class SkyboxCube extends Model {
  constructor(gl, props) {
    const vs = `#version 300 es
in vec3 positions;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
out vec3 vPosition;
void main(void) {
  gl_Position = uProjection * mat4(mat3(uView)) * vec4(positions, 1.0);
  gl_Position = gl_Position.xyww;
  //gl_Position = vec4(positions.xy, 1.0, 1.0);
  vPosition = positions;
}
`;
    const fs = `#version 300 es
precision highp float;
uniform samplerCube uTextureCube;
uniform samplerCube uTextureCubeNew;
uniform float diff;
in vec3 vPosition;
out vec3 fragColor;
void main(void) {
  vec3 np = normalize(vPosition);
  vec3 curr = texture(uTextureCube, np).rgb;
  vec3 new = texture(uTextureCubeNew, np).rgb;
  fragColor = mix(curr,new,diff);
}
`;

    super(gl, Object.assign({geometry: new CubeGeometry()}, props, {fs, vs}));
  }
}

const SPACE_SKYBOX_GEN_VS = 
`#version 300 es
in vec3 positions;
in vec3 vertexes;
out vec3 vPosition;
void main(void) {
  gl_Position = vec4(positions, 1.0);
  vPosition = vertexes;
}
`;

const SPACE_SKYBOX_GEN_SHADER = 
`#version 300 es
precision highp float;` + CLASSIC_NOISE_3D_SHADER + `

float normalnoise(vec3 p){
  return cnoise(p)*.5 + .5;
}

float spaceNoise(vec3 p, vec3 dir){
  #define steps 5
  float scale = pow(2.0, float(steps));
  float displace = 0.0;
  
  displace = normalnoise(p * scale + displace*dir);
  scale *= 0.5;
  displace = normalnoise(p * scale + displace*dir);
  scale *= 0.5;
  displace = normalnoise(p * scale + displace*dir);
  scale *= 0.5;
  displace = normalnoise(p * scale + displace*dir);
  scale *= 0.5;
  displace = normalnoise(p * scale + displace*dir);
  scale *= 0.5;

  return normalnoise(p + displace);
}

vec3 coloredNoise(vec3 p){
  return vec3(normalnoise(p),normalnoise(p+10.),normalnoise(p-5.));
}

vec3 getSpaceColor(vec3 np, vec3 o){
  vec3 p = np+o*0.001;
  float n = spaceNoise(p, np);
  n = pow(n+0.15, 6.0);

  vec3 col = coloredNoise(p)*.3;
  vec3 base = vec3(0.2,0.5,0.8); //SPACE COLOR

  vec3 final = mix(col*base, base, n);
  float stars = smoothstep(0.9,0.95,normalnoise(np*200.+o*0.01))*normalnoise(np*100.+o*0.01);
  final = mix(final, vec3(1.0), stars);

  return clamp(final, 0.0, 1.0);
}`;

const SPACE_SKYBOX_GEN_FS = 
SPACE_SKYBOX_GEN_SHADER + `
precision highp float;
in vec3 vPosition;
out vec3 fragColor;
uniform vec3 offset;
void main(void) {
  vec3 np = normalize(vPosition);
  //fragColor = ((getSpaceColor(np, offset+delta.xyy)+getSpaceColor(np, offset-delta.xyy))
  //            +(getSpaceColor(np, offset+delta.yxy)+getSpaceColor(np, offset-delta.yxy))
  //            +(getSpaceColor(np, offset+delta.yyx)+getSpaceColor(np, offset-delta.yyx)))*0.16666;
  fragColor = getSpaceColor(np, offset);
}
`;

const SPACE_DIFF_SKYBOX_GEN_FS = 
SPACE_SKYBOX_GEN_SHADER + `
precision highp float;
in vec3 vPosition;
layout(location = 0) out vec3 diffX;
layout(location = 1) out vec3 diffY;
layout(location = 2) out vec3 diffZ;
uniform vec3 offset;
uniform float offsetScale;
void main(void){
  vec2 delta = vec2(offsetScale, 0.0);
  vec3 np = normalize(vPosition);
  diffX = (getSpaceColor(np, offset+delta.xyy)-getSpaceColor(np, offset-delta.xyy))*.5+.5;
  diffY = (getSpaceColor(np, offset+delta.yxy)-getSpaceColor(np, offset-delta.yxy))*.5+.5;
  diffZ = (getSpaceColor(np, offset+delta.yyx)-getSpaceColor(np, offset-delta.yyx))*.5+.5;
}
`;

export class SpaceSkybox extends SkyboxCube {
  constructor(gl, props, resolution=512){
    super(gl, props);
    this.resolution = resolution;

    let rttCubemapData = {pos: {}, neg: {}}; 
    console.log(GL);
    for(let i = 0; i < 6; ++i){
      rttCubemapData[TextureCube.FACES[i]] = new Uint8Array(resolution*resolution*4);
      //for(let j = 0; j < rttCubemapData[TextureCube.FACES[i]].length; ++j) rttCubemapData[TextureCube.FACES[i]][j] = 128;
    }
    this.rttCubemap = new TextureCube(gl, {
      pixels: rttCubemapData,
      width: resolution, height: resolution,
      format: gl.RGB,
      type: gl.UNSIGNED_BYTE,
      mipmaps: false,
      parameters: {
        [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
        [GL.TEXTURE_MIN_FILTER]: GL.LINEAR
      },
    });

    /*this.rttDiffCubemaps = new Array(3);
    for(let j = 0; j < 3; ++j)
      this.rttDiffCubemaps[j] = new TextureCube(gl, {
        pixels: rttCubemapData,
        width: resolution, height: resolution,
        format: gl.RGB,
        type: gl.UNSIGNED_BYTE,
        mipmaps: false,
        parameters: {
          [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
          [GL.TEXTURE_MIN_FILTER]: GL.LINEAR
        },
      });*/
    
    this.rttNewCubemap = new TextureCube(gl, {
      pixels: rttCubemapData,
      width: resolution, height: resolution,
      format: gl.RGB,
      type: gl.UNSIGNED_BYTE,
      mipmaps: false,
      parameters: {
        [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
        [GL.TEXTURE_MIN_FILTER]: GL.LINEAR
      },
    });

    this.renderbuffer = new Renderbuffer(gl, {
      format: GL.DEPTH_COMPONENT16,
      width: resolution,
      height: resolution
    });
    this.rttFrameBuffer = new Framebuffer(gl, {
      width: resolution,
      height: resolution,
      color: true, depth: true
    });
    /*this.rttFrameBuffer.attach({
      [GL.COLOR_ATTACHMENT0]: [this.rttCubemap, GL.TEXTURE_CUBE_MAP_POSITIVE_X],
      [GL.DEPTH_ATTACHMENT]: this.renderbuffer
    });*/

    this.diffSkyboxProgram = new Program(gl, {
      vs: SPACE_SKYBOX_GEN_VS,
      fs: SPACE_DIFF_SKYBOX_GEN_FS
    });

    this.faceBuffers = new Array(6);
    for(let i=0; i < 6; ++i){
      //this.faceBuffers[i] = new Buffer(gl, {data: this.geometryBuffers.positions[0].slice(0+i*3*4,(i+1)*3*4)});
      //const arr = this.geometryBuffers.positions[0].getData({srcByteOffset: 0+i*3*4, length: 3*4});
      this.faceBuffers[i] = new Buffer(gl, BOX_PLANES[i]);
    }
    this.fullscModel = new Model(gl, {attributes: {positions: new Buffer(gl, FULLSC_GEOMETRY), vertexes: this.faceBuffers[0]}, vertexCount: 4, drawMode: gl.TRIANGLE_FAN, vs: SPACE_SKYBOX_GEN_VS, fs: SPACE_SKYBOX_GEN_FS});
    this.criticalDelta = 10.0;
  }

  renderCubemap(gl, pos, cubemap) {
    if(!cubemap) cubemap = this.rttCubemap;
    pos = pos.clone().multiply([-1,1,-1]);
    gl.viewport(0, 0, this.resolution, this.resolution);
    for(let i=0; i < 6; ++i){
      this.rttFrameBuffer.attach({
        [GL.COLOR_ATTACHMENT0]: [cubemap, GL.TEXTURE_CUBE_MAP_POSITIVE_X+i]
      }, {resizeAttachments: false});
      this.rttFrameBuffer.bind();
      this.fullscModel.setAttributes({vertexes: this.faceBuffers[i]});
      this.fullscModel.setUniforms({offset: pos, offsetScale: this.criticalDelta});
      this.fullscModel.draw();
      this.rttFrameBuffer.unbind();
    }
    this.setUniforms({uTextureCube: this.rttCubemap, uTextureCubeNew: this.rttNewCubemap});
  }

  renderCubemapDiffs(gl, pos){
    //pos = pos.clone().multiply([1,1,-1]);
    gl.viewport(0, 0, this.resolution, this.resolution);
    for(let i=0; i < 6; ++i){
      this.rttFrameBuffer.attach({
        [GL.COLOR_ATTACHMENT0]: [this.rttDiffCubemaps[0], GL.TEXTURE_CUBE_MAP_POSITIVE_X+i],
        [GL.COLOR_ATTACHMENT1]: [this.rttDiffCubemaps[1], GL.TEXTURE_CUBE_MAP_POSITIVE_X+i],
        [GL.COLOR_ATTACHMENT2]: [this.rttDiffCubemaps[2], GL.TEXTURE_CUBE_MAP_POSITIVE_X+i]
      }, {resizeAttachments: false});
      //this.rttFrameBuffer.update({drawBuffers:[GL.COLOR_ATTACHMENT0,GL.COLOR_ATTACHMENT1,GL.COLOR_ATTACHMENT2]});
      this.rttFrameBuffer.bind();
      this.rttFrameBuffer.gl.drawBuffers([GL.COLOR_ATTACHMENT0,GL.COLOR_ATTACHMENT1,GL.COLOR_ATTACHMENT2]);
      
      this.fullscModel.setAttributes({vertexes: this.faceBuffers[i]});
      this.diffSkyboxProgram.setUniforms({offset: pos, offsetScale: this.criticalDelta});
      this.diffSkyboxProgram.draw({
        drawMode: this.fullscModel.getDrawMode(),
        vertexArray: this.fullscModel.vertexArray,
        vertexCount: this.fullscModel.getVertexCount(),
        indexType: this.fullscModel.indexType
      });
      this.rttFrameBuffer.unbind();
    }
    this.setUniforms({uTextureDiffCube0: this.rttDiffCubemaps[0],
      uTextureDiffCube1: this.rttDiffCubemaps[1],
      uTextureDiffCube2: this.rttDiffCubemaps[2]});
  }

  renderAllParts(gl, pos){
    this.renderCubemapDiffs(gl, pos);
    this.renderCubemap(gl, pos);
  }

  renderNewCubemapSlowly(gl, pos){
    let cubemap = this.rttNewCubemap;
    if(this.progress === undefined){
      this.progress = 0;
      this.MAX_PROGRESS = 36;
    }
    //pos = pos.clone().multiply([1,1,-1]);
    gl.viewport(0, 0, this.resolution, this.resolution);
    if(this.progress < this.MAX_PROGRESS && Math.floor(this.progress/6)*6===this.progress){
      console.log(this.progress);
      let i = Math.floor(this.progress/6);
      this.rttFrameBuffer.attach({
        [GL.COLOR_ATTACHMENT0]: [this.rttNewCubemap, GL.TEXTURE_CUBE_MAP_POSITIVE_X+i]
      }, {resizeAttachments: false});
      this.rttFrameBuffer.bind();
      this.fullscModel.setAttributes({vertexes: this.faceBuffers[i]});
      this.fullscModel.setUniforms({offset: pos, offsetScale: this.criticalDelta});
      this.fullscModel.draw();
      this.rttFrameBuffer.unbind();
    }
    this.progress++;
    this.setUniforms({uTextureCube: this.rttCubemap, uTextureCubeNew: this.rttNewCubemap});
  }

  update(gl, pos){
    if(this.oldPos !== undefined){
      let delta = pos.clone().subtract(this.oldPos);
      delta = Math.min(this.criticalDelta, Math.sqrt(delta.dot(delta)));
      if(delta < this.criticalDelta){
        delta/=this.criticalDelta;
        this.setUniforms({diff: delta});
        return;
      }
    }
    //SWAP
    [this.rttCubemap, this.rttNewCubemap] = [this.rttNewCubemap, this.rttCubemap];
    if(this.oldPos === undefined) this.renderCubemap(gl, pos, this.rttCubemap);
    this.renderCubemap(gl, pos, this.rttNewCubemap);
    this.oldPos = pos.clone();
    this.setUniforms({
      uTextureCube: this.rttCubemap, 
      uTextureCubeNew: this.rttNewCubemap, 
      diff: 0.0});
    this.progress = 0;
  }
}

export function generateSimpleCubemapData(gl, resolution, color=[255,255,255]){
  let texture = {};
  let face = 0;
  for(let i = 0; i < 6; i++){
    const textureData = new Uint8Array(resolution*resolution*3);
    let textureIndex = 0;
    for(let x = 0; x < resolution; x++){
      for(let y = 0; y < resolution; y++){
        textureData[textureIndex++] = color[0];
        textureData[textureIndex++] = color[1];
        textureData[textureIndex++] = color[2];
      }
    }
    texture[TextureCube.FACES[face++]] = textureData;
  }
  return texture;
}
export function generateSimpleCubemap(gl, resolution, color=[255,255,255]){
  return new TextureCube(gl, {
    pixels: generateSimpleCubemapData(gl, resolution, color),
    width: resolution, height: resolution,
    format: gl.RGB,
    type: gl.UNSIGNED_BYTE,
    mipmaps: false,
    parameters: {
      [GL.TEXTURE_MAG_FILTER]: GL.LINEAR,
      [GL.TEXTURE_MIN_FILTER]: GL.LINEAR
    },
  });
}