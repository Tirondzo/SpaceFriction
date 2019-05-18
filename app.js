import GL from '@luma.gl/constants';
import {AnimationLoop, Model, Geometry, CubeGeometry, setParameters, log, 
  Texture2D, TextureCube, loadImage, Framebuffer, clear} from '@luma.gl/core';
import {Matrix4, Vector3, Vector4, Quaternion} from 'math.gl';
import {parse} from '@loaders.gl/core';
// eslint-disable-next-line import/no-unresolved
import {DracoLoader} from '@loaders.gl/draco';
import {addEvents, GLTFScenegraphLoader, createGLTFObjects, GLTFEnvironment} from '@luma.gl/addons';
import { Program, FragmentShader, VertexShader } from '@luma.gl/webgl';
import { VERTEX_SHADER, FRAGMENT_SHADER, SHADOWMAP_VERTEX, SHADOWMAP_FRAGMENT, 
  PBR_VS_WITH_SHADOWMAP, PBR_FS_WITH_SHADOWMAP } from './shaders';
import { SpaceSkybox, generateSimpleCubemap } from './spaceSkybox';
import * as KeyCode from 'keycode-js';

const INFO_HTML = `
<p>
  <a href="http://learningwebgl.com/blog/?p=370" target="_blank">
    Some Real 3D Objects
  </a>
<p>
The classic WebGL Lessons in luma.gl
`;

const CONTROLS = {
  MOVE_FWD: KeyCode.KEY_W,
  MOVE_LEFT: KeyCode.KEY_A,
  MOVE_BACK: KeyCode.KEY_S,
  MOVE_RIGHT: KeyCode.KEY_D,
  ROLL_LEFT: KeyCode.KEY_Q,
  ROLL_RIGHT: KeyCode.KEY_E,
  MOVE_DOWN: KeyCode.KEY_C,
  MOVE_UP: KeyCode.KEY_Z,
  RESET_CAMERA: KeyCode.KEY_X,
  TARGET_VIEW: KeyCode.KEY_V,
  TARGET_LIGHT: KeyCode.KEY_L,
  DEBUG_BASIS: KeyCode.KEY_P,
  MOVE_FAST: KeyCode.KEY_SHIFT
}

Matrix4.prototype.removeTranslate = function(){
  let m = this;
  m[3]=m[7]=m[11]=m[12]=m[13]=m[14]=0;
  return m;
}

// Makes a colored pyramid
class ColoredPyramidGeometry extends Geometry {
  constructor(props) {
    super({
      ...props,
      attributes: {
        /* eslint-disable indent, no-multi-spaces */

        // prettier-ignore
        positions: new Float32Array([
          0,  1,  0,
          -1, -1,  1,
          1, -1,  1,
          0,  1,  0,
          1, -1,  1,
          1, -1, -1,
          0,  1,  0,
          1, -1, -1,
          -1, -1, -1,
          0,  1,  0,
          -1, -1, -1,
          -1, -1,  1
        ]),
        colors: {
          size: 4,
          // prettier-ignore
          value: new Float32Array([
            1, 0, 0, 1,
            0, 1, 0, 1,
            0, 0, 1, 1,
            1, 0, 0, 1,
            0, 0, 1, 1,
            0, 1, 0, 1,
            1, 0, 0, 1,
            0, 1, 0, 1,
            0, 0, 1, 1,
            1, 0, 0, 1,
            0, 0, 1, 1,
            0, 1, 0, 1
          ])
        }
      }
    });
  }
}

// Make a colored cube
class ColoredCubeGeometry extends CubeGeometry {
  constructor(props) {
    super({
      ...props,
      // Add one attribute to the geometry
      attributes: {
        colors: {
          size: 4,
          // prettier-ignore
          value: new Float32Array([
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 1, 0, 1,
            1, 1, 0, 1,
            1, 1, 0, 1,
            1, 1, 0, 1,
            0, 1, 0, 1,
            0, 1, 0, 1,
            0, 1, 0, 1,
            0, 1, 0, 1,
            1, 0.5, 0.5, 1,
            1, 0.5, 0.5, 1,
            1, 0.5, 0.5, 1,
            1, 0.5, 0.5, 1,
            1, 0, 1, 1,
            1, 0, 1, 1,
            1, 0, 1, 1,
            1, 0, 1, 1,
            0, 0, 1, 1,
            0, 0, 1, 1,
            0, 0, 1, 1,
            0, 0, 1, 1
          ])
        }
      }
    });
  }
}

class Camera{
  constructor(pos, wfront=new Vector3(0,0,-1), wup=new Vector3(0,1,0)){
    this.pos = pos;
    this.front = new Vector3();
    this.right = new Vector3();
    this.up = new Vector3();
    this.wfront = wfront;
    this.wup = wup;
    this.viewMatrix = new Matrix4();
    this.updateVectors();
  }
  updateVectors(transpose=true){
    //YXZ Is nice solution when camera pitch is limited
    //this.viewMatrix = new Matrix4().rotateY(this.ang[1]).rotateX(this.ang[0]).rotateZ(this.ang[2]);

    this.front.copy(this.wfront);
    this.up.copy(this.wup);
    this.right.copy(this.front);
    this.right = this.right.cross(this.up);
    //this.viewMatrix = new Matrix4().lookAt({eye:[0,0,0],center:this.front,up:this.up});
    this.viewMatrix.setColumnMajor(this.right[0],this.right[1],this.right[2],0,
                                  this.up[0],this.up[1],this.up[2],0,
                                  -this.front[0],-this.front[1],-this.front[2],0,
                                  0,0,0,1);
    if(!transpose) this.viewMatrix = new Matrix4().translate(this.pos).multiplyRight(this.viewMatrix);
    else this.viewMatrix.transpose().translate(this.pos);
  }
  updateCamera(dpos=new Vector3(0), dang=new Vector3(0), transpose=true){
    this.pos.add(dpos);
    let quat = new Quaternion().setAxisAngle(this.up, dang[0])
      .multiply(new Quaternion().setAxisAngle(this.right, dang[1]))
      .multiply(new Quaternion().setAxisAngle(this.front, dang[2]));
    
    this.applyQuaternion(quat);
    this.updateVectors(transpose);
  }
  applyQuaternion(quat){
    let u = new Vector3(quat);
    let s = quat.w; let ss = quat.w*quat.w;
    let uv = u.dot(this.wfront);
    let uu = u.dot(u);
    let cuv = u.clone().cross(this.wfront);
    this.wfront = this.wfront.scale(ss - uu).add(u.clone().scale(2*uv)).add(cuv.scale(2*s));
    uv = u.dot(this.wup);
    cuv = u.clone().cross(this.wup);
    this.wup = this.wup.scale(ss - uu).add(u.clone().scale(2*uv)).add(cuv.scale(2*s));
  }
}

async function loadGLTF(url, gl, options) {
  const data = window.fetch(url);
  const {gltf, scenes, animator} = await parse(data, GLTFScenegraphLoader, {
    ...options,
    gl,
    DracoLoader
  }, url);
  
  scenes[0].traverse((node, {worldMatrix}) => {
    log.info(4, 'Using model: ', node);
    if (options.pbrShadowProgram){
      options.pbrShadowProgram.setUniforms(node.model.program.uniforms);
    }
    //node.model.props.defines["USE_TEX_LOD"] = 0;
    //node.model.program = node.model._createProgram(node.props);
    //node.model.program.fs = new FragmentShader(gl, node.model.program.fs.source.replace("USE_TEX_LOD 1", "USE_TEX_LOD 0"));
  });
  return {scenes, animator, gltf};
}

const SHIP_DELTA = new Vector3([0,0,-15]);
export default class AppAnimationLoop extends AnimationLoop {
  // .context(() => createGLContext({canvas: 'lesson04-canvas'}))
  static getInfo() {
    return INFO_HTML;
  }
  constructor(opts = {}) {
    super({
      ...opts,
      glOptions: {
        // alpha causes issues with some glTF demos
        webgl1: false,
        webgl2: true,
        alpha: false
      }
    });
  }
  onInitialize({canvas, gl}) {
    this.camera = new Camera(new Vector3());
    this.ship = new Camera(new Vector3());
    this.loadOptions = {
      pbrDebug: true,
      imageBasedLightingEnvironment: null,
      lights: true
    };
    addKeyboardHandler(canvas);
    addPointerHandler(canvas, this.camera);
    setParameters(gl, {
      clearColor: [0.2, 0.2, 0.2, 1],
      clearDepth: 1,
      depthTest: true,
      depthFunc: GL.LEQUAL
    });

    const SKYBOX_RES = 1024;
    let skybox = new SpaceSkybox(gl, {}, SKYBOX_RES);

    //make environment
    this.BrdfTexture = new Texture2D(this.gl, {
      id: 'brdfLUT',
      parameters: {
        [GL.TEXTURE_WRAP_S]: GL.CLAMP_TO_EDGE,
        [GL.TEXTURE_WRAP_T]: GL.CLAMP_TO_EDGE,
        [GL.TEXTURE_MIN_FILTER]: GL.LINEAR,
        [GL.TEXTURE_MAG_FILTER]: GL.LINEAR
      },
      pixelStore: {
        [this.gl.UNPACK_FLIP_Y_WEBGL]: false
      },
      // Texture2D accepts a promise that returns an image as data (Async Textures)
      data: loadImage('/resources/brdfLUT.png')
    });
    this.DiffuseEnvSampler = generateSimpleCubemap(gl, 16, [127,127,255]);
    this.SpecularEnvSampler = skybox.rttCubemap;
    let environment = {
      getDiffuseEnvSampler: x=>this.DiffuseEnvSampler,
      getSpecularEnvSampler: x=>this.SpecularEnvSampler,
      getBrdfTexture: x=>this.BrdfTexture
    }
    this.loadOptions.imageBasedLightingEnvironment = environment;

    const CUBE_FACE_TO_DIRECTION = {
      [GL.TEXTURE_CUBE_MAP_POSITIVE_X]: 'right',
      [GL.TEXTURE_CUBE_MAP_NEGATIVE_X]: 'left',
      [GL.TEXTURE_CUBE_MAP_POSITIVE_Y]: 'top',
      [GL.TEXTURE_CUBE_MAP_NEGATIVE_Y]: 'bottom',
      [GL.TEXTURE_CUBE_MAP_POSITIVE_Z]: 'front',
      [GL.TEXTURE_CUBE_MAP_NEGATIVE_Z]: 'back'
    };
    const SITE_LINK = 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/luma.gl/examples/gltf/';
    this.environment = new GLTFEnvironment(gl, {
      brdfLutUrl: `${SITE_LINK}/brdfLUT.png`,
      getTexUrl: (type, dir, mipLevel) =>
        `${SITE_LINK}/papermill/${type}/${type}_${CUBE_FACE_TO_DIRECTION[dir]}_${mipLevel}.jpg`
    });
    //this.environment._SpecularEnvSampler = skybox.rttCubemap;
    //this.environment._DiffuseEnvSampler = this.DiffuseEnvSampler;
    this.loadOptions.imageBasedLightingEnvironment = this.environment;
    this.shadowProgram = new Program(gl, {vs: SHADOWMAP_VERTEX, fs:SHADOWMAP_FRAGMENT});
    this.pbrShadowProgram = new Program(gl, {vs: PBR_VS_WITH_SHADOWMAP, fs:PBR_FS_WITH_SHADOWMAP});
    this.loadOptions.pbrShadowProgram = this.pbrShadowProgram;
    loadGLTF("/resources/45-e/scene.gltf", this.gl, this.loadOptions).then(result =>
      Object.assign(this, result)
    );
    
    this.test = true;
    return {
      pyramid: new Model(gl, {
        vs: VERTEX_SHADER,
        fs: FRAGMENT_SHADER,
        geometry: new ColoredPyramidGeometry()
      }),
      cube: new Model(gl, {
        vs: VERTEX_SHADER,
        fs: FRAGMENT_SHADER,
        geometry: new ColoredCubeGeometry()
      }),
      fbShadow: new Framebuffer(gl, {id: 'shadowmap', width: 1024, height: 1024}),
      skybox: skybox
    };
  }
  onRender({gl, tick, aspect, pyramid, cube, skybox, fbShadow, canvas}) {
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    this.lastTick = this.lastTick ? this.lastTick : tick;
    const deltaTick = (tick - this.lastTick);
    this.lastTick = tick;

    updateCamera(this.camera, this.ship, deltaTick);

    const projection = new Matrix4().perspective({aspect});
    let ship_view_trans = this.ship.viewMatrix.clone();
    /*ship_view_trans.removeTranslate();
    const ship_delta = ship_view_trans.transformDirection(SHIP_DELTA);
    let view = triggers.freeCamera ? this.camera.viewMatrix.clone() : ship_view_trans;
    let view_pos = triggers.freeCamera ? this.camera.pos.clone() : ship_delta.clone();
    if(!triggers.freeCamera){
      //const rotateMatrix = new Matrix4().rotateAxis(this.camera.ang[0],this.ship.right).rotateAxis(this.camera.ang[1],this.ship.up);
      //view.translate(view_pos).multiplyRight(rotateMatrix);
      //view_pos = rotateMatrix.transpose().transformPoint(view_pos);
      view_pos.add(this.ship.pos);
      //this.camera.pos = view_pos;
      //view.removeTranslate().translate(view_pos.clone().negate());

      
    }
    ship_view_trans.translate(this.ship.pos.clone().negate());*/
    let view_pos = this.camera.pos;
    let view = this.camera.viewMatrix;
    if(!triggers.freeCamera || triggers.backToFreeCam){
      view = this.ship.viewMatrix.clone().removeTranslate().transpose();
      const vmat = new Matrix4().translate(SHIP_DELTA).multiplyRight(this.camera.viewMatrix.clone().removeTranslate());
      view.multiplyLeft(vmat);
      view.translate(this.ship.pos.clone().negate());
      view_pos = this.ship.pos;
    }
    if(triggers.backToFreeCam){
      triggers.backToFreeCam = false;

      view.invert();
      this.camera.pos = new Vector3(view[12], view[13], view[14]).negate();
      this.camera.wup = new Vector3(view[4], view[5], view[6]);
      this.camera.wfront = new Vector3(-view[8], -view[9], -view[10]);
      
      this.camera.updateVectors();
      view = this.camera.viewMatrix;
    }

    const engineLightDelta = [0,-0.28,-6.7];
    this.engineLight = ship_view_trans.transformDirection(engineLightDelta);
    this.engineView = this.ship.viewMatrix.clone().removeTranslate().translate(this.engineLight);
    this.engineLight.negate();
    const shadowProj = new Matrix4().ortho({
      left: -4,
      right: 4,
      bottom: -4,
      top: 4,
      near: 0,
      far: 64
    });

    gl.viewport(0,0,fbShadow.width,fbShadow.height);
    clear(gl, {framebuffer: fbShadow, color: [1, 1, 1, 1], depth: true});
    //gl.cullFace(GL.BACK);
    //gl.enable(GL.CULL_FACE);
    if (this.scenes !== undefined)
    this.scenes[0].traverse((model, {worldMatrix}) => {
      //if(model.id !== "mesh--primitive-0") return;
      // In glTF, meshes and primitives do no have their own matrix.

      const u_MVPMatrix = new Matrix4(shadowProj).multiplyRight(this.engineView).multiplyRight(ship_view_trans).multiplyRight(worldMatrix);
      let old_program = model.model.program;
      model.model.program = this.shadowProgram;
      model.setUniforms({
        u_MVPMatrix
      }).draw({
        framebuffer: fbShadow,
        drawMode: model.model.getDrawMode(),
        vertexCount: model.model.getVertexCount(),
        vertexArray: model.model.vertexArray,
        isIndexed: true,
        indexType: model.model.indexType,
      });
      model.model.program = old_program;
    });
    gl.viewport(0,0,canvas.width,canvas.height);

    pyramid
    .setUniforms({
      uPMatrix: projection,
      uMVMatrix: view
      .clone()
      .translate([-1.5, 0, -8])
      .rotateY(tick * 0.01)
    })
    .draw();

    const phi = tick * 0.01;
    cube
    .setUniforms({
      uPMatrix: projection,
      uMVMatrix: view
      .clone()
      .translate([1.5, 0, -8])
      .rotateXYZ([phi, phi, phi])
    })
    .draw();

    if(triggers.debugBasis)
    for(const vec of [this.ship.front,this.ship.up,this.ship.right]){
      cube
      .setUniforms({
        uPMatrix: projection,
        uMVMatrix: view.clone().multiplyRight(new Matrix4().translate(vec.clone().scale(3)))
                                .multiplyRight(this.ship.viewMatrix.clone().scale(.3))
        .clone()
      }).draw();
    }

    let success = true;
    if (this.scenes !== undefined)
    this.scenes[0].traverse((model, {worldMatrix}) => {
      // In glTF, meshes and primitives do no have their own matrix.
      let pointLights = [];
      pointLights.push({
        color: [255*.2, 255*.5, 255*.8],
        position: this.engineLight,
        attenuation: [0, 0, 0.01],
        intensity: 1.0
      });
      if(triggers.cameraLight) pointLights.push({
        color: [255, 0, 0],
        position: view_pos,
        attenuation: [0, 0, 0.01],
        intensity: 1.0
      });

      model.updateModuleSettings({lightSources: {
        pointLights: pointLights,
        ambientLight: {
          color: [255*.2, 255*.5, 255*.8],
          intensity: 1.0
        }
      }});
      const u_MSVSPMatirx = new Matrix4(shadowProj).multiplyRight(this.engineView).multiplyRight(ship_view_trans);
      const u_MVPMatrix = new Matrix4(projection).multiplyRight(view).multiplyRight(ship_view_trans);
      let old_program = model.model.program;
      if(model.id === "Cube.021_0-primitive-0") model.model.program = this.pbrShadowProgram;
      this.pbrShadowProgram.setUniforms(old_program.uniforms);
      /*model.setUniforms({
        u_Camera: view_pos,
        u_MVPMatrix, u_MSVSPMatirx,
        u_ShadowMap: fbShadow,
        u_ModelMatrix: this.ship.viewMatrix.clone().transpose(),
        u_NormalMatrix: ship_view_trans.clone().removeTranslate().invert().transpose(),
        u_SpecularEnvSampler: skybox.rttCubemap,
        u_ScaleIBLAmbient: [1, 5]
      }).draw({
        drawMode: model.model.getDrawMode(),
        vertexCount: model.model.getVertexCount(),
        vertexArray: model.model.vertexArray,
        isIndexed: true,
        indexType: model.model.indexType
      });*/
      model.model.program = old_program;
    });

    skybox.update(gl, view_pos);
    gl.viewport(0, 0, canvas.width, canvas.height);
    skybox.setUniforms({
      uProjection: projection,
      uView: view
    }).draw();
    //skybox.fullscModel.draw();

    return success;
  }
}
const triggers = {};
const currentlyPressedKeys = {};
function addKeyboardHandler(canvas) {
  addEvents(canvas, {
    onKeyDown(e) {
      currentlyPressedKeys[e.code] = true;
    },
    onKeyUp(e) {
      currentlyPressedKeys[e.code] = false;
      if(e.code === CONTROLS.TARGET_LIGHT) triggers.cameraLight = !triggers.cameraLight;
      if(e.code === CONTROLS.TARGET_VIEW) triggers.freeCamera = !triggers.freeCamera;
      if(e.code === CONTROLS.DEBUG_BASIS) triggers.debugBasis = !triggers.debugBasis;

      if(e.code === CONTROLS.TARGET_VIEW && triggers.freeCamera) triggers.backToFreeCam = true;
    }
  });
}

function addPointerHandler(canvas, camera) {
  let mouseDown = false;
  let currentX = 0;
  let currentY = 0;
  let moveCallback = function(e){
    camera.updateCamera(new Vector3(), new Vector3(-e.movementX,-e.movementY).scale(0.001));
  }

  document.addEventListener('pointerlockchange', function(e){
    if (canvas === document.pointerLockElement) {
      document.addEventListener("mousemove", moveCallback, false);
    } else {
      document.removeEventListener("mousemove", moveCallback, false);
    }
  }, false);
  canvas.addEventListener('click', function(e){
    if(canvas !== document.pointerLockElement){ 
      canvas.requestPointerLock();
      canvas.requestFullscreen();
    }
    else document.exitPointerLock();
  }, false);
  addEvents(canvas, {
    onDragStart: function(e){ currentX=e.x; currentY=e.y; },
    onDragMove: function(e){
      if(canvas !== document.pointerLockElement) pointerPos(e.x, e.y);
    },
  });

  let pointerPos = function(x, y){
    const dx = x - currentX;
    const dy = y - currentY;
    camera.updateCamera(new Vector3(), new Vector3(dy,dx).scale(0.001));
    currentX = x;
    currentY = y;
  }
}

function updateCamera(camera, ship, tick){
  let dpos = new Vector3(0);
  let kdpos = new Vector3(0);
  let roll = 0;
  let k = tick*.1;
  if (currentlyPressedKeys[CONTROLS.MOVE_LEFT]) {
    dpos.subtract(camera.right);
    kdpos.subtract([1,0,0]);
  } else if (currentlyPressedKeys[CONTROLS.MOVE_RIGHT]) {
    dpos.add(camera.right);
    kdpos.add([1,0,0]);
  }
  if (currentlyPressedKeys[CONTROLS.MOVE_FWD]) {
    dpos.add(camera.front);
    kdpos.add([0,0,-1]);
  } else if (currentlyPressedKeys[CONTROLS.MOVE_BACK]) {
    dpos.subtract(camera.front);
    kdpos.subtract([0,0,-1]);
  }
  if (currentlyPressedKeys[CONTROLS.MOVE_UP]) {
    dpos.add(camera.up);
    kdpos.add([0,1,0]);
  }else if (currentlyPressedKeys[CONTROLS.MOVE_DOWN]) {
    dpos.subtract(camera.up);
    kdpos.subtract([0,1,0]);
  }
  if (currentlyPressedKeys[CONTROLS.ROLL_LEFT]) {
    roll -= .25;
  }else if (currentlyPressedKeys[CONTROLS.ROLL_RIGHT]) {
    roll += .25;
  }
  if (currentlyPressedKeys[CONTROLS.RESET_CAMERA]){
    camera.applyQuaternion(new Quaternion().slerp({target: new Quaternion().rotationTo(camera.up, [0,1,0]), ratio: Math.min(1.0, k)}));
    camera.updateVectors();
  }

  if (currentlyPressedKeys[CONTROLS.MOVE_FAST]) k *= 3;

  if(!triggers.freeCamera){
    k *= .5;
    ship.updateCamera(ship.front.clone().scale(-kdpos[2]*k), new Vector3(-kdpos[0]*k*.25,kdpos[1]*k*.25,roll*k), false);
  }
  if(triggers.freeCamera)
    camera.updateCamera(dpos.negate().scale(k), new Vector3(0,0,roll*k));
}



/* global window */
if (!window.website) {
  const animationLoop = new AppAnimationLoop();
  animationLoop.start();
}