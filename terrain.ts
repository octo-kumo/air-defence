import {
    BufferAttribute,
    BufferGeometry,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    TextureLoader
} from "three";
import {Mesh} from "three/src/objects/Mesh";
import {RES_ROOT} from "./config";


export function createTerrain(width: number, height: number, precision = .1) {
    const loader = new TextureLoader();
    const displacement = loader.load(RES_ROOT + "heightmap.png");
    const geometry = new PlaneGeometry(width, height, width / precision, height / precision);
    const material = new MeshStandardMaterial({
        color: 0xff0000, //Red
        displacementMap: displacement,
        displacementScale: 1
    });
    return new Mesh(geometry, material);
}

export function procedureGeneration() {
    const geometry = new BufferGeometry();
    const vertices = new Float32Array([
        -1.0, -1.0, 1.0, // v0
        1.0, -1.0, 1.0, // v1
        1.0, 1.0, 1.0, // v2

        1.0, 1.0, 1.0, // v3
        -1.0, 1.0, 1.0, // v4
        -1.0, -1.0, 1.0  // v5
    ]);

// itemSize = 3 because there are 3 values (components) per vertex
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    const material = new MeshBasicMaterial({color: 0xff0000});
    const mesh = new Mesh(geometry, material);
}
