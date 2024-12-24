import { Box3, Object3D } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { BallisticObject } from "./ballistic_object";

export interface DynObject extends Object3D<any> {
    hittable: boolean;
    update(delta: number, box?: Box3): void;
    hit?(proj: BallisticObject): void;
}


export function makeLabel(obj: DynObject, offset: number = 0) {
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