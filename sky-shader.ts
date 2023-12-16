import {MathUtils, Vector2, Vector3} from "three";

function shade(
    vWorldPosition: Vector3,
    vSunDirection: Vector3,
    vSunfade: number,
    vBetaR: Vector3,
    vBetaM: Vector3,
    vSunE: number,
    mieDirectionalG: number,
    up: Vector3,
    cameraPosition: Vector3
): Vector3 {
    const pi: number = 3.141592653589793238462643383279502884197169;
    const n: number = 1.0003;
    const N: number = 2.545e25;
    const rayleighZenithLength: number = 8.4e3;
    const mieZenithLength: number = 1.25e3;
    const sunAngularDiameterCos: number = 0.999956676946448443553574619906976478926848692873900859324;
    const THREE_OVER_SIXTEENPI: number = 0.05968310365946075;
    const ONE_OVER_FOURPI: number = 0.07957747154594767;

    function rayleighPhase(cosTheta: number): number {
        return THREE_OVER_SIXTEENPI * (1.0 + Math.pow(cosTheta, 2.0));
    }

    function hgPhase(cosTheta: number, g: number): number {
        const g2: number = Math.pow(g, 2.0);
        const inverse: number = 1.0 / Math.pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
        return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
    }

    const direction: Vector3 = vWorldPosition.clone().sub(cameraPosition).normalize();
    const zenithAngle: number = Math.acos(Math.max(0.0, up.dot(direction)));
    const inverse: number =
        1.0 / (Math.cos(zenithAngle) + 0.15 * Math.pow(93.885 - (zenithAngle * 180.0) / pi, -1.253));
    const sR: number = rayleighZenithLength * inverse;
    const sM: number = mieZenithLength * inverse;

    const Fex: Vector3 = exp(vBetaR.clone().multiplyScalar(sR).add(vBetaM.clone().multiplyScalar(sM)).negate());

    const cosTheta: number = direction.dot(vSunDirection);

    const rPhase: number = rayleighPhase(cosTheta * 0.5 + 0.5);
    const betaRTheta: Vector3 = vBetaR.clone().multiplyScalar(rPhase);

    const mPhase: number = hgPhase(cosTheta, mieDirectionalG);
    const betaMTheta: Vector3 = vBetaM.clone().multiplyScalar(mPhase);
    const Lin: Vector3 = pow(betaRTheta.clone().add(betaMTheta).divide(
        vBetaR.clone().add(vBetaM))
        .multiply(Fex.clone().subScalar(1).negate().multiplyScalar(vSunE)), new Vector3(1.5, 1.5, 1.5));

    Lin.multiply(
        mix(
            new Vector3(1, 1, 1),
            pow(betaRTheta.clone().add(betaMTheta).divide(
                vBetaR.clone().add(vBetaM))
                .multiply(Fex).multiplyScalar(vSunE), new Vector3(0.5, 0.5, 0.5)),
            MathUtils.clamp(Math.pow(1.0 - up.dot(vSunDirection), 5.0), 0.0, 1.0)
        )
    );

    const theta: number = Math.acos(direction.y);
    const phi: number = Math.atan2(direction.z, direction.x);
    const uv: Vector2 = new Vector2(phi, theta)
        .divide(new Vector2(2.0 * pi, pi))
        .add(new Vector2(0.5, 0.0));
    const L0: Vector3 = new Vector3(0.1).multiply(Fex);

    const sundisk: number = MathUtils.smoothstep(
        sunAngularDiameterCos,
        sunAngularDiameterCos + 0.00002,
        cosTheta
    );
    L0.add(Fex.multiplyScalar(vSunE * 19000.0 * sundisk));

    const texColor: Vector3 = Lin.add(L0).multiplyScalar(0.04).add(new Vector3(0.0, 0.0003, 0.00075));

    return pow(texColor, new Vector3(1.0 / (1.2 + 1.2 * vSunfade)));
}

// Assuming the following Vector and Math utility classes are available:

function exp(vec: Vector3) {
    return new Vector3(Math.exp(vec.x), Math.exp(vec.y), Math.exp(vec.z))
}

function pow(v1: Vector3, v2: Vector3) {
    return new Vector3(Math.pow(v1.x, v2.x), Math.pow(v1.y, v2.y), Math.pow(v1.z, v2.z))
}

function mix(v1: Vector3, v2: Vector3, a: number) {
    return new Vector3(
        v1.x * (1 - a) + v2.x * a,
        v1.y * (1 - a) + v2.y * a,
        v1.z * (1 - a) + v2.z * a
    );
}
