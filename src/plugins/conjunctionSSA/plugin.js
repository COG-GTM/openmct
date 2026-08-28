import { ConjunctionEngine } from './ConjunctionEngine.js';
import { buildAllModels, KEYS, NAMESPACE, PAIR_TYPE, TRACKED_TYPE } from './models.js';
import SsaMetadataProvider from './SsaMetadataProvider.js';
import SsaObjectProvider from './SsaObjectProvider.js';
import SsaTelemetryProvider from './SsaTelemetryProvider.js';
import { SEED_TLES } from './tles.js';

function ConjunctionSSAPlugin(options = {}) {
  const seeds = options.seeds ?? SEED_TLES;
  const engine = new ConjunctionEngine({
    seeds,
    lookAheadSeconds: options.lookAheadSeconds,
    coarseStepSeconds: options.coarseStepSeconds,
    tickIntervalMs: options.tickIntervalMs,
    pcOptions: options.pcOptions,
    now: options.now
  });

  function install(openmct) {
    openmct.types.addType(TRACKED_TYPE, {
      name: 'Tracked Object',
      description: 'A satellite or debris object propagated from TLE state.',
      cssClass: 'icon-object',
      creatable: false
    });

    openmct.types.addType(PAIR_TYPE, {
      name: 'Conjunction Pair',
      description: 'A screened pair of tracked objects with miss distance and Pc telemetry.',
      cssClass: 'icon-object',
      creatable: false
    });

    const pairs = engine.listPairs();
    const modelMap = buildAllModels(seeds, pairs);
    const objectProvider = new SsaObjectProvider(modelMap);

    openmct.objects.addRoot({ namespace: NAMESPACE, key: KEYS.root }, openmct.priority.LOW);
    openmct.objects.addProvider(NAMESPACE, objectProvider);
    openmct.telemetry.addProvider(new SsaMetadataProvider());
    openmct.telemetry.addProvider(new SsaTelemetryProvider(engine));

    if (options.autoStart !== false) {
      engine.start();
      openmct.on('destroy', () => engine.stop());
    }
  }

  install.engine = engine;
  return install;
}

export default ConjunctionSSAPlugin;
