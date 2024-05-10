import type {DynObject} from "./dyn_object";
import {CylinderGeometry, MeshStandardMaterial, Vector3} from "three";
import {Mesh} from "three/src/objects/Mesh";

export interface BallisticOptions {
    startPos: Vector3;
    startVec: Vector3;
    gravity: boolean;
    drag: boolean;
}

const gravity = new Vector3(0, -9.81, 0);
const geo = new CylinderGeometry(0.2, 0.2, 25, 8);
geo.rotateX(Math.PI / 2);
const mat = new MeshStandardMaterial({
    color: "#000000",
    emissive: "#ff0000",
    emissiveIntensity: 1,
});

export class BallisticObject extends Mesh implements DynObject {
    options: BallisticOptions;
    et = 0;

    constructor(props: BallisticOptions) {
        super();
        this.options = props;
        this.geometry = geo.clone();
        this.material = mat.clone();
        // this.add(new Mesh(geo, mat));
    }

    update(delta: number): void {
        this.et += delta;
        const newPos = this.options.startPos.clone()
            .add(this.options.startVec.clone().multiplyScalar(this.et))
            .add(gravity.clone().multiplyScalar(0.5 * this.et * this.et * 9.81));
        // const deltaX = this.position.clone().min(newPos);
        this.lookAt(newPos);
        this.position.copy(newPos);
        this.visible = this.et >= 0;
        if (!this.visible) return;
        if (this.position.y < 0) this.removeFromParent();
    }

    trajectory() {
        const dir = new Vector3(this.options.startVec.x, 0, this.options.startVec.z).normalize();
        const wave = this.options.startVec.clone().multiplyScalar(this.et);
    }
}
