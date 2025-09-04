bl_info = {
    "name": "WebView Panel Tracker",
    "author": "William MacLeod",
    "version": (1, 1),
    "blender": (4, 5, 1),
    "location": "View3D > Sidebar > Panel Info",
    "description": "Launches and tracks WebView window position relative to Blender",
    "category": "Development",
}

import atexit
import ctypes
import json
import os
import subprocess
import threading
import time
import shutil
import tempfile
from ctypes import wintypes

import bpy
from bpy.types import Operator, Panel

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

user32.FindWindowW.restype = wintypes.HWND
kernel32.CreateFileW.restype = wintypes.HANDLE
kernel32.WriteFile.restype = wintypes.BOOL
kernel32.ReadFile.restype = wintypes.BOOL
kernel32.CloseHandle.restype = wintypes.BOOL
kernel32.CreateNamedPipeW.restype = wintypes.HANDLE
kernel32.ConnectNamedPipe.restype = wintypes.BOOL
kernel32.GetLastError.restype = wintypes.DWORD
user32.GetWindowRect.restype = wintypes.BOOL
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]

GENERIC_WRITE = 0x40000000
OPEN_EXISTING = 3
INVALID_HANDLE_VALUE = wintypes.HANDLE(-1).value
PIPE_NAME = "\\\\.\\pipe\\BlenderWebViewPipe"
SCRIPT_PIPE_NAME = "\\\\.\\pipe\\BlenderScriptPipe"
UPDATE_THRESHOLD = 0.5
PIPE_ACCESS_INBOUND = 0x00000001
ERROR_PIPE_CONNECTED = 535

last_window_rect = None
last_update_time = 0
stop_ipc = True
webview_process = None
script_listener_thread = None
temp_run_dir = None


def get_window_rect(hwnd):
    rect = wintypes.RECT()
    return (
        (rect.left, rect.top, rect.right, rect.bottom)
        if user32.GetWindowRect(hwnd, ctypes.byref(rect))
        else None
    )


def get_blender_layout_info():
    window_info = get_blender_window_info() or (0, 0, 1920, 1080)
    x, y, width, height = window_info

    return {
        "windows": [
            {
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "screen": {
                    "name": window.screen.name,
                    "areas": [
                        {
                            "type": area.type,
                            "x": area.x,
                            "y": area.y,
                            "width": area.width,
                            "height": area.height,
                            "regions": [
                                {
                                    "type": region.type,
                                    "x": area.x + region.x,
                                    "y": area.y + region.y,
                                    "width": region.width,
                                    "height": region.height,
                                    "alignment": region.alignment,
                                }
                                for region in area.regions
                                if region.width > 0 and region.height > 0
                            ],
                        }
                        for area in window.screen.areas
                    ],
                },
            }
            for window in bpy.context.window_manager.windows
        ]
    }


def get_blender_window_info():
    hwnd = user32.FindWindowW("GHOST_WindowClass", None)
    if not hwnd:
        return None

    window_rect = get_window_rect(hwnd)
    if not window_rect:
        return None

    left, top, right, bottom = window_rect
    return (left, top, right - left, bottom - top)


def send_window_info():
    global last_window_rect, last_update_time

    current_time = time.time()
    window_info = get_blender_window_info()

    if not window_info or (
        last_window_rect == window_info
        and current_time - last_update_time < UPDATE_THRESHOLD
    ):
        return

    x, y, width, height = window_info

    pipe_handle = kernel32.CreateFileW(
        PIPE_NAME, GENERIC_WRITE, 0, None, OPEN_EXISTING, 0, None
    )
    if pipe_handle != INVALID_HANDLE_VALUE:
        layout_info = get_blender_layout_info()
        message = f"LAYOUT:{x},{y},{width},{height}|{json.dumps(layout_info, separators=(',', ':'))}"
        message_bytes = message.encode("utf-8")
        bytes_written = wintypes.DWORD()
        kernel32.WriteFile(
            pipe_handle,
            message_bytes,
            len(message_bytes),
            ctypes.byref(bytes_written),
            None,
        )
        kernel32.CloseHandle(pipe_handle)
        last_window_rect = window_info
        last_update_time = current_time


def script_listener_worker():
    global stop_ipc

    while not stop_ipc:
        pipe_handle = kernel32.CreateNamedPipeW(
            SCRIPT_PIPE_NAME, PIPE_ACCESS_INBOUND, 0, 1, 8192, 8192, 0, None
        )
        if pipe_handle == INVALID_HANDLE_VALUE:
            time.sleep(0.05)
            continue

        if not kernel32.ConnectNamedPipe(pipe_handle, None):
            if kernel32.GetLastError() != ERROR_PIPE_CONNECTED:
                kernel32.CloseHandle(pipe_handle)
                time.sleep(0.05)
                continue

        buffer = ctypes.create_string_buffer(8192)
        bytes_read = wintypes.DWORD(0)
        data = bytearray()
        while kernel32.ReadFile(
            pipe_handle, buffer, 8192, ctypes.byref(bytes_read), None
        ):
            if bytes_read.value == 0:
                break
            data.extend(buffer.raw[: bytes_read.value])

        kernel32.CloseHandle(pipe_handle)

        if not data:
            continue

        text = data.decode("utf-8")
        if text.startswith("SCRIPT_LOAD:"):
            json_data = text[12:]
            script_data = json.loads(json_data)
            handle_script_load_message(script_data)


def ipc_update_thread():
    global stop_ipc

    while not stop_ipc:
        if not _is_blender_context_valid():
            break
        send_window_info()
        time.sleep(UPDATE_THRESHOLD)


def _is_blender_context_valid():
    return (
        hasattr(bpy, "context")
        and bpy.context is not None
        and bpy.context.window_manager is not None
        and bpy.context.window_manager.windows
    )


class PANEL_INFO_OT_launch_webview(Operator):
    bl_idname = "panel_info.launch_webview"
    bl_label = "Launch WebView"
    bl_description = "Launches the WebView application with position tracking"

    def execute(self, context):
        global webview_process, stop_ipc, last_window_rect, script_listener_thread, temp_run_dir

        window_info = get_blender_window_info()
        addon_root = os.path.dirname(os.path.abspath(__file__))
        src_bin = os.path.join(addon_root, "bin")
        exe_src = os.path.join(src_bin, "WebView2Control.exe")
        if not (os.path.isdir(src_bin) and os.path.exists(exe_src)):
            return {"CANCELLED"}

        try:
            temp_run_dir = tempfile.mkdtemp(prefix="RemoteBlenderServer_")
            shutil.copytree(src_bin, temp_run_dir, dirs_exist_ok=True)
            src_ui = os.path.join(addon_root, "web_ui")
            if os.path.isdir(src_ui):
                shutil.copytree(
                    src_ui, os.path.join(temp_run_dir, "web_ui"), dirs_exist_ok=True
                )

            webview_path = os.path.join(temp_run_dir, "WebView2Control.exe")
            loader_path = os.path.join(temp_run_dir, "WebView2Loader.dll")
            if not (os.path.exists(webview_path) and os.path.exists(loader_path)):
                raise RuntimeError(
                    "Missing WebView2Control.exe or WebView2Loader.dll in temp run dir"
                )

            stop_ipc = False
            last_window_rect = window_info
            script_listener_thread = threading.Thread(
                target=script_listener_worker, daemon=True
            )
            script_listener_thread.start()

            initial_params = (
                f"{window_info[0]},{window_info[1]},{window_info[2]},{window_info[3]}"
            )
            webview_process = subprocess.Popen(
                [webview_path, initial_params], cwd=os.path.dirname(webview_path)
            )

            time.sleep(0.15)
            code = webview_process.poll()
            if code == 3221225781:
                cleanup_webview()
                return {"CANCELLED"}

            threading.Thread(target=ipc_update_thread, daemon=True).start()

            return {"FINISHED"}
        except Exception as e:
            cleanup_webview()
            return {"CANCELLED"}


class PANEL_INFO_OT_stop_webview(Operator):
    bl_idname = "panel_info.stop_webview"
    bl_label = "Stop WebView"
    bl_description = "Stops the WebView application and cleanup resources"

    def execute(self, context):
        cleanup_webview()
        return {"FINISHED"}


class PANEL_INFO_PT_main_panel(Panel):
    bl_label = "WebView Tracker"
    bl_idname = "PANEL_INFO_PT_main_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WebView"

    def draw(self, context):
        layout = self.layout
        row = layout.row()
        row.operator("panel_info.launch_webview")
        row.operator("panel_info.stop_webview")


def handle_script_load_message(message_data):
    script_name = message_data.get("name", "Unnamed Script")
    script_content = message_data.get("content", "")
    parameters = message_data.get("parameters", {})

    if parameters and script_content:
        script_content = apply_parameters_to_script(script_content, parameters)

    text_block = bpy.data.texts.get(script_name)
    if not text_block:
        text_block = bpy.data.texts.new(name=script_name)

    text_block.clear()
    text_block.write(script_content)

    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "TEXT_EDITOR":
                area.spaces.active.text = text_block
                return True

    return True


def apply_parameters_to_script(script_content, parameters):
    lines = script_content.split("\n")
    modified_lines = []
    in_main_function = False

    for line in lines:
        if "def main():" in line:
            in_main_function = True
        elif (
            in_main_function
            and line.strip()
            and not line.startswith(("    ", "\t", "#"))
        ):
            in_main_function = False

        modified_line = line
        if in_main_function:
            for param_name, param_value in parameters.items():
                if f"{param_name} =" in line and "=" in line:
                    indent = line[: len(line) - len(line.lstrip())]

                    if isinstance(param_value, bool):
                        value_str = "True" if param_value else "False"
                    elif isinstance(param_value, str):
                        value_str = f"'{param_value}'"
                    else:
                        value_str = str(param_value)

                    modified_line = f"{indent}{param_name} = {value_str}"
                    break

        modified_lines.append(modified_line)

    return "\n".join(modified_lines)


classes = (
    PANEL_INFO_OT_launch_webview,
    PANEL_INFO_OT_stop_webview,
    PANEL_INFO_PT_main_panel,
)


def cleanup_webview():
    global webview_process, stop_ipc, script_listener_thread

    stop_ipc = True

    if webview_process:
        try:
            webview_process.terminate()
            webview_process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            webview_process.kill()
        webview_process = None

    if script_listener_thread and script_listener_thread.is_alive():
        script_listener_thread.join(timeout=1.0)
    global temp_run_dir
    if temp_run_dir and os.path.isdir(temp_run_dir):
        shutil.rmtree(temp_run_dir, ignore_errors=True)
    temp_run_dir = None


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    atexit.register(cleanup_webview)


def unregister():
    cleanup_webview()
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
