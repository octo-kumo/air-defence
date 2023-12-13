import {PerspectiveCamera} from "three/src/cameras/PerspectiveCamera";
import {Scene} from "three/src/scenes/Scene";
import {WebGLRenderer} from "three/src/renderers/WebGLRenderer";
import {
    ACESFilmicToneMapping,
    Clock,
    CylinderGeometry,
    DirectionalLight,
    FogExp2,
    GridHelper,
    HemisphereLight,
    Material,
    MathUtils,
    MeshLambertMaterial,
    Object3D,
    PlaneGeometry,
    PMREMGenerator,
    RepeatWrapping,
    TextureLoader,
    Vector3
} from "three";
import {EaseInOut, InEaseOut, Linear, Terrain, type TerrainOptions} from "~/games/air-defence/terraints/core";
import {Mesh} from "three/src/objects/Mesh";
import {RES_ROOT} from "~/games/air-defence/config";
import {generateBlendedMaterial} from "~/games/air-defence/terraints/materials";
import {DiamondSquare, Perlin} from "~/games/air-defence/terraints/generator";
import {ScatterHelper, ScatterMeshes} from "~/games/air-defence/terraints/scatter";
import {Sky} from "three/examples/jsm/objects/Sky";
import {ShaderMaterial} from "three/src/Three";
import {Water} from "three/examples/jsm/objects/Water";
import Stats from 'three/examples/jsm/libs/stats.module';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

export class AirDefence {
    lastFrame: number = 0;
    private parent?: HTMLElement;
    private readonly loader: TextureLoader;
    private readonly stats: Stats;
    private readonly scene: Scene;
    private readonly sceneEnv: Scene;
    private readonly renderer: WebGLRenderer;
    private readonly pmremGenerator: PMREMGenerator;
    private readonly clock: Clock;
    private readonly camera: PerspectiveCamera;
    private readonly fpsCamera: PerspectiveCamera;
    private readonly controls: OrbitControls;
    private readonly resize_observer: ResizeObserver;
    private readonly sky: Sky;
    private readonly water: Water;
    private readonly skyLight: DirectionalLight;
    private terrainScene?: Object3D;
    private ratio = 1;
    private readonly options: TerrainOptions;
    private readonly sun: Vector3;

    constructor() {
        const segments = 63, size = 1024;
        this.loader = new TextureLoader();
        this.options = {
            frequency: 0, optimization: 0,
            easing: Linear,
            heightmap: DiamondSquare,
            maxHeight: 100,
            minHeight: -100,
            steps: 1,
            stretch: true,
            turbulent: false,
            xSize: size,
            ySize: Math.round(size * this.ratio),
            xSegments: segments,
            ySegments: Math.round(segments * this.ratio)
        };
        {
            this.stats = new Stats();
            this.stats.dom.style.top = "unset";
            this.stats.dom.style.bottom = "0";
            this.scene = new Scene();
            this.sceneEnv = new Scene();
            this.scene.fog = new FogExp2(0x868293, 0.0007);

            this.renderer = new WebGLRenderer({antialias: true});
            // this.renderer.setAnimationLoop(this.animation.bind(this));
            this.renderer.toneMapping = ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.5;
            this.pmremGenerator = new PMREMGenerator(this.renderer);

            this.camera = new PerspectiveCamera(60, 1, 1, 2000000);
            this.scene.add(this.camera);
            this.camera.position.x = 449;
            this.camera.position.y = 311;
            this.camera.position.z = 376;
            this.camera.rotation.x = -52 * Math.PI / 180;
            this.camera.rotation.y = 35 * Math.PI / 180;
            this.camera.rotation.z = 37 * Math.PI / 180;

            this.clock = new Clock(false);
        }
        {
            this.fpsCamera = new PerspectiveCamera(60, 1, 1, 10000);
            this.scene.add(this.fpsCamera);
            // this.controls = new FirstPersonControls(this.fpsCamera, this.renderer.domElement);
            // this.controls.enabled = true;
            // this.controls.movementSpeed = 100;
            // this.controls.lookSpeed = 0.075;
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            // this.controls.maxPolarAngle = Math.PI * 0.495;
            this.controls.target.set(0, 10, 0);
            this.controls.minDistance = 40.0;
            this.controls.maxDistance = 200.0;
            this.controls.update();
        }
        {
            // this.sky = new Mesh(
            //     new SphereGeometry(100000, 25, 25),
            //     undefined,
            // );
            // this.sky.position.y = -99;
            // this.loader.load(RES_ROOT + "sky.png", (t1) => {
            //     t1.minFilter = LinearFilter;
            //     this.sky.material = new MeshPhongMaterial({map: t1, side: BackSide, fog: false})
            //     this.scene.add(this.sky);
            // });

            this.sky = new Sky();
            this.sun = new Vector3();
            this.skyLight = new DirectionalLight(0xe8bdb0, 5);
            this.sky.scale.setScalar(450000);
            const uniforms = (this.sky.material as ShaderMaterial).uniforms;
            uniforms["turbidity"].value = 10;
            uniforms["rayleigh"].value = 1.443;
            uniforms["mieCoefficient"].value = 0.005;
            uniforms["mieDirectionalG"].value = 0.7;
            this.water = new Water(
                new PlaneGeometry(10000, 10000),
                {
                    textureWidth: 512,
                    textureHeight: 512,
                    waterNormals: this.loader.load(RES_ROOT + 'waternormals.jpg', function (texture) {
                        texture.wrapS = texture.wrapT = RepeatWrapping;
                    }),
                    sunDirection: new Vector3(),
                    sunColor: 0xffffff,
                    waterColor: 0x001e0f,
                    distortionScale: 3.7,
                    fog: this.scene.fog !== undefined
                }
            );
            this.water.rotation.x = -Math.PI / 2;
            this.scene.add(this.sky);
            this.scene.add(this.skyLight);
            this.scene.add(this.water);
            this.scene.add(new HemisphereLight(0x0000ff, 0x00ff00, 0.6));
            // this.sceneEnv.add(this.sky);
            this.updateStage();
            setInterval(this.updateStage.bind(this), 1000);


            const helper = new GridHelper(10000, 2, 0xffffff, 0xffffff);
            this.scene.add(helper);
        }

        {
            this.loader.load(RES_ROOT + 'sand1.jpg', (t1) => {
                t1.wrapS = t1.wrapT = RepeatWrapping;
                // let sand = new Mesh(
                //     new PlaneGeometry(16384 + 1024, 16384 + 1024, 64, 64),
                //     new MeshLambertMaterial({map: t1})
                // );
                // sand.position.y = -101;
                // sand.rotation.x = -0.5 * Math.PI;
                // this.scene.add(sand);
                this.loader.load(RES_ROOT + 'grass1.jpg', (t2) => {
                    this.loader.load(RES_ROOT + 'stone1.jpg', (t3) => {
                        this.loader.load(RES_ROOT + 'snow1.jpg', (t4) => {
                            // t2.repeat.x = t2.repeat.y = 2;
                            this.regenerate(generateBlendedMaterial([
                                {texture: t1},
                                {texture: t2, levels: [-80, -35, 20, 50]},
                                {texture: t3, levels: [20, 50, 60, 85]},
                                {
                                    texture: t4,
                                    glsl: '1.0 - smoothstep(65.0 + smoothstep(-256.0, 256.0, vPosition.x) * 10.0, 80.0, vPosition.z)'
                                },
                                {
                                    texture: t3,
                                    glsl: 'slope > 0.7853981633974483 ? 0.2 : 1.0 - smoothstep(0.47123889803846897, 0.7853981633974483, slope) + 0.2'
                                }, // between 27 and 45 degrees
                            ]));
                        });
                    });
                });
            });
        }
        this.resize_observer = new ResizeObserver(this.on_resize.bind(this));
    }

    attach(parent?: HTMLElement) {
        if (this.parent) {
            this.parent.removeChild(this.stats.dom);
            this.parent.removeChild(this.renderer.domElement);
            this.resize_observer.unobserve(this.parent);
        }
        this.parent = parent;
        if (parent) {
            parent.appendChild(this.stats.dom);
            parent.appendChild(this.renderer.domElement);
            this.resize_observer.observe(parent);
            this.renderer.setPixelRatio(parent.ownerDocument.defaultView?.devicePixelRatio ?? 1);
            parent.ownerDocument.defaultView?.requestAnimationFrame(() => this.animation(Date.now()));
        }
    }

    animation(time: number) {
        this.lastFrame ??= time;
        this.animateStage((time - this.lastFrame) / 1000);
        this.controls.update((time - this.lastFrame) / 1000);
        this.renderer.render(this.scene, this.camera);
        this.lastFrame = time;
        this.stats.update();
        this.parent?.ownerDocument.defaultView?.requestAnimationFrame(() => this.animation(Date.now()));
    }

    regenerate(blend: Material) {
        this.options.material = blend;
        if (this.terrainScene) this.scene.remove(this.terrainScene);
        this.terrainScene = Terrain(this.options);
        this.scene.add(this.terrainScene);
        this.scatterMeshes();
    }

    scatterMeshes() {
        let spread = 60;
        let h = ScatterHelper(Perlin, this.options, 2, 0.125)(),
            hs = InEaseOut(spread * 0.01);
        if (!this.terrainScene) return;
        let geo = (this.terrainScene.children[0] as Mesh).geometry;
        let decoScene = ScatterMeshes(geo, {
            scene: undefined,
            mesh: buildTree(),
            w: this.options.xSegments,
            h: this.options.ySegments,
            spread: function (v, k) {
                let rv = h[k],
                    place = false;
                if (rv < hs) {
                    place = true;
                } else if (rv < hs + 0.2) {
                    place = EaseInOut((rv - hs) * 5) * hs < Math.random();
                }
                return Math.random() < altitudeProbability(v.z) * 5 && place;
            },
            smoothSpread: 0.2,
            maxSlope: 0.6283185307179586, // 36deg or 36 / 180 * Math.PI, about the angle of repose of earth
            maxTilt: 0.15707963267948966 //  9deg or  9 / 180 * Math.PI. Trees grow up regardless of slope but we can allow a small variation
        });
        if (decoScene) {
            this.terrainScene.add(decoScene);
        }
    }

    private on_resize() {
        if (this.parent) {
            this.renderer.setSize(this.parent.clientWidth, this.parent.clientHeight);
            this.camera.aspect = this.parent.clientWidth / this.parent.clientHeight;
            this.camera.updateProjectionMatrix();
            this.fpsCamera.aspect = this.parent.clientWidth / this.parent.clientHeight;
            this.fpsCamera.updateProjectionMatrix();
            // this.controls.handleResize();
        }
    }

    private updateStage() {
        const dayLength = 10 * 60 * 1000;
        const phi = MathUtils.degToRad((Date.now() % dayLength) / dayLength * 180 - 90);
        const theta = MathUtils.degToRad(180);
        this.sun.setFromSphericalCoords(1, phi, theta);
        this.skyLight.position.copy(this.sun);
        this.sky.material.uniforms['sunPosition'].value.copy(this.sun);
        this.water.material.uniforms['sunDirection'].value.copy(this.sun).normalize();
        let renderTarget = this.pmremGenerator.fromScene(this.sceneEnv);
        // this.scene.environment = renderTarget.texture;
    }

    private animateStage(delta: number) {
        this.water.material.uniforms['time'].value += 1.0 / 60.0;
    }
}

function altitudeProbability(z: number, spread = 60) {
    if (z > -80 && z < -50) return EaseInOut((z + 80) / (-50 + 80)) * spread * 0.002;
    else if (z > -50 && z < 20) return spread * 0.002;
    else if (z > 20 && z < 50) return EaseInOut((z - 20) / (50 - 20)) * spread * 0.002;
    return 0;
}

function buildTree() {
    const green = new MeshLambertMaterial({color: 0x2d4c1e});

    const c0 = new Mesh(
        new CylinderGeometry(2, 2, 12, 6, 1, true),
        new MeshLambertMaterial({color: 0x3d2817}) // brown
    );
    c0.position.setY(6);

    const c1 = new Mesh(new CylinderGeometry(0, 10, 14, 8), green);
    c1.position.setY(18);
    const c2 = new Mesh(new CylinderGeometry(0, 9, 13, 8), green);
    c2.position.setY(25);
    const c3 = new Mesh(new CylinderGeometry(0, 8, 12, 8), green);
    c3.position.setY(32);

    let s = new Object3D();
    s.add(c0);
    s.add(c1);
    s.add(c2);
    s.add(c3);
    s.scale.set(5, 1.25, 5);

    return s;
}
