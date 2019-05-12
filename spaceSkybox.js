import { perlin, lerp, shuffle, range } from './perlin';
import { Vector3 } from 'math.gl';
import { TextureCube, Framebuffer, Renderbuffer, Texture2D, Buffer } from '@luma.gl/core';
import { Model, CubeGeometry, Geometry } from '@luma.gl/core';
import GL from '@luma.gl/constants';

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
    const vs = `\
attribute vec3 positions;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
varying vec3 vPosition;
void main(void) {
  gl_Position = uProjection * mat4(mat3(uView)) * vec4(positions, 1.0);
  gl_Position = gl_Position.xyww;
  //gl_Position = vec4(positions.xy, 1.0, 1.0);
  vPosition = positions;
}
`;
    const fs = `\
precision highp float;
uniform samplerCube uTextureCube;
varying vec3 vPosition;
void main(void) {
  // The outer cube just samples the texture cube directly
  gl_FragColor = textureCube(uTextureCube, normalize(vPosition) * vec3(-1.0, 1.0, 1.0));
  //gl_FragColor = vec4(normalize(vPosition), 1.0);
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

const SPACE_SKYBOX_GEN_FS = 
`#version 300 es
precision highp float;
in vec3 vPosition;
out vec4 fragColor;
void main(void) {
  fragColor = vec4(normalize(vPosition),1.0);
  //fragColor = vec4(1.0);
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
      data: rttCubemapData,
      width: resolution, height: resolution,
      format: gl.RGB,
      type: gl.UNSIGNED_BYTE,
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
    this.rttFrameBuffer.attach({
      [GL.COLOR_ATTACHMENT0]: [this.rttCubemap, GL.TEXTURE_CUBE_MAP_POSITIVE_X],
      [GL.DEPTH_ATTACHMENT]: this.renderbuffer
    });

    this.faceBuffers = new Array(6);
    for(let i=0; i < 6; ++i){
      //this.faceBuffers[i] = new Buffer(gl, {data: this.geometryBuffers.positions[0].slice(0+i*3*4,(i+1)*3*4)});
      //const arr = this.geometryBuffers.positions[0].getData({srcByteOffset: 0+i*3*4, length: 3*4});
      this.faceBuffers[i] = new Buffer(gl, BOX_PLANES[i]);
    }
    this.fullscModel = new Model(gl, {attributes: {positions: new Buffer(gl, FULLSC_GEOMETRY), vertexes: this.faceBuffers[0]}, vertexCount: 4, drawMode: gl.TRIANGLE_FAN, vs: SPACE_SKYBOX_GEN_VS, fs: SPACE_SKYBOX_GEN_FS});
  }

  renderCubemap(gl, pos) {
    gl.viewport(0, 0, this.resolution, this.resolution);
    for(let i=0; i < 6; ++i){
      this.rttFrameBuffer.attach({
        [GL.COLOR_ATTACHMENT0]: [this.rttCubemap, GL.TEXTURE_CUBE_MAP_POSITIVE_X+i],
        [GL.DEPTH_ATTACHMENT]: this.renderbuffer
      });
      this.rttFrameBuffer.bind();
      this.fullscModel.setAttributes({vertexes: this.faceBuffers[i]});
      this.fullscModel.draw();
      this.rttFrameBuffer.unbind();
    }
    this.setUniforms({uTextureCube: this.rttCubemap});
  }
}

export function renderSpaceSkybox(cubemap){

}