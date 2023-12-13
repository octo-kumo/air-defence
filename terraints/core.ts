import {Material, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, type TypedArray} from "three";
import {Clamp, Smooth, Step, Turbulence} from "./filter";
import {fromHeightmap} from "./images";
import {DiamondSquare} from "./generator";

/**
 * A terrain object for use with the js library.
 *
 * Usage: `var terrainScene = Terrain();`
 *
 * @param {Object} [options]
 *   An optional map of settings that control how the terrain is constructed
 *   and displayed. Options include:
 *
 *   - `after`: A function to run after other transformations on the terrain
 *     produce the highest-detail heightmap, but before optimizations and
 *     visual properties are applied. Takes two parameters, which are the same
 *     as those for {@link DiamondSquare}: an array of
 *     `Vector3` objects representing the vertices of the terrain, and a
 *     map of options with the same available properties as the `options`
 *     parameter for the `Terrain` function.
 *   - `easing`: A function that affects the distribution of slopes by
 *     interpolating the height of each vertex along a curve. Valid values
 *     include `Linear` (the default), `EaseIn`,
 *     `EaseOut`, `EaseInOut`,
 *     `InEaseOut`, and any custom function that accepts a float
 *     between 0 and 1 and returns a float between 0 and 1.
 *   - `frequency`: For terrain generation methods that support it (Perlin,
 *     Simplex, and Worley) the octave of randomness. This basically controls
 *     how big features of the terrain will be (higher frequencies result in
 *     smaller features). Often running multiple generation functions with
 *     different frequencies and heights results in nice detail, as
 *     the PerlinLayers and SimplexLayers methods demonstrate. (The counterpart
 *     to frequency, amplitude, is represented by the difference between the
 *     `maxHeight` and `minHeight` parameters.) Defaults to 2.5.
 *   - `heightmap`: Either a canvas or pre-loaded image (from the same domain
 *     as the webpage or served with a CORS-friendly header) representing
 *     terrain height data (lighter pixels are higher); or a function used to
 *     generate random height data for the terrain. Valid random functions are
 *     specified in `generators.js` (or custom functions with the same
 *     signature). Ideally heightmap images have the same number of pixels as
 *     the terrain has vertices, as determined by the `xSegments` and
 *     `ySegments` options, but this is not required. If the heightmap is a
 *     different size, vertex height values will be interpolated.) Defaults to
 *     `DiamondSquare`.
 *   - `material`: a Material instance used to display the terrain.
 *     Defaults to `new MeshBasicMaterial({color: 0xee6633})`.
 *   - `maxHeight`: the highest point, in js units, that a peak should
 *     reach. Defaults to 100. Setting to `undefined`, `null`, or `Infinity`
 *     removes the cap, but this is generally not recommended because many
 *     generators and filters require a vertical range. Instead, consider
 *     setting the `stretch` option to `false`.
 *   - `minHeight`: the lowest point, in js units, that a valley should
 *     reach. Defaults to -100. Setting to `undefined`, `null`, or `-Infinity`
 *     removes the cap, but this is generally not recommended because many
 *     generators and filters require a vertical range. Instead, consider
 *     setting the `stretch` option to `false`.
 *   - `steps`: If this is a number above 1, the terrain will be paritioned
 *     into that many flat "steps," resulting in a blocky appearance. Defaults
 *     to 1.
 *   - `stretch`: Determines whether to stretch the heightmap across the
 *     maximum and minimum height range if the height range produced by the
 *     `heightmap` property is smaller. Defaults to true.
 *   - `turbulent`: Whether to perform a turbulence transformation. Defaults to
 *     false.
 *   - `xSegments`: The number of segments (rows) to divide the terrain plane
 *     into. (This basically determines how detailed the terrain is.) Defaults
 *     to 63.
 *   - `xSize`: The width of the terrain in js units. Defaults to 1024.
 *     Rendering might be slightly faster if this is a multiple of
 *     `options.xSegments + 1`.
 *   - `ySegments`: The number of segments (columns) to divide the terrain
 *     plane into. (This basically determines how detailed the terrain is.)
 *     Defaults to 63.
 *   - `ySize`: The length of the terrain in js units. Defaults to 1024.
 *     Rendering might be slightly faster if this is a multiple of
 *     `options.ySegments + 1`.
 */
export interface TerrainOptions {
    after?: (vertices: Float32Array, options: TerrainOptions) => void;
    easing?: ((
        t: number
    ) => number) | typeof Linear | typeof EaseIn | typeof EaseOut | typeof EaseInOut | typeof InEaseOut;
    frequency: number;
    heightmap?: HTMLCanvasElement | CanvasImageSource | ((g: TypedArray, options: TerrainOptions) => void);
    material?: Material;
    maxHeight: number;
    minHeight: number;
    steps: number;
    stretch?: boolean;
    turbulent: boolean;
    xSegments: number;
    xSize: number;
    ySegments: number;
    ySize: number;
    optimization: number;
}

export function Terrain(opts: Partial<TerrainOptions> = {}): Object3D {
    let defaultOptions: Partial<TerrainOptions> = {
        after: undefined,
        easing: Linear,
        heightmap: DiamondSquare,
        material: undefined,
        maxHeight: 100,
        minHeight: -100,
        optimization: NONE,
        frequency: 2.5,
        steps: 1,
        stretch: true,
        turbulent: false,
        xSegments: 63,
        xSize: 1024,
        ySegments: 63,
        ySize: 1024,
    };
    const options = Object.assign(defaultOptions, opts) as TerrainOptions;
    options.material = options.material || new MeshBasicMaterial({color: 0xee6633});

    // Encapsulating the terrain in a parent object allows us the flexibility
    // to more easily have multiple meshes for optimization purposes.
    let scene = new Object3D();
    // Planes are initialized on the XY plane, so rotate the plane to make it lie flat.
    scene.rotation.x = -0.5 * Math.PI;

    // Create the terrain mesh.
    let mesh = new Mesh(
        new PlaneGeometry(options.xSize, options.ySize, options.xSegments, options.ySegments),
        options.material
    );

    // Assign elevation data to the terrain plane from a heightmap or function.
    let zs = toArray1D(mesh.geometry.attributes.position.array);
    if (options.heightmap instanceof HTMLCanvasElement || options.heightmap instanceof Image) {
        fromHeightmap(zs, options);
    } else if (typeof options.heightmap === 'function') {
        options.heightmap(zs, options);
    } else {
        console.warn('An invalid value was passed for `options.heightmap`: ' + options.heightmap);
    }
    fromArray1D(mesh.geometry.attributes.position.array, zs);
    Normalize(mesh, options);

    // lod.addLevel(mesh, options.unit * 10 * Math.pow(2, lodLevel));

    scene.add(mesh);
    return scene;
}


/**
 * Optimization types.
 *
 * Note that none of these are implemented right now. They should be done as
 * shaders so that they execute on the GPU, and the resulting scene would need
 * to be updated every frame to adjust to the camera's position.
 *
 * Further reading:
 * - http://vterrain.org/LOD/Papers/
 * - http://vterrain.org/LOD/Implementations/
 *
 * GEOMIPMAP: The terrain plane should be split into sections, each with their
 * own LODs, for screen-space occlusion and detail reduction. Intermediate
 * vertices on higher-detail neighboring sections should be interpolated
 * between neighbor edge vertices in order to match with the edge of the
 * lower-detail section. The number of sections should be around sqrt(segments)
 * along each axis. It's unclear how to make materials stretch across segments.
 * Possible example (I haven't looked too much into it) at
 * https://github.com/felixpalmer/lod-terrain/tree/master/js/shaders
 *
 * GEOCLIPMAP: The terrain should be composed of multiple donut-shaped sections
 * at decreasing resolution as the radius gets bigger. When the player moves,
 * the sections should morph so that the detail "follows" the player around.
 * There is an implementation of geoclipmapping at
 * https://github.com/CodeArtemis/TriggerRally/blob/unified/server/public/scripts/client/terrain.coffee
 * and a tutorial on morph targets at
 * http://nikdudnik.com/making-3d-gfx-for-the-cinema-on-low-budget-and-three-js/
 *
 * POLYGONREDUCTION: Combine areas that are relatively coplanar into larger
 * polygons as described at http://www.shamusyoung.com/twentysidedtale/?p=142.
 * This method can be combined with the others if done very carefully, or it
 * can be adjusted to be more aggressive at greater distance from the camera
 * (similar to combining with geomipmapping).
 *
 * If these do get implemented, here is the option description to add to the
 * `Terrain` docblock:
 *
 *    - `optimization`: the type of optimization to apply to the terrain. If
 *      an optimization is applied, the number of segments along each axis that
 *      the terrain should be divided into at the most detailed level should
 *      equal (n * 2^(LODs-1))^2 - 1, for arbitrary n, where LODs is the number
 *      of levels of detail desired. Valid values include:
 *
 *          - `NONE`: Don't apply any optimizations. This is the
 *            default.
 *          - `GEOMIPMAP`: Divide the terrain into evenly-sized
 *            sections with multiple levels of detail. For each section,
 *            display a level of detail dependent on how close the camera is.
 *          - `GEOCLIPMAP`: Divide the terrain into donut-shaped
 *            sections, where detail decreases as the radius increases. The
 *            rings then morph to "follow" the camera around so that the camera
 *            is always at the center, surrounded by the most detail.
 */
export const NONE = 0;
export const GEOMIPMAP = 1;
export const GEOCLIPMAP = 2;
export const POLYGONREDUCTION = 3;

/**
 * Normalize the terrain after applying a heightmap or filter.
 *
 * This applies turbulence, steps, and height clamping; calls the `after`
 * callback; updates normals and the bounding sphere; and marks vertices as
 * dirty.
 *
 * @param {Mesh} mesh
 *   The terrain mesh.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid options are the same as for {@link Terrain}().
 */
export function Normalize(mesh: Mesh, options: TerrainOptions) {
    let zs = toArray1D(mesh.geometry.attributes.position.array);
    if (options.turbulent) {
        Turbulence(zs, options);
    }
    if (options.steps > 1) {
        Step(zs, options.steps);
        Smooth(zs, options);
    }

    // Keep the terrain within the allotted height range if necessary, and do easing.
    Clamp(zs, options);

    // Call the "after" callback
    if (typeof options.after === 'function') {
        options.after(zs, options);
    }
    fromArray1D(mesh.geometry.attributes.position.array, zs);
    // Mark the geometry as having changed and needing updates.
    mesh.geometry.computeBoundingSphere();
    // mesh.geometry.computeFaceNormals();
    mesh.geometry.computeVertexNormals();
}


/**
 * Get a 2D array of heightmap values from a 1D array of Z-positions.
 *
 * @param {Float32Array} vertices
 *   A 1D array containing the vertex Z-positions of the geometry representing
 *   the terrain.
 * @param {Object} options
 *   A map of settings defining properties of the terrain. The only properties
 *   that matter here are `xSegments` and `ySegments`, which represent how many
 *   vertices wide and deep the terrain plane is, respectively (and therefore
 *   also the dimensions of the returned array).
 *
 * @return {Float32Array[]}
 *   A 2D array representing the terrain's heightmap.
 */
export function toArray2D(vertices: TypedArray, options: TerrainOptions): TypedArray[] {
    let tgt: TypedArray[] = new Array(options.xSegments + 1),
        xl = options.xSegments + 1,
        yl = options.ySegments + 1,
        i, j;
    for (i = 0; i < xl; i++) {
        tgt[i] = new Float32Array(options.ySegments + 1);
        for (j = 0; j < yl; j++) {
            tgt[i][j] = vertices[j * xl + i];
        }
    }
    return tgt;
}

/**
 * Set the height of plane vertices from a 2D array of heightmap values.
 *
 * @param {Float32Array} vertices
 *   A 1D array containing the vertex Z-positions of the geometry representing
 *   the terrain.
 * @param {Number[][]} src
 *   A 2D array representing a heightmap to apply to the terrain.
 */
export function fromArray2D(vertices: TypedArray, src: TypedArray[]) {
    for (let i = 0, xl = src.length; i < xl; i++) {
        for (let j = 0, yl = src[i].length; j < yl; j++) {
            vertices[j * xl + i] = src[i][j];
        }
    }
}

/**
 * Get a 1D array of heightmap values from a 1D array of plane vertices.
 *
 * @param {Float32Array} vertices
 *   A 1D array containing the vertex positions of the geometry representing the
 *   terrain.
 *   A map of settings defining properties of the terrain. The only properties
 *   that matter here are `xSegments` and `ySegments`, which represent how many
 *   vertices wide and deep the terrain plane is, respectively (and therefore
 *   also the dimensions of the returned array).
 *
 * @return {Float32Array}
 *   A 1D array representing the terrain's heightmap.
 */
export function toArray1D(vertices: TypedArray): Float32Array {
    let tgt = new Float32Array(vertices.length / 3);
    for (let i = 0, l = tgt.length; i < l; i++) {
        tgt[i] = vertices[i * 3 + 2];
    }
    return tgt;
}

/**
 * Set the height of plane vertices from a 1D array of heightmap values.
 *
 * @param {Float32Array} vertices
 *   A 1D array containing the vertex positions of the geometry representing the
 *   terrain.
 * @param {Number[]} src
 *   A 1D array representing a heightmap to apply to the terrain.
 */
export function fromArray1D(vertices: TypedArray, src: TypedArray) {
    for (let i = 0, l = Math.min(vertices.length / 3, src.length); i < l; i++) {
        vertices[i * 3 + 2] = src[i];
    }
}

/**
 * Generate a 1D array containing random heightmap data.
 *
 * This is like {@link toHeightmap} except that instead of
 * generating the js mesh and material information you can just get the
 * height data.
 *
 * @param {Function} method
 *   The method to use to generate the heightmap data. Works with function that
 *   would be an acceptable value for the `heightmap` option for the
 *   {@link Terrain} function.
 * @param {Number} options
 *   The same as the options parameter for the {@link Terrain} function.
 */
export function heightmapArray(method: Function, options: TerrainOptions): Float32Array {
    let arr: Float32Array = new Float32Array((options.xSegments + 1) * (options.ySegments + 1));//,
    // l = arr.length,
    // i;
    arr.fill(0);
    options.minHeight = options.minHeight || 0;
    options.maxHeight = typeof options.maxHeight === 'undefined' ? 1 : options.maxHeight;
    options.stretch = options.stretch || false;
    method(arr, options);
    Clamp(arr, options);
    return arr;
}

/**
 * Randomness interpolation functions.
 */
export function Linear(x: number) {
    return x;
}

// x = [0, 1], x^2
export function EaseIn(x: number) {
    return x * x;
}

// x = [0, 1], -x(x-2)
export function EaseOut(x: number) {
    return -x * (x - 2);
}

// x = [0, 1], x^2(3-2x)
// Nearly identical alternatives: 0.5+0.5*cos(x*pi-pi), x^a/(x^a+(1-x)^a) (where a=1.6 seems nice)
// For comparison: http://www.wolframalpha.com/input/?i=x^1.6%2F%28x^1.6%2B%281-x%29^1.6%29%2C+x^2%283-2x%29%2C+0.5%2B0.5*cos%28x*pi-pi%29+from+0+to+1
export function EaseInOut(x: number) {
    return x * x * (3 - 2 * x);
}

// x = [0, 1], 0.5*(2x-1)^3+0.5
export function InEaseOut(x: number) {
    let y = 2 * x - 1;
    return 0.5 * y * y * y + 0.5;
}

// x = [0, 1], x^1.55
export function EaseInWeak(x: number) {
    return Math.pow(x, 1.55);
}

// x = [0, 1], x^7
export function EaseInStrong(x: number) {
    return x * x * x * x * x * x * x;
}
