import type {TypedArray} from "three";
import type {TerrainOptions} from "./core";

/**
 * Convert an image-based heightmap into vertex-based height data.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 */
export function fromHeightmap(g: TypedArray, options: TerrainOptions) {
    let canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        rows = options.ySegments + 1,
        cols = options.xSegments + 1,
        spread = options.maxHeight - options.minHeight;
    canvas.width = cols;
    canvas.height = rows;
    if (!context) throw new Error("canvas context is null")
    context.drawImage(options.heightmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    let data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            let i = row * cols + col,
                idx = i * 4;
            g[i] = (data[idx] + data[idx + 1] + data[idx + 2]) / 765 * spread + options.minHeight;
        }
    }
}

/**
 * Convert a terrain plane into an image-based heightmap.
 *
 * Parameters are the same as for {@link fromHeightmap} except
 * that if `options.heightmap` is a canvas element then the image will be
 * painted onto that canvas; otherwise a new canvas will be created.
 *
 * @param {Float32Array} g
 *   The vertex position array for the geometry to paint to a heightmap.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 *
 * @return {HTMLCanvasElement}
 *   A canvas with the relevant heightmap painted on it.
 */
export function toHeightmap(g: TypedArray, options: TerrainOptions) {
    let hasMax = typeof options.maxHeight !== 'undefined',
        hasMin = typeof options.minHeight !== 'undefined',
        max = hasMax ? options.maxHeight : -Infinity,
        min = hasMin ? options.minHeight : Infinity;
    if (!hasMax || !hasMin) {
        let max2 = max,
            min2 = min;
        for (let k = 2, l = g.length; k < l; k += 3) {
            if (g[k] > max2) max2 = g[k];
            if (g[k] < min2) min2 = g[k];
        }
        if (!hasMax) max = max2;
        if (!hasMin) min = min2;
    }
    let canvas = options.heightmap instanceof HTMLCanvasElement ? options.heightmap : document.createElement('canvas'),
        context = canvas.getContext('2d'),
        rows = options.ySegments + 1,
        cols = options.xSegments + 1,
        spread = max - min;
    if (!context) throw new Error("canvas context is null")
    canvas.width = cols;
    canvas.height = rows;
    let d = context.createImageData(canvas.width, canvas.height),
        data = d.data;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            let i = row * cols + col,
                idx = i * 4;
            data[idx] = data[idx + 1] = data[idx + 2] = Math.round(((g[i * 3 + 2] - min) / spread) * 255);
            data[idx + 3] = 255;
        }
    }
    context.putImageData(d, 0, 0);
    return canvas;
}
