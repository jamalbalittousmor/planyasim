#!/usr/bin/env python3
"""
Симулятор Плани v2 — лаунчер.

Открывает index.html через встроенный в PySide6 Chromium (Qt WebEngine)
прямо с диска (file://), без запуска какого-либо локального сервера.
Доступ к локальным файлам и внешним ресурсам (шрифты) разрешён настройками
движка, поэтому браузер не ругается на CORS.

Запуск:  pip install PySide6   →   python launcher.py
Клавиши: F11 — полный экран, F12 — DevTools, Ctrl+R / F5 — перезагрузка.
"""
import os
import sys
from pathlib import Path

# Флаги Chromium нужно выставить ДО создания QApplication
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--autoplay-policy=no-user-gesture-required --allow-file-access-from-files --ignore-gpu-blocklist --enable-gpu-rasterization",
)

from PySide6.QtCore import QStandardPaths, QUrl, Qt
from PySide6.QtGui import QDesktopServices, QIcon, QKeySequence, QShortcut
from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox
from PySide6.QtWebEngineCore import (
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineScript,
    QWebEngineSettings,
)
from PySide6.QtWebEngineWidgets import QWebEngineView

APP_NAME = "Симулятор Плани v2"
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
INDEX = BASE_DIR / "index.html"
ICON = BASE_DIR / "assets" / "img" / "icon.png"


class ExternalLinkPage(QWebEnginePage):
    """Временная страница для target=_blank: отдаёт ссылку системному браузеру."""

    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        if url.scheme() in ("http", "https"):
            QDesktopServices.openUrl(url)
        self.deleteLater()
        return False


class GamePage(QWebEnginePage):
    def acceptNavigationRequest(self, url, nav_type, is_main_frame):
        # Клик по внешней ссылке (соцсети Плани) — открываем в обычном браузере
        if (
            is_main_frame
            and url.scheme() in ("http", "https")
            and nav_type == QWebEnginePage.NavigationType.NavigationTypeLinkClicked
        ):
            QDesktopServices.openUrl(url)
            return False
        return super().acceptNavigationRequest(url, nav_type, is_main_frame)

    def createWindow(self, _type):
        return ExternalLinkPage(self.profile(), self)

    def javaScriptConsoleMessage(self, level, message, line, source):
        if level == QWebEnginePage.JavaScriptConsoleMessageLevel.ErrorMessageLevel:
            print(f"[JS] {source}:{line}: {message}", file=sys.stderr)


class Launcher(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        if ICON.exists():
            self.setWindowIcon(QIcon(str(ICON)))
        self.resize(1600, 900)
        self.setMinimumSize(960, 540)
        self.setStyleSheet("background:#05040d;")

        # Постоянный профиль → localStorage (сохранения) живёт между запусками
        data_dir = Path(QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppDataLocation)) / "PlanyaSim2"
        data_dir.mkdir(parents=True, exist_ok=True)
        self.profile = QWebEngineProfile("PlanyaSim2", self)
        self.profile.setPersistentStoragePath(str(data_dir / "storage"))
        self.profile.setCachePath(str(data_dir / "cache"))
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.PersistentCookiesPolicy.ForcePersistentCookies)

        # Флаг для игры: «мы внутри лаунчера»
        script = QWebEngineScript()
        script.setName("launcher-flag")
        script.setSourceCode("window.__qtLauncher = true;")
        script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentCreation)
        script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
        self.profile.scripts().insert(script)

        self.page = GamePage(self.profile, self)
        s = self.page.settings()
        A = QWebEngineSettings.WebAttribute
        for attr, val in (
            (A.LocalContentCanAccessFileUrls, True),
            (A.LocalContentCanAccessRemoteUrls, True),
            (A.LocalStorageEnabled, True),
            (A.JavascriptEnabled, True),
            (A.PlaybackRequiresUserGesture, False),
            (A.FullScreenSupportEnabled, True),
            (A.Accelerated2dCanvasEnabled, True),
            (A.WebGLEnabled, True),
            (A.ShowScrollBars, False),
        ):
            s.setAttribute(attr, val)
        self.page.fullScreenRequested.connect(self._on_fullscreen_request)

        self.view = QWebEngineView(self)
        self.view.setPage(self.page)
        self.view.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.setCentralWidget(self.view)
        self.view.load(QUrl.fromLocalFile(str(INDEX)))

        QShortcut(QKeySequence("F11"), self, activated=self.toggle_fullscreen)
        QShortcut(QKeySequence("F12"), self, activated=self.open_devtools)
        QShortcut(QKeySequence("F5"), self, activated=self.view.reload)
        QShortcut(QKeySequence("Ctrl+R"), self, activated=self.view.reload)
        self._devtools = None

    def _on_fullscreen_request(self, request):
        request.accept()
        if request.toggleOn():
            self.showFullScreen()
        else:
            self.showNormal()

    def toggle_fullscreen(self):
        if self.isFullScreen():
            self.showNormal()
        else:
            self.showFullScreen()

    def open_devtools(self):
        if self._devtools is None:
            self._devtools = QWebEngineView()
            self._devtools.setWindowTitle(f"{APP_NAME} — DevTools")
            self._devtools.resize(1100, 700)
            self.page.setDevToolsPage(self._devtools.page())
        self._devtools.show()
        self._devtools.raise_()


def main():
    QApplication.setApplicationName("PlanyaSim2")
    QApplication.setOrganizationName("PlanyaFan")
    app = QApplication(sys.argv)
    if not INDEX.exists():
        QMessageBox.critical(None, APP_NAME, f"Не найден файл игры:\n{INDEX}")
        return 1
    win = Launcher()
    win.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
