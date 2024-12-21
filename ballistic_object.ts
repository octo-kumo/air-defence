import type { DynObject } from "./dyn_object";
import { CylinderGeometry, Euler, Matrix3, MeshPhongMaterial, MeshStandardMaterial, Raycaster, Vector3, type Intersection } from "three";
import { Mesh } from "three/src/objects/Mesh";
import type { AirDefence } from "./game";
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export interface BallisticOptions {
    startPos: Vector3;
    startVec: Vector3;
    gravity: boolean;
    drag: boolean;
}

const gravity = new Vector3(0, -9.81, 0);
const geo = new CylinderGeometry(0.02, 0.02, 0.3, 4);
geo.rotateX(Math.PI / 2);
const mat = new MeshStandardMaterial({
    color: "#000000",
    emissive: "#ff0000",
    emissiveIntensity: 1,
});
const raycaster = new Raycaster();

const decalMaterial = new MeshPhongMaterial({
    specular: 0x444444,
    shininess: 30,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: - 4,
    wireframe: false
});
export class BallisticObject extends Mesh implements DynObject {
    options: BallisticOptions;
    et = 0;
    game: AirDefence;
    intersects: Array<Intersection<Mesh>> = [];

    constructor(props: BallisticOptions, game: AirDefence) {
        super();
        this.game = game;
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
        const diff = newPos.clone().sub(this.position);
        raycaster.far = diff.length();
        raycaster.set(this.position, diff.normalize());
        if (this.checkIntersection()) return;
        this.lookAt(newPos);
        this.position.copy(newPos);
        this.visible = this.et >= 0;
        if (!this.visible) return;
        if (this.position.y < 0) {
            this.removeFromParent();
            this.game.objects.delete(this);
        }
    }

    trajectory() {
        const dir = new Vector3(this.options.startVec.x, 0, this.options.startVec.z).normalize();
        const wave = this.options.startVec.clone().multiplyScalar(this.et);
    }

    checkIntersection() {
        raycaster.intersectObjects(this.game.hittables, true, this.intersects);

        if (this.intersects.length > 0) {
            const p = this.intersects[0].point;
            const mesh = this.intersects[0].object;
            const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);

            const n = this.intersects[0].face?.normal.clone() || new Vector3();
            n.applyNormalMatrix(normalMatrix);
            n.multiplyScalar(10);
            n.add(this.intersects[0].point);

            const material = decalMaterial.clone();
            material.color.setHex(Math.random() * 0xffffff);

            const m = new Mesh(new DecalGeometry(mesh, p.clone(), new Euler().setFromVector3(n), new Vector3(0.1, 0.1, 0.1)), decalMaterial);
            mesh.attach(m);

            this.game.addDecal(m);

            this.removeFromParent();
            this.game.objects.delete(this);
            return true;
        }

    }
}
