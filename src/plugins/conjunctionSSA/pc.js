const DEFAULT_HARD_BODY_RADIUS_M = 10;
const DEFAULT_POSITION_SIGMA_M = 100;

function probabilityOfCollision(missKm, options = {}) {
  const hardBodyRadiusM = options.hardBodyRadiusM ?? DEFAULT_HARD_BODY_RADIUS_M;
  const positionSigmaM = options.positionSigmaM ?? DEFAULT_POSITION_SIGMA_M;
  const missM = missKm * 1000;
  const sigmaSq = positionSigmaM * positionSigmaM;
  const radiusSq = hardBodyRadiusM * hardBodyRadiusM;
  const exponent = -(missM * missM) / (2 * sigmaSq);
  return (radiusSq / (2 * sigmaSq)) * Math.exp(exponent);
}

export { DEFAULT_HARD_BODY_RADIUS_M, DEFAULT_POSITION_SIGMA_M, probabilityOfCollision };
