import { Box3, Object3D } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { BallisticObject } from "./ballistic_object";

export interface IDynObject {
    hittable: boolean;
    update(delta: number, box?: Box3): void;
    hit?(proj: BallisticObject): void;
}
export type DynObject = IDynObject & Object3D;

export function makeLabel(obj: DynObject & Object3D, offset: number = 0) {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = obj.name;
    label.style.backgroundColor = 'transparent';
    label.style.textAlign = 'center';

    const labelObj = new CSS2DObject(label);
    labelObj.position.set(0, offset, 0)
    labelObj.layers.set(0);
    obj.add(labelObj);
}