import GL from '@luma.gl/constants';
import {AnimationLoop, Model, Geometry, CubeGeometry, setParameters, log, TextureCube} from '@luma.gl/core';
import {Matrix4, Vector3, Vector4} from 'math.gl';
import {parse} from '@loaders.gl/core';
// eslint-disable-next-line import/no-unresolved
import {DracoLoader} from '@loaders.gl/draco';
import {addEvents, GLTFScenegraphLoader, createGLTFObjects, GLTFEnvironment} from '@luma.gl/addons';
import { Program } from '@luma.gl/webgl';
import { VERTEX_SHADER, FRAGMENT_SHADER, V_SHADER, F_SHADER, VS_PBR_SHADER, PS_PBR_SHADER } from './shaders';
import { SpaceSkybox } from './spaceSkybox';

const INFO_HTML = `
<p>
  <a href="http://learningwebgl.com/blog/?p=370" target="_blank">
    Some Real 3D Objects
  </a>
<p>
The classic WebGL Lessons in luma.gl
`;

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
  constructor(pos, ang, wfront=new Vector3(0,0,1), wup=new Vector3(0,1,0)){
    this.pos = pos;
    this.ang = ang;
    this.front = new Vector3();
    this.right = new Vector3();
    this.up = new Vector3();
    this.wfront = wfront;
    this.wup = wup;
    this.viewMatrix = new Matrix4();
    this.updateVectors();
  }
  updateVectors(){
    this.viewMatrix = new Matrix4().rotateXYZ(this.ang).transpose();
    this.front = new Vector3(this.viewMatrix.transformDirection(this.wfront));
    this.up = new Vector3(this.viewMatrix.transformDirection(this.wup));
    this.right = this.front.clone().cross(this.up).normalize();
    this.viewMatrix.transpose().translate(this.pos);
  }
  updateCamera(dpos=new Vector3(0), dang=new Vector3(0)){
    this.pos.add(dpos);
    this.ang.add(dang);
    this.updateVectors();
  }
}

async function loadGLTF(url, gl, options) {
  const data = window.fetch(url);
  const {gltf, scenes, animator} = await parse(data, GLTFScenegraphLoader, {
    ...options,
    gl,
    DracoLoader
  }, url);
  
  scenes[0].traverse((node, {worldMatrix}) => log.info(4, 'Using model: ', node)());
  return {scenes, animator, gltf};
}

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
        webgl1: true,
        webgl2: true,
        alpha: false
      }
    });
  }
  onInitialize({canvas, gl}) {
    this.camera = new Camera(new Vector3(), new Vector3());
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

    const SKYBOX_RES = 512;

    this.main_program = new Program(gl, {id:"main_pr", vs: VS_PBR_SHADER, fs: PS_PBR_SHADER, varyings: ['gl_Position']});

    loadGLTF("/resources/space_ranger_sr1/scene.gltf", this.gl, this.loadOptions).then(result =>
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
      skybox: new SpaceSkybox(gl, {}, SKYBOX_RES)
    };
  }
  onRender({gl, tick, aspect, pyramid, cube, skybox, canvas}) {
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    updateCamera(this.camera);

    gl.viewport(0, 0, canvas.width, canvas.height);

    const projection = new Matrix4().perspective({aspect});
    const view = this.camera.viewMatrix;

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

    let success = true;
    if (this.scenes !== undefined)
    this.scenes[0].traverse((model, {worldMatrix}) => {
      // In glTF, meshes and primitives do no have their own matrix.
      model.updateModuleSettings({lightSources: {
        pointLights: [
          {
            color: [255, 0, 0],
            position: this.camera.pos.clone().negate(),
            attenuation: [0, 0, 0.01],
            intensity: 1.0
          }
        ],
        ambientLight: {
          color: [255, 255, 255],
          intensity: 1.0
        }
      }});
      const u_MVPMatrix = new Matrix4(projection).multiplyRight(view).multiplyRight(worldMatrix);
      model.setUniforms({
        u_Camera: this.camera.pos,
        u_MVPMatrix,
        u_PMatrix: projection,
        u_MVMatrix: worldMatrix.clone().multiplyRight(view),
        u_ModelMatrix: worldMatrix,
        u_NormalMatrix: new Matrix4(worldMatrix).invert().transpose(),
      }).draw({
        drawMode: model.model.getDrawMode(),
        vertexCount: model.model.getVertexCount(),
        vertexArray: model.model.vertexArray,
        isIndexed: true,
        indexType: model.model.indexType,
      });
    });

    skybox.update(gl, this.camera.pos);
    skybox.setUniforms({
      uProjection: projection,
      uView: view
    }).draw();
    //skybox.fullscModel.draw();

    return success;
  }
}
const currentlyPressedKeys = {};
function addKeyboardHandler(canvas) {
  addEvents(canvas, {
    onKeyDown(e) {
      currentlyPressedKeys[e.code] = true;
    },
    onKeyUp(e) {
      currentlyPressedKeys[e.code] = false;
    }
  });
}

function addPointerHandler(canvas, camera) {
  let mouseDown = false;
  let currentX = 0;
  let currentY = 0;
  let moveCallback = function(e){
    camera.updateCamera(new Vector3(), new Vector3(e.movementY,e.movementX).scale(0.001));
  }

  document.addEventListener('pointerlockchange', function(e){
    if (canvas === document.pointerLockElement) {
      document.addEventListener("mousemove", moveCallback, false);
    } else {
      document.removeEventListener("mousemove", moveCallback, false);
    }
  }, false);
  canvas.addEventListener('click', function(e){
    if(canvas !== document.pointerLockElement) canvas.requestPointerLock();
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

function updateCamera(camera){
  let dpos = new Vector3(0);
  if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {
    // Left cursor key or A
    dpos.subtract(camera.right);
  } else if (currentlyPressedKeys[39] || currentlyPressedKeys[68]) {
    // Right cursor key or D
    dpos.add(camera.right);
  }
  if (currentlyPressedKeys[38] || currentlyPressedKeys[87]) {
    // Up cursor key or W
    dpos.add(camera.front);
  } else if (currentlyPressedKeys[40] || currentlyPressedKeys[83]) {
    // Down cursor key or S
    dpos.subtract(camera.front);
  }
  if (currentlyPressedKeys[81]) {
    // Q
    dpos.add(camera.up);
  }else if (currentlyPressedKeys[69]) {
    dpos.subtract(camera.up);
  }

  dpos.scale(.1);
  //if(dpos.dot(new Vector3())!==0)
  camera.updateCamera(dpos, new Vector3(0));
}



/* global window */
if (!window.website) {
  const animationLoop = new AppAnimationLoop();
  animationLoop.start();
}