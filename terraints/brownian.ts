import type {TypedArray} from "three";
import {EaseInWeak, type TerrainOptions} from "./core";
import {Smooth} from "./filter";

export function Brownian(g: TypedArray, options: TerrainOptions) {
    let untouched = [],
        touched = [],
        smallerSideSize = Math.min(options.xSize, options.ySize),
        changeDirectionProbability = Math.sqrt(smallerSideSize) / smallerSideSize,
        maxHeightAdjust = Math.sqrt(options.maxHeight - options.minHeight),
        xl = options.xSegments + 1,
        yl = options.ySegments + 1,
        i = Math.floor(Math.random() * options.xSegments),
        j = Math.floor(Math.random() * options.ySegments),
        x = i,
        y = j,
        numVertices = g.length,
        vertices = Array.from(g).map(function (z) {
            return {z: z};
        }),
        current = vertices[j * xl + i],
        randomDirection = Math.random() * Math.PI * 2,
        addX = Math.cos(randomDirection),
        addY = Math.sin(randomDirection),
        n: number,
        m: number,
        key: number,
        sum: number,
        c: number,
        lastAdjust: number = 0,
        index: number;

    // Initialize the first vertex.
    current.z = Math.random() * (options.maxHeight - options.minHeight) + options.minHeight;
    touched.push(current);

    // Walk through all vertices until they've all been adjusted.
    while (touched.length !== numVertices) {
        // Mark the untouched neighboring vertices to revisit later.
        for (n = -1; n <= 1; n++) {
            for (m = -1; m <= 1; m++) {
                key = (j + n) * xl + i + m;
                if (typeof vertices[key] !== 'undefined' && touched.indexOf(vertices[key]) === -1 && i + m >= 0 && j + n >= 0 && i + m < xl && j + n < yl && n && m) {
                    untouched.push(vertices[key]);
                }
            }
        }

        // Occasionally, pick a random untouched point instead of continuing.
        if (Math.random() < changeDirectionProbability) {
            current = untouched.splice(Math.floor(Math.random() * untouched.length), 1)[0];
            randomDirection = Math.random() * Math.PI * 2;
            addX = Math.cos(randomDirection);
            addY = Math.sin(randomDirection);
            index = vertices.indexOf(current);
            i = index % xl;
            j = Math.floor(index / xl);
            x = i;
            y = j;
        } else {
            // Keep walking in the current direction.
            let u = x,
                v = y;
            while (Math.round(u) === i && Math.round(v) === j) {
                u += addX;
                v += addY;
            }
            i = Math.round(u);
            j = Math.round(u);

            // If we hit a touched vertex, look in different directions to try to find an untouched one.
            for (let k = 0; i >= 0 && j >= 0 && i < xl && j < yl && touched.indexOf(vertices[j * xl + i]) !== -1 && k < 9; k++) {
                randomDirection = Math.random() * Math.PI * 2;
                addX = Math.cos(randomDirection);
                addY = Math.sin(randomDirection);
                while (Math.round(u) === i && Math.round(v) === j) {
                    u += addX;
                    v += addY;
                }
                i = Math.round(u);
                j = Math.round(v);
            }

            // If we found an untouched vertex, make it the current one.
            if (i >= 0 && j >= 0 && i < xl && j < yl && touched.indexOf(vertices[j * xl + i]) === -1) {
                x = u;
                y = v;
                current = vertices[j * xl + i];
                let io = untouched.indexOf(current);
                if (io !== -1) {
                    untouched.splice(io, 1);
                }
            }

                // If we couldn't find an untouched vertex near the current point,
            // pick a random untouched vertex instead.
            else {
                current = untouched.splice(Math.floor(Math.random() * untouched.length), 1)[0];
                randomDirection = Math.random() * Math.PI * 2;
                addX = Math.cos(randomDirection);
                addY = Math.sin(randomDirection);
                index = vertices.indexOf(current);
                i = index % xl;
                j = Math.floor(index / xl);
                x = i;
                y = j;
            }
        }

        // Set the current vertex to the average elevation of its touched neighbors plus a random amount
        sum = 0;
        c = 0;
        for (n = -1; n <= 1; n++) {
            for (m = -1; m <= 1; m++) {
                key = (j + n) * xl + i + m;
                if (typeof vertices[key] !== 'undefined' && touched.indexOf(vertices[key]) !== -1 && i + m >= 0 && j + n >= 0 && i + m < xl && j + n < yl && n && m) {
                    sum += vertices[key].z;
                    c++;
                }
            }
        }
        if (c) {
            if (!lastAdjust || Math.random() < changeDirectionProbability) {
                lastAdjust = Math.random();
            }
            current.z = sum / c + EaseInWeak(lastAdjust) * maxHeightAdjust * 2 - maxHeightAdjust;
        }
        touched.push(current);
    }

    for (i = vertices.length - 1; i >= 0; i--) {
        g[i] = vertices[i].z;
    }

    // Erase artifacts.
    Smooth(g, options);
    Smooth(g, options);
}
