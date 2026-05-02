import { _decorator, Component, Node, EditBox, Button, Sprite, SpriteFrame, ToggleContainer, Color, Label } from 'cc';
import { WebSocketManager } from '../global/WebSocketManager';
const { ccclass, property } = _decorator;

@ccclass('CharacterCreatePanel')
export class CharacterCreatePanel extends Component {
    @property([Node])
    characterSprites: Node[] = []; // 角色格子节点数组（Sprite-001 ~ Sprite-006）

    @property(SpriteFrame)
    normalBg: SpriteFrame = null!; // 常态底图

    @property(SpriteFrame)
    selectedBg: SpriteFrame = null!; // 选中高亮底图

    @property(ToggleContainer)
    toggleGroup: ToggleContainer = null!; // ToggleGroup节点

    @property(EditBox)
    nameEditBox: EditBox = null!; // 角色名输入框

    @property(Button)
    createButton: Button = null!; // 创建按钮

    @property(Button)
    backButton: Button = null!; // 返回按钮

    @property(Button)
    randomNameBtn: Button = null!;

    @property(Label)
    tipLabel: Label = null!; // 创建角色报错提示文本，支持拖拽绑定

    private selectedCharacterIndex: number = 0; // 当前选中的角色索引
    private selectedSlotIndex: number = 0; // 当前选中的槽位索引
    private wsManager: WebSocketManager = null!;
    // 修复点：创建角色过程状态标记，防止高频点击导致多次创建请求
    private isCreating: boolean = false;

    start() {
        // 延迟初始化，避免引擎内部错误；组件销毁后不再执行
        setTimeout(() => {
            if (!this.isValid) return;
            this.initializeComponents();
        }, 200);
    }

    private initializeComponents() {
        try {
            this.wsManager = WebSocketManager.getInstance();

            // 监听创建角色响应
            if (this.wsManager) {
                this.wsManager.on('create_character_response', this.onCreateCharacterResponse, this);
            }

            // 绑定角色格子点击事件
            this.characterSprites.forEach((node, idx) => {
                if (node && typeof node.on === 'function') {
                    try {
                        node.on(Node.EventType.TOUCH_END, () => this.onSelectCharacter(idx), this);
                    } catch (error) {
                        console.error(`绑定角色格子${idx}点击事件时出错:`, error);
                    }
                }
            });

            // 绑定返回按钮点击事件
            if (this.backButton && this.backButton.node && typeof this.backButton.node.on === 'function') {
                try {
                    this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
                } catch (error) {
                    console.error('绑定返回按钮事件时出错:', error);
                }
            }

            // 绑定创建按钮点击事件
            if (this.createButton && this.createButton.node && typeof this.createButton.node.on === 'function') {
                try {
                    this.createButton.node.on(Button.EventType.CLICK, this.onCreateClick, this);
                } catch (error) {
                    console.error('绑定创建按钮事件时出错:', error);
                }
            }

            // 绑定随机名字按钮点击事件
            if (this.randomNameBtn && this.randomNameBtn.node && typeof this.randomNameBtn.node.on === 'function') {
                try {
                    this.randomNameBtn.node.on(Button.EventType.CLICK, this.randomName, this);
                } catch (error) {
                    console.error('绑定随机名字按钮事件时出错:', error);
                }
            }

            // 默认选中第一个角色
            this.onSelectCharacter(0);
        } catch (error) {
            console.error('CharacterCreatePanel初始化时出错:', error);
        }
    }

    onDestroy() {
        // 移除监听
        if (this.wsManager) {
            this.wsManager.off('create_character_response', this.onCreateCharacterResponse, this);
        }
    }

    onCreateCharacterResponse(data: any) {
        // 修复点：收到服务器响应后重置创建状态与按钮交互状态
        this.isCreating = false;
        if (this.createButton && this.createButton.node) {
            this.createButton.interactable = true;
        }
        // 兼容标准格式（data字段）和直接格式
        const resp = data.data || data;
        if (resp.success) {
            (this as any).node.active = false;
            (this as any).node.emit('refresh_slots_and_hide_buttons');
            if (this.tipLabel) this.tipLabel.string = '';
        } else {
            if (this.tipLabel) this.tipLabel.string = resp.message || '创建角色失败';
        }
    }

    onSelectCharacter(idx: number) {
        this.selectedCharacterIndex = idx;
        // 切换底图高亮
        this.characterSprites.forEach((node, i) => {
            // 假设每个格子下有名为'BgSprite'的子节点
            const bgSpriteNode = node.getChildByName('BgSprite');
            if (bgSpriteNode) {
                const bgSprite = bgSpriteNode.getComponent(Sprite);
                if (bgSprite) {
                    bgSprite.spriteFrame = (i === idx) ? this.selectedBg : this.normalBg;
                }
            }
        });
    }

    // 设置槽位索引
    setSlotIndex(slotIndex: number) {
        this.selectedSlotIndex = slotIndex;
    }

    onCreateClick() {
        // 修复点：高频点击防抖 + 基本校验，避免空名和多次请求
        if (this.isCreating) {
            return;
        }
        if (!this.wsManager || !this.nameEditBox) {
            if (this.tipLabel) this.tipLabel.string = '创建组件未初始化完成';
            return;
        }
        const name = this.nameEditBox.string.trim();
        if (!name) {
            if (this.tipLabel) this.tipLabel.string = '角色名不能为空';
            return;
        }
        // 获取选中的Toggle
        const toggles = this.toggleGroup.toggleItems;
        let selectedToggleIdx = toggles.findIndex(t => t.isChecked);
        if (selectedToggleIdx === -1) selectedToggleIdx = 0;

        // 构造创建角色消息
        const requestId = `create_char_${Date.now()}_${this.selectedSlotIndex}`;
        const msg: any = {
            role_name: name,
            name: name, // 文档字段兼容
            class: selectedToggleIdx + 1, // 1~3
            slot_index: this.selectedSlotIndex, // 0~2
            character_index: this.selectedCharacterIndex, // 兼容旧字段
            sprite: this.selectedCharacterIndex + 1,     // 文档字段 sprite
            request_id: requestId
        };

        this.isCreating = true;
        if (this.createButton && this.createButton.node) {
            this.createButton.interactable = false;
        }

        this.wsManager.request(
            'create_character',
            msg,
            (response: any) => {
                this.onCreateCharacterResponse(response);
            },
            true,
            10000
        );
    }

    onBackClick() {
        // 关闭/隐藏角色创建面板
        (this as any).node.active = false;
        // 如需切换到其他面板，可在此处添加逻辑
    }

    // 百家姓（部分示例，可自行扩展）
    private surnames: string[] = [
        '赵','钱','孙','李','周','吴','郑','王','冯','陈','褚','卫','蒋','沈','韩','杨',
        '朱','秦','尤','许','何','吕','施','张','孔','曹','严','华','金','魏','陶','姜',
        '谢','邹','喻','柏','水','窦','章','云','苏','潘','葛','奚','范','彭','郎','鲁',
        '韦','昌','马','苗','凤','花','方','俞','任','袁','柳','酆','鲍','史','唐','费',
        '廉','岑','薛','雷','贺','倪','汤','滕','殷','罗','毕','郝','邬','安','常','乐',
        '于','时','傅','皮','卞','齐','康','伍','余','元','卜','顾','孟','平','黄','和',
        '穆','萧','尹','姚','邵','湛','汪','祁','毛','禹','狄','米','贝','明','臧','计',
        '伏','成','戴','谈','宋','茅','庞','熊','纪','舒','屈','项','祝','董','梁'
    ];
    // 常用名字符号（部分示例）
    private nameWords: string[] = [
        '伟','刚','勇','毅','俊','峰','强','军','平','保','东','文','辉','力','明','永',
        '健','世','广','志','义','兴','良','海','山','仁','波','宁','贵','福','生','龙',
        '元','全','国','胜','学','祥','才','发','武','新','利','清','飞','彬','富','顺',
        '信','子','杰','涛','昌','成','康','星','光','天','达','安','岩','中','茂','进',
        '林','有','坚','和','彪','博','诚','先','敬','震','振','壮','会','思','群','豪',
        '心','邦','承','乐','绍','功','松','善','厚','庆','磊','民','友','裕','河','哲',
        '江','超','浩','亮','政','谦','亨','奇','固','之','轮','翰','朗','伯','宏','言',
        '若','鸣','朋','斌','梁','栋','维','启','克','伦','翔','旭','鹏','泽','晨','辰'
    ];

    // 常见复姓（可自行扩展）
    private doubleSurnames: string[] = [
        '欧阳','司马','上官','诸葛','东方','皇甫','尉迟','公孙','慕容','司徒','司空','夏侯','长孙','宇文','端木','独孤','南宫','呼延','令狐','轩辕','左丘','东郭','西门','南门','百里','澹台','公冶','宗政','濮阳','淳于','单于','太叔','申屠','公羊','公良','乐正','壤驷','公户','公玉','公仪','梁丘','公仲','公上','公门','公山','公坚','公伯','公祖','第五','公乘','贯丘','公皙','南荣','东里','东宫','仲孙','子车','颛孙','巫马','公西','漆雕','乐羊','壤驷','公良','拓跋','夹谷','宰父','谷梁','晋楚','闾丘','段干','百里','东郭','微生','羊舌','公户','公玉','公仪','梁丘','公仲','公上','公门','公山','公坚','公伯','公祖','第五','公乘','贯丘','公皙','南荣','东里','东宫','仲孙','子车','颛孙','巫马','公西','漆雕','乐羊','壤驷','公良','拓跋','夹谷','宰父','谷梁','晋楚','闾丘','段干','百里','东郭','微生','羊舌'
    ];

    randomName() {
        if (!this.nameEditBox) return;
        let surname = '';
        let name = '';
        // 20%概率复姓
        if (Math.random() < 0.2) {
            surname = this.doubleSurnames[Math.floor(Math.random() * this.doubleSurnames.length)];
        } else {
            surname = this.surnames[Math.floor(Math.random() * this.surnames.length)];
        }
        // 名字1-2字
        const nameLen = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < nameLen; i++) {
            name += this.nameWords[Math.floor(Math.random() * this.nameWords.length)];
        }
        let fullName = surname + name;
        // 限制最多4个汉字
        if (fullName.length > 4) fullName = fullName.slice(0, 4);
        this.nameEditBox.string = fullName;
        if (this.tipLabel) this.tipLabel.string = '';
    }

    // 名字输入校验（只允许汉字或英文，禁止数字和符号，汉字最多6字节，英文10字母）
    onNameEditChanged() {
        if (!this.nameEditBox) return;
        let val = this.nameEditBox.string;
        // 只保留汉字和英文
        val = val.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '');
        // 汉字优先，最多4个汉字
        if (/^[\u4e00-\u9fa5]+$/.test(val)) {
            if (val.length > 6) val = val.slice(0, 6);
            if (val.length > 4) val = val.slice(0, 4);
        } else {
            // 英文最多10个字母
            val = val.slice(0, 10);
        }
        this.nameEditBox.string = val;
    }
}
