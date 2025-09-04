#include "BlenderWebView2.h"

#include "WebView2Browser.h"

#include <Windows.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <bit>
#include <cstdio>
#include <filesystem>
#include <format>
#include <iomanip>
#include <memory>
#include <ranges>
#include <regex>
#include <span>
#include <sstream>
#include <string>
#include <tchar.h>
#include <thread>
#include <vector>

const wchar_t *const SCRIPT_PIPE_NAME = L"\\\\.\\pipe\\BlenderScriptPipe";
const wchar_t *const LAYOUT_PIPE_NAME = L"\\\\.\\pipe\\BlenderWebViewPipe";

constexpr int LAYOUT_PREFIX_LENGTH = 7;

constexpr int DEFAULT_WINDOW_X = 100;
constexpr int DEFAULT_WINDOW_Y = 100;
constexpr int DEFAULT_WINDOW_WIDTH = 800;
constexpr int DEFAULT_WINDOW_HEIGHT = 600;
constexpr int TIMER_INTERVAL_MS = 50;

constexpr int SSCANF_EXPECTED_ARGS = 4;
constexpr int PIPE_INSTANCE_COUNT = 1;
constexpr int EXIT_SUCCESS_CODE = 0;
constexpr int EXIT_FAILURE_CODE = 1;

static auto WideToUtf8(const std::wstring &wide) -> std::string {
  if (wide.empty()) {
    return {};
  }

  int size = WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), (int)wide.length(),
                                 nullptr, 0, nullptr, nullptr);
  if (size <= 0) {
    return {};
  }

  std::string result(size, 0);
  WideCharToMultiByte(CP_UTF8, 0, wide.c_str(), (int)wide.length(),
                      result.data(), size, nullptr, nullptr);
  return result;
}

static auto Utf8ToWide(const std::string &utf8) -> std::wstring {
  if (utf8.empty()) {
    return {};
  }

  int size = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), (int)utf8.size(),
                                 nullptr, 0);
  if (size <= 0) {
    return {};
  }

  std::wstring result(size, 0);
  MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), (int)utf8.size(), result.data(),
                      size);
  return result;
}

void sendScriptToBlender(const std::wstring &scriptMessage) {
  std::string narrowMessage = WideToUtf8(scriptMessage);
  if (narrowMessage.empty()) {
    return;
  }

  HANDLE hPipe = CreateFileW(SCRIPT_PIPE_NAME, GENERIC_WRITE, 0, nullptr,
                             OPEN_EXISTING, 0, nullptr);

  if (hPipe != INVALID_HANDLE_VALUE) {
    DWORD bytesWritten = 0;
    WriteFile(hPipe, narrowMessage.c_str(), (DWORD)narrowMessage.length(),
              &bytesWritten, nullptr);
    CloseHandle(hPipe);
  }
}

auto GetExecutableDir() -> std::wstring {
  std::array<wchar_t, MAX_PATH> path = {0};
  DWORD len = GetModuleFileNameW(nullptr, path.data(), MAX_PATH);
  if (len == 0 || len >= MAX_PATH) {
    return L"";
  }
  return std::filesystem::path(path.data()).parent_path().wstring();
}

static auto FilePathToFileUri(const std::wstring &filePath) -> std::wstring {
  auto path = std::filesystem::absolute(filePath);
  auto pathStr = path.generic_wstring();

  std::ranges::replace(pathStr, L'\\', L'/');

  return L"file:///" + pathStr;
}

auto UpdateOverlayPosition(HWND overlay, HWND blender, int positionX,
                           int positionY, int width, int height) -> bool {
  if (overlay == nullptr || blender == nullptr || width <= 0 || height <= 0) {
    return false;
  }

  RECT blenderClientRect;
  GetClientRect(blender, &blenderClientRect);

  POINT blenderClientTopLeft = {0, 0};
  ClientToScreen(blender, &blenderClientTopLeft);

  if (positionX != blenderClientTopLeft.x ||
      positionY != blenderClientTopLeft.y || width != blenderClientRect.right ||
      height != blenderClientRect.bottom) {
    SetWindowPos(overlay, nullptr, positionX, positionY, width, height,
                 SWP_NOZORDER | SWP_NOACTIVATE);
    return true;
  }
  return false;
}

constexpr const TCHAR *SZ_WND_CLASS_MAIN = _T("BlenderWebView2Class");

static auto GetMainWindow() -> HWND & {
  static HWND hWndMain = nullptr;
  return hWndMain;
}

auto FindBlenderWindow() -> HWND {
  return FindWindowW(L"GHOST_WindowClass", nullptr);
}

auto ParseRects(std::wstring const &input) -> std::vector<RECT> {
  if (input.empty()) {
    return {};
  }

  std::wregex rectPattern(LR"(\[(\d+),(\d+),(\d+),(\d+)\])");
  std::wsregex_iterator begin(input.begin(), input.end(), rectPattern);
  std::wsregex_iterator end;

  auto matches = std::ranges::subrange(begin, end);

  std::vector<RECT> rects;
  auto transformed =
      matches | std::views::transform([](const std::wsmatch &match) -> RECT {
        int positionX = std::stoi(match[1].str());
        int positionY = std::stoi(match[2].str());
        int width = std::stoi(match[3].str());
        int height = std::stoi(match[4].str());
        return RECT{positionX, positionY, positionX + width,
                    positionY + height};
      });

  std::ranges::copy(transformed, std::back_inserter(rects));
  return rects;
}

static auto GetWebBrowser() -> WebView2Browser & {
  static WebView2Browser instance;
  return instance;
}

static auto ProcessLayoutMessage(std::span<const char> buffer) -> void {
  if (buffer.size() < LAYOUT_PREFIX_LENGTH ||
      strncmp(buffer.data(), "LAYOUT:", LAYOUT_PREFIX_LENGTH) != 0) {
    return;
  }

  int blenderX = 0;
  int blenderY = 0;
  int blenderWidth = 0;
  int blenderHeight = 0;
  std::string bufferStr(buffer.data(), buffer.size());
  size_t pipePos = bufferStr.find('|', LAYOUT_PREFIX_LENGTH);

  if (pipePos == std::string::npos) {
    return;
  }

  std::string layoutData =
      bufferStr.substr(LAYOUT_PREFIX_LENGTH, pipePos - LAYOUT_PREFIX_LENGTH);
  std::istringstream iss(layoutData);
  std::string token;
  std::vector<int> values;

  while (std::getline(iss, token, ',') &&
         values.size() < SSCANF_EXPECTED_ARGS) {
    try {
      values.push_back(std::stoi(token));
    } catch (const std::exception &) {
      return;
    }
  }

  if (values.size() != SSCANF_EXPECTED_ARGS) {
    return;
  }

  blenderX = values[0];
  blenderY = values[1];
  blenderWidth = values[2];
  blenderHeight = values[3];

  HWND blenderWindow = FindBlenderWindow();
  if (!UpdateOverlayPosition(GetMainWindow(), blenderWindow, blenderX, blenderY,
                             blenderWidth, blenderHeight)) {
    return;
  }

  size_t jsonStart = pipePos + 1;
  std::string jsonData = bufferStr.substr(jsonStart);
  auto wideJson = Utf8ToWide(jsonData);

  thread_local std::wstring currentLayoutMessage;
  currentLayoutMessage = wideJson;
  PostMessage(GetMainWindow(), WM_LAYOUT_UPDATE, 0,
              static_cast<LPARAM>(
                  reinterpret_cast<intptr_t>(currentLayoutMessage.c_str())));
}

static auto ProcessPipeData(HANDLE hPipe) -> void {
  std::array<char, BUFFER_SIZE> buffer{};
  DWORD bytesRead = 0;
  bool success = ReadFile(hPipe, buffer.data(), buffer.size() - 1, &bytesRead,
                          nullptr) != 0;

  if (success && bytesRead > 0) {
    buffer.at(bytesRead) = '\0';
    ProcessLayoutMessage(std::span<const char>{buffer.data(), bytesRead});
  }
}

static auto CreateAndConnectPipe() -> HANDLE {
  HANDLE hPipe =
      CreateNamedPipeW(LAYOUT_PIPE_NAME, PIPE_ACCESS_INBOUND,
                       PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
                       PIPE_INSTANCE_COUNT, BUFFER_SIZE, BUFFER_SIZE,
                       EXIT_SUCCESS_CODE, nullptr);

  if (hPipe == INVALID_HANDLE_VALUE) {
    return INVALID_HANDLE_VALUE;
  }

  bool connected = (ConnectNamedPipe(hPipe, nullptr) != 0) ||
                   (GetLastError() == ERROR_PIPE_CONNECTED);

  if (!connected) {
    CloseHandle(hPipe);
    return INVALID_HANDLE_VALUE;
  }

  return hPipe;
}

void handleIPC(const std::stop_token &stopToken) {
  while (!stopToken.stop_requested()) {
    HANDLE hPipe = CreateAndConnectPipe();
    if (hPipe == INVALID_HANDLE_VALUE) {
      continue;
    }

    ProcessPipeData(hPipe);
    DisconnectNamedPipe(hPipe);
    CloseHandle(hPipe);
  }
}

auto WINAPI WinMain(HINSTANCE hInstance, HINSTANCE /*hPrevInstance*/,
                    LPSTR lpCmdLine, int nShowCmd) -> int {
  OleInitialize(nullptr);

  int positionX = DEFAULT_WINDOW_X;
  int positionY = DEFAULT_WINDOW_Y;
  int width = DEFAULT_WINDOW_WIDTH;
  int height = DEFAULT_WINDOW_HEIGHT;
  std::jthread ipcThread;
  if (__argc > 1) {
    std::string args(__argv[1]);
    size_t pos = 0;
    std::array<int *, 4> values = {&positionX, &positionY, &width, &height};

    for (int *value : values) {
      size_t nextPos = args.find(',', pos);
      if (nextPos == std::string::npos && value != values.back()) {
        break;
      }

      std::string token = args.substr(pos, nextPos - pos);
      *value = std::stoi(token);
      pos = nextPos + 1;
    }
  }

  WNDCLASS wnd{};
  wnd.style = CS_HREDRAW | CS_VREDRAW;
  wnd.lpfnWndProc = WndProc;
  wnd.hInstance = hInstance;
  wnd.hbrBackground = CreateSolidBrush(TRANS_COLOR);
  wnd.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wnd.lpszClassName = SZ_WND_CLASS_MAIN;

  if (!RegisterClass(&wnd)) {
    return FALSE;
  }

  HWND blenderWindow = FindBlenderWindow();
  if (blenderWindow == nullptr) {
    return FALSE;
  }

  GetMainWindow() =
      CreateWindowEx(WS_EX_LAYERED | WS_EX_TOOLWINDOW, SZ_WND_CLASS_MAIN,
                     nullptr, WS_POPUP, positionX, positionY, width, height,
                     blenderWindow, nullptr, hInstance, nullptr);

  if (GetMainWindow() == nullptr) {
    return FALSE;
  }

  SetLayeredWindowAttributes(GetMainWindow(), TRANS_COLOR, 0, LWA_COLORKEY);

  ShowWindow(GetMainWindow(), SW_SHOW);
  UpdateWindow(GetMainWindow());
  SetWindowPos(GetMainWindow(), HWND_NOTOPMOST, 0, 0, 0, 0,
               SWP_NOMOVE | SWP_NOSIZE);

  ipcThread = std::jthread(handleIPC);

  GetWebBrowser().Create(GetMainWindow(), BrowserCreated);

  MSG msg;
  while (GetMessage(&msg, nullptr, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  ipcThread.request_stop();
  if (ipcThread.joinable()) {
    ipcThread.join();
  }

  OleUninitialize();
  return (int)msg.wParam;
}

void BrowserCreated() {
  auto fileExists = [](const std::wstring &path) -> bool {
    return std::filesystem::is_regular_file(path);
  };

  std::wstring exeDir = GetExecutableDir();

  std::wstring htmlFile =
      (std::filesystem::path(exeDir) / L"web_ui" / L"index.html").wstring();
  if (!fileExists(htmlFile)) {
    PostQuitMessage(EXIT_FAILURE_CODE);
    return;
  }

  std::wstring htmlUri = FilePathToFileUri(htmlFile);
  GetWebBrowser().Navigate(htmlUri);

  SetTimer(GetMainWindow(), POSITION_TIMER_ID, TIMER_INTERVAL_MS, nullptr);
}

static auto HandleSizeMessage() -> void {
  if (GetWebBrowser().webviewController) {
    RECT bounds;
    GetClientRect(GetMainWindow(), &bounds);
    GetWebBrowser().webviewController->put_Bounds(bounds);
  }
}

static auto HandleTimerMessage(HWND hWnd, WPARAM wParam) -> void {
  if (wParam != POSITION_TIMER_ID) {
    return;
  }

  POINT point;
  GetCursorPos(&point);
  ScreenToClient(hWnd, &point);

  bool mouseOverClickable = false;
  for (const auto &rect : GetWebBrowser().clickableRects) {
    if (PtInRect(&rect, point) != 0) {
      mouseOverClickable = true;
      break;
    }
  }

  LONG exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
  if (mouseOverClickable) {
    if ((exStyle & WS_EX_TRANSPARENT) != 0) {
      SetWindowLong(hWnd, GWL_EXSTYLE, exStyle & ~WS_EX_TRANSPARENT);
    }
  } else {
    if ((exStyle & WS_EX_TRANSPARENT) == 0) {
      SetWindowLong(hWnd, GWL_EXSTYLE, exStyle | WS_EX_TRANSPARENT);
    }
  }
}

static auto HandleLayoutUpdateMessage(LPARAM lParam) -> void {
  if (GetWebBrowser().webviewController) {
    wil::com_ptr<ICoreWebView2> webview;
    HRESULT hResult =
        GetWebBrowser().webviewController->get_CoreWebView2(&webview);
    if (SUCCEEDED(hResult) && webview) {
      const auto *messagePtr = std::bit_cast<const wchar_t *>(lParam);
      webview->PostWebMessageAsString(messagePtr);
    }
  }
}

auto WndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) -> LRESULT {
  switch (uMsg) {
  case WM_SIZE:
    HandleSizeMessage();
    break;

  case WM_PARENTNOTIFY:
    if (LOWORD(wParam) == WM_DESTROY) {
      PostQuitMessage(EXIT_SUCCESS_CODE);
    }
    break;

  case WM_TIMER:
    HandleTimerMessage(hWnd, wParam);
    break;

  case WM_SET_WV2_CONTROLS:
    GetWebBrowser().clickableRects =
        ParseRects(GetWebBrowser().rects_from_browser_);
    break;

  case WM_LAYOUT_UPDATE:
    HandleLayoutUpdateMessage(lParam);
    break;

  case WM_SCRIPT_MESSAGE:
    if (lParam != 0) {
      auto *messagePtr = std::bit_cast<wchar_t *>(lParam);
      std::wstring message(messagePtr);
      sendScriptToBlender(message);
    }
    break;

  case WM_DESTROY:
    KillTimer(hWnd, POSITION_TIMER_ID);
    PostQuitMessage(EXIT_SUCCESS_CODE);
    break;

  default:
    return DefWindowProc(hWnd, uMsg, wParam, lParam);
  }
  return EXIT_SUCCESS_CODE;
}
