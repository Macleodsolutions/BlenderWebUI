#include "WebView2Browser.h"

#include <Windows.h>
#include <format>
#include <memory>

auto WebView2Browser::Create(HWND hWndParent, WebView2CB callBack) -> bool {
  hWndParent_ = hWndParent;
  callBack_ = std::move(callBack);
  _wputenv(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-web-security "
           L"--allow-file-access-from-files "
           L"--allow-universal-access-from-files");
  CreateCoreWebView2EnvironmentWithOptions(
      nullptr, nullptr, nullptr,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
          [this](HRESULT result, ICoreWebView2Environment *env) -> HRESULT {
            if (FAILED(result) || env == nullptr) {
              PostQuitMessage(1);
              return result;
            }

            env->CreateCoreWebView2Controller(
                hWndParent_,
                Callback<
                    ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [this](HRESULT result,
                           ICoreWebView2Controller *controller) -> HRESULT {
                      if (FAILED(result) || controller == nullptr) {
                        PostQuitMessage(1);
                        return result;
                      }
                      webviewController = controller;
                      webviewController->get_CoreWebView2(&webviewWindow);
                      if (!webviewWindow) {
                        PostQuitMessage(1);
                        return E_FAIL;
                      }

                      ICoreWebView2Settings *settings = nullptr;
                      webviewWindow->get_Settings(&settings);
                      if (settings) {
                        settings->put_AreHostObjectsAllowed(TRUE);
                        settings->Release();
                      }

                      EventRegistrationToken token;
                      result = webviewWindow->add_WebMessageReceived(
                          Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                              this, &WebView2Browser::OnWebMessageReceived)
                              .Get(),
                          &token);

                      RECT rcClient{};
                      GetClientRect(hWndParent_, &rcClient);
                      webviewController->put_Bounds(
                          RECT{0, 0, rcClient.right, rcClient.bottom});

                      COREWEBVIEW2_COLOR const TRANS_COLOR_VAL{
                          0, GetRValue(TRANS_COLOR), GetGValue(TRANS_COLOR),
                          GetBValue(TRANS_COLOR)};
                      wil::com_ptr<ICoreWebView2Controller2> controller2 =
                          webviewController.query<ICoreWebView2Controller2>();
                      result = controller2->put_DefaultBackgroundColor(
                          TRANS_COLOR_VAL);

                      auto setBkgndColor =
                          std::format(L"document.body.style.background = "
                                      L"'rgba({},{},{},0)'",
                                      TRANS_COLOR_VAL.R, TRANS_COLOR_VAL.G,
                                      TRANS_COLOR_VAL.B);
                      result = webviewWindow->AddScriptToExecuteOnDocumentCreated(
                          setBkgndColor.c_str(),
                          Callback<
                              ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
                              [](HRESULT /*error*/, PCWSTR /*id*/) -> HRESULT {
                                return S_OK;
                              })
                              .Get());

                      if (callBack_) {
                        callBack_();
                      }

                      return S_OK;
                    })
                    .Get());
            return S_OK;
          })
          .Get());

  return TRUE;
}

void WebView2Browser::Navigate(std::wstring const &szUrl) {
  webviewWindow->Navigate(szUrl.c_str());
}

auto WebView2Browser::OnWebMessageReceived(
    ICoreWebView2 *sender, ICoreWebView2WebMessageReceivedEventArgs *args)
    -> HRESULT {
  LPWSTR pwStr = nullptr;
  if (SUCCEEDED(args->TryGetWebMessageAsString(&pwStr))) {
    std::wstring message = pwStr;
    if (message.starts_with(L"SCRIPT_LOAD:")) {
      thread_local std::wstring currentScriptMessage;
      currentScriptMessage = message;
      ::PostMessage(hWndParent_, WM_SCRIPT_MESSAGE, 0,
                    static_cast<LPARAM>(reinterpret_cast<intptr_t>(
                        currentScriptMessage.c_str())));
    } else {
      rects_from_browser_ = pwStr;
      ::PostMessage(hWndParent_, WM_SET_WV2_CONTROLS, 0, 0);
    }
    CoTaskMemFree(pwStr);
  }
  return S_OK;
}
