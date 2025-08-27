import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Box3, FogExp2, Mesh, Vector3 } from "three";
import ThreeGame from "../base/baseGame";
import { GroundObject } from "../civilisation-0/ground_object";
import { makeLabel, type DynObject } from "./dyn_object";
import { Turret } from "./gun";
import TargetBall from "./sin_target_ball";
import { Aircraft } from './aircraft';
export class AirDefence extends ThreeGame {
    cssRenderer = new CSS2DRenderer();

    private objects: Set<DynObject> = new Set();
    private hittable: Set<DynObject> = new Set();
    private _hittable: DynObject[] = [];
    turret: Turret;
    aircraft: Aircraft;
    decals: Mesh[] = [];

    showLabels = true;

    constructor() {
        super();
        this.controls.screenSpacePanning = true;
        this.controls.enablePan = true;
        (this.scene.fog as FogExp2).density = 0.001;
        this.resetCamera();
        new GroundObject('c0/tree_palm.glb', new Vector3(-1, 1, -1), 0.2 * Math.PI * 2);
        this.turret = new Turret(this);
        this.turret.position.set(0, 1, 0);
        this.turret.rotate(Math.PI / 2, Math.PI / 4);
        const control = { yaw: 0, pitch: 0 };
        this.gui.add(control, 'yaw', -Math.PI, Math.PI, 0.00001).onChange((v) => {
            this.turret.rotate(v, control.pitch);
        });
        this.gui.add(control, 'pitch', -Math.PI / 2, Math.PI / 2, 0.00001).onChange((v) => {
            this.turret.rotate(control.yaw, v);
        });
        this.gui.add(this.turret, 'isFiring').name('Firing');
        this.gui.add(this, 'resetCamera').name('Reset Camera');
        this.gui.add(this, 'showLabels').name('Show Labels').onChange((v) => {
            this.cssRenderer.domElement.style.display = v ? 'block' : 'none';
        });
        this.addObject(this.turret);
        for (let i = 0; i < 10; i++) {
            const ball = new TargetBall(i * Math.PI);
            ball.name = "Target #" + (i + 1);
            makeLabel(ball, 1);
            this.addObject(ball);
        }
        this.aircraft = new Aircraft(this);
        this.aircraft.position.set(10, 10, 10);
        this.addObject(this.aircraft);

        this.cssRenderer.domElement.style.pointerEvents = 'none';
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0px';
    }

    override update(delta: number) {
        const box = new Box3();
        this.hittable.forEach(h => box.expandByObject(h));
        this.objects.forEach(obj => obj.update(delta, box));
    }

    override updateStats() {
        super.updateStats();
        this.guiStatsEl.textContent += ' D' + this.decals.length + ' O' + this.objects.size;
    }

    addDecal(decal: Mesh) {
        decal.renderOrder = this.decals.length; // give decals a fixed render order
        this.decals.push(decal);

        while (this.decals.length > 500) {
            const d = this.decals.shift();
            d?.parent?.remove(d);
        }
    }

    resetCamera() {
        this.controls.target.set(0, 1, 0);
        this.camera.position.set(2, 2, 2);
    }

    addObject(obj: DynObject) {
        this.objects.add(obj);
        if (obj.hittable) {
            this.hittable.add(obj);
            this._hittable = Array.from(this.hittable);
        }
        this.scene.add(obj);
    }

    removeObject(obj: DynObject) {
        this.objects.delete(obj);
        if (obj.hittable) {
            this.hittable.delete(obj);
            this._hittable = Array.from(this.hittable);
        }
        this.scene.remove(obj);
    }

    get hittables() {
        return this._hittable;
    }

    override attach(parent?: HTMLElement): void {
        super.attach(parent);
        if (parent) parent.appendChild(this.cssRenderer.domElement);
    }

    override render(): void {
        super.render();
        if (this.showLabels) this.cssRenderer.render(this.scene, this.camera);
    }

    override onResize() {
        super.onResize();
        this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
    }
}