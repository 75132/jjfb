export type CapabilityTierLists = {
  supported: string[];
  serverOnly: string[];
  planned: string[];
};

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
  /** v2 契约：三档能力分类（单一真相源） */
  capabilities: {
    requirements: CapabilityTierLists;
    effects: CapabilityTierLists;
  };
  /** @deprecated v1 字段，仅用于旧测试；请读 capabilities */
  supportedRequirementTypes?: string[];
  warnOnlyRequirementTypes?: string[];
  warnOnlyEffectActions?: string[];
};
