import type { DynObject } from "./dyn_object";
import { BatchedMesh, Box3, BufferGeometry, CylinderGeometry, Euler, Matrix3, MeshStandardMaterial, Object3D, Raycaster, Vector3, type Intersection } from "three";
import { Mesh } from "three/src/objects/Mesh";
import type { AirDefence } from "./game";
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

import {
    computeBoundsTree, disposeBoundsTree,
    computeBatchedBoundsTree, disposeBatchedBoundsTree, acceleratedRaycast,
} from 'three-mesh-bvh';

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
BatchedMesh.prototype.raycast = acceleratedRaycast;

export interface BallisticOptions {
    startPos: Vector3;
    startVec: Vector3;
    gravity: boolean;
    drag: boolean;
}

const gravity = new Vector3(0, -9.81, 0);
const geo = new CylinderGeometry(0.02, 0.02, 1, 4);
geo.rotateX(Math.PI / 2);
const mat = new MeshStandardMaterial({
    color: "#000000",
    emissive: "#ff0000",
    emissiveIntensity: 1,
});
const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const decalMaterial = new MeshStandardMaterial({
    color: "#000000",
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: - 4,
    wireframe: false
});
export class BallisticObject extends Mesh implements DynObject {
    hittable = false;
    options: BallisticOptions;
    v = new Vector3();
    et = 0;
    game: AirDefence;
    intersects: Array<Intersection<Mesh>> = [];
    mass = 0.1;

    constructor(props: BallisticOptions, game: AirDefence) {
        super();
        this.game = game;
        this.options = props;
        this.v.copy(props.startVec);
        this.position.copy(props.startPos);
        this.geometry = geo.clone();
        this.material = mat.clone();
    }

    update(delta: number, box?: Box3): void {
        this.et += delta;
        this.visible = this.et >= 0;
        if (this.et < 0) return;
        if (this.et < delta) delta -= this.et;
        const vel = this.v.length();
        if (box?.containsPoint(this.position)) {
            raycaster.far = vel * delta;
            raycaster.set(this.position, this.v);
            if (this.checkIntersection()) return;
        }

        this.v.addScaledVector(gravity, delta);
        const dragForce = 0.5 * 1.225 * 0.01 * drag_cd(vel / 343) * vel * vel / this.mass;

        const accel = this.v.clone().normalize().multiplyScalar(-dragForce).add(gravity);
        this.v.addScaledVector(accel, delta);

        const newp = this.position.clone().addScaledVector(this.v, delta);
        this.lookAt(newp);
        this.position.copy(newp);

        if (!this.visible) return;
        if (this.position.y < 0) {
            this.game.removeObject(this);
        }
    }

    checkIntersection() {
        raycaster.intersectObjects(this.game.hittables, true, this.intersects);

        if (this.intersects.length > 0) {
            const p = this.intersects[0].point;
            const mesh = this.intersects[0].object;
            const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);

            const n = this.intersects[0].face?.normal.clone() || new Vector3();
            const hitAngle = n.angleTo(this.v);

            let _host: Object3D = mesh;
            while (_host.parent && !(_host as DynObject).hittable) _host = _host.parent;
            const host = _host as DynObject;
            const deflectChance = Math.pow(Math.sin(hitAngle), 4);
            if (Math.random() < deflectChance - 0.3) {
                this.v.reflect(n);
                this.v.multiplyScalar(0.2);
                this.position.copy(p.addScaledVector(this.v, 0.01));
            } else {
                if (host.hittable) host.hit?.(this);
                n.applyNormalMatrix(normalMatrix);
                n.multiplyScalar(10);
                n.add(this.intersects[0].point);

                const material = decalMaterial.clone();
                material.color.setHex(Math.random() * 0xffffff);

                const m = new Mesh(new DecalGeometry(mesh, p.clone(), new Euler().setFromVector3(n), new Vector3(0.1, 0.1, 0.1)), material);
                mesh.attach(m);
                this.game.addDecal(m);
                this.game.removeObject(this);
                return true;
            }
        }
        return false;
    }
}

function drag_cd(M: number): number {
    const M_p = 1.3;
    const a = 0.1;
    const b = 3.9;
    const c = 0.217;
    const d = 10;
    const e = 2.5;
    const f = -10;
    const g = 5.6;

    return a * Math.exp(-b * M) + (c / (1 + d * Math.pow(M - M_p, 2))) + (e / (Math.pow(M, f) + g));
}