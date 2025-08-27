/**
 * @author https://github.com/PaulGilchrist/pg-ballistics
 */
import drag from "./drag";
import conversions from "./conversions";

export interface Weather {
    altitudeFeet: number;
    windAngleDegrees: number;
    windVelocityMPH: number;
    temperatureDegreesFahrenheit: number;
    barometricPressureInchesHg: number;
    relativeHumidityPercent: number;
}

export interface Firearm {
    zeroRangeUnits: 'Yards' | 'Meters';
    zeroRange: number;
    sightHeightInches: number;

    muzzleAngleDegreesForZeroRange(muzzleVelocityFPS: number, zeroRangeYards: number, sightHeightInches: number, currentBallisticCoefficient: number): number;
}

export interface Round {
    bulletBC: number;
    muzzleVelocityFPS: number;
    bulletWeightGrains: number;
}

export interface Target {
    distance: number;
    distanceUnits: 'Yards' | 'Meters';
    chartStepping: number;
    slantDegrees: number;
    speedMPH: number;
}

export interface Range {
    rangeMeters: number;
    rangeYards: number;
    velocityFPS: number;
    energyFtLbs: number;
    timeSeconds: number;
    dropInches: number;
    verticalPositionInches: number;
    crossWindDriftInches: number;
    leadInches: number;
    slantDegrees: number;
    verticalPositionMil: number;
    verticalPositionMoA: number;
    verticalPositionIPHY: number;
    crossWindDriftMil: number;
    crossWindDriftMoA: number;
    crossWindDriftIPHY: number;
    leadMil: number;
    leadMoA: number;
    leadIPHY: number;
    slantDropInches: number;
    slantMil: number;
    slantMoA: number;
    slantIPHY: number;
}

const ballistics = {
    getRangeData: (weather: Weather, target: Target, firearm: Firearm, round: Round): Range[] => {
        const rangeData: Range[] = [];
        if (weather && target && firearm && round) {
            // Loop through from Range = 0 to the maximum range and display the ballistics table at each chart stepping range.
            const currentBallisticCoefficient = drag.modifiedBallisticCoefficient(round.bulletBC, weather.altitudeFeet, weather.temperatureDegreesFahrenheit, weather.barometricPressureInchesHg, weather.relativeHumidityPercent);
            const zeroRangeYards = firearm.zeroRangeUnits === 'Yards' ? firearm.zeroRange : conversions.metersToYards(firearm.zeroRange);
            const muzzleAngleDegrees = drag.muzzleAngleDegreesForZeroRange(round.muzzleVelocityFPS, zeroRangeYards, firearm.sightHeightInches, currentBallisticCoefficient);
            let currentCrossWindDriftInches: number, currentDropInches: number, currentEnergyFtLbs: number,
                currentLeadInches: number,
                currentRangeMeters: number, currentRangeYards: number, currentTimeSeconds: number,
                currentVelocityFPS: number,
                currentVerticalPositionInches: number;
            // Skip the first row
            let currentRange = target.chartStepping;
            while (currentRange <= target.distance) {
                currentRangeMeters = target.distanceUnits === 'Yards' ? conversions.yardsToMeters(currentRange) : currentRange;
                currentRangeYards = target.distanceUnits === 'Yards' ? currentRange : conversions.metersToYards(currentRange);
                currentVelocityFPS = drag.velocityFromRange(currentBallisticCoefficient, round.muzzleVelocityFPS, currentRangeYards);
                currentEnergyFtLbs = drag.energy(round.bulletWeightGrains, currentVelocityFPS);
                currentTimeSeconds = drag.time(currentBallisticCoefficient, round.muzzleVelocityFPS, currentVelocityFPS);
                currentDropInches = drag.drop(round.muzzleVelocityFPS, currentVelocityFPS, currentTimeSeconds);
                currentVerticalPositionInches = drag.verticalPosition(firearm.sightHeightInches, muzzleAngleDegrees, currentRangeYards, currentDropInches);
                // Cross Winds take on full range value regardless of Slant To Target
                currentCrossWindDriftInches = drag.crossWindDrift(currentRangeYards, currentTimeSeconds, weather.windAngleDegrees, weather.windVelocityMPH, muzzleAngleDegrees, round.muzzleVelocityFPS);
                currentLeadInches = drag.lead(target.speedMPH, currentTimeSeconds);
                const slantDropInches = currentDropInches * (1 - Math.cos(conversions.degreesToRadians(target.slantDegrees)));
                const range = {
                    rangeMeters: currentRangeMeters,
                    rangeYards: currentRangeYards,
                    velocityFPS: currentVelocityFPS,
                    energyFtLbs: currentEnergyFtLbs,
                    timeSeconds: currentTimeSeconds,
                    dropInches: currentDropInches,
                    verticalPositionInches: -currentVerticalPositionInches,  // Go negative to reflect how much scope dial up is needed
                    crossWindDriftInches: currentCrossWindDriftInches,
                    leadInches: currentLeadInches,
                    slantDegrees: target.slantDegrees,
                    // //Al the remaining properties are computed
                    verticalPositionMil: conversions.inchesToMil(-currentVerticalPositionInches, currentRangeYards),
                    verticalPositionMoA: conversions.inchesToMinutesOfAngle(-currentVerticalPositionInches, currentRangeYards),
                    verticalPositionIPHY: conversions.inchesToIPHY(-currentVerticalPositionInches, currentRangeYards),
                    crossWindDriftMil: conversions.inchesToMil(currentCrossWindDriftInches, currentRangeYards),
                    crossWindDriftMoA: conversions.inchesToMinutesOfAngle(currentCrossWindDriftInches, currentRangeYards),
                    crossWindDriftIPHY: conversions.inchesToIPHY(currentCrossWindDriftInches, currentRangeYards),
                    leadMil: conversions.inchesToMil(currentLeadInches, currentRangeYards),
                    leadMoA: conversions.inchesToMinutesOfAngle(currentLeadInches, currentRangeYards),
                    leadIPHY: conversions.inchesToIPHY(currentLeadInches, currentRangeYards),
                    slantDropInches: slantDropInches,
                    slantMil: conversions.inchesToMil(slantDropInches, currentRangeYards),
                    slantMoA: conversions.inchesToMinutesOfAngle(slantDropInches, currentRangeYards),
                    slantIPHY: conversions.inchesToIPHY(slantDropInches, currentRangeYards)
                };
                rangeData.push(range);
                currentRange += target.chartStepping;
            }
        }
        return rangeData;
    }
}

export default ballistics;
