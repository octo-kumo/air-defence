
import { type Box3, Group, Vector3 } from "three";
import { makeLabel, type DynObject } from "~/games/air-defence/dyn_object";
import type { AirDefence } from "./game";
import { loadAsset } from "../base/assets";
export class Aircraft extends Group implements DynObject {
    dir = new Vector3(0, 0, 0);
    vel = new Vector3(0, 0, 0);
    hittable = true;
    game: AirDefence;

    constructor(game: AirDefence) {
        super();
        this.game = game;
        this.name = 'Airship';
        loadAsset('airdefence/airship.glb', true, true).then((gltf) => {
            const ship = gltf.scene.clone().children[0];
            ship.scale.set(0.1, 0.1, 0.1);
            this.add(ship);
        });
        makeLabel(this, 0.5);
    }

    update(delta: number, box?: Box3): void {

    }
} 