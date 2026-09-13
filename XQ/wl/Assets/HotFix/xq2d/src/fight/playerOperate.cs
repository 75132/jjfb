using Assets.HotFix.MyUtils.src.common;
using Assets.HotFix.MyUtils.src.data;
using Assets.HotFix.MyUtils.src.factory;
using Assets.HotFix.MyUtils.src.shape;
using Assets.HotFix.MyUtils.src.ui.basicUI;
using Assets.HotFix.xq2d.src.am;
using Assets.HotFix.xq2d.src.common;
using Assets.HotFix.xq2d.src.data;
using Assets.HotFix.xq2d.src.faceI;
using Assets.HotFix.xq2d.src.factory.manager;
using Assets.HotFix.xq2d.src.factory.playerObjBehaviour;
using Assets.HotFix.xq2d.src.model;
using Assets.HotFix.xq2d.src.ui.page;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;

namespace Assets.HotFix.xq2d.src.fight
{
    class playerOperate
    {
        private static playerOperate one;
        private List<GameObject> players = new List<GameObject>();
        public static playerOperate getInstance()
        {
            if (one == null)
            {
                one = new playerOperate();
            }

            return one;
        }
        public playerOperate()
        {

        }
        public void clear()
        {
            this.players.Clear();
        }
        /**将帧同步，每次执行下一个动作之前同步一次，待命阶段同步一次*/
        public void setSameFrame()
        {
            for (int i = 0; i < players.Count; i++)
            {
                GameObject a = players[i];
                AniRuntime am = a.GetComponent<AniRuntime>();
                if (am == null) continue;
                am.resetFrame();
            }
            //Debug.Log("===重置帧===");
        }
        public void setNoTouch()
        {
            for (int i = 0; i < players.Count; i++)
            {
                GameObject a = players[i];
                modelMsgBind mb = a.GetComponent<modelMsgBind>();
                mb.isTouch = false;
                a.transform.Find("touchKuai").gameObject.SetActive(false);
            }
        }
        public void setAllowedTouch(int target, bool isRole)
        {
            for (int i = 0; i < players.Count; i++)
            {
                GameObject a = players[i];
                modelMsgBind mb = a.GetComponent<modelMsgBind>();
                //战斗玩家、怪物模型必然带有modelMsgBind，没有就是灯光之类的玩意
                if (mb == null) continue;
                if ((target == 2 && fightCache.getInstance().isFriend(mb.msg.posKey)) ||
                    (target == 1 && !fightCache.getInstance().isFriend(mb.msg.posKey)) ||
                    (target == 0 && !fightCache.getInstance().isRolePetPosKey(isRole, mb.msg.posKey)))
                {
                    //目标为敌方则去掉友方；目标为友方则去掉敌方;目标为自己则去掉除自己意外的
                    mb.isTouch = false;
                    a.transform.Find("touchKuai").gameObject.SetActive(false);
                    continue;
                }
                mb.isTouch = true;
                a.transform.Find("touchKuai").gameObject.SetActive(true);
            }
        }
        /**将名称隐藏*/
        public void visibleNames(bool b)
        {
            foreach (GameObject a in players)
            {
                if (a != null)
                {
                    a.transform.Find("name").gameObject.SetActive(b);
                    //隐藏状态图标
                    a.transform.Find("buffArea").gameObject.SetActive(b);
                }
            }
        }
        /**将玩家隐藏*/
        public void visiblePlayer(string posKey, bool b)
        {
            modelMsgBind p = getPlayer(posKey);
            if (p != null) p.gameObject.SetActive(b);
        }
        /**由站位获取玩家*/
        public modelMsgBind getPlayer(string posKey)
        {
            foreach (GameObject a in players)
            {
                modelMsgBind p = a.GetComponent<modelMsgBind>();
                if (p.msg.posKey.Equals(posKey)) return p;
            }
            return null;
        }
        public void loadList(JArray list, Action ac)
        {
            loadList(0, list, () => { ac(); });
        }
        private void loadList(int i, JArray list, Action ac)
        {
            if (i >= list.Count)
            {
                ac();
                return;
            }
            JObject obj = (JObject)list[i];
            loadOne(obj, () =>
            {
                i++;
                loadList(i, list, ac);
            });
        }
        /**加载模型*/
        private void loadOne(JObject obj, Action ac)
        {
            //站位-自上而下 05 16 27 38 49
            string posKey = obj["posKey"].ToString();
            int type = (int)obj["type"];

            string model = obj["model"].ToString();
            JObject shenfu = (JObject)obj["shenfu"];
            if (shenfu != null && strUtils.getMillis() < (long)shenfu["end"])
            {
                ShenFu sf = (ShenFu)face.goodsInterface.getGoodsMsgByKey(shenfu["sf_key"].ToString());
                model = sf.petKey;
            }

            /*float direction = 0;
            if (type != 0) direction = 180;*/
            //镜像站位后：服务端 r 在屏幕左侧朝右(0)，l 在右侧朝左(180)，双方对峙
            float direction = 0;
            string tag = "friend";
            if (posKey.Contains("l"))
            {
                /*direction = 180f;
                if (type != 0) direction = 0;*/
                direction = 180;
                tag = "foe";
            }
            string name = obj["name"].ToString();
            string color = tag.Equals("friend") ? "#ffffff" : "#FFE200";
            //0人物 1宠物 2怪物 4ai 5伙伴
            if (type == 1 || type == 5)
            {
                name = obj["nickName"].ToString();
            }
            else if (type == 2)
            {
                //替换怪物名
                JObject a = face.monsterInterface.getMonster(obj["key"].ToString());
                name = a["name"].ToString();
                if (obj.ContainsKey("quality"))
                {
                    if ((int)obj["quality"] == -1)
                    {
                        name = "[精]" + name;
                        color = "#E49200";//金黄
                    }
                    else if ((int)obj["quality"] == 2)
                    {
                        name = "[宝]" + name;
                        color = "#6EFF00";//绿色
                    }
                    else if ((int)obj["quality"] == 3)
                    {
                        name = "[异]" + name;
                        color = "#00ECFF";//蓝色
                    }
                    else if ((int)obj["quality"] == 4)
                    {
                        color = "#FF0800";//红色
                    }
                }
            }
            //Debug.Log("======================");
            //Debug.Log(obj);

            //这里会解析出动画、模型资源路径

            FightModelMsg pl = new FightModelMsg(model);

            pl.addTag(tag);
            pl.addRoleType(type);

            //Debug.Log(strUtils.copyJSON<JArray>(pl.zhandouPwds));
            //Debug.Log(pl.zhandouAef);


            // 赤翼蝠等：若本地有 simpleAnim/{amKey} 整帧序列，则走整帧播放（试验替换）
            if (!string.IsNullOrEmpty(pl.amKey) && SimpleFrameAnim.HasLocalFrames(pl.amKey))
            {
                bindFightUnit(createSimpleFrameUnit(pl.amKey, name, posKey, direction, pl), obj, name, color, direction, posKey, pl, ac);
                return;
            }

            string[] pwds = pl.zhandouPwds;
            string[] aefs = { pl.zhandouAef };
            List<string> all = new List<string>();
            all.AddRange(pwds);
            all.AddRange(aefs);
            DoGet.getInstance().collectionAnyRes(() =>
            {
                Transform ts = PointGet.getModelLayer();
                List<GameObject> list = readModel.drawGameObj(ts, pwds, aefs);

                GameObject g = list[0].gameObject;

                Transform frames = g.transform.Find("frames");
                //对于人物需要改变方向
                if (model.Contains("_nan") || model.Contains("_nv"))
                {
                    /*for (int i = 0; i < g.transform.childCount; i++)
                    {
                        g.transform.GetChild(i).localRotation = Quaternion.Euler(0, 180, 0);
                    }*/
                    frames.localRotation = Quaternion.Euler(0, 180, 0);
                }

                g.name = name;
                g.transform.SetParent(ts.transform, false);

                //Vector2 size = g.GetComponent<RectTransform>().sizeDelta;
                Vector2 pos = playerOperate.getInstance().getPosByPosKey(posKey);
                //x取中心位置，y取底部
                //SetGameObj.setLeftPos(new Vector2(pos.x + 200 - size.x, pos.y + (size.y - 200)), g);
                g.transform.localPosition = pos;
                g.transform.localScale = Vector2.one * GameAttrConst.getMapScaleRate();
                g.transform.localRotation = Quaternion.Euler(0, direction, 0);
                //todo:需要将y上移对齐，如果发生翻转要左对齐

                bindFightUnit(g, obj, name, color, direction, posKey, pl, ac);
            }, all);
        }

        /**用本地整帧 PNG 序列创建战斗单位（不走 pwd/aef 切块）*/
        private GameObject createSimpleFrameUnit(string animKey, string name, string posKey, float direction, FightModelMsg pl)
        {
            Transform ts = PointGet.getModelLayer();
            GameObject g = gameObjPool.getInstance().get(name, typeof(SimpleUI));
            g.transform.SetParent(ts, false);
            if (g.GetComponent<Canvas>() == null) g.AddComponent<Canvas>();
            g.AddComponent<GraphicRaycaster>().ignoreReversedGraphics = false;

            GameObject body = gameObjPool.getInstance().get("simpleBody", typeof(ImgUI));
            body.transform.SetParent(g.transform, false);
            Image img = body.GetComponent<Image>();
            SimpleFrameAnim anim = g.AddComponent<SimpleFrameAnim>();
            anim.Setup(img, animKey);

            Vector3 pos = getSimpleFramePos(posKey, pl.roleType);
            g.transform.localPosition = pos;
            // 整帧设计尺寸约 150；用半倍地图缩放，避免过大
            float unitScale = SimpleFrameAnim.FightDisplayScale();
            g.transform.localScale = Vector3.one * unitScale;
            g.transform.localRotation = Quaternion.Euler(0, direction, 0);
            return g;
        }

        /**整帧宠物站在人物正下方；其他人仍用原站位*/
        private Vector3 getSimpleFramePos(string posKey, int roleType)
        {
            if (roleType == 1 && posKey != null && posKey.Length >= 2)
            {
                int n;
                if (int.TryParse(posKey.Substring(1), out n) && n >= 5)
                {
                    string rolePosKey = posKey.Substring(0, 1) + (n - 5);
                    Vector3 rolePos = getRawPosByPosKey(rolePosKey);
                    // 人物脚下：按显示高度+名字预留，避免和人物/相邻单位重叠
                    rolePos.y -= SimpleFrameAnim.SlotSize * SimpleFrameAnim.FightDisplayScale()
                        + SimpleFrameAnim.NameReserve;
                    return rolePos;
                }
            }
            // 禁止再调 getPosByPosKey，否则带 SimpleFrameAnim 的单位会递归爆栈
            return getRawPosByPosKey(posKey);
        }

        private void bindFightUnit(GameObject g, JObject obj, string name, string color, float direction, string posKey, FightModelMsg pl, Action ac)
        {
            pl.posKey = posKey;
            modelMsgBind bind = g.GetComponent<modelMsgBind>();
            if (bind == null) bind = g.AddComponent<modelMsgBind>();
            bind.addModelMsg(pl);
            //旋转180度会导致无法点击ui的情况，所以要关闭忽略图形背面无法点击
            GraphicRaycaster gr = g.GetComponent<GraphicRaycaster>();
            if (gr == null) gr = g.AddComponent<GraphicRaycaster>();
            gr.ignoreReversedGraphics = false;

            playByStatus(g, 1);

            //橙装特效
            updateCzTx(g.transform, obj);

            float parentScale = g.transform.localScale.x;
            if (parentScale < 0.0001f) parentScale = 1f;
            Vector2 uiScale = Vector2.one / parentScale;

            GameObject title = gameObjPool.getInstance().get("name", typeof(TextUI));
            TextUI tx = title.GetComponent<TextUI>();
            tx.setText(name).setColor(color).setAlign().setFontSize(35)
            .setFontStyle().setIsRichText().horiOut().horiOut().setSize(new Vector2(100, 100));
            title.transform.SetParent(g.transform, false);
            title.transform.localScale = uiScale;
            // 整帧 pivot≈0.15，头顶约在 SlotSize*0.85；名字再往上留出字高
            float nameY = g.GetComponent<SimpleFrameAnim>() != null
                ? (SimpleFrameAnim.SlotSize * 0.88f + 12f)
                : 70f;
            title.transform.localPosition = new Vector2(0, nameY);
            title.transform.localRotation = Quaternion.Euler(0, direction, 0);
            title.AddComponent<UIOutline>().effectDistance = new Vector2(2, -2);

            //buff状态图标区
            addBuffStatus(g.transform);
            Transform buffArea = g.transform.Find("buffArea");
            if (buffArea != null) buffArea.localScale = uiScale;

            //选目标触摸的块
            addTouchKuai(g.transform);
            Transform touch = g.transform.Find("touchKuai");
            if (touch != null) touch.localScale = uiScale;

            DoGet.getInstance().startReqImg();

            players.Add(g);
            ac();
        }
        /**移除过期的buff状态图标*/
        public void clearBuffStatusIcon(Transform ts, int statusType)
        {
            Transform buffArea = ts.Find("buffArea");
            //已经显示了该buff图标则不再创建
            Transform a = buffArea.Find("bf_" + statusType);
            if (a == null) return;
            gameObjPool.getInstance().free(a.gameObject);
        }
        /**将buff图标显示出来*/
        public void showBuffStatusIcon(Transform ts, int statusType, int buffNowAddNum)
        {
            Transform buffArea = ts.Find("buffArea");
            //已经显示了该buff图标则不再创建
            if (buffArea.Find("bf_" + statusType) != null)
            {
                //Debug.Log(statusType + "-----showBuffStatusIcon----" + buffNowAddNum);
                if (buffNowAddNum >= 1 && buffArea.Find("bf_" + statusType).Find("text") != null)//刷新叠加层数
                {
                    buffArea.Find("bf_" + statusType).Find("text").GetComponent<TextUI>().setText(buffNowAddNum.ToString());
                }
                return;
            }
            string png = null;
            if (statusType == 4) png = "jn_006_png";
            else if (statusType == 5) png = "jn_023_png";
            else if (statusType == 9) png = "jn_003_png";
            else if (statusType == 10) png = "jn_004_png";
            else if (statusType == 49) png = "jn_002_png";
            else if (statusType == 52) png = "jn_012_png";
            else if (statusType == 53) png = "jn_017_png";
            else return;

            GameObject icon = gameObjPool.getInstance().get("bf_" + statusType, typeof(ImgUI));
            icon.transform.SetParent(buffArea.transform, false);
            icon.GetComponent<ImgUI>().loadRes(png)
            .setSize(new Vector2(20, 20));
            icon.transform.localPosition = new Vector2(22 * buffArea.childCount, 0);
            if (buffNowAddNum >= 1)
            {
                //显示层数
                GameObject title = gameObjPool.getInstance().get("text", typeof(TextUI));
                TextUI tx = title.GetComponent<TextUI>();
                tx.setText(buffNowAddNum.ToString()).setColor("#ffffff").setAlign().setFontSize(15)
                .setFontStyle().setIsRichText().horiOut().horiOut().setSize(new Vector2(20, 20));
                title.transform.SetParent(icon.transform, false);
                title.transform.localPosition = new Vector2(0, 0);
                title.transform.localRotation = Quaternion.Euler(0, ts.transform.localRotation.eulerAngles.y, 0);
                title.AddComponent<UIOutline>().effectDistance = new Vector2(2, -2);
            }
        }
        /**显示buff状态的区域*/
        private void addBuffStatus(Transform ts)
        {
            GameObject top = gameObjPool.getInstance().get("buffArea", typeof(SimpleUI));
            top.transform.SetParent(ts.transform, false);
            top.transform.localScale = Vector2.one / GameAttrConst.getMapScaleRate();
            top.transform.localPosition = new Vector2(0, 60);


        }
        /**选择目标对象时的触摸块*/
        public void addTouchKuai(Transform ts)
        {
            GameObject top = gameObjPool.getInstance().get("touchKuai", typeof(ImgUI));
            top.transform.SetParent(ts.transform, false);
            top.GetComponent<ImgUI>().loadRes("xiaojian_png")
            .setSize(new Vector2(15 * 4, 28 * 4)).addClk(() =>
            {
                modelMsgBind mb = ts.GetComponent<modelMsgBind>();
                Debug.Log(mb.msg.posKey);
                if (!mb.isTouch) return;
                orderOperate.getInstance().putTarget(mb.msg.posKey);

                //将所有模型设置为禁止点击
                setNoTouch();
            });
            top.transform.localScale = Vector2.one / GameAttrConst.getMapScaleRate();
            top.transform.localPosition = new Vector2(0, 50);
            top.SetActive(false);
        }
        /**刷新橙装特效*/
        public void updateCzTx(Transform ts, JObject player)
        {
            Transform a = ts.Find("cztx");
            if (a != null) gameObjPool.getInstance().free(a.gameObject);
            int lv = player.ContainsKey("goldType") ? int.Parse(player["goldType"].ToString()) : -1;
            string tx = null;
            if (lv == -1)
            {
                return;
            }
            else if (lv == 0) tx = "cztx1";
            else if (lv == 1) tx = "cztx2";
            else if (lv == 2) tx = "cztx3";
            string[] pwds = new string[1] { tx + "_pwd" };
            string[] aefs = { tx + "_aef" };
            List<string> all = new List<string>();
            all.AddRange(pwds);
            all.AddRange(aefs);
            DoGet.getInstance().collectionAnyRes(() =>
            {
                List<GameObject> list = readModel.drawGameObj(ts, pwds, aefs);

                GameObject g = list[0].gameObject;
                g.name = "cztx";
                g.transform.SetParent(ts, false);
                AniRuntime am = g.GetComponent<AniRuntime>();
                //g.transform.localScale = Vector2.one * GameAttrConst.getMapScaleRate();
                am.play();
            }, all);
        }
        /**播放技能特效*/
        public GameObject playEffect(string key, GameObject target, float dy)
        {
            /*GameObject g = new GameObject(key);
            g.transform.SetParent(PointGet.getModelLayer(), false);
            g.transform.localPosition = target.transform.localPosition * 1f;
            g.transform.localScale = Vector3.one;
            g.transform.localRotation = Quaternion.Euler(target.transform.localRotation.eulerAngles);
            g.AddComponent<lzStopCallback>();

            DoGet.getInstance().loadAnyPrefab("effect/" + key + ".prefab", (ab) =>
            {
                GameObject abObj = ab.LoadAsset<GameObject>(key + ".prefab");
                GameObject tt = GameObject.Instantiate(abObj);
                tt.transform.SetParent(g.transform, false);
                tt.transform.localPosition = new Vector3(0, dy, 0);
            });
            return g;*/
            return null;
        }
        /**添加移动到目标位置的脚本*/
        public void addToTargetPos(GameObject obj, GameObject target, Action startCall, Action endCall)
        {
            /*moveTargetAm m = obj.AddComponent<moveTargetAm>();
            m.startCall = startCall;
            m.endCall = endCall;
            m.target = target;*/

        }
        /**设置图层排序，因为命中时需要将受伤动画图层设置为最顶*/
        public void setLayerOrder(GameObject obj, bool isTop)
        {
            Canvas cv = obj.GetComponent<Canvas>();
            if (isTop)
            {
                cv.overrideSorting = true;
                cv.sortingOrder = 1;
            }
            else
            {
                cv.overrideSorting = false;
                cv.sortingOrder = 0;
            }

        }
        /**对一个包含帧对象的集合对象进行帧重载*/
        private void reloadAm(GameObject obj, string[] pwds, string aef, Action<AniRuntime> ac)
        {
            string[] aefs = { aef };
            List<string> all = new List<string>();
            all.AddRange(pwds);
            all.AddRange(aefs);
            DoGet.getInstance().collectionAnyRes(() =>
            {
                Transform ts = PointGet.getModelLayer();
                List<GameObject> list = readModel.drawGameObj(ts, pwds, aefs);

                GameObject g = list[0].gameObject;
                //将帧对象进行替换
                FrameUtils.frameReplace(obj, g);

                ac(obj.GetComponent<AniRuntime>());

            }, all);
        }


        /**播放多段动作*/
        private void playMultyAm(List<AmPlayControl> list, int i, AniRuntime am, Action ac)
        {
            if (i >= list.Count)
            {
                ac();
                return;
            }
            am.setCall(() =>
            {
                i++;
                playMultyAm(list, i, am, ac);
            }).playOnce(list[i].start, list[i].end);
        }
        /**加载boom特效*/
        private void playSjtx(Transform ts, string[] pwds, string aef, Action<AniRuntime> ac)
        {
            string[] aefs = { aef };
            List<string> all = new List<string>();
            all.AddRange(pwds);
            all.AddRange(aefs);
            DoGet.getInstance().collectionAnyRes(() =>
            {
                List<GameObject> list = readModel.drawGameObj(ts, pwds, aefs);

                GameObject g = list[0].gameObject;
                g.name = "texiao";
                g.transform.SetParent(ts, false);
                AniRuntime am = g.GetComponent<AniRuntime>();
                g.transform.localScale = Vector2.one * GameAttrConst.getMapScaleRate();

                ac(am);
            }, all);
        }
        /**播放爆炸效果（命中特效）*/
        public void playBoom(GameObject obj, Vector2 pos, string sklKey)
        {
            FightModelMsg fm = (FightModelMsg)obj.GetComponent<modelMsgBind>().msg;
            AmModelMsg md = amManager.getAttackTx(fm.amKey, sklKey);
            if (md.zdSjtxPwds != null && md.zdSjtxPwds.Length > 0)
            {
                playSjtx(obj.transform.parent, md.zdSjtxPwds, md.zdSjtxAef, (am1) =>
                {
                    am1.gameObject.transform.localPosition = pos;
                    playMultyAm(md.zdSjtxList, 0, am1, () => { gameObjPool.getInstance().free(am1.gameObject); });
                });
            }
        }
        /**复活，恢复idle状态*/
        public void playReliveStatus(GameObject obj)
        {
            FightModelMsg fm = (FightModelMsg)obj.GetComponent<modelMsgBind>().msg;
            AmModelMsg md = amManager.getAttackTx(fm.amKey, null);
            //请求pwd数据，将原来的帧全部替换
            reloadAm(obj, md.zhandouPwds, md.zhandouAef, (am) =>
            {
                playByStatus(obj, 1);
            });
        }
        public void playByStatus(GameObject obj, int status, string sklKey = null, Action<AmModelMsg> callback = null)
        {
            //0 run 1 idle 2 show2 3 die 4 hit 5 run2 6 show 7 fangyu 8 bianshen 9 battle_run
            //10 attack 11 skill 12 skill1 13 skill2 14 skill3 15 mz 16 mz1 17 mz2 18 mz3 19 mz4 20 sd

            // 整帧序列替换：待机循环，出手/命中/受伤/闪躲播一遍四帧后回调
            SimpleFrameAnim simple = obj.GetComponent<SimpleFrameAnim>();
            if (simple != null)
            {
                if (status == 1)
                {
                    simple.playLoopAll();
                    return;
                }
                if (status == 3)
                {
                    // 死亡暂无原死亡特效资源，先停在当前循环并回调
                    simple.playLoopAll();
                    if (callback != null) callback(null);
                    return;
                }
                if (status == 4 || status == 10 || status == 15 || status == 20)
                {
                    simple.playOnceAll(() => { if (callback != null) callback(null); });
                    return;
                }
                simple.playLoopAll();
                if (callback != null) callback(null);
                return;
            }

            FightModelMsg fm = (FightModelMsg)obj.GetComponent<modelMsgBind>().msg;
            AniRuntime am = obj.GetComponent<AniRuntime>();
            //am.stop();
            if (status == 1)
            {
                am.frameInterval = 0.2f;
                am.setCall(null).play(fm.zdIdle.start, fm.zdIdle.end);
                return;
            }
            else if (status == 3)
            {
                am.frameInterval = 0.2f;
                AmModelMsg md = amManager.getAmByKey("swtx");
                //请求pwd数据，将原来的帧全部替换
                reloadAm(obj, md.changguiPwds, md.changguiAef, (am) =>
                {
                    am.setCall(() =>
                    {
                        am.play(6, 12);
                        if (callback != null) callback(md);
                    }).playOnce(0, 6);
                });
                return;
            }
            else if (status == 4)
            {
                am.frameInterval = 0.05f;
                am.setCall(() => { if (callback != null) callback(null); }).playOnce(fm.zdHurt.start, fm.zdHurt.end);
                return;
            }
            else if (status == 10)
            {
                am.frameInterval = 0.05f;
                AmModelMsg md = amManager.getAttackTx(fm.amKey, sklKey);
                //请求pwd数据，将原来的帧全部替换
                reloadAm(obj, md.zhandouPwds, md.zhandouAef, (am) =>
                {
                    playMultyAm(md.zdSklList, 0, am, () =>
                    {
                        callback(md);
                    });
                });
            }
            else if (status == 15)
            {
                am.frameInterval = 0.05f;
                AmModelMsg md = amManager.getAttackTx(fm.amKey, sklKey);
                //请求pwd数据，将原来的帧全部替换
                reloadAm(obj, md.zhandouPwds, md.zhandouAef, (am) =>
                {
                    setLayerOrder(obj, true);
                    playMultyAm(md.zdMzList, 0, am, () =>
                    {
                        setLayerOrder(obj, false);
                        callback(md);
                    });
                });
            }
            else if (status == 20)
            {
                am.frameInterval = 0.05f;
                am.setCall(() => { if (callback != null) callback(null); }).playOnce(fm.zdSd.start, fm.zdSd.end);
                return;
            }
        }
        
        /**由站位获取模型位置
         * 站位 共20个位置（下方为镜像前的逻辑坐标示意，最终经 v3.x=-v3.x 交换到：角色r在左、敌人l在右）
         * 14 9 4 19
         * 12 7 2 17
         * 10 5 0 15
         * 11 6 1 16
         * 13 8 3 18
         * 镜像后屏幕从左到右：
         * 19 4 9 14
         * 17 2 7 12
         * 15 0 5 10
         * 16 1 6 11
         * 18 3 8 13
         */
        public Vector3 getPosByPosKey(string posKey)
        {
            // 已生成的整帧宠物：回家位在人物正下方
            modelMsgBind mb = getPlayer(posKey);
            if (mb != null && mb.msg != null && mb.gameObject.GetComponent<SimpleFrameAnim>() != null)
            {
                return getSimpleFramePos(posKey, mb.msg.roleType);
            }
            return getRawPosByPosKey(posKey);
        }

        /**原始站位坐标（不做整帧宠物重定向，避免递归）*/
        private Vector3 getRawPosByPosKey(string posKey)
        {
            // 高2460是标准；纵距先按 k 反推，保证乘 k 后能放下整帧+名字
            float k = ScreenUtils.height / 2460f;
            if (k < 0.01f) k = 1f;
            float row = SimpleFrameAnim.FightRowGap(k);
            //从上至下加载，4、9、2、7、0、5、1、6、3、8
            Vector3 v3 = default;
            switch (posKey)
            {
                case "l4":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100, row * 2f, 0f); break;
                    }
                case "l2":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100, row * 1f, 0f); break;
                    }
                case "l0":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100, 0, 0f); break;
                    }
                case "l1":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100, -row * 1f, 0f); break;
                    }
                case "l3":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100, -row * 2f, 0f); break;
                    }

                case "l9":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100 + 150, row * 2f - 100, 0f); break;
                    }
                case "l7":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100 + 150, row * 1f - 100, 0f); break;
                    }
                case "l5":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100 + 150, 0 - 100, 0f); break;
                    }
                case "l6":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100 + 150, -row * 1f - 100, 0f); break;
                    }
                case "l8":
                    {
                        v3 = new Vector3(-ScreenUtils.width / 2f + 100 + 150, -row * 2f - 100, 0f); break;
                    }



                case "r14": v3 = new Vector3(96f, 0f, 101f); break;
                case "r12": v3 = new Vector3(98f, 0f, 101f); break;
                case "r10": v3 = new Vector3(100f, 0f, 101f); break;
                case "r11": v3 = new Vector3(102f, 0f, 101f); break;
                case "r13": v3 = new Vector3(104f, 0f, 101f); break;

                case "r19": v3 = new Vector3(96f, 0f, 107f); break;
                case "r17": v3 = new Vector3(98f, 0f, 107f); break;
                case "r15": v3 = new Vector3(100f, 0f, 107f); break;
                case "r16": v3 = new Vector3(102f, 0f, 107f); break;
                case "r18": v3 = new Vector3(104f, 0f, 107f); break;

                case "r4":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 100, row * 2f, 0f); break;
                    }
                case "r2":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 100, row * 1f, 0f); break;
                    }
                case "r0":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 100, 0, 0f); break;
                    }
                case "r1":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 100, -row * 1f, 0f); break;
                    }
                case "r3":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 100, -row * 2f, 0f); break;
                    }

                case "r9":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 250, row * 2f - 100, 0f); break;
                    }
                case "r7":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 250, row * 1f - 100, 0f); break;
                    }
                case "r5":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 250, 0 - 100, 0f); break;
                    }
                case "r6":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 250, -row * 1f - 100, 0f); break;
                    }
                case "r8":
                    {
                        v3 = new Vector3(ScreenUtils.width / 2f - 250, -row * 2f - 100, 0f); break;
                    }

                case "l14": v3 = new Vector3(96f, 0f, 99f); break;
                case "l12": v3 = new Vector3(98f, 0f, 99f); break;
                case "l10": v3 = new Vector3(100f, 0f, 99f); break;
                case "l11": v3 = new Vector3(102f, 0f, 99f); break;
                case "l13": v3 = new Vector3(104f, 0f, 99f); break;

                case "l19": v3 = new Vector3(96f, 0f, 93f); break;
                case "l17": v3 = new Vector3(98f, 0f, 93f); break;
                case "l15": v3 = new Vector3(100f, 0f, 93f); break;
                case "l16": v3 = new Vector3(102f, 0f, 93f); break;
                case "l18": v3 = new Vector3(104f, 0f, 93f); break;
            }
            //高2460是标准，其他分辨率则按其比例计算（k 已在上方用于纵距）
            v3.y = v3.y * k - 90;//90是top区高度
            // 新地图战斗：全体站位上移 100
            try
            {
                string mk = face.roleInterface.getRole()["pos"]["map"].ToString();
                if (GameAttrConst.isFullImageMap(mk)) v3.y += 100f;
            }
            catch { }
            v3.x = -v3.x;//镜像交换：以屏幕中心为轴翻转左右站位，角色移至左侧
            return v3;
        }
    }
}
