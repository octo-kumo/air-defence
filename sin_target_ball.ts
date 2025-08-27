import { Mesh, MeshPhongMaterial, SphereGeometry } from "three";
import type { DynObject } from "./dyn_object";

export default class TargetBall extends Mesh implements DynObject {
    time = 0;
    hittable = true;
    constructor(offset = 0) {
        super(new SphereGeometry(2), new MeshPhongMaterial({
        }));
        this.castShadow = true;
        this.receiveShadow = true;
        this.time = offset;
    }
    update(delta: number): void {
        this.time += delta;
        this.position.y = 5 * Math.sin(1 * this.time);
        this.position.x = 10 * Math.cos(0.2 * this.time);
        this.position.z = 10 * Math.sin(0.2 * this.time);
    }
}