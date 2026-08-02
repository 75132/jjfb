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
        constructor() {
          super(...arguments);
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
          var loadTime = Date.now() - this.sceneLoadStartTime;
          this.monitorComponentInitialization();
        }

        monitorComponentInitialization() {
          setTimeout(() => {
            this.checkComponentInitialization();
          }, 500);
        }

        checkComponentInitialization() {
          var componentChecks = ['GameControl', 'GameMenu', 'RobotAttributePanel', 'MechAttributeTEST'];
          componentChecks.forEach(componentName => {
            var found = this.findComponentInScene(componentName);
          });
        }

        findComponentInScene(componentName) {
          var scene = director.getScene();
          return this.searchNodeRecursively(scene, componentName);
        }

        searchNodeRecursively(node, componentName) {
          var component = node.getComponent(componentName);

          if (component) {
            return true;
          }

          for (var i = 0; i < node.children.length; i++) {
            if (this.searchNodeRecursively(node.children[i], componentName)) {
              return true;
            }
          }

          return false;
        }

        recordComponentInit(componentName, startTime) {
          var duration = Date.now() - startTime;
          this.componentInitTimes.set(componentName, duration);
        }

        getPerformanceReport() {}

      }, _class2.instance = null, _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=be45f326f490badaa6353479beb9359f87c9b558.js.map