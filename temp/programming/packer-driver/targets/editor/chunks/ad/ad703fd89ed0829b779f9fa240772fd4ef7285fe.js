System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, director, _dec, _class, _class2, _crd, ccclass, SceneLoadMonitor;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      director = _cc.director;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "3c67fb9k0BC56fHEUFRis44", "SceneLoadMonitor", undefined);

      __checkObsolete__(['_decorator', 'Component', 'director']);

      ({
        ccclass
      } = _decorator);

      _export("SceneLoadMonitor", SceneLoadMonitor = (_dec = ccclass('SceneLoadMonitor'), _dec(_class = (_class2 = class SceneLoadMonitor extends Component {
        constructor(...args) {
          super(...args);
          this.sceneLoadStartTime = 0;
          this.componentInitTimes = new Map();
        }

        static getInstance() {
          if (!SceneLoadMonitor.instance) {
            SceneLoadMonitor.instance = new SceneLoadMonitor();
          }

          return SceneLoadMonitor.instance;
        }

        onLoad() {
          SceneLoadMonitor.instance = this;
          this.sceneLoadStartTime = Date.now();
        }

        start() {
          const loadTime = Date.now() - this.sceneLoadStartTime;
          this.monitorComponentInitialization();
        }

        monitorComponentInitialization() {
          setTimeout(() => {
            this.checkComponentInitialization();
          }, 500);
        }

        checkComponentInitialization() {
          const componentChecks = ['GameControl', 'GameMenu', 'RobotAttributePanel', 'MechAttributeTEST'];
          componentChecks.forEach(componentName => {
            const found = this.findComponentInScene(componentName);
          });
        }

        findComponentInScene(componentName) {
          const scene = director.getScene();
          return this.searchNodeRecursively(scene, componentName);
        }

        searchNodeRecursively(node, componentName) {
          const component = node.getComponent(componentName);

          if (component) {
            return true;
          }

          for (let i = 0; i < node.children.length; i++) {
            if (this.searchNodeRecursively(node.children[i], componentName)) {
              return true;
            }
          }

          return false;
        }

        recordComponentInit(componentName, startTime) {
          const duration = Date.now() - startTime;
          this.componentInitTimes.set(componentName, duration);
        }

        getPerformanceReport() {}

      }, _class2.instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=ad703fd89ed0829b779f9fa240772fd4ef7285fe.js.map