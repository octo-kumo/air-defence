import {Object3D} from "three";

export interface DynObject extends Object3D<any> {
    update(delta: number): void;
}
