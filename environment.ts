import {type DirectionalLight, Vector3} from "three";
import {ShaderMaterial} from "three/src/Three";

const water_colors = ["#0f5e9c", "#2389da", "#1ca3ec", "#5abcd8", "#74ccf4"]


export function calculateSunlight(sunShaderMaterial: ShaderMaterial, light: DirectionalLight) {
    const uniforms = sunShaderMaterial.uniforms;
    const turbidity = uniforms["turbidity"].value;
    const rayleigh = uniforms["rayleigh"].value;
    const mieCoefficient = uniforms["mieCoefficient"].value = 0.005;
    const sXYZ: Vector3 = uniforms['sunPosition'].value;

    const lambda = new Vector3(680e-9, 550e-9, 450e-9);
    const k = new Vector3(0.686, 0.678, 0.666);
    const piTimes2 = 2.0 * Math.PI;
    let c = (0.2 * turbidity) * 10.0e-18;
    let totalMie = new Vector3(piTimes2, piTimes2, piTimes2);
    let sunFade = 1.0 - Math.min(Math.max(1.0 - Math.exp(sXYZ.z), 0.0), 1.0);
    totalMie.divide(lambda);
    totalMie.multiply(totalMie); // raise to the power of v - 2.0 where v is 4.0, so square it
    totalMie.multiply(k).multiplyScalar(0.434 * c * Math.PI);

    let betaM = totalMie.multiplyScalar(mieCoefficient);
    const up = new Vector3(0.0, 1.0, 0.0);
    // let dotOfMoonDirectionAndUp = mXYZ.dot(up);
    let dotOfSunDirectionAndUp = sXYZ.dot(up);
    let cutoffAngle = Math.PI / 1.95;
    let steepness = 1.5;
    let sunE = 1000.0 * Math.max(0.0, 1.0 - Math.exp(-((cutoffAngle - Math.acos(dotOfSunDirectionAndUp)) / steepness)));
    // sunShaderMaterial.uniforms['sunE'].value = sunE;
    //These are used to fade our objects out a bit during the day as our eyes are contracted due to higher light levels
    //The numbers are basically ad hoc to make them feel 'about right'
    let sunFadeTimesSunE = sunFade * sunE;
    // let exposureCoeficient = -(sunFadeTimesSunE + moonFade * moonE);
    const simplifiedRayleigh = new Vector3(0.0005 / 94.0, 0.0005 / 40.0, 0.0005 / 18.0);
    let betaRSun = simplifiedRayleigh.clone().multiplyScalar(rayleigh - (1.0 - sunFade));

    let cosZenithAngleOfSun = Math.max(0.0, up.dot(sXYZ));
    let zenithAngleOfSun = Math.acos(cosZenithAngleOfSun);
    let inverseSDenominator = 1.0 / (cosZenithAngleOfSun + 0.15 * Math.pow(93.885 - (zenithAngleOfSun * 180.0 / Math.PI), -1.253));
    const rayleighAtmosphereHeight = 8.4E3;
    const mieAtmosphereHeight = 1.25E3;
    let sR = rayleighAtmosphereHeight * inverseSDenominator;
    let sM = mieAtmosphereHeight * inverseSDenominator;
    let betaMTimesSM = betaM.clone().multiplyScalar(sM);

//
// //I also included logic for the sunE which is the intensity of the sunlight
// //If the light is too bright or dark, this will probably prove useful to your needs.
    let solarLightBaseIntensitySquared = sunE / 700.0;
    let solarLightBaseIntensity = Math.sqrt(solarLightBaseIntensitySquared);
    light.color.setRGB(Math.max(Math.min(Math.exp(-(betaRSun.x * sR + betaMTimesSM.x)), 1.0), 0.0),
        Math.max(Math.min(Math.exp(-(betaRSun.y * sR + betaMTimesSM.y)), 1.0), 0.0),
        Math.max(Math.min(Math.exp(-(betaRSun.z * sR + betaMTimesSM.z)), 1.0), 0.0));
    light.intensity = solarLightBaseIntensity * Math.PI;
    light.position.copy(sXYZ.clone().multiplyScalar(500));
    light.shadow.updateMatrices(light);
    // console.log("sun calc", dotOfSunDirectionAndUp, light.color, light.intensity);
}
