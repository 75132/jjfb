export type ClientRuntimeManifest = {
  manifestVersion: string;
  targetEngine: string;
  mapDefaults: {
    configVersion: string;
    coordinateSystem: string;
    localTest: {
      skipServerRequirements: boolean;
      spawnMissingNpcClones: boolean;
      sequentialStoryNpcReveal: boolean;
    };
  };
  battleRefs: string[];
  defaultBattleRef: string;
  npcVisualMode: string;
  supportedEventTypes: string[];
  supportedRequirementTypes: string[];
  warnOnlyRequirementTypes?: string[];
  warnOnlyEffectActions?: string[];
};
