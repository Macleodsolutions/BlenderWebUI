#pragma once

#include "WebView2.h"

#include <functional>
#include <string>
#include <wil/com.h>
#include <wrl.h>

using namespace Microsoft::WRL;

UINT const WM_SET_WV2_CONTROLS = WM_USER;
UINT const WM_SCRIPT_MESSAGE = WM_USER + 2;

COLORREF const TRANS_COLOR = RGB(0xDF, 0xFE, 0xEF);

using WebView2CB = std::function<void()>;

class WebView2Browser {
public:
  WebView2Browser() = default;
  bool Create(HWND hWndParent, WebView2CB callBack);
  void Navigate(std::wstring const &szUrl);

  wil::com_ptr<ICoreWebView2Controller> webviewController;
  std::wstring rects_from_browser_;
  std::vector<RECT> clickableRects;

protected:
  HRESULT
  OnWebMessageReceived(ICoreWebView2 *sender,
                       ICoreWebView2WebMessageReceivedEventArgs *args);

private:
  wil::com_ptr<ICoreWebView2> webviewWindow;

  HWND hWndParent_ = 0;
  WebView2CB callBack_;
};
