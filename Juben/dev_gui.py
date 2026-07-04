# 推荐：仓库根目录统一开发控制台（Juben + ws_server + 文件夹快捷）
# python -m tools.dev_launcher
import os
import queue
import re
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import messagebox, scrolledtext
import shutil
import webbrowser


ROOT = os.path.abspath(os.path.dirname(__file__))

# storage: 8787; vite 默认 5173
DEFAULT_PORTS = [8787, 5173, 5174, 5175, 5176]

_CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
_VITE_LOCAL_RE = re.compile(r"http://localhost:(\d+)", re.I)


def _run_netstat_once() -> list[str]:
    lines: list[str] = []
    seen: set[str] = set()
    for proto in ("tcp", "tcpv6"):
        cp = subprocess.run(
            ["netstat", "-ano", "-p", proto],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=_CREATE_NO_WINDOW,
        )
        if cp.returncode != 0:
            continue
        for line in cp.stdout.splitlines():
            if line not in seen:
                seen.add(line)
                lines.append(line)
    if lines:
        return lines
    cp = subprocess.run(
        ["netstat", "-ano"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_CREATE_NO_WINDOW,
    )
    if cp.returncode != 0:
        return []
    return cp.stdout.splitlines()


def pids_listening_on_ports(ports: list[int]) -> dict[int, list[int]]:
    """单次 netstat 扫描所有目标端口（避免每个端口起一个 PowerShell）。"""
    if not ports:
        return {}
    wanted = set(ports)
    found: dict[int, list[int]] = {}
    for line in _run_netstat_once():
        if "LISTENING" not in line:
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        local_addr = parts[1]
        if ":" not in local_addr:
            continue
        port_str = local_addr.rsplit(":", 1)[-1]
        try:
            port = int(port_str)
        except ValueError:
            continue
        if port not in wanted:
            continue
        try:
            pid = int(parts[-1])
        except ValueError:
            continue
        found.setdefault(port, []).append(pid)
    for port in found:
        found[port] = sorted(set(found[port]))
    return found


def pids_listening_on_port(port: int) -> list[int]:
    return pids_listening_on_ports([port]).get(port, [])


def kill_pid_tree(pid: int) -> bool:
    cp = subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        capture_output=True,
        text=True,
        creationflags=_CREATE_NO_WINDOW,
    )
    return cp.returncode == 0


def cleanup_ports(ports: list[int], *, retries: int = 2, pause_sec: float = 0.35) -> dict[int, list[int]]:
    """清理端口占用；多轮扫描避免进程刚退出端口尚未释放。"""
    killed: dict[int, list[int]] = {}
    for attempt in range(max(1, retries)):
        busy = pids_listening_on_ports(ports)
        if not busy:
            break
        for port, pids in busy.items():
            for pid in pids:
                if kill_pid_tree(pid):
                    killed.setdefault(port, [])
                    if pid not in killed[port]:
                        killed[port].append(pid)
        if attempt + 1 < retries:
            time.sleep(pause_sec)
    for port in killed:
        killed[port] = sorted(killed[port])
    return killed


def kill_process_tree(pid: int) -> bool:
    """Windows 下强制结束进程树，避免 cmd 弹出「终止批处理(Y/N)?」。"""
    if pid <= 0:
        return False
    if os.name == "nt":
        cp = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            creationflags=_CREATE_NO_WINDOW,
        )
        return cp.returncode == 0
    try:
        os.kill(pid, 15)
        return True
    except OSError:
        return False


class DevGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Juben Dev GUI")
        self.geometry("920x560")

        self.proc: subprocess.Popen | None = None
        self.web_url = "http://localhost:5173"
        self.log_q: queue.Queue[str] = queue.Queue()
        self._reader_thread: threading.Thread | None = None
        self._worker_lock = threading.Lock()

        self._build_ui()
        self.after(50, self._drain_logs)

    def _build_ui(self) -> None:
        top = tk.Frame(self)
        top.pack(fill=tk.X, padx=10, pady=10)

        self.btn_start = tk.Button(top, text="启动 (npm run dev:full)", width=24, command=self.on_start)
        self.btn_start.pack(side=tk.LEFT)

        self.btn_stop = tk.Button(top, text="停止 + 清理端口", width=18, command=self.on_stop)
        self.btn_stop.pack(side=tk.LEFT, padx=(8, 0))

        self.btn_open = tk.Button(top, text="打开浏览器", width=12, command=self.on_open_browser)
        self.btn_open.pack(side=tk.LEFT, padx=(8, 0))

        self.btn_cleanup = tk.Button(top, text="仅清理端口", width=12, command=self.on_cleanup_only)
        self.btn_cleanup.pack(side=tk.LEFT, padx=(8, 0))

        tk.Label(top, text="端口(逗号分隔):").pack(side=tk.LEFT, padx=(16, 6))
        self.port_var = tk.StringVar(value="8787,5173-5179")
        self.port_entry = tk.Entry(top, textvariable=self.port_var, width=28)
        self.port_entry.pack(side=tk.LEFT)

        self.status_var = tk.StringVar(value="就绪")
        tk.Label(top, textvariable=self.status_var).pack(side=tk.RIGHT)

    def on_open_browser(self) -> None:
        webbrowser.open(self.web_url)

    def _maybe_update_web_url(self, line: str) -> None:
        plain = _ANSI_RE.sub("", line)
        m = _VITE_LOCAL_RE.search(plain)
        if not m:
            return
        port = int(m.group(1))
        url = f"http://localhost:{port}"
        self.web_url = url
        if port != 5173:
            self.log_q.put(
                f"[gui] 注意：Vite 未使用默认 5173，当前为 {port}。"
                f"请用「打开浏览器」或访问 {url}\n"
            )
        self.after(0, lambda u=url: self.status_var.set(f"运行中 · {u}"))

        self.log = scrolledtext.ScrolledText(self, wrap=tk.WORD)
        self.log.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        self.log.configure(state=tk.DISABLED)

        bottom = tk.Frame(self)
        bottom.pack(fill=tk.X, padx=10, pady=(0, 10))
        tk.Label(bottom, text=f"工作目录: {ROOT}").pack(side=tk.LEFT)

    def _append_log(self, text: str) -> None:
        self.log.configure(state=tk.NORMAL)
        self.log.insert(tk.END, text)
        self.log.see(tk.END)
        self.log.configure(state=tk.DISABLED)

    def _drain_logs(self) -> None:
        try:
            while True:
                s = self.log_q.get_nowait()
                self._append_log(s)
        except queue.Empty:
            pass
        self.after(50, self._drain_logs)

    def _set_buttons(self, starting: bool, stopping: bool) -> None:
        self.btn_start.configure(state=tk.DISABLED if starting or stopping else tk.NORMAL)
        self.btn_stop.configure(state=tk.DISABLED if stopping else tk.NORMAL)
        self.btn_cleanup.configure(state=tk.DISABLED if starting or stopping else tk.NORMAL)

    def _parse_ports(self) -> list[int]:
        raw = self.port_var.get().strip()
        if not raw:
            return DEFAULT_PORTS[:]
        ports: list[int] = []
        for part in raw.split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                a, b = part.split("-", 1)
                try:
                    start = int(a.strip())
                    end = int(b.strip())
                    if end < start:
                        start, end = end, start
                    ports.extend(range(start, end + 1))
                    continue
                except ValueError:
                    pass
            try:
                ports.append(int(part))
            except ValueError:
                pass
        return sorted(set(ports))

    def _start_reader(self) -> None:
        assert self.proc is not None

        def _reader() -> None:
            try:
                stdout = self.proc.stdout
                if stdout is None:
                    return
                for line in iter(stdout.readline, ""):
                    if not line:
                        break
                    self._maybe_update_web_url(line)
                    self.log_q.put(line)
            finally:
                self.log_q.put("\n[gui] 子进程已退出。\n")
                self.proc = None
                self.after(0, lambda: self.status_var.set("已停止"))
                self.after(0, lambda: self._set_buttons(False, False))

        self._reader_thread = threading.Thread(target=_reader, daemon=True)
        self._reader_thread.start()

    def _start_worker(self) -> None:
        npm = shutil.which("npm.cmd") or shutil.which("npm")
        if not npm:
            self.after(
                0,
                lambda: messagebox.showerror(
                    "找不到 npm",
                    "未在系统 PATH 中找到 npm。\n\n"
                    "请先安装 Node.js，或重新打开终端/IDE 让 PATH 生效。",
                ),
            )
            self.after(0, lambda: self._set_buttons(False, False))
            self.after(0, lambda: self.status_var.set("就绪"))
            return

        ports = self._parse_ports()
        self.log_q.put("[gui] 清理端口占用…\n")
        killed = cleanup_ports(ports, retries=3, pause_sec=0.4)
        if killed:
            self.log_q.put(f"[gui] 已清理端口占用: {killed}\n")

        busy = pids_listening_on_ports(ports)
        if busy:
            self.log_q.put(f"[gui] 仍有端口被占用: {busy}\n")
            self.log_q.put("[gui] 若 Vite 跳到 5174，请点「停止」后再「仅清理端口」，或手动结束 node.exe\n")
            self.after(
                0,
                lambda b=busy: messagebox.showwarning(
                    "端口仍被占用",
                    "已尝试清理端口，但仍有端口占用未释放。\n\n"
                    f"{b}\n\n"
                    "建议以管理员运行本 GUI，或手动结束占用进程。",
                ),
            )

        self.after(0, lambda: self.status_var.set("启动中..."))
        if not os.environ.get("DEEPSEEK_API_KEY", "").strip():
            self.log_q.put("[gui] 提示: 未配置 DEEPSEEK_API_KEY，AI 助手将返回 503。可复制 .env.example 为 .env\n")
        self.log_q.put(f"[gui] 启动: {npm} run dev:full\n")
        self.web_url = "http://localhost:5173"

        popen_kw: dict = {
            "cwd": ROOT,
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT,
            "text": True,
            "encoding": "utf-8",
            "errors": "replace",
            "bufsize": 1,
        }
        if os.name == "nt":
            # npm.cmd 需 shell；CREATE_NEW_PROCESS_GROUP 便于 taskkill /T 整树结束
            popen_kw["shell"] = True
            popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
            cmd = f'"{npm}" run dev:full'
        else:
            popen_kw["shell"] = False
            cmd = [npm, "run", "dev:full"]

        try:
            proc = subprocess.Popen(cmd, **popen_kw)
        except OSError as e:
            self.log_q.put(f"[gui] 启动失败: {e}\n")
            self.after(0, lambda: self.status_var.set("启动失败"))
            self.after(0, lambda: self._set_buttons(False, False))
            return

        self.proc = proc
        self.after(0, lambda: self.status_var.set("运行中"))
        self._start_reader()

    def on_start(self) -> None:
        if self.proc is not None and self.proc.poll() is None:
            messagebox.showinfo("提示", "已经在运行了。")
            return
        if not self._worker_lock.acquire(blocking=False):
            return
        self._set_buttons(starting=True, stopping=False)
        self.status_var.set("准备中...")

        def _run() -> None:
            try:
                self._start_worker()
            finally:
                self._worker_lock.release()

        threading.Thread(target=_run, daemon=True).start()

    def _cleanup_worker(self) -> None:
        ports = self._parse_ports()
        killed = cleanup_ports(ports)
        self.log_q.put(f"[gui] 清理端口结果: {killed if killed else '无占用'}\n")
        self.after(0, lambda: self._set_buttons(False, False))

    def on_cleanup_only(self) -> None:
        if not self._worker_lock.acquire(blocking=False):
            return
        self._set_buttons(starting=False, stopping=True)
        self.status_var.set("清理端口…")

        def _run() -> None:
            try:
                self._cleanup_worker()
            finally:
                self._worker_lock.release()
                self.after(0, lambda: self.status_var.set("就绪"))

        threading.Thread(target=_run, daemon=True).start()

    def _stop_worker(self) -> None:
        ports = self._parse_ports()

        if self.proc is not None and self.proc.poll() is None:
            pid = self.proc.pid
            kill_process_tree(pid)
            t0 = time.time()
            while time.time() - t0 < 3.0:
                if self.proc.poll() is not None:
                    break
                time.sleep(0.05)
            if self.proc.poll() is None:
                try:
                    self.proc.kill()
                except Exception:
                    pass

        time.sleep(0.3)
        killed = cleanup_ports(ports, retries=2, pause_sec=0.35)
        self.log_q.put(f"[gui] 停止完成，端口清理: {killed if killed else '无占用'}\n")
        self.after(0, lambda: self.status_var.set("已停止"))
        self.after(0, lambda: self._set_buttons(False, False))

    def on_stop(self) -> None:
        if not self._worker_lock.acquire(blocking=False):
            return
        self._set_buttons(starting=False, stopping=True)
        self.status_var.set("停止中...")

        def _run() -> None:
            try:
                self._stop_worker()
            finally:
                self._worker_lock.release()

        threading.Thread(target=_run, daemon=True).start()


def main() -> int:
    if sys.platform != "win32":
        print("This GUI script is intended for Windows.")
    app = DevGui()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
