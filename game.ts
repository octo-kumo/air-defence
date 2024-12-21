import { Mesh, Vector3 } from "three";
import ThreeGame from "../base/baseGame";
import { GroundObject } from "../civilisation-0/ground_object";
import type { DynObject } from "./dyn_object";
import { Gun } from "./gun";
import TargetBall from "./sin_target_ball";
export class AirDefence extends ThreeGame {
    objects: Set<DynObject> = new Set();
    gun: Gun;
    decals: Mesh[] = [];
    hittables: Mesh[] = []

    constructor() {
        super();
        this.controls.screenSpacePanning = true;
        this.controls.enablePan = true;
        this.resetCamera();

        new GroundObject('c0/tree_palm.glb', new Vector3(-1, 1, -1), 0.2 * Math.PI * 2);
        this.gun = new Gun(this);
        this.gun.position.set(0, 1, 0);
        this.scene.add(this.gun);
        this.gun.rotate(Math.PI / 2, Math.PI / 4);
        const control = { yaw: 0, pitch: 0 };
        this.gui.add(control, 'yaw', -Math.PI, Math.PI, 0.00001).onChange((v) => {
            this.gun.rotate(v, control.pitch);
        });
        this.gui.add(control, 'pitch', -Math.PI / 2, Math.PI / 2, 0.00001).onChange((v) => {
            this.gun.rotate(control.yaw, v);
        });
        this.gui.add(this.gun, 'isFiring').name('Firing');
        this.gui.add(this, 'resetCamera').name('Reset Camera');
        this.objects.add(this.gun);
        for (let i = 0; i < 10; i++) {
            const ball = new TargetBall(i * Math.PI);
            this.scene.add(ball);
            this.hittables.push(ball);
            this.objects.add(ball);
        }
    }

    override update(delta: number) {
        this.objects.forEach(obj => obj.update(delta));
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
}