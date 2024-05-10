import {type BufferGeometry, Object3D, Triangle, Vector3} from "three";
import {EaseInOut, heightmapArray, type TerrainOptions} from "./core";

export interface ScatterOptions {
    mesh: Object3D;
    spread: number | ((vertex: Vector3, key: number) => boolean);
    smoothSpread: number;
    scene: Object3D;
    sizeVariance: number;
    randomness: (faceIndex?: number, faceCount?: number) => number[] | number;
    maxSlope: number;
    maxTilt: number;
    w: number;
    h: number;
}

/**
 * Scatter a mesh across the terrain.
 *
 * @param {THREE.BufferGeometry} geometry
 *   The terrain's geometry (or the highest-resolution version of it).
 * @param opts
 *   A map of settings that controls how the meshes are scattered, with the
 *   following properties:
 *   - `mesh`: A `THREE.Mesh` instance to scatter across the terrain.
 *   - `spread`: A number or a function that affects where meshes are placed.
 *     If it is a number, it represents the percent of faces of the terrain
 *     onto which a mesh should be placed. If it is a function, it takes a
 *     vertex from the terrain and the key of a related face and returns a
 *     boolean indicating whether to place a mesh on that face or not. An
 *     example could be `function(v, k) { return v.z > 0 && !(k % 4); }`.
 *     Defaults to 0.025.
 *   - `smoothSpread`: If the `spread` option is a number, this affects how
 *     much placement is "eased in." Specifically, if the `randomness` function
 *     returns a value for a face that is within `smoothSpread` percentiles
 *     above `spread`, then the probability that a mesh is placed there is
 *     interpolated between zero and `spread`. This creates a "thinning" effect
 *     near the edges of clumps, if the randomness function creates clumps.
 *   - `scene`: A `THREE.Object3D` instance to which the scattered meshes will
 *     be added. This is expected to be either a return value of a call to
 *     `Terrain()` or added to that return value; otherwise the position
 *     and rotation of the meshes will be wrong.
 *   - `sizeVariance`: The percent by which instances of the mesh can be scaled
 *     up or down when placed on the terrain.
 *   - `randomness`: If `options.spread` is a number, then this property is a
 *     function that determines where meshes are placed. Specifically, it
 *     returns an array of numbers, where each number is the probability that
 *     a mesh is NOT placed on the corresponding face. Valid values include
 *     `Math.random` and the return value of a call to
 *     `ScatterHelper`.
 *   - `maxSlope`: The angle in radians between the normal of a face of the
 *     terrain and the "up" vector above which no mesh will be placed on the
 *     related face. Defaults to ~0.63, which is 36 degrees.
 *   - `maxTilt`: The maximum angle in radians a mesh can be tilted away from
 *     the "up" vector (towards the normal vector of the face of the terrain).
 *     Defaults to Infinity (meshes will point towards the normal).
 *   - `w`: The number of horizontal segments of the terrain.
 *   - `h`: The number of vertical segments of the terrain.
 *
 * @return {THREE.Object3D}
 *   An Object3D containing the scattered meshes. This is the value of the
 *   `options.scene` parameter if passed. This is expected to be either a
 *   return value of a call to `Terrain()` or added to that return value;
 *   otherwise the position and rotation of the meshes will be wrong.
 */
export function ScatterMeshes(geometry: BufferGeometry, opts: Partial<ScatterOptions>) {
    if (!opts.mesh) {
        console.error('options.mesh is required for ScatterMeshes but was not passed');
        return;
    }
    if (!opts.scene) {
        opts.scene = new Object3D();
    }
    let options: ScatterOptions = {
        //@ts-ignore
        mesh: undefined, scene: undefined,
        spread: 0.025,
        smoothSpread: 0,
        sizeVariance: 0.1,
        randomness: Math.random,
        maxSlope: 0.6283185307179586, // 36deg or 36 / 180 * Math.PI, about the angle of repose of earth
        maxTilt: Infinity,
        w: 0,
        h: 0,
        ...opts
    };

    const spreadIsNumber = typeof options.spread === 'number';
    let randomHeightmap: number[] | number;
    let randomness: (k: number) => number;
    const spreadRange = 1 / options.smoothSpread;
    const doubleSizeVariance = options.sizeVariance * 2;
    const vertex1 = new Vector3();
    const vertex2 = new Vector3();
    const vertex3 = new Vector3();
    const faceNormal = new Vector3();
    const up = options.mesh.up.clone().applyAxisAngle(new Vector3(1, 0, 0), 0.5 * Math.PI);

    if (spreadIsNumber) {
        randomHeightmap = options.randomness();
        randomness = typeof randomHeightmap === 'number' ? Math.random : (k) => (randomHeightmap as number[])[k];
    }

    geometry = geometry.toNonIndexed();
    const gArray = geometry.attributes.position.array;

    for (let i = 0; i < gArray.length; i += 9) {
        vertex1.set(gArray[i], gArray[i + 1], gArray[i + 2]);
        vertex2.set(gArray[i + 3], gArray[i + 4], gArray[i + 5]);
        vertex3.set(gArray[i + 6], gArray[i + 7], gArray[i + 8]);
        Triangle.getNormal(vertex1, vertex2, vertex3, faceNormal);

        let place = false;

        if (spreadIsNumber) {
            const rv = randomness!(i / 9);
            if (rv < (options.spread as number)) {
                place = true;
            } else if (rv < (options.spread as number) + options.smoothSpread) {
                // Interpolate rv between spread and spread + smoothSpread,
                // then multiply that "easing" value by the probability
                // that a mesh would get placed on a given face.
                place = EaseInOut((rv - (options.spread as number)) * spreadRange) * (options.spread as number) > Math.random();
            }
        } else {
            place = (options.spread as ((...args: any[]) => boolean))(vertex1, i / 9, faceNormal, i);
        }

        if (place) {
            // Don't place a mesh if the angle is too steep.
            if (faceNormal.angleTo(up) > options.maxSlope) {
                continue;
            }

            const mesh = options.mesh.clone();
            mesh.position.addVectors(vertex1, vertex2).add(vertex3).divideScalar(3);

            if (options.maxTilt > 0) {
                const normal = mesh.position.clone().add(faceNormal);
                mesh.lookAt(normal);
                const tiltAngle = faceNormal.angleTo(up);
                if (tiltAngle > options.maxTilt) {
                    const ratio = options.maxTilt / tiltAngle;
                    mesh.rotation.x *= ratio;
                    mesh.rotation.y *= ratio;
                    mesh.rotation.z *= ratio;
                }
            }

            mesh.rotation.x += 90 / 180 * Math.PI;
            mesh.rotateY(Math.random() * 2 * Math.PI);

            if (options.sizeVariance) {
                const variance = Math.random() * doubleSizeVariance - options.sizeVariance;
                mesh.scale.x = mesh.scale.z = 1 + variance;
                mesh.scale.y += variance;
            }

            mesh.updateMatrix();
            options.scene.add(mesh);
        }
    }

    return options.scene;
}

/**
 * Generate a function that returns a heightmap to pass to ScatterMeshes.
 *
 * Specifically, this function generates a heightmap and then uses that
 * heightmap as a map of probabilities of where meshes will be placed.
 *
 * @param {Function} method
 *   A random terrain generation function (i.e. a valid value for the
 *   `options.heightmap` parameter of the `Terrain` function).
 * @param {Object} options
 *   A map of settings that control how the resulting noise should be generated
 *   (with the same parameters as the `options` parameter to the
 *   `Terrain` function). `options.minHeight` must equal `0` and
 *   `options.maxHeight` must equal `1` if they are specified.
 * @param {Number} skip
 *   The number of sequential faces to skip between faces that are candidates
 *   for placing a mesh. This avoid clumping meshes too closely together.
 *   Defaults to 1.
 * @param {Number} threshold
 *   The probability that, if a mesh can be placed on a non-skipped face due to
 *   the shape of the heightmap, a mesh actually will be placed there. Helps
 *   thin out placement and make it less regular. Defaults to 0.25.
 *
 * @return {Function}
 *   Returns a function that can be passed as the value of the
 *   `options.randomness` parameter to the {@link ScatterMeshes}
 *   function.
 */
export function ScatterHelper(method: Function, options: TerrainOptions, skip: number, threshold: number): () => Float32Array {
    skip = skip || 1;
    threshold = threshold || 0.25;
    options.frequency = options.frequency || 2.5;

    let clonedOptions = Object.assign({}, options);

    clonedOptions.xSegments *= 2;
    clonedOptions.stretch = true;
    clonedOptions.maxHeight = 1;
    clonedOptions.minHeight = 0;
    let heightmap = heightmapArray(method, clonedOptions);

    for (let i = 0, l = heightmap.length; i < l; i++) {
        if (i % skip || Math.random() > threshold) {
            heightmap[i] = 1; // 0 = place, 1 = don't place
        }
    }
    return () => heightmap;
}
