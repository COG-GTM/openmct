import { evaluate, validateExpression } from './securedMath.js';

function assertValidCalculationPayload(telemetryForComps, parameters, expression) {
  if (typeof expression !== 'string') {
    throw new Error('Invalid payload: expression must be a string');
  }
  if (!Array.isArray(parameters)) {
    throw new Error('Invalid payload: parameters must be an array');
  }
  if (typeof telemetryForComps !== 'object' || telemetryForComps === null) {
    throw new Error('Invalid payload: telemetryForComps must be an object');
  }
  parameters.forEach((parameter) => {
    if (typeof parameter?.name !== 'string' || typeof parameter?.keyString !== 'string') {
      throw new Error('Invalid payload: malformed parameter');
    }
  });
  // Enforce the allow-list, length, and complexity bounds up front, before any
  // untrusted expression reaches the mathjs engine.
  validateExpression(
    expression,
    parameters.map((parameter) => parameter.name)
  );
}

// eslint-disable-next-line no-undef
onconnect = function (e) {
  const port = e.ports[0];

  port.onmessage = function (event) {
    const { type, callbackID, telemetryForComps, expression, parameters, newTelemetry } =
      event.data;
    let responseType = 'unknown';
    let error = null;
    let result = [];
    try {
      if (type === 'calculateRequest') {
        responseType = 'calculationRequestResult';
        console.debug(`📫 Received new calculation request with callback ID ${callbackID}`);
        assertValidCalculationPayload(telemetryForComps, parameters, expression);
        result = calculateRequest(telemetryForComps, parameters, expression);
      } else if (type === 'calculateSubscription') {
        responseType = 'calculationSubscriptionResult';
        assertValidCalculationPayload(telemetryForComps, parameters, expression);
        result = calculateSubscription(telemetryForComps, newTelemetry, parameters, expression);
      } else if (type === 'init') {
        port.postMessage({ type: 'ready' });
        return;
      } else {
        throw new Error('Invalid message type');
      }
    } catch (errorInCalculation) {
      error = errorInCalculation;
    }
    console.debug(`📭 Sending response for callback ID ${callbackID}`, result);
    port.postMessage({ type: responseType, callbackID, result, error });
  };
};

function getFullDataFrame(telemetryForComps, parameters) {
  const dataFrame = {};
  Object.keys(telemetryForComps)?.forEach((key) => {
    const parameter = parameters.find((p) => p.keyString === key);
    const dataSet = telemetryForComps[key];
    const telemetryMap = new Map(dataSet.map((item) => [item[parameter.timeKey], item]));
    dataFrame[key] = telemetryMap;
  });
  return dataFrame;
}

function calculateSubscription(telemetryForComps, newTelemetry, parameters, expression) {
  const dataFrame = getFullDataFrame(telemetryForComps, parameters);
  const calculation = calculate(dataFrame, parameters, expression);
  const newTelemetryKey = Object.keys(newTelemetry)[0];
  const newTelemetrySize = newTelemetry[newTelemetryKey].length;
  let trimmedCalculation = calculation;
  if (calculation.length > newTelemetrySize) {
    trimmedCalculation = calculation.slice(calculation.length - newTelemetrySize);
  }
  return trimmedCalculation;
}

function calculateRequest(telemetryForComps, parameters, expression) {
  const dataFrame = getFullDataFrame(telemetryForComps, parameters);
  return calculate(dataFrame, parameters, expression);
}

function calculate(dataFrame, parameters, expression) {
  const sumResults = [];
  // ensure all parameter keyStrings have corresponding telemetry data
  if (!expression) {
    return sumResults;
  }
  // set up accumulated data structure
  const accumulatedData = {};
  parameters.forEach((parameter) => {
    if (parameter.accumulateValues) {
      accumulatedData[parameter.name] = [];
    }
  });

  // take the first parameter keyString as the reference
  const referenceParameter = parameters[0];
  const otherParameters = parameters.slice(1);
  // iterate over the reference telemetry data
  const referenceTelemetry = dataFrame[referenceParameter.keyString];
  referenceTelemetry?.forEach((referenceTelemetryItem) => {
    let referenceValue = referenceTelemetryItem[referenceParameter.valueToUse];
    if (referenceParameter.accumulateValues) {
      accumulatedData[referenceParameter.name].push(referenceValue);
      referenceValue = accumulatedData[referenceParameter.name];
    }
    if (
      referenceParameter.accumulateValues &&
      referenceParameter.sampleSize &&
      referenceParameter.sampleSize > 0
    ) {
      // enforce sample size by ensuring referenceValue has the latest n elements
      // if we don't have at least the sample size, skip this iteration
      if (!referenceValue.length || referenceValue.length < referenceParameter.sampleSize) {
        return;
      }
      referenceValue = referenceValue.slice(-referenceParameter.sampleSize);
    }

    const scope = {
      [referenceParameter.name]: referenceValue
    };
    const referenceTime = referenceTelemetryItem[referenceParameter.timeKey];
    // iterate over the other parameters to set the scope
    let missingData = false;
    otherParameters.forEach((parameter) => {
      const otherDataFrame = dataFrame[parameter.keyString];
      const otherTelemetry = otherDataFrame.get(referenceTime);
      if (otherTelemetry === undefined || otherTelemetry === null) {
        missingData = true;
        return;
      }
      let otherValue = otherTelemetry[parameter.valueToUse];
      if (parameter.accumulateValues) {
        accumulatedData[parameter.name].push(referenceValue);
        otherValue = accumulatedData[referenceParameter.name];
      }
      scope[parameter.name] = otherValue;
    });
    if (missingData) {
      console.debug('🤦‍♂️ Missing data for some parameters, skipping calculation');
      return;
    }
    const rawComputedValue = evaluate(expression, scope);
    let computedValue = rawComputedValue;
    if (computedValue.entries) {
      // if there aren't any entries, return with nothing
      if (computedValue.entries.length === 0) {
        return;
      }
      console.debug('📊 Computed value is an array of entries', computedValue.entries);
      // make array of arrays of entries
      computedValue = computedValue.entries?.[0];
    }
    sumResults.push({ [referenceParameter.timeKey]: referenceTime, value: computedValue });
  });
  return sumResults;
}
