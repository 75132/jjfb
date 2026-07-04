"""机甲风暴 · 开发控制台。"""

import sys

from .console_filters import install_console_filters

install_console_filters()

from .app import main
from .bootstrap import run_bootstrap

if __name__ == "__main__":
    skip_npm = "--skip-npm" in sys.argv
    code = run_bootstrap(skip_npm=skip_npm)
    if code != 0:
        raise SystemExit(code)
    raise SystemExit(main())
