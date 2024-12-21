import { Mesh, MeshNormalMaterial, SphereGeometry } from "three";
import type { DynObject } from "./dyn_object";

export default class TargetBall extends Mesh implements DynObject {
    time = 0;
    constructor(offset = 0) {
        super(new SphereGeometry(2), new MeshNormalMaterial());
        this.time = offset;
    }
    update(delta: number): void {
        this.time += delta;
        this.position.y = 5 * Math.sin(1 * this.time);
        this.position.x = 20 * Math.cos(0.1 * this.time);
        this.position.z = 20 * Math.sin(0.1 * this.time);
    }
}