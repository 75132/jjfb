System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Label, Node, StoryManager, _dec, _dec2, _dec3, _dec4, _class, _class2, _descriptor, _descriptor2, _descriptor3, _crd, ccclass, property, TaskTracker;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  function _reportPossibleCrUseOfStoryManager(extras) {
    _reporterNs.report("StoryManager", "./StoryManager", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Label = _cc.Label;
      Node = _cc.Node;
    }, function (_unresolved_2) {
      StoryManager = _unresolved_2.StoryManager;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "105dbCuBgtJg5YzfOIxMEha", "TaskTracker", undefined);
      /**
       * 主线任务追踪面板（数据来自 StoryManager / story_get_state）
       */


      __checkObsolete__(['_decorator', 'Component', 'Label', 'Node']);

      ({
        ccclass,
        property
      } = _decorator);

      _export("TaskTracker", TaskTracker = (_dec = ccclass('TaskTracker'), _dec2 = property(Label), _dec3 = property(Label), _dec4 = property({
        type: Node,
        tooltip: '挂有 StoryManager 的节点'
      }), _dec(_class = (_class2 = class TaskTracker extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "mainlineLabel", _descriptor, this);

          _initializerDefineProperty(this, "taskListLabel", _descriptor2, this);

          _initializerDefineProperty(this, "storyHost", _descriptor3, this);

          this._story = null;

          this.refresh = () => {
            var _this$_story;

            if (!((_this$_story = this._story) != null && _this$_story.isValid)) return;

            var snap = this._story.getStoryTaskSnapshot();

            if (this.mainlineLabel) {
              this.mainlineLabel.string = "\u4E3B\u7EBF\u6B65\u9AA4\uFF1A" + snap.mainlineStep;
            }

            if (this.taskListLabel) {
              var lines = (snap.tasks || []).map(t => "\xB7 " + (t.taskName || "\u4EFB\u52A1" + t.taskId) + " [" + t.status + "]");
              this.taskListLabel.string = lines.length ? lines.join('\n') : '暂无进行中任务';
            }
          };
        }

        onLoad() {
          var _ref, _host$getComponent;

          var host = this.storyHost || this.node.parent;
          this._story = (_ref = (_host$getComponent = host == null ? void 0 : host.getComponent(_crd && StoryManager === void 0 ? (_reportPossibleCrUseOfStoryManager({
            error: Error()
          }), StoryManager) : StoryManager)) != null ? _host$getComponent : host == null ? void 0 : host.getComponentInChildren(_crd && StoryManager === void 0 ? (_reportPossibleCrUseOfStoryManager({
            error: Error()
          }), StoryManager) : StoryManager)) != null ? _ref : null;

          if (this._story) {
            this._story.node.on('story_state_updated', this.refresh, this);
          }

          this.schedule(this.refresh, 2);
          this.refresh();
        }

        onDestroy() {
          var _this$_story2;

          if ((_this$_story2 = this._story) != null && (_this$_story2 = _this$_story2.node) != null && _this$_story2.isValid) {
            this._story.node.off('story_state_updated', this.refresh, this);
          }

          this.unschedule(this.refresh);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "mainlineLabel", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "taskListLabel", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "storyHost", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=2c00de7440c682ef899f397e913e8edd5eb4aa7a.js.map