const conversions = {
    minuteOfAngle: 1.04719755119, // Inches at 100 yards
    mil: 3.6, // Inches at 100 yards
    pi: 3.14159265358979,
    degreesToRadians: (degrees: number) => {
        // Converts from a degree to a radian angle.
        return degrees * conversions.pi / 180;
    },
    inchesToIPHY: (inches: number, currentRange: number) => {
        // Converts from inches to inches per 100 yards
        return (inches * 100 / currentRange);
    },
    inchesToMil: (inches: number, currentRange: number) => {
        // Converts from inches to milliradians.
        return (inches * 100 / conversions.mil / currentRange);
    },
    inchesToMinutesOfAngle: (inches: number, currentRange: number) => {
        // Converts from inches to minutes of angle (MoA).
        return (inches * 100 / conversions.minuteOfAngle / currentRange);
    },
    isEven: (input: number) => {
        // Returns true if the inputed integer is an even number.
        return input / 2 * 2 === input;
    },
    metersToYards: (meters: number) => {
        return (meters / 0.9144);
    },
    milesPerHourToInchesPerSecond: (inputVelocityMPH: number) => {
        // Converts from a miles per hour (MPH) to inches per second.
        return inputVelocityMPH * 17.6004;
    },
    radiansToDegrees: (radians: number) => {
        // Converts from a radian ro a degree angle.
        return radians * 180 / conversions.pi;
    },
    sec: (angle: number) => {
        // Secant
        return 1 / Math.cos(angle);
    },
    sizeToDistance: (actualTargetSizeInches: number, reticleViewedTargetSizeMils: number) => {
        return Math.round((actualTargetSizeInches / 36) * 1000 / reticleViewedTargetSizeMils);
    },
    yardsToMeters: (yards: number) => {
        return (yards * 0.9144);
    }
};

export default conversions;
