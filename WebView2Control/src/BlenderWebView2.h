#pragma once

#include <Windows.h>
#include <stop_token>
#include <string>

constexpr DWORD BUFFER_SIZE = 8192;
constexpr UINT WM_LAYOUT_UPDATE = WM_USER + 1;
constexpr UINT POSITION_TIMER_ID = 1;

extern const wchar_t *const SCRIPT_PIPE_NAME;
extern const wchar_t *const LAYOUT_PIPE_NAME;

std::wstring GetExecutableDir();
bool UpdateOverlayPosition(HWND overlay, HWND blender, int x, int y, int w,
                           int h);

HWND FindBlenderWindow();
void sendScriptToBlender(const std::wstring &scriptMessage);
void handleIPC(const std::stop_token &stopToken);
void BrowserCreated();
LRESULT CALLBACK WndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam);
