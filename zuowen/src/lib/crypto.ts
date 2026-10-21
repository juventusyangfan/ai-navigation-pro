// 作文正文的加密封装（AES-256-GCM）
//
// 为什么加密：作文里几乎必然出现孩子的姓名、学校、班级、住址片段，
// 属于儿童个人信息。库文件一旦被拷走或误传，明文等于把一批孩子的信息摊开。
//
// 存盘格式固定为 zw1:<iv>:<authTag>:<ciphertext>，后三段都是 base64。
// 注意不要用字符串拼接各段时带上多余的冒号，否则解密时字段错位、
// 而且会静默解不出原文（GCM 校验失败但不一定抛在你想的地方）。
//
// 密钥来源：ZW_TEXT_KEY，32 字节，支持 64 位 hex 或 base64。
// 生产环境缺密钥 → 拒绝写入（fail-closed），不静默存明文。
// 读路径故意不抛：把写路径的严格带到读路径，会让一次配置失误放大成全站 500，
// 家长看到的是白屏而不是一句人话。这里降级为空串，由上层按「正文不可用」处理。

import crypto from "node:crypto";

const PREFIX = "zw1";
let cachedKey: Buffer | null = null;
let warned = false;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = (process.env.ZW_TEXT_KEY || "").trim();
  if (!raw) throw new Error("缺少 ZW_TEXT_KEY 环境变量");
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) buf = Buffer.from(raw, "hex");
  else {
    buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) buf = Buffer.from(raw, "utf8");
  }
  if (buf.length !== 32) {
    throw new Error("ZW_TEXT_KEY 必须是 32 字节（64 位 hex 或 44 位 base64）");
  }
  cachedKey = buf;
  return buf;
}

export function encryptText(plain: string): string {
  const key = loadKey(); // 写入路径：缺密钥直接抛，由调用方转成明确的错误
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** 解密失败一律返回空串，绝不抛。 */
export function decryptText(stored: string): string {
  try {
    if (!stored) return "";
    const parts = stored.split(":");
    if (parts.length !== 4 || parts[0] !== PREFIX) return "";
    const key = loadKey();
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const ct = Buffer.from(parts[3], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (err) {
    if (!warned) {
      warned = true;
      console.error("[zuowen][正文解密失败] 后续同类错误不再重复打印", err);
    }
    return "";
  }
}

/** 是否已配置密钥。用于启动自检与健康检查，不暴露密钥本身。 */
export function hasTextKey(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** IP 单向哈希，只用于滥用风控，不可反查。 */
export function hashIp(ip: string): string {
  const salt = process.env.ZW_IP_SALT || "zuowen-default-salt";
  return crypto.createHash("sha256").update(salt + "|" + ip).digest("hex").slice(0, 32);
}
