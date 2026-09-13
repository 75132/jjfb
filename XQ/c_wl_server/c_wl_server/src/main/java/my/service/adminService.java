package my.service;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.sun.management.OperatingSystemMXBean;
import my.dao.userMapper;
import my.dao.jsonMapper;
import my.dao.roleMapper;
import my.db.mybatisConfig;
import my.fightUtils.fightUtils;
import my.gameUtils.rewardUtils;
import my.model.ChannelSupervise;
import my.model.user;
import my.startBef;
import my.utils.staticCollection;
import my.utils.strUtils;
import org.apache.ibatis.session.defaults.DefaultSqlSession;

import java.lang.management.ManagementFactory;
import java.util.Map;
import java.util.function.Function;

/**
 * 管理面板明文 JSON API（监控 + 游戏控制）
 */
public class adminService {
    public static final String SECRET = "iloveu";

    public static boolean checkSecret(String secret) {
        return SECRET.equals(secret);
    }

    public static JSONObject ok() {
        JSONObject o = new JSONObject();
        o.put("ok", true);
        return o;
    }

    public static JSONObject fail(String msg) {
        JSONObject o = new JSONObject();
        o.put("ok", false);
        o.put("msg", msg);
        return o;
    }

    public static JSONObject unauthorized() {
        return fail("unauthorized");
    }

    public static JSONObject status() {
        JSONObject o = new JSONObject();
        Runtime runtime = Runtime.getRuntime();
        OperatingSystemMXBean osmxb = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
        long jvmTotal = runtime.totalMemory();
        long jvmFree = runtime.freeMemory();
        long jvmUsed = jvmTotal - jvmFree;
        long osTotal = osmxb.getTotalPhysicalMemorySize();
        long osFree = osmxb.getFreePhysicalMemorySize();

        o.put("ok", true);
        o.put("port", staticCollection.port);
        o.put("allowed", staticCollection.isAllowedReq);
        o.put("apkVersion", staticCollection.apkVersion);
        o.put("resVersion", staticCollection.resVersion);
        o.put("notice", staticCollection.noticeMsg);
        o.put("online", staticCollection.userMap.size());
        o.put("hostname", System.getenv().get("COMPUTERNAME"));
        o.put("osName", System.getProperty("os.name"));
        o.put("javaVersion", System.getProperty("java.version"));
        o.put("startTime", ManagementFactory.getRuntimeMXBean().getStartTime());
        o.put("upTime", ManagementFactory.getRuntimeMXBean().getUptime());
        o.put("jvmTotal", jvmTotal);
        o.put("jvmFree", jvmFree);
        o.put("jvmUsed", jvmUsed);
        o.put("osTotal", osTotal);
        o.put("osFree", osFree);
        o.put("osUsed", osTotal - osFree);
        return o;
    }

    public static JSONObject online() {
        JSONObject o = new JSONObject();
        JSONArray list = new JSONArray();
        for (Map.Entry<String, user> e : staticCollection.userMap.entrySet()) {
            user u = e.getValue();
            if (u == null) continue;
            JSONObject row = new JSONObject();
            row.put("sbh", e.getKey());
            row.put("name", u.name);
            row.put("ip", u.ip);
            if (u.msg != null) {
                row.put("lever", u.msg.get("lever"));
                row.put("model", u.msg.get("model"));
                JSONObject pos = u.msg.getJSONObject("pos");
                if (pos != null) {
                    row.put("map", pos.get("map"));
                }
            }
            list.add(row);
        }
        o.put("ok", true);
        o.put("count", list.size());
        o.put("list", list);
        return o;
    }

    public static JSONObject runtime() {
        JSONObject o = new JSONObject();
        o.put("ok", true);
        o.put("online", staticCollection.userMap.size());
        o.put("auth", staticCollection.authMap.size());
        o.put("team", staticCollection.teamMap.size());
        o.put("fight", fightUtils.fightMap.size());
        o.put("buff", fightUtils.buffMap.size());
        o.put("order", fightUtils.orderMap.size());
        o.put("role", fightUtils.roleMap.size());
        o.put("monster", fightUtils.monsterMap.size());
        o.put("overTimeOrder", fightUtils.overTimeOrderMap.size());
        o.put("ipLimit", staticCollection.ipMap.size());
        o.put("sameReq", staticCollection.sameReqMap.size());
        o.put("chatWorld", staticCollection.chatList0.size());
        o.put("chatNear", staticCollection.chatList1.size());
        o.put("pos", staticCollection.posMap.size());
        o.put("jingji", staticCollection.jingjiMap.size());
        o.put("codes", staticCollection.codes.size());
        o.put("hurt", staticCollection.hurtMap.size());
        o.put("hongbao", staticCollection.hongbaoList.size());
        o.put("goods", staticCollection.goodsMap.size());
        o.put("players", staticCollection.players.size());
        o.put("pushUser", staticCollection.pushUser.size());
        return o;
    }

    /** 踢下线指定角色 */
    public static JSONObject kick(JSONObject body) {
        String name = body == null ? null : body.getString("name");
        if (strUtils.isNull(name)) {
            return fail("缺少角色名 name");
        }
        user u = staticCollection.getUserByName(name);
        if (u == null) {
            return fail("玩家不在线");
        }
        try {
            startBef.teamService.handleOffLine(name);
            startBef.logService.offLine(name);
            startBef.prisonService.updateTotal(name);
        } catch (Exception ignored) {
        }
        u.offLine();
        JSONObject o = ok();
        o.put("msg", "已踢下线: " + name);
        return o;
    }

    /** 踢全部在线 */
    public static JSONObject kickAll() {
        int n = staticCollection.userMap.size();
        ChannelSupervise.closeAllClient();
        staticCollection.userMap.clear();
        JSONObject o = ok();
        o.put("msg", "已踢下线全部玩家");
        o.put("count", n);
        return o;
    }

    /** 维护开关：false 拒收游戏请求，admin 仍可用 */
    public static JSONObject setAllowed(JSONObject body) {
        if (body == null || body.get("allowed") == null) {
            return fail("缺少 allowed");
        }
        boolean allowed = body.getBooleanValue("allowed");
        staticCollection.isAllowedReq = allowed;
        if (!allowed) {
            try {
                startBef.chatService.putSysMsg("服务器进入维护，请稍后登录");
            } catch (Exception ignored) {
            }
        }
        JSONObject o = ok();
        o.put("allowed", staticCollection.isAllowedReq);
        o.put("msg", allowed ? "已开放入站" : "已开启维护（拒收游戏请求）");
        return o;
    }

    /** 世界系统公告（聊天频道） */
    public static JSONObject broadcast(JSONObject body) {
        String content = body == null ? null : body.getString("content");
        if (strUtils.isNull(content)) {
            return fail("缺少 content");
        }
        if (content.length() > 500) {
            return fail("内容过长");
        }
        startBef.chatService.putSysMsg(content);
        JSONObject o = ok();
        o.put("msg", "公告已发送");
        return o;
    }

    /**
     * 发放货币
     * type: gold | tale | yinPiao
     */
    public static JSONObject grantCurrency(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        String type = body.getString("type");
        long num = body.getLongValue("num");
        if (strUtils.isNull(name) || strUtils.isNull(type) || num <= 0) {
            return fail("需要 name、type、num>0");
        }
        if (!"gold".equals(type) && !"tale".equals(type) && !"yinPiao".equals(type)) {
            return fail("type 仅支持 gold/tale/yinPiao");
        }
        if (num > 100000000L) {
            return fail("单次数值过大");
        }
        final String player = name;
        final String currency = type;
        final long amount = num;
        Function<DefaultSqlSession, Object> fn = (con) -> {
            JSONArray rewards;
            if ("gold".equals(currency)) {
                rewards = rewardUtils.getGoldReward(amount);
            } else if ("tale".equals(currency)) {
                rewards = rewardUtils.getTaleReward(amount);
            } else {
                rewards = rewardUtils.getYinPiaoReward(amount);
            }
            startBef.rewardService.saveRewards(rewards, player, con);
            ChannelSupervise.noticeClientByName(rewards, player, "10000");
            return rewards;
        };
        try {
            mybatisConfig.putTask(fn);
        } catch (Exception e) {
            return fail("发放失败: " + e.getMessage());
        }
        JSONObject o = ok();
        o.put("msg", "已发放 " + type + " x" + num + " 给 " + name);
        return o;
    }

    /** 发放物品 key + num + 可选 bind(0/1) */
    public static JSONObject grantGoods(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        String key = body.getString("key");
        int num = body.getIntValue("num");
        int bind = body.get("bind") == null ? 0 : body.getIntValue("bind");
        if (strUtils.isNull(name) || strUtils.isNull(key) || num <= 0) {
            return fail("需要 name、key、num>0");
        }
        if (num > 9999) {
            return fail("数量过大");
        }
        final String player = name;
        final String goodsKey = key;
        final int goodsNum = num;
        final int isBind = bind;
        Function<DefaultSqlSession, Object> fn = (con) -> {
            JSONArray rewards = rewardUtils.getGoodsReward(goodsKey, goodsNum, isBind);
            startBef.rewardService.saveRewards(rewards, player, con);
            ChannelSupervise.noticeClientByName(rewards, player, "10000");
            return rewards;
        };
        try {
            mybatisConfig.putTask(fn);
        } catch (Exception e) {
            return fail("发放失败: " + e.getMessage());
        }
        JSONObject o = ok();
        o.put("msg", "已发放物品 " + key + " x" + num + " 给 " + name);
        return o;
    }

    /** 强制改密（账号用户名） */
    public static JSONObject resetPassword(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String username = body.getString("username");
        String password = body.getString("password");
        if (strUtils.isNull(username) || strUtils.isNull(password)) {
            return fail("需要 username、password");
        }
        if (username.length() > 30 || password.length() > 30) {
            return fail("用户名或密码过长");
        }
        final String u = username;
        final String p = password;
        final boolean[] done = {false};
        Function<DefaultSqlSession, Object> fn = (con) -> {
            userMapper um = mybatisConfig.getMapper(con, userMapper.class);
            done[0] = um.updatePassword(u, p);
            return null;
        };
        mybatisConfig.putTask(fn);
        if (!done[0]) {
            return fail("改密失败，请确认账号存在");
        }
        JSONObject o = ok();
        o.put("msg", "已重置密码: " + username);
        return o;
    }

    /**
     * 发放宠物
     * body: name, key, quality(可选 1-5，缺省走随机/特殊规则)
     */
    public static JSONObject grantPet(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        String key = body.getString("key");
        Integer quality = body.get("quality") == null ? null : body.getInteger("quality");
        if (strUtils.isNull(name) || strUtils.isNull(key)) {
            return fail("需要 name、key（宠物ID）");
        }
        if (quality != null && (quality < 1 || quality > 5)) {
            return fail("quality 范围 1-5");
        }
        final String player = name;
        final String petKey = key;
        final Integer q = quality;
        final JSONObject[] petHolder = {null};
        final String[] err = {null};

        // 离线时临时挂一个用户，保证 createPet 能取到 projRootDir
        boolean tmpUser = false;
        String tmpSbh = null;
        user exist = staticCollection.getUserByName(player);
        if (exist == null) {
            user tmp = new user(player);
            tmp.projRootDir = "xq2d";
            tmp.sbh = "admin-tmp-" + System.currentTimeMillis();
            tmpSbh = tmp.sbh;
            staticCollection.userMap.put(tmp.sbh, tmp);
            tmpUser = true;
        } else if (strUtils.isNull(exist.projRootDir)) {
            exist.projRootDir = "xq2d";
        }

        try {
            Function<DefaultSqlSession, Object> fn = (con) -> {
                if (startBef.manService.getRole(player, con) == null) {
                    err[0] = "角色不存在";
                    return null;
                }
                JSONObject pet = q == null
                        ? startBef.petService.createPet(petKey, player, con)
                        : startBef.petService.createPet(petKey, q, player, con);
                if (pet == null) {
                    err[0] = "生成宠物失败，请检查宠物ID";
                    return null;
                }
                petHolder[0] = pet;
                JSONArray ps = rewardUtils.getPetReward(pet);
                ChannelSupervise.noticeClientByName(ps, player, "10000");
                return pet;
            };
            mybatisConfig.putTask(fn);
        } finally {
            if (tmpUser && tmpSbh != null) {
                staticCollection.userMap.remove(tmpSbh);
            }
        }
        if (err[0] != null) return fail(err[0]);
        if (petHolder[0] == null) return fail("发放宠物失败");
        JSONObject o = ok();
        o.put("msg", "已发放宠物 " + key + " 给 " + name);
        o.put("petId", petHolder[0].get("Id"));
        o.put("quality", petHolder[0].get("quality"));
        return o;
    }

    /**
     * 设置角色等级
     * body: name, lever
     */
    public static JSONObject setLevel(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        int lever = body.getIntValue("lever");
        if (strUtils.isNull(name) || lever < 1 || lever > 200) {
            return fail("需要 name，lever 范围 1-200");
        }
        final String player = name;
        final int lv = lever;
        final String[] err = {null};
        Function<DefaultSqlSession, Object> fn = (con) -> {
            if (startBef.manService.getRole(player, con) == null) {
                err[0] = "角色不存在";
                return null;
            }
            roleMapper rm = mybatisConfig.getMapper(con, roleMapper.class);
            rm.updateLv((long) lv, player);
            user u = staticCollection.getUserByName(player);
            if (u != null && u.msg != null) {
                u.msg.put("lever", lv);
            }
            try {
                JSONObject prop = startBef.manService.getProp(player, con);
                JSONObject attr = startBef.manService.getFightAttr(player, con).getJSONObject("prop");
                if (attr != null) {
                    if (attr.get("max_xue") != null) prop.put("xue", attr.getInteger("max_xue"));
                    if (attr.get("max_lan") != null) prop.put("lan", attr.getInteger("max_lan"));
                }
                jsonMapper jm = mybatisConfig.getMapper(con, jsonMapper.class);
                jm.updatePropByName(JSON.toJSONString(prop), player);
                startBef.orderService.countLvOrder(player);
                startBef.orderService.countZlOrder(player);
            } catch (Exception e) {
                e.printStackTrace();
            }
            return lv;
        };
        mybatisConfig.putTask(fn);
        if (err[0] != null) return fail(err[0]);
        JSONObject o = ok();
        o.put("msg", "已将 " + name + " 等级设为 " + lever);
        o.put("lever", lever);
        return o;
    }

    /**
     * 增加角色经验（会按规则触发升级）
     * body: name, exp
     */
    public static JSONObject addExp(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        int exp = body.getIntValue("exp");
        if (strUtils.isNull(name) || exp == 0) {
            return fail("需要 name、exp（非0）");
        }
        if (Math.abs(exp) > 200000000) {
            return fail("经验数值过大");
        }
        final String player = name;
        final int add = exp;
        final String[] err = {null};
        final int[] before = {0};
        final int[] after = {0};
        Function<DefaultSqlSession, Object> fn = (con) -> {
            JSONObject role = startBef.manService.getRole(player, con);
            if (role == null) {
                err[0] = "角色不存在";
                return null;
            }
            before[0] = role.getInteger("lever");
            // limitLv 设高，便于管理端直接升到高等级
            startBef.manService.upLv(player, add, con, 200);
            JSONObject role2 = startBef.manService.getRole(player, con);
            after[0] = role2.getInteger("lever");
            JSONArray rewards = rewardUtils.getExpReward(Math.max(add, 0), 0, new JSONArray());
            ChannelSupervise.noticeClientByName(rewards, player, "10000");
            return null;
        };
        mybatisConfig.putTask(fn);
        if (err[0] != null) return fail(err[0]);
        JSONObject o = ok();
        o.put("msg", "已给 " + name + " 增加经验 " + exp + "（等级 " + before[0] + " → " + after[0] + "）");
        o.put("beforeLevel", before[0]);
        o.put("afterLevel", after[0]);
        return o;
    }

    /**
     * 直接设置当前经验值（不自动连升，仅改 prop.exp）
     * body: name, exp
     */
    public static JSONObject setExp(JSONObject body) {
        if (body == null) return fail("缺少参数");
        String name = body.getString("name");
        if (strUtils.isNull(name) || body.get("exp") == null) {
            return fail("需要 name、exp");
        }
        int exp = body.getIntValue("exp");
        if (exp < 0 || exp > 200000000) {
            return fail("exp 范围 0-200000000");
        }
        final String player = name;
        final int val = exp;
        final String[] err = {null};
        Function<DefaultSqlSession, Object> fn = (con) -> {
            if (startBef.manService.getRole(player, con) == null) {
                err[0] = "角色不存在";
                return null;
            }
            JSONObject patch = new JSONObject();
            patch.put("exp", val);
            int r = startBef.manService.saveProp(player, patch, con);
            if (r != 1) {
                err[0] = "保存经验失败";
            }
            return null;
        };
        mybatisConfig.putTask(fn);
        if (err[0] != null) return fail(err[0]);
        JSONObject o = ok();
        o.put("msg", "已将 " + name + " 经验设为 " + exp);
        o.put("exp", exp);
        return o;
    }

    /** 角色目录（供下拉选择） */
    public static JSONObject roles() {
        final JSONArray list = new JSONArray();
        Function<DefaultSqlSession, Object> fn = (con) -> {
            roleMapper rm = mybatisConfig.getMapper(con, roleMapper.class);
            // 分页取一批角色，足够控制台用
            java.util.List<JSONObject> rows = rm.getRolesByPage(0L, 500L);
            if (rows != null) {
                for (JSONObject r : rows) {
                    JSONObject row = new JSONObject();
                    row.put("name", r.getString("name"));
                    row.put("lever", r.get("lever"));
                    row.put("username", r.getString("username"));
                    row.put("model", r.get("model"));
                    list.add(row);
                }
            }
            return null;
        };
        mybatisConfig.putTask(fn);
        JSONObject o = ok();
        o.put("list", list);
        o.put("count", list.size());
        return o;
    }
}
