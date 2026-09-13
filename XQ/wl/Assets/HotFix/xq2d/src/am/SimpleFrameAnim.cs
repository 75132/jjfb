using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UI;
using Assets.HotFix.MyUtils.src.common;
using Assets.HotFix.MyUtils.src.factory;
using Assets.HotFix.MyUtils.src.ui.basicUI;
using Assets.HotFix.xq2d.src.common;
using Assets.HotFix.xq2d.src.model;

namespace Assets.HotFix.xq2d.src.am
{
    /**整帧序列动画（不切块），用于替换指定宠物的 pwd/aef 拼装播放*/
    public class SimpleFrameAnim : MonoBehaviour
    {
        /**整帧单位设计尺寸（原 140，现 150）*/
        public const float SlotSize = 150f;
        /**名字区预留高度（模型层坐标，与站位同一套单位）*/
        public const float NameReserve = 50f;
        /**战斗显示缩放：地图缩放的一半*/
        public static float FightDisplayScale()
        {
            return GameAttrConst.getMapScaleRate() * 0.5f;
        }
        /**
         * 战斗纵向站位间距（乘 height/2460 之前）。
         * 必须覆盖：精灵显示高度 + 名字，否则上下单位会叠在一起。
         */
        public static float FightRowGap(float heightScaleK)
        {
            float k = heightScaleK < 0.01f ? 1f : heightScaleK;
            float visualH = SlotSize * FightDisplayScale();
            // 最终 y 还会 *k，这里先 /k，保证屏幕上实际间距 ≈ visualH + NameReserve
            return (visualH + NameReserve) / k;
        }

        public float frameInterval = 0.15f;
        private Image image;
        private Sprite[] sprites;
        private float displayScale = 1f;
        private Vector2? fixedSize;
        private int curFrame;
        private int startFrame;
        private int endFrame;
        private float timer;
        private bool isAllowed;
        private bool isRepeat = true;
        private Action callback;
        private static readonly Dictionary<string, Sprite[]> cache = new Dictionary<string, Sprite[]>();

        public static bool HasLocalFrames(string animKey)
        {
            if (string.IsNullOrEmpty(animKey)) return false;
            string dir = GetAnimDir(animKey);
            return Directory.Exists(dir) && File.Exists(Path.Combine(dir, "0.png"));
        }

        /**宠物是否有本地整帧替换（按 pwdId）*/
        public static bool HasPetFrames(Pet pet)
        {
            return pet != null && HasLocalFrames(pet.pwdId);
        }

        public static string GetAnimDir(string animKey)
        {
            return Path.Combine(sysUtils.getUrl(), "simpleAnim", animKey);
        }

        /**读取 anim.json 里的 frameInterval（秒）；没有则返回 null*/
        public static float? LoadInterval(string animKey)
        {
            try
            {
                string path = Path.Combine(GetAnimDir(animKey), "anim.json");
                if (!File.Exists(path)) return null;
                string json = File.ReadAllText(path);
                // 轻量解析，避免依赖额外 JSON 库
                string key = "\"frameInterval\"";
                int i = json.IndexOf(key, StringComparison.Ordinal);
                if (i < 0) return null;
                i = json.IndexOf(':', i);
                if (i < 0) return null;
                int j = i + 1;
                while (j < json.Length && (json[j] == ' ' || json[j] == '\t')) j++;
                int k = j;
                while (k < json.Length && (char.IsDigit(json[k]) || json[k] == '.')) k++;
                if (k <= j) return null;
                float v;
                if (float.TryParse(json.Substring(j, k - j),
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out v))
                {
                    return Mathf.Max(0.02f, v);
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("SimpleFrameAnim LoadInterval: " + e.Message);
            }
            return null;
        }

        /**
         * 在 UI 节点下挂载整帧循环动画。
         * fixedSize 不为空时按固定宽高显示（头像用）；否则 SetNativeSize 后再乘 displayScale。
         * interval 若目录存在 anim.json，优先用 json 中的帧间隔（来自 GIF）。
         */
        public static GameObject Mount(Transform parent, string animKey, string childName,
            Vector2 localPos, float displayScale = 1f, Vector2? fixedSize = null, float interval = 0.15f)
        {
            if (!HasLocalFrames(animKey)) return null;
            Transform old = parent.Find(childName);
            if (old != null) gameObjPool.getInstance().free(old.gameObject);

            GameObject body = gameObjPool.getInstance().get(childName, typeof(ImgUI));
            body.transform.SetParent(parent, false);
            body.transform.localPosition = localPos;
            body.transform.localScale = Vector3.one;
            Image img = body.GetComponent<Image>();
            SimpleFrameAnim anim = body.AddComponent<SimpleFrameAnim>();
            float? fromGif = LoadInterval(animKey);
            anim.frameInterval = fromGif.HasValue ? fromGif.Value : interval;
            anim.displayScale = displayScale;
            anim.fixedSize = fixedSize;
            anim.Setup(img, animKey);
            anim.playLoopAll();
            return body;
        }

        public void Setup(Image img, string animKey)
        {
            this.image = img;
            this.sprites = LoadSprites(animKey);
            if (sprites == null || sprites.Length == 0)
            {
                Debug.LogError("SimpleFrameAnim 未找到帧: " + animKey);
                return;
            }
            // Setup 时若尚未设置过自定义间隔，尝试读 GIF 间隔
            float? fromGif = LoadInterval(animKey);
            if (fromGif.HasValue)
            {
                frameInterval = fromGif.Value;
            }
            RectTransform rt = img.GetComponent<RectTransform>();
            if (rt != null)
            {
                rt.pivot = new Vector2(0.5f, 0.15f);
            }
            img.preserveAspect = true;
            img.raycastTarget = false;
            ShowFrame(0);
            play(0, sprites.Length);
        }

        public static Sprite[] LoadSprites(string animKey)
        {
            if (cache.ContainsKey(animKey))
            {
                Sprite[] cached = cache[animKey];
                // 尺寸改过（如 140→150）时丢掉旧缓存，避免继续用旧图
                if (cached != null && cached.Length > 0 && cached[0] != null
                    && (cached[0].rect.width != SlotSize || cached[0].rect.height != SlotSize))
                {
                    cache.Remove(animKey);
                }
                else
                {
                    return cached;
                }
            }
            string dir = GetAnimDir(animKey);
            if (!Directory.Exists(dir)) return null;
            List<Sprite> list = new List<Sprite>();
            for (int i = 0; ; i++)
            {
                string path = Path.Combine(dir, i + ".png");
                if (!File.Exists(path)) break;
                byte[] bs = File.ReadAllBytes(path);
                Texture2D tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                tex.wrapMode = TextureWrapMode.Clamp;
                tex.filterMode = FilterMode.Point;
                if (!tex.LoadImage(bs))
                {
                    Debug.LogError("SimpleFrameAnim LoadImage失败: " + path);
                    break;
                }
                tex.Apply();
                Sprite sp = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.15f), 100f);
                sp.name = animKey + "_" + i;
                list.Add(sp);
            }
            Sprite[] arr = list.ToArray();
            cache[animKey] = arr;
            return arr;
        }

        private void ShowFrame(int index)
        {
            if (sprites == null || sprites.Length == 0 || image == null) return;
            if (index < 0) index = 0;
            if (index >= sprites.Length) index = sprites.Length - 1;
            image.sprite = sprites[index];
            if (fixedSize.HasValue)
            {
                image.rectTransform.sizeDelta = fixedSize.Value;
            }
            else
            {
                image.SetNativeSize();
                if (displayScale != 1f)
                {
                    Vector2 sz = image.rectTransform.sizeDelta;
                    image.rectTransform.sizeDelta = sz * displayScale;
                }
            }
        }

        void Update()
        {
            if (!isAllowed || sprites == null || sprites.Length == 0) return;
            timer += Time.deltaTime;
            if (timer < frameInterval) return;
            timer = 0;
            if (curFrame >= endFrame)
            {
                if (!isRepeat)
                {
                    isAllowed = false;
                    if (callback != null) callback();
                    curFrame = startFrame;
                    ShowFrame(Mathf.Min(curFrame, sprites.Length - 1));
                    return;
                }
                curFrame = startFrame;
            }
            ShowFrame(curFrame);
            curFrame++;
        }

        public SimpleFrameAnim setCall(Action cb)
        {
            callback = cb;
            return this;
        }

        public void play(int start = 0, int end = -1)
        {
            if (sprites == null || sprites.Length == 0) return;
            startFrame = Mathf.Clamp(start, 0, sprites.Length);
            endFrame = end < 0 ? sprites.Length : Mathf.Clamp(end, 0, sprites.Length);
            if (endFrame <= startFrame) endFrame = Mathf.Min(startFrame + 1, sprites.Length);
            curFrame = startFrame;
            isRepeat = true;
            isAllowed = true;
            timer = frameInterval;
            ShowFrame(curFrame);
        }

        public void playOnce(int start = 0, int end = -1)
        {
            play(start, end);
            isRepeat = false;
        }

        public void playLoopAll()
        {
            frameInterval = Mathf.Max(0.02f, frameInterval);
            setCall(null);
            play(0, sprites != null ? sprites.Length : -1);
        }

        public void playOnceAll(Action cb)
        {
            // 保留已从 anim.json 读取的间隔，不再强行改成 0.1
            frameInterval = Mathf.Max(0.02f, frameInterval);
            setCall(cb);
            playOnce(0, sprites != null ? sprites.Length : -1);
        }
    }
}
