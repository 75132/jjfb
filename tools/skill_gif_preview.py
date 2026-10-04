# -*- coding: utf-8 -*-
"""
把 skill_list.md 里的 31 个技能各自导出一个 GIF 预览，文件名 = 技能名。

- 帧源：assets/Image/Skill/ani/{anim}.anim（时间轴）+ assets/resources/Skill/{anim}-{k}.png（画面）
- 帧时长：取 .anim 的 _times 差分（MV 原生 0.0667s / 老版 0.1s），量化到 GIF 的 10ms 精度
- 画面：统一 424x458 深色棋盘底（亮/暗特效都看得清）+ 顶部技能名标签条
- 小尺寸特效按整数倍最近邻放大（cap 3x），保持硬边缘像素感
- 附带生成 skill_preview.html 总览页

用法：--dry 只统计 / --apply 写盘
"""
import json
import os
import sys
import html as _html

from PIL import Image, ImageDraw, ImageFont

COCOS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANI = os.path.join(COCOS, 'assets', 'Image', 'Skill', 'ani')
RES = os.path.join(COCOS, 'assets', 'resources', 'Skill')
OUT_DIR = os.path.join(COCOS, 'tools', '_preview', 'skill_gifs')
SLOW_DIR = os.path.join(OUT_DIR, 'slow')   # 快动画的慢放版（帧时长 ×4），仅预览用
HTML_PATH = os.path.join(COCOS, 'tools', '_preview', 'skill_preview.html')
SLOW_UNDER = 0.5   # 一轮时长低于此值 → 生成慢放版
SLOW_FACTOR = 4

PAD = 20          # 画面四周留白
HEADER = 44       # 顶部标签条高度
CELL = 60         # 棋盘格边长
MAX_ZOOM = 3      # 最大放大倍数

FONT_BD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_RG = 'C:/Windows/Fonts/msyh.ttc'

# 技能名 / 类型 / 动画短名 —— 与 tools/skill_list.md 保持同步
SKILLS = [
    # 一、技能书技能（16）
    ('肉搏攻击', '格斗', 'quan01'),
    ('光刃斩', '格斗', 'guangrenzhan'),
    ('超能拳', '格斗', 'chaonengquan'),
    ('雷霆震慑', '格斗', 'leitingzhenshe'),
    ('火焰风暴', '格斗', 'kuangnu'),
    ('雷霆冲击', '射击', 'leitingchongji'),
    ('离子激光', '射击', 'lizijiguang'),
    ('等离子弹幕', '射击', 'denglizidanmu'),
    ('虚空导弹', '射击', 'xukongdaodan'),
    ('能量爆破', '射击', 'nengliangbaopo'),
    ('电磁风暴', '射击', 'diancifengbao'),
    ('时空扭曲', '全能', 'shikongniuqu'),
    ('能量护盾', '全能', 'xinniandun'),
    ('引力压制', '全能', 'yinliyazhi'),
    ('等离子屏障', '全能', 'denglizipingzhang'),
    ('虚空冲击', '全能', 'xukongchongji'),
    # 二、补充技能（13）
    ('冲锋', '格斗', 'chongfeng'),
    ('狂怒一击', '格斗', 'kuangnu'),
    ('连续攻击', '格斗', 'lianxu'),
    ('精神攻击', '射击', 'jingsheng'),
    ('禁锢', '射击', 'jingu'),
    ('舍身一击', '射击', 'sheshen'),
    ('干扰攻击', '全能', 'ganrao'),
    ('回路干扰', '全能', 'huiluganrao'),
    ('信念盾', '全能', 'xinniandun'),
    ('紧急修理', '通用', 'xiuli'),
    ('急速攻击', '通用', 'jisu'),
    ('生命摄取', '通用', 'shengmingshequ'),
    ('能量榨取', '通用', 'zhaqu'),
    ('生命恢复', '通用', 'shengminghuifu'),
    ('能量恢复', '通用', 'nenglianghuifu'),
    # 三、悟性技能（2）
    ('纳米攻击', '全能', 'leiting'),
    ('弱点攻击', '射击', 'ruodian'),
]

TYPE_COLOR = {'格斗': '#e0533d', '射击': '#3d8de0', '全能': '#a05fe0', '通用': '#35a86b'}


def load_clip(anim):
    """返回 (帧文件名列表, 每帧时长秒列表, 一轮实际播放时长)"""
    p = os.path.join(ANI, anim + '.anim')
    clip = json.load(open(p, encoding='utf-8'))
    times = clip[5]['_times']
    n = len(times)
    frames = [os.path.join(RES, f'{anim}-{k}.png') for k in range(n)]
    # 差分得每帧显示时长；末帧沿用前一段（GIF 需要末帧也停留）
    durs = []
    for i in range(n):
        if i + 1 < n:
            durs.append(times[i + 1] - times[i])
        elif n > 1:
            durs.append(times[-1] - times[-2])
        else:
            durs.append(0.1)
    return frames, durs, sum(durs)


def checker(w, h):
    """深色棋盘底：亮色/暗色特效都能看清"""
    img = Image.new('RGB', (w, h), (43, 43, 49))
    d = ImageDraw.Draw(img)
    c2 = (53, 53, 61)
    for y in range(0, h, CELL):
        for x in range(0, w, CELL):
            if ((x // CELL) + (y // CELL)) % 2 == 0:
                d.rectangle([x, y, min(x + CELL - 1, w - 1), min(y + CELL - 1, h - 1)], fill=c2)
    return img


def compose(name, typ, anim, ims, total, tag=''):
    """把帧序列合成到棋盘底 + 标签条，返回 (P 模式帧列表, zoom, 画布尺寸)"""
    mw = max(i.width for i in ims)
    mh = max(i.height for i in ims)

    # 整数倍最近邻放大（保持硬边缘），并保证塞进内容区
    avail = 384
    zoom = max(1, min(MAX_ZOOM, avail // max(mw, mh)))
    cw, ch = mw * zoom, mh * zoom
    W = max(cw, avail) + PAD * 2
    H = max(ch, avail) + PAD * 2 + HEADER

    bg_base = checker(W, H)
    # 帧内容定位：尺寸一致 → 统一左上对齐（保留帧间相对位移）；不一致 → 逐帧居中
    same = len({i.size for i in ims}) == 1
    fb = ImageFont.truetype(FONT_BD, 22)
    fr = ImageFont.truetype(FONT_RG, 14)
    out = []
    for im in ims:
        f = bg_base.copy()
        if zoom != 1:
            im = im.resize((im.width * zoom, im.height * zoom), Image.NEAREST)
        if same:
            ox = PAD + (avail - cw) // 2
            oy = HEADER + PAD + (avail - ch) // 2
        else:
            ox = PAD + (W - PAD * 2 - im.width) // 2
            oy = HEADER + PAD + (avail - im.height) // 2
        f.paste(im, (ox, oy), im)
        # 标签条
        d = ImageDraw.Draw(f)
        d.rectangle([0, 0, W, HEADER - 1], fill=(23, 23, 27))
        d.text((PAD - 6, 9), name, font=fb, fill=(240, 240, 242))
        sub = f'{typ} · {anim} · {len(ims)}f · {total:.2f}s' + tag
        tw = d.textlength(sub, font=fr)
        d.text((W - PAD + 6 - tw, 14), sub, font=fr, fill=(140, 140, 152))
        out.append(f.convert('P', palette=Image.ADAPTIVE, colors=128))
    return out, zoom, (W, H)


def _ms(durs, factor=1.0):
    """秒 → GIF 的 10ms 量化毫秒。累积误差分配，避免逐帧取整的累积偏差
    （0.0667s 直取会变成 70ms/帧，64 帧就偏掉 +0.21s）"""
    out = []
    acc = 0.0
    for d in durs:
        acc += d * factor * 1000.0
        ms = int(round(acc / 10.0)) * 10
        acc -= ms
        out.append(max(10, ms))
    return out


def build_gif(name, typ, anim, dry=False):
    frames_p, durs, total = load_clip(anim)
    ims = [Image.open(p).convert('RGBA') for p in frames_p]
    out, zoom, size = compose(name, typ, anim, ims, total)

    path = os.path.join(OUT_DIR, name + '.gif')
    kb = slow_kb = 0
    if not dry:
        os.makedirs(OUT_DIR, exist_ok=True)
        out[0].save(path, save_all=True, append_images=out[1:], duration=_ms(durs),
                    loop=0, optimize=True, disposal=2)
        kb = os.path.getsize(path) // 1024

    # 一轮太短（< 0.5s）的动画，额外出一份慢放版到 slow/ 子目录，便于看清
    slow = total < SLOW_UNDER
    if slow and not dry:
        sout, _, _ = compose(name, typ, anim, ims, total, tag=f'  慢放×{SLOW_FACTOR}')
        os.makedirs(SLOW_DIR, exist_ok=True)
        sp = os.path.join(SLOW_DIR, name + '.gif')
        sout[0].save(sp, save_all=True, append_images=sout[1:], duration=_ms(durs, SLOW_FACTOR),
                     loop=0, optimize=True, disposal=2)
        slow_kb = os.path.getsize(sp) // 1024

    return dict(name=name, typ=typ, anim=anim, n=len(ims), total=total,
                zoom=zoom, size=size, kb=kb, slow=slow, slow_kb=slow_kb)


def build_html(rows):
    by_type = {}
    for r in rows:
        by_type.setdefault(r['typ'], []).append(r)
    order = ['格斗', '射击', '全能', '通用']
    cards = []
    for typ in order:
        for r in by_type.get(typ, []):
            c = TYPE_COLOR[typ]
            nm = _html.escape(r['name'])
            zoom_txt = f' · ×{r["zoom"]}' if r['zoom'] > 1 else ''
            slow_blk = ''
            if r['slow']:
                slow_blk = f'''
      <div class="slow">
        <img src="skill_gifs/slow/{nm}.gif" alt="{nm} 慢放" loading="lazy">
        <span>慢放 ×{SLOW_FACTOR}</span>
      </div>'''
            cards.append(f'''    <figure class="card" data-type="{typ}">
      <img class="main" src="skill_gifs/{nm}.gif" alt="{nm}" loading="lazy">
      <figcaption>
        <b>{nm}</b>
        <span class="badge" style="background:{c}">{typ}</span>
        <span class="meta">{r['anim']} · {r['n']}帧 · {r['total']:.2f}s{zoom_txt}</span>
      </figcaption>{slow_blk}
    </figure>''')
    chips = ''.join(
        f'<button class="chip{" on" if t == "全部" else ""}" data-f="{t}">{t}</button>'
        for t in ['全部'] + order)
    n_skill = len(rows)
    n_anim = len([f for f in os.listdir(ANI) if f.endswith('.anim')])
    n_slow = len([r for r in rows if r['slow']])
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>JJFB 技能特效预览（{n_skill}）</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:#111114; color:#e8e8ee;
         font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif; }}
  header {{ position:sticky; top:0; z-index:9; background:#17171bdd; backdrop-filter:blur(8px);
            border-bottom:1px solid #2a2a31; padding:14px 22px; display:flex;
            align-items:center; gap:16px; flex-wrap:wrap; }}
  h1 {{ font-size:17px; margin:0; font-weight:700; letter-spacing:.5px; }}
  .sub {{ color:#8a8a96; font-size:12px; }}
  .chip {{ background:#22222a; color:#c9c9d4; border:1px solid #33333d; border-radius:999px;
           padding:5px 14px; font-size:13px; cursor:pointer; transition:.15s; }}
  .chip:hover {{ border-color:#4a4a58; }}
  .chip.on {{ background:#3a3a48; color:#fff; border-color:#5a5a70; }}
  main {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(258px,1fr));
          gap:18px; padding:22px; }}
  .card {{ margin:0; background:#1a1a1f; border:1px solid #26262e; border-radius:12px;
           overflow:hidden; transition:.15s; }}
  .card:hover {{ border-color:#3c3c4a; transform:translateY(-2px); }}
  .card > img.main {{ display:block; width:100%; height:auto; background:#2b2b31; }}
  .slow {{ display:flex; align-items:center; gap:10px; padding:0 12px 12px; }}
  .slow img {{ width:44%; height:auto; border-radius:8px; border:1px solid #2e2e38; }}
  .slow span {{ color:#8a8a96; font-size:11px; }}
  figcaption {{ padding:10px 12px 12px; display:flex; align-items:center;
                gap:8px; flex-wrap:wrap; }}
  figcaption b {{ font-size:14px; }}
  .badge {{ font-size:11px; color:#fff; border-radius:4px; padding:1px 7px; }}
  .meta {{ color:#7e7e8c; font-size:11px; margin-left:auto; font-family:Consolas,monospace; }}
  .card.hide {{ display:none; }}
</style>
</head>
<body>
<header>
  <h1>JJFB 技能特效预览</h1>
  <span class="sub">{n_skill} 个技能 · {n_anim} 个 AnimationClip · 点标签筛选 · {n_slow} 个快动画附慢放版</span>
  <span style="flex:1"></span>
  {chips}
</header>
<main>
{chr(10).join(cards)}
</main>
<script>
  document.querySelectorAll('.chip').forEach(function (b) {{
    b.onclick = function () {{
      document.querySelectorAll('.chip').forEach(function (x) {{ x.classList.remove('on'); }});
      b.classList.add('on');
      var f = b.dataset.f;
      document.querySelectorAll('.card').forEach(function (c) {{
        c.classList.toggle('hide', f !== '全部' && c.dataset.type !== f);
      }});
    }};
  }});
</script>
</body>
</html>
'''


def main():
    dry = '--apply' not in sys.argv
    rows = []
    missing = []
    for name, typ, anim in SKILLS:
        if not os.path.exists(os.path.join(ANI, anim + '.anim')):
            missing.append((name, anim)); continue
        rows.append(build_gif(name, typ, anim, dry=dry))
    if not dry:
        open(HTML_PATH, 'w', encoding='utf-8').write(build_html(rows))
    print(('[dry] ' if dry else '[apply] ') + f'技能 {len(rows)}/{len(SKILLS)}  缺失 {missing}')
    tot = tot_kb = tot_slow = 0
    for r in rows:
        tot += r['n']
        tot_kb += r['kb']
        tot_slow += r['slow_kb']
        flag = f"  +慢放 {r['slow_kb']}KB" if r['slow'] else ''
        print(f"  {r['name']:<8}{r['typ']:<4}{r['anim']:<20}{r['n']:>3}f {r['total']:>6.2f}s  ×{r['zoom']}  {r['size']}  {r['kb']:>5}KB{flag}")
    print(f'合计 {tot} 帧 · {tot_kb} KB (+慢放 {tot_slow} KB) · 画布 {rows[0]["size"]}')
    print('HTML:', HTML_PATH)


if __name__ == '__main__':
    main()
