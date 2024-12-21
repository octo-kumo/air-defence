import { Group, Object3D, Vector3 } from "three";
import type { DynObject } from "~/games/air-defence/dyn_object";
import type { AirDefence } from "~/games/air-defence/game";
import { BallisticObject } from "~/games/air-defence/ballistic_object";
import type { PerspectiveCamera } from "three/src/cameras/PerspectiveCamera";
import { loadAsset } from "../base/assets";


export class Gun extends Group implements DynObject {
    private _game: AirDefence;
    camera?: PerspectiveCamera;
    top?: Group;
    base?: Group;
    tip?: Object3D;
    yaw: number = 0;
    pitch: number = 0;
    isFiring: boolean = false;
    fireCooldown: number = 0;
    firePeriod: number = 0.01;

    constructor(game: AirDefence) {
        super();
        this._game = game;//new Mesh(new SphereGeometry(0.001), new MeshBasicMaterial({ color: 0xff0000 }));
        loadAsset('airdefence/turret.glb').then((gltf) => {
            const [base, top] = gltf.scene.clone().children[0].children;
            this.add(base);

            this.tip ??= new Object3D();
            this.top ??= top as Group;
            this.tip.position.set(0, -0.007, 0.0047);
            this.top.add(this.tip);
            this.base ??= new Group();
            this.base.add(this.top);
            this.add(this.base);
            this.rotate(0, 0);
        });
    }


    update(delta: number): void {
        this.fireCooldown -= delta;
        if (this.fireCooldown < 0) this.fireCooldown = 0;
        while (this.isFiring && this.fireCooldown <= this.firePeriod) {
            this.fireProjectile();
        }
    }

    fireProjectile() {
        const magnitude = 300;
        const spread = 0.005;
        const obj = new BallisticObject({
            drag: false,
            gravity: false,
            startPos: this.getStartPos(),
            startVec: new Vector3(
                (magnitude * Math.sin(this.yaw) * Math.cos(this.pitch)),
                (magnitude * Math.sin(this.pitch)),
                (magnitude * Math.cos(this.yaw) * Math.cos(this.pitch)))
                .applyAxisAngle(new Vector3(0, 0, 1), Math.random() * spread - spread / 2)
                .applyAxisAngle(new Vector3(0, 1, 0), Math.random() * spread - spread / 2)
                .applyAxisAngle(new Vector3(1, 0, 0), Math.random() * spread - spread / 2)
        }, this._game);
        obj.et = -this.fireCooldown - 0.05;
        obj.update(0.05);
        this.fireCooldown += this.firePeriod;
        this._game.objects.add(obj);
        this._game.scene.add(obj);
    }

    getStartPos() {
        return this.tip?.getWorldPosition(new Vector3()) ?? new Vector3();
    }

    rotate(yaw: number, pitch: number) {
        this.yaw = yaw;
        this.pitch = pitch;
        this.base?.rotation?.set(0, yaw, 0);
        this.top?.rotation?.set(-pitch - Math.PI / 2, 0, 0);
    }
}
