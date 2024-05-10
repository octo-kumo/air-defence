import {Group, ObjectLoader, Vector3} from "three";
import type {DynObject} from "~/games/air-defence/dyn_object";
import {RES_ROOT} from "~/games/air-defence/config";
import type {AirDefence} from "~/games/air-defence/game";
import {BallisticObject} from "~/games/air-defence/ballistic_object";
import type {PerspectiveCamera} from "three/src/cameras/PerspectiveCamera";

const loader = new ObjectLoader();

export class Gun extends Group implements DynObject {
    private _game: AirDefence;
    camera?: PerspectiveCamera;

    constructor(game: AirDefence) {
        super();
        this._game = game;
        loader.load(
            RES_ROOT + "gun.json",
            obj => {
                this.add(...obj.children);
                this.camera = this.children[0].children[0] as PerspectiveCamera;
            },
            // xhr => {
            //     console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            // },
            err => console.error('An error happened', err)
        );
    }


    update(delta: number): void {
    }

    setAngles(yaw: number, pitch: number) {
        this.children[0].rotation.z = pitch;
        this.rotation.y = yaw - Math.PI / 2;
    }

    fireProjectile() {
        const velocity = this._game.plane.position.clone().sub(this.getStartPos()).normalize().multiplyScalar(810);
        const magnitude = velocity.length();
        let pitch = Math.asin(velocity.y / magnitude), yaw = -Math.atan2(-velocity.x, velocity.z);
        this.setAngles(yaw, pitch)
        const spread = 0.02;
        for (let i = 0; i < 100; i++) {
            let deviation = Math.random() * spread, dev_direction = Math.random() * 2 * Math.PI;
            let _pitch = pitch + Math.sin(dev_direction) * deviation;
            let _yaw = yaw + Math.cos(dev_direction) * deviation;

            const obj = new BallisticObject({
                drag: false,
                gravity: false,
                startPos: this.getStartPos(),
                startVec: new Vector3(
                    (magnitude * Math.sin(_yaw) * Math.cos(_pitch)),
                    (magnitude * Math.sin(_pitch)),
                    (magnitude * Math.cos(_yaw) * Math.cos(_pitch))),
            });
            obj.et = -i * 0.02;
            this._game.objects.push(obj);
            this._game.scene.add(obj);
        }
    }

    getStartPos() {
        return this.children[0].getWorldPosition(new Vector3());
    }
}
