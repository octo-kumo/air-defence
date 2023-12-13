// jscs:disable disallowSpaceBeforeSemicolon, requireBlocksOnNewline


import type {TypedArray} from "three";
import type {TerrainOptions} from "./core";

/**
 * Perform Gaussian smoothing on terrain vertices.
 *
 * @param {Float32Array} g
 *   The geometry's z-positions to modify with heightmap data.
 * @param {Object} options
 *   A map of settings that control how the terrain is constructed and
 *   displayed. Valid values are the same as those for the `options` parameter
 *   of {@link Terrain}().
 * @param {Number} [s=1]
 *   The standard deviation of the Gaussian kernel to use. Higher values result
 *   in smoothing across more cells of the src matrix.
 * @param {Number} [n=3]
 *   The number of box blurs to use in the approximation. Larger values result
 *   in slower but more accurate smoothing.
 */
export function GaussianBoxBlur(g: TypedArray, options: TerrainOptions, s = 1, n = 3) {
    gaussianBoxBlur(
        g,
        options.xSegments + 1,
        options.ySegments + 1,
        s,
        n
    );
}

/**
 * Approximate a Gaussian blur by performing several weighted box blurs.
 *
 * After this function runs, `tcl` will contain the blurred source channel.
 * This operation also modifies `scl`.
 *
 * Lightly modified from http://blog.ivank.net/fastest-gaussian-blur.html
 * under the MIT license: http://opensource.org/licenses/MIT
 *
 * Other than style cleanup, the main significant change is that the original
 * version was used for manipulating RGBA channels in an image, so it assumed
 * that input and output were integers [0, 255]. This version does not make
 * such assumptions about the input or output values.
 *
 *   The source channel.
 *   The image width.
 *   The image height.
 *   The standard deviation (how much to blur).
 *   The number of box blurs to use in the approximation.
 *   The target channel. Should be different than the source channel. If not
 *   passed, one is created. This is also the return value.
 *
 * @return Number[]
 *   An array representing the blurred channel.
 * @param scl
 * @param w
 * @param h
 * @param r
 * @param n
 * @param tcl
 */
function gaussianBoxBlur(scl: TypedArray, w: number, h: number, r = 1, n = 3, tcl: TypedArray = new Float32Array(scl.length)) {
    let boxes = boxesForGauss(r, n);
    for (let i = 0; i < n; i++) {
        boxBlur(scl, tcl, w, h, (boxes[i] - 1) / 2);
    }
    return tcl;
}

/**
 * Calculate the size of boxes needed to approximate a Gaussian blur.
 *
 * The appropriate box sizes depend on the number of box blur passes required.
 *
 *   The standard deviation (how much to blur).
 *   The number of boxes (also the number of box blurs you want to perform
 *   using those boxes).
 * @param sigma
 * @param n
 */
function boxesForGauss(sigma: number, n: number) {
    // Calculate how far out we need to go to capture the bulk of the distribution.
    let wIdeal = Math.sqrt(12 * sigma * sigma / n + 1); // Ideal averaging filter width
    let wl = Math.floor(wIdeal); // Lower odd integer bound on the width
    if (wl % 2 === 0) wl--;
    let wu = wl + 2; // Upper odd integer bound on the width

    let mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    let m = Math.round(mIdeal);
    // let sigmaActual = Math.sqrt( (m*wl*wl + (n-m)*wu*wu - n)/12 );

    let sizes = new Int16Array(n);
    for (let i = 0; i < n; i++) {
        sizes[i] = i < m ? wl : wu;
    }
    return sizes;
}

/**
 * Perform a 2D box blur by doing a 1D box blur in two directions.
 *
 * Uses the same parameters as gaussblur().
 */
function boxBlur(scl, tcl, w, h, r) {
    for (let i = 0, l = scl.length; i < l; i++) {
        tcl[i] = scl[i];
    }
    boxBlurH(tcl, scl, w, h, r);
    boxBlurV(scl, tcl, w, h, r);
}

/**
 * Perform a horizontal box blur.
 *
 * Uses the same parameters as gaussblur().
 */
function boxBlurH(scl, tcl, w, h, r) {
    let iarr = 1 / (r + r + 1); // averaging adjustment parameter
    for (let i = 0; i < h; i++) {
        let ti = i * w, // current target index
            li = ti, // current left side of the examined range
            ri = ti + r, // current right side of the examined range
            fv = scl[ti], // first value in the row
            lv = scl[ti + w - 1], // last value in the row
            val = (r + 1) * fv, // target value, accumulated over examined points
            j;
        // Sum the source values in the box
        for (j = 0; j < r; j++) {
            val += scl[ti + j];
        }
        // Compute the target value by taking the average of the surrounding
        // values. This is done by adding the deviations so far and adjusting,
        // accounting for the edges by extending the first and last values.
        for (j = 0; j <= r; j++) {
            val += scl[ri++] - fv;
            tcl[ti++] = val * iarr;
        }
        for (j = r + 1; j < w - r; j++) {
            val += scl[ri++] - scl[li++];
            tcl[ti++] = val * iarr;
        }
        for (j = w - r; j < w; j++) {
            val += lv - scl[li++];
            tcl[ti++] = val * iarr;
        }
    }
}

/**
 * Perform a vertical box blur.
 *
 * Uses the same parameters as gaussblur().
 */
function boxBlurV(scl, tcl, w, h, r) {
    let iarr = 1 / (r + r + 1); // averaging adjustment parameter
    for (let i = 0; i < w; i++) {
        let ti = i, // current target index
            li = ti, // current top of the examined range
            ri = ti + r * w, // current bottom of the examined range
            fv = scl[ti], // first value in the column
            lv = scl[ti + w * (h - 1)], // last value in the column
            val = (r + 1) * fv, // target value, accumulated over examined points
            j;
        // Sum the source values in the box
        for (j = 0; j < r; j++) {
            val += scl[ti + j * w];
        }
        // Compute the target value by taking the average of the surrounding
        // values. This is done by adding the deviations so far and adjusting,
        // accounting for the edges by extending the first and last values.
        for (j = 0; j <= r; j++) {
            val += scl[ri] - fv;
            tcl[ti] = val * iarr;
            ri += w;
            ti += w;
        }
        for (j = r + 1; j < h - r; j++) {
            val += scl[ri] - scl[li];
            tcl[ti] = val * iarr;
            li += w;
            ri += w;
            ti += w;
        }
        for (j = h - r; j < h; j++) {
            val += lv - scl[li];
            tcl[ti] = val * iarr;
            li += w;
            ti += w;
        }
    }
}
