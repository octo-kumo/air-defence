import {EaseInStrong, type TerrainOptions} from "./core";
import {AdditiveBlending, type TypedArray, type Vector3} from "three";
import {ceilPowerOfTwo} from "three/src/math/MathUtils";
import {Clamp, SmoothMedian} from "./filter";
import {Influence, Influences} from "./influences";
import {perlin, seed, simplex} from "./noise";

/**
 * A utility for generating heightmap functions by additive composition.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} [options]
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 * @param {Object[]} passes
 *   Determines which heightmap functions to compose to create a new one.
 *   Consists of an array of objects with the following properties:
 *   - `method`: Contains something that will be passed around as an
 *     `options.heightmap` (a heightmap-generating function or a heightmap image)
 *   - `amplitude`: A multiplier for the heightmap of the pass. Applied before
 *     the result of the pass is added to the result of previous passes.
 *   - `frequency`: For terrain generation methods that support it (Perlin,
 *     Simplex, and Worley) the octave of randomness. This basically controls
 *     how big features of the terrain will be (higher frequencies result in
 *     smaller features). Often running multiple generation functions with
 *     different frequencies and amplitudes results in nice detail.
 */
export function MultiPass(g: TypedArray, options: TerrainOptions, passes: {
    method: Function,
    amplitude?: number,
    frequency?: number
}[]) {
    let clonedOptions = Object.assign({}, options);
    let range = options.maxHeight - options.minHeight;
    for (let i = 0, l = passes.length; i < l; i++) {
        let amp = passes[i].amplitude ?? 1,
            move = 0.5 * (range - range * amp);
        clonedOptions.maxHeight = options.maxHeight - move;
        clonedOptions.minHeight = options.minHeight + move;
        clonedOptions.frequency = passes[i].frequency ?? options.frequency;
        passes[i].method(g, clonedOptions);
    }
}

/**
 * Generate random terrain using a curve.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 * @param {Function} curve
 *   A function that takes an x- and y-coordinate and returns a z-coordinate.
 *   For example, `function(x, y) { return Math.sin(x*y*Math.PI*100); }`
 *   generates sine noise, and `function() { return Math.random(); }` sets the
 *   vertex elevations entirely randomly. The function's parameters (the x- and
 *   y-coordinates) are given as percentages of a phase (i.e. how far across
 *   the terrain in the relevant direction they are).
 */
export function Curve(g: TypedArray, options: TerrainOptions, curve: Function) {
    let range = (options.maxHeight - options.minHeight) * 0.5,
        scalar = options.frequency / (Math.min(options.xSegments, options.ySegments) + 1);
    for (let i = 0, xl = options.xSegments + 1, yl = options.ySegments + 1; i < xl; i++) {
        for (let j = 0; j < yl; j++) {
            g[j * xl + i] += curve(i * scalar, j * scalar) * range;
        }
    }
}

/**
 * Generate random terrain using the Cosine waves.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Cosine(g: TypedArray, options: TerrainOptions) {
    let amplitude = (options.maxHeight - options.minHeight) * 0.5,
        frequencyScalar = options.frequency * Math.PI / (Math.min(options.xSegments, options.ySegments) + 1),
        phase = Math.random() * Math.PI * 2;
    for (let i = 0, xl = options.xSegments + 1; i < xl; i++) {
        for (let j = 0, yl = options.ySegments + 1; j < yl; j++) {
            g[j * xl + i] += amplitude * (Math.cos(i * frequencyScalar + phase) + Math.cos(j * frequencyScalar + phase));
        }
    }
}

/**
 * Generate random terrain using layers of Cosine waves.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function CosineLayers(g: TypedArray, options: TerrainOptions) {
    MultiPass(g, options, [
        {method: Cosine, frequency: 2.5},
        {method: Cosine, amplitude: 0.1, frequency: 12},
        {method: Cosine, amplitude: 0.05, frequency: 15},
        {method: Cosine, amplitude: 0.025, frequency: 20},
    ]);
}

/**
 * Generate random terrain using the Diamond-Square method.
 *
 * Based on https://github.com/srchea/Terrain-Generation/blob/master/js/classes/TerrainGeneration.js
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 */
export function DiamondSquare(g: TypedArray, options: TerrainOptions) {
    // Set the segment length to the smallest power of 2 that is greater than
    // the number of vertices in either dimension of the plane
    let segments = ceilPowerOfTwo(Math.max(options.xSegments, options.ySegments) + 1);

    // Initialize heightmap
    let size = segments + 1,
        heightmap = [],
        smoothing = (options.maxHeight - options.minHeight),
        i,
        j,
        xl = options.xSegments + 1,
        yl = options.ySegments + 1;
    for (i = 0; i <= segments; i++) {
        heightmap[i] = new Float64Array(segments + 1);
    }

    // Generate heightmap
    for (let l = segments; l >= 2; l /= 2) {
        let half = Math.round(l * 0.5),
            whole = Math.round(l),
            x: number,
            y: number,
            avg: number,
            d: number;//,
        // e: number;
        smoothing /= 2;
        // square
        for (x = 0; x < segments; x += whole) {
            for (y = 0; y < segments; y += whole) {
                d = Math.random() * smoothing * 2 - smoothing;
                avg = heightmap[x][y] +            // top left
                    heightmap[x + whole][y] +      // top right
                    heightmap[x][y + whole] +      // bottom left
                    heightmap[x + whole][y + whole]; // bottom right
                avg *= 0.25;
                heightmap[x + half][y + half] = avg + d;
            }
        }
        // diamond
        for (x = 0; x < segments; x += half) {
            for (y = (x + half) % l; y < segments; y += l) {
                d = Math.random() * smoothing * 2 - smoothing;
                avg = heightmap[(x - half + size) % size][y] + // middle left
                    heightmap[(x + half) % size][y] +      // middle right
                    heightmap[x][(y + half) % size] +      // middle top
                    heightmap[x][(y - half + size) % size];  // middle bottom
                avg *= 0.25;
                avg += d;
                heightmap[x][y] = avg;
                // top and right edges
                if (x === 0) heightmap[segments][y] = avg;
                if (y === 0) heightmap[x][segments] = avg;
            }
        }
    }

    // Apply heightmap
    for (i = 0; i < xl; i++) {
        for (j = 0; j < yl; j++) {
            g[j * xl + i] += heightmap[i][j];
        }
    }

    // SmoothConservative(g, options);

}

/**
 * Generate random terrain using the Fault method.
 *
 * Based on http://www.lighthouse3d.com/opengl/terrain/index.php3?fault
 * Repeatedly draw random lines that cross the terrain. Raise the terrain on
 * one side of the line and lower it on the other.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Fault(g: TypedArray, options: TerrainOptions) {
    let d = Math.sqrt(options.xSegments * options.xSegments + options.ySegments * options.ySegments),
        iterations = d * options.frequency,
        range = (options.maxHeight - options.minHeight) * 0.5,
        displacement = range / iterations,
        smoothDistance = Math.min(options.xSize / options.xSegments, options.ySize / options.ySegments) * options.frequency;
    for (let k = 0; k < iterations; k++) {
        let v = Math.random(),
            a = Math.sin(v * Math.PI * 2),
            b = Math.cos(v * Math.PI * 2),
            c = Math.random() * d - d * 0.5;
        for (let i = 0, xl = options.xSegments + 1; i < xl; i++) {
            for (let j = 0, yl = options.ySegments + 1; j < yl; j++) {
                let distance = a * i + b * j - c;
                if (distance > smoothDistance) {
                    g[j * xl + i] += displacement;
                } else if (distance < -smoothDistance) {
                    g[j * xl + i] -= displacement;
                } else {
                    g[j * xl + i] += Math.cos(distance / smoothDistance * Math.PI * 2) * displacement;
                }
            }
        }
    }

    // Smooth(g, options);
}

/**
 * Generate random terrain using the Hill method.
 *
 * The basic approach is to repeatedly pick random points on or near the
 * terrain and raise a small hill around those points. Those small hills
 * eventually accumulate into large hills with distinct features.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 * @param {Function} [feature=Influences.Hill]
 *   A function describing the feature to raise at the randomly chosen points.
 *   Typically this is a hill shape so that the accumulated features result in
 *   something resembling mountains, but it could be any function that accepts
 *   one parameter representing the distance from the feature's origin
 *   expressed as a number between -1 and 1 inclusive. Optionally it can accept
 *   a second and third parameter, which are the x- and y- distances from the
 *   feature's origin, respectively. It should return a number between -1 and 1
 *   representing the height of the feature at the given coordinate.
 *   `Influences` contains some useful functions for this
 *   purpose.
 * @param {Function} [shape]
 *   A function that takes an object with `x` and `y` properties consisting of
 *   uniform random variables from 0 to 1, and returns a number from 0 to 1,
 *   typically by transforming it over a distribution. The result affects where
 *   small hills are raised thereby affecting the overall shape of the terrain.
 */
export function Hill(g: TypedArray, options: TerrainOptions, feature: Function, shape: Function) {
    let frequency = options.frequency * 2,
        numFeatures = frequency * frequency * 10,
        heightRange = options.maxHeight - options.minHeight,
        minHeight = heightRange / (frequency * frequency),
        maxHeight = heightRange / frequency,
        smallerSideLength = Math.min(options.xSize, options.ySize),
        minRadius = smallerSideLength / (frequency * frequency),
        maxRadius = smallerSideLength / frequency;
    feature = feature || Influences.Hill;

    let coords = {x: 0, y: 0};
    for (let i = 0; i < numFeatures; i++) {
        let radius = Math.random() * (maxRadius - minRadius) + minRadius,
            height = Math.random() * (maxHeight - minHeight) + minHeight;
        // let min = 0 - radius,
        //     maxX = options.xSize + radius,
        //     maxY = options.ySize + radius;
        coords.x = Math.random();
        coords.y = Math.random();
        if (typeof shape === 'function') shape(coords);
        Influence(
            g, options,
            feature,
            coords.x, coords.y,
            radius, height,
            AdditiveBlending,
            EaseInStrong
        );
    }
}

/**
 * Generate random terrain using the Hill method, centered on the terrain.
 *
 * The only difference between this and the Hill method is that the locations
 * of the points to place small hills are not uniformly randomly distributed
 * but instead are more likely to occur close to the center of the terrain.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 * @param {Function} [feature=Influences.Hill]
 *   A function describing the feature. The function should accept one
 *   parameter representing the distance from the feature's origin expressed as
 *   a number between -1 and 1 inclusive. Optionally it can accept a second and
 *   third parameter, which are the x- and y- distances from the feature's
 *   origin, respectively. It should return a number between -1 and 1
 *   representing the height of the feature at the given coordinate.
 *   `Influences` contains some useful functions for this
 *   purpose.
 */
export const HillIsland = (function () {
    function island(coords: Vector3) {
        let theta = Math.random() * Math.PI * 2;
        coords.x = 0.5 + Math.cos(theta) * coords.x * 0.4;
        coords.y = 0.5 + Math.sin(theta) * coords.y * 0.4;
    }

    return function (g: TypedArray, options: TerrainOptions, feature: Function) {
        return Hill(g, options, feature, island);
    };
})();

/**
 * Deposit a particle at a vertex.
 */
function deposit(g: TypedArray, i: number, j: number, xl: number, displacement: number) {
    let currentKey = j * xl + i;
    // Pick a random neighbor.
    for (let k = 0; k < 3; k++) {
        let r = Math.floor(Math.random() * 8);
        switch (r) {
            case 0:
                i++;
                break;
            case 1:
                i--;
                break;
            case 2:
                j++;
                break;
            case 3:
                j--;
                break;
            case 4:
                i++;
                j++;
                break;
            case 5:
                i++;
                j--;
                break;
            case 6:
                i--;
                j++;
                break;
            case 7:
                i--;
                j--;
                break;
        }
        let neighborKey = j * xl + i;
        // If the neighbor is lower, move the particle to that neighbor and re-evaluate.
        if (typeof g[neighborKey] !== 'undefined') {
            if (g[neighborKey] < g[currentKey]) {
                deposit(g, i, j, xl, displacement);
                return;
            }
        }
        // Deposit some particles on the edge.
        else if (Math.random() < 0.2) {
            g[currentKey] += displacement;
            return;
        }
    }
    g[currentKey] += displacement;
}

/**
 * Generate random terrain using the Particle Deposition method.
 *
 * Based on http://www.lighthouse3d.com/opengl/terrain/index.php?particle
 * Repeatedly deposit particles on terrain vertices. Pick a random neighbor
 * of that vertex. If the neighbor is lower, roll the particle to the
 * neighbor. When the particle stops, displace the vertex upwards.
 *
 * The shape of the outcome is highly dependent on options.frequency
 * because that affects how many particles will be dropped. Values around
 * 0.25 generally result in archipelagos whereas the default of 2.5
 * generally results in one large mountainous island.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Particles(g: TypedArray, options: TerrainOptions) {
    let iterations = Math.sqrt(options.xSegments * options.xSegments + options.ySegments * options.ySegments) * options.frequency * 300,
        xl = options.xSegments + 1,
        displacement = (options.maxHeight - options.minHeight) / iterations * 1000,
        i = Math.floor(Math.random() * options.xSegments),
        j = Math.floor(Math.random() * options.ySegments),
        xDeviation = Math.random() * 0.2 - 0.1,
        yDeviation = Math.random() * 0.2 - 0.1;
    for (let k = 0; k < iterations; k++) {
        deposit(g, i, j, xl, displacement);
        let d = Math.random() * Math.PI * 2;
        if (k % 1000 === 0) {
            xDeviation = Math.random() * 0.2 - 0.1;
            yDeviation = Math.random() * 0.2 - 0.1;
        }
        if (k % 100 === 0) {
            i = Math.floor(options.xSegments * (0.5 + xDeviation) + Math.cos(d) * Math.random() * options.xSegments * (0.5 - Math.abs(xDeviation)));
            j = Math.floor(options.ySegments * (0.5 + yDeviation) + Math.sin(d) * Math.random() * options.ySegments * (0.5 - Math.abs(yDeviation)));
        }
    }
    // Smooth(g, options, 3);
}

/**
 * Generate random terrain using the Perlin Noise method.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Perlin(g: TypedArray, options: TerrainOptions) {
    seed(Math.random());
    let range = (options.maxHeight - options.minHeight) * 0.5,
        divisor = (Math.min(options.xSegments, options.ySegments) + 1) / options.frequency;
    for (let i = 0, xl = options.xSegments + 1; i < xl; i++) {
        for (let j = 0, yl = options.ySegments + 1; j < yl; j++) {
            g[j * xl + i] += perlin(i / divisor, j / divisor) * range;
        }
    }
}

/**
 * Generate random terrain using the Perlin and Diamond-Square methods composed.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function PerlinDiamond(g: TypedArray, options: TerrainOptions) {
    MultiPass(g, options, [
        {method: Perlin},
        {method: DiamondSquare, amplitude: 0.75},
        {
            method: (g: TypedArray, o: TerrainOptions) => SmoothMedian(g, o)
        },
    ]);
}

/**
 * Generate random terrain using layers of Perlin noise.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function PerlinLayers(g: TypedArray, options: TerrainOptions) {
    MultiPass(g, options, [
        {method: Perlin, frequency: 1.25},
        {method: Perlin, amplitude: 0.05, frequency: 2.5},
        {method: Perlin, amplitude: 0.35, frequency: 5},
        {method: Perlin, amplitude: 0.15, frequency: 10},
    ]);
}

/**
 * Generate random terrain using the Simplex Noise method.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 *
 * See https://github.com/mrdoob/three.js/blob/master/examples/webgl_terrain_dynamic.html
 * for an interesting comparison where the generation happens in GLSL.
 */
export function Simplex(g: TypedArray, options: TerrainOptions) {
    seed(Math.random());
    let range = (options.maxHeight - options.minHeight) * 0.5,
        divisor = (Math.min(options.xSegments, options.ySegments) + 1) * 2 / options.frequency;
    for (let i = 0, xl = options.xSegments + 1; i < xl; i++) {
        for (let j = 0, yl = options.ySegments + 1; j < yl; j++) {
            g[j * xl + i] += simplex(i / divisor, j / divisor) * range;
        }
    }
}

/**
 * Generate random terrain using layers of Simplex noise.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function SimplexLayers(g: TypedArray, options: TerrainOptions) {
    MultiPass(g, options, [
        {method: Simplex, frequency: 1.25},
        {method: Simplex, amplitude: 0.5, frequency: 2.5},
        {method: Simplex, amplitude: 0.25, frequency: 5},
        {method: Simplex, amplitude: 0.125, frequency: 10},
        {method: Simplex, amplitude: 0.0625, frequency: 20},
    ]);
}

/**
 * Generate a heightmap using white noise.
 *
 * @param {THREE.Vector3[]} g The terrain vertices.
 * @param {Object} options Settings
 * @param {Number} scale The resolution of the resulting heightmap.
 * @param {Number} segments The width of the target heightmap.
 * @param {Number} range The altitude of the noise.
 * @param {Number[]} data The target heightmap.
 */
function WhiteNoise(g: TypedArray, options: TerrainOptions, scale: number, segments: number, range: number, data: TypedArray) {
    if (scale > segments) return;
    let i: number,
        j = 0,
        xl = segments,
        yl = segments,
        inc = Math.floor(segments / scale),
        lastX = -inc,
        lastY = -inc;
    // Walk over the target. For a target of size W and a resolution of N,
    // set every W/N points (in both directions).
    for (i = 0; i <= xl; i += inc) {
        for (j = 0; j <= yl; j += inc) {
            let k = j * xl + i;
            data[k] = Math.random() * range;
            if (lastX < 0 && lastY < 0) continue;
            // jscs:disable disallowSpacesInsideBrackets
            /* c b *
             * l t */
            let t = data[k],
                l = data[j * xl + (i - inc)] || t, // left
                b = data[(j - inc) * xl + i] || t, // bottom
                c = data[(j - inc) * xl + (i - inc)] || t; // corner
            // jscs:enable disallowSpacesInsideBrackets
            // Interpolate between adjacent points to set the height of
            // higher-resolution target data.
            for (let x = lastX; x < i; x++) {
                for (let y = lastY; y < j; y++) {
                    if (x === lastX && y === lastY) continue;
                    let z = y * xl + x;
                    if (z < 0) continue;
                    let px = ((x - lastX) / inc),
                        py = ((y - lastY) / inc),
                        r1 = px * b + (1 - px) * c,
                        r2 = px * t + (1 - px) * l;
                    data[z] = py * r2 + (1 - py) * r1;
                }
            }
            lastY = j;
        }
        lastX = i;
        lastY = -inc;
    }
    // Assign the temporary data back to the actual terrain heightmap.
    for (i = 0, xl = options.xSegments + 1; i < xl; i++) {
        for (j = 0, yl = options.ySegments + 1; j < yl; j++) {
            // http://stackoverflow.com/q/23708306/843621
            let kg = j * xl + i,
                kd = j * segments + i;
            g[kg] += data[kd];
        }
    }
}

/**
 * Generate random terrain using value noise.
 *
 * The basic approach of value noise is to generate white noise at a
 * smaller octave than the target and then interpolate to get a higher-
 * resolution result. This is then repeated at different resolutions.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Value(g: TypedArray, options: TerrainOptions) {
    // Set the segment length to the smallest power of 2 that is greater
    // than the number of vertices in either dimension of the plane
    let segments = ceilPowerOfTwo(Math.max(options.xSegments, options.ySegments) + 1);

    // Store the array of white noise outside of the WhiteNoise function to
    // avoid allocating a bunch of unnecessary arrays; we can just
    // overwrite old data each time WhiteNoise() is called.
    let data = new Float64Array((segments + 1) * (segments + 1));

    // Layer white noise at different resolutions.
    let range = options.maxHeight - options.minHeight;
    for (let i = 2; i < 7; i++) {
        WhiteNoise(g, options, Math.pow(2, i), segments, range * Math.pow(2, 2.4 - i * 1.2), data);
    }

    // White noise creates some weird artifacts; fix them.
    // Smooth(g, options, 1);
    Clamp(g, {
        maxHeight: options.maxHeight,
        minHeight: options.minHeight,
        stretch: true,
    } as TerrainOptions);
}

/**
 * Generate random terrain using Weierstrass functions.
 *
 * Weierstrass functions are known for being continuous but not differentiable
 * anywhere. This produces some nice shapes that look terrain-like, but can
 * look repetitive from above.
 *
 * Parameters are the same as those for {@link DiamondSquare}.
 */
export function Weierstrass(g: TypedArray, options: TerrainOptions) {
    let range = (options.maxHeight - options.minHeight) * 0.5,
        dir1 = Math.random() < 0.5 ? 1 : -1,
        dir2 = Math.random() < 0.5 ? 1 : -1,
        r11 = 0.5 + Math.random(),
        r12 = 0.5 + Math.random(),
        r13 = 0.025 + Math.random() * 0.10,
        r14 = -1.0 + Math.random() * 2.0,
        r21 = 0.5 + Math.random(),
        r22 = 0.5 + Math.random(),
        r23 = 0.025 + Math.random() * 0.10,
        r24 = -1.0 + Math.random() * 2.0;
    for (let i = 0, xl = options.xSegments + 1; i < xl; i++) {
        for (let j = 0, yl = options.ySegments + 1; j < yl; j++) {
            let sum = 0;
            for (let k = 0; k < 20; k++) {
                let x = Math.pow(1 + r11, -k) * Math.sin(Math.pow(1 + r12, k) * (i + 0.25 * Math.cos(j) + r14 * j) * r13);
                let y = Math.pow(1 + r21, -k) * Math.sin(Math.pow(1 + r22, k) * (j + 0.25 * Math.cos(i) + r24 * i) * r23);
                sum -= Math.exp(dir1 * x * x + dir2 * y * y);
            }
            g[j * xl + i] += sum * range;
        }
    }
    Clamp(g, options);
}
