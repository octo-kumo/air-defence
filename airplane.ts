import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {RES_ROOT} from "./config";
import {Group, Matrix4, Quaternion, Vector3} from "three";
import type {DynObject} from "./dyn_object";
import type {Mesh} from "three/src/objects/Mesh";
import {updatePlaneAxis} from "~/games/air-defence/controls";
import type {PerspectiveCamera} from "three/src/cameras/PerspectiveCamera";

const loader = new GLTFLoader();

export class Airplane extends Group implements DynObject {
    x = new Vector3(1, 0, 0);
    y = new Vector3(0, 1, 0);
    z = new Vector3(0, 0, 1);
    private parts: { supports?: Mesh, chassis?: Mesh, helix?: Mesh } = {};
    private readonly camera: PerspectiveCamera;

    constructor(camera: PerspectiveCamera) {
        super();
        this.camera = camera;
        this.camera.position.set(0, 10, 10);
        loader.load(RES_ROOT + 'airplane.glb', (gltf) => {
            [this.parts.supports, this.parts.chassis, this.parts.helix] = gltf.scene.children as Mesh[];
            gltf.scene.rotation.y = Math.PI;
            this.add(gltf.scene);
            console.log(gltf);
        });
    }

    delayedRotMatrix = new Matrix4();
    delayedQuaternion = new Quaternion();

    update(delta: number): void {
        updatePlaneAxis(this.x, this.y, this.z, this.position, this.camera, delta);

        const rotMatrix = new Matrix4().makeBasis(this.x, this.y, this.z);

        const matrix = new Matrix4()
            .multiply(new Matrix4().makeTranslation(this.position.x, this.position.y, this.position.z))
            .multiply(rotMatrix);

        this.matrixAutoUpdate = false;
        this.matrix.copy(matrix);
        this.matrixWorldNeedsUpdate = true;


        var quaternionA = new Quaternion().copy(this.delayedQuaternion);

        // warning! setting the quaternion from the rotation matrix will cause
        // issues that resemble gimbal locks, instead, always use the quaternion notation
        // throughout the slerping phase
        // quaternionA.setFromRotationMatrix(this.delayedRotMatrix);

        var quaternionB = new Quaternion();
        quaternionB.setFromRotationMatrix(rotMatrix);

        var interpolationFactor = 0.175;
        var interpolatedQuaternion = new Quaternion().copy(quaternionA);
        interpolatedQuaternion.slerp(quaternionB, interpolationFactor);
        this.delayedQuaternion.copy(interpolatedQuaternion);

        this.delayedRotMatrix.identity();
        this.delayedRotMatrix.makeRotationFromQuaternion(this.delayedQuaternion);

        const cameraMatrix = new Matrix4()
            .multiply(new Matrix4().makeTranslation(this.position.x, this.position.y, this.position.z))
            .multiply(this.delayedRotMatrix)
            .multiply(new Matrix4().makeRotationX(-0.2))
            .multiply(
                new Matrix4().makeTranslation(0, -0.015 * 10, 0.3 * 100)
            );

        this.camera.matrixAutoUpdate = false;
        this.camera.matrix.copy(cameraMatrix);
        this.camera.matrixWorldNeedsUpdate = true;

        if (this.parts.helix) this.parts.helix.rotation.z -= delta;
    }
}
