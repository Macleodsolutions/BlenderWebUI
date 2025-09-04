@echo off
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0"

set "FAILED="
set "HAS_BLACK="
where black >nul 2>nul && set "HAS_BLACK=1"

set "HAS_NPX="
where npx >nul 2>nul && set "HAS_NPX=1"

set "HAS_CLANGFORMAT="
where clang-format >nul 2>nul && set "HAS_CLANGFORMAT=1"

set "HAS_CLANGTIDY="
where clang-tidy >nul 2>nul && set "HAS_CLANGTIDY=1"


echo.
echo ==== [1/6] Python: Black ====
if defined HAS_BLACK (
  if exist "PythonScript" (
    echo Running Black in "PythonScript"...
    black "PythonScript" || set "FAILED=1"
  ) else (
    echo Skipped: "PythonScript" not found.
  )
  if exist "UIFrontend\scripts" (
    echo Running Black in "UIFrontend\scripts"...
    black "UIFrontend\scripts" || set "FAILED=1"
  ) else (
    echo Skipped: "UIFrontend\scripts" not found.
  )
) else (
  echo Black not found. Install with: pip install black  (or: py -m pip install black)
)

echo.
echo ==== [2/6] UI: Prettier (UIFrontend) ====
if defined HAS_NPX (
  if exist "UIFrontend\package.json" (
    pushd "UIFrontend"
    echo Running Prettier...
    call npx prettier --loglevel warn --ignore-path .prettierignore --write "**/*.{js,jsx,ts,tsx,css,scss,html,json,md}" || set "FAILED=1"
    popd
  ) else (
    echo Skipped: "UIFrontend\package.json" not found.
  )
) else (
  echo npx not found. Install Node.js from https://nodejs.org/ to run Prettier/ESLint/tsc.
)

echo.
echo ==== [3/6] UI: ESLint (UIFrontend) ====
if defined HAS_NPX (
  if exist "UIFrontend\package.json" (
    if exist "UIFrontend\eslint.config.js" (
      pushd "UIFrontend"
      echo Running ESLint...
      call npx eslint "src/**/*.{ts,tsx,js,jsx}" --fix || set "FAILED=1"
      popd
    ) else (
      echo Skipped: "UIFrontend\eslint.config.js" not found.
    )
  ) else (
    echo Skipped: "UIFrontend\package.json" not found.
  )
) else (
  echo npx not found. Install Node.js from https://nodejs.org/ to run Prettier/ESLint/tsc.
)

echo.
echo ==== [4/6] UI: TypeScript type-check (UIFrontend) ====
if defined HAS_NPX (
  if exist "UIFrontend\tsconfig.json" (
    pushd "UIFrontend"
    echo Running tsc --noEmit...
    call npx tsc --noEmit -p . || set "FAILED=1"
    popd
  ) else (
    echo Skipped: "UIFrontend\tsconfig.json" not found.
  )
) else (
  echo npx not found. Install Node.js from https://nodejs.org/ to run Prettier/ESLint/tsc.
)

echo.
echo ==== [5/6] C++: clang-format (WebView2Control) ====
if defined HAS_CLANGFORMAT (
  if exist "WebView2Control" (
    echo Running clang-format...
    for /r "WebView2Control" %%f in (*.h *.hpp *.hh *.hxx *.c *.cc *.cxx *.cpp) do (
      clang-format -i -style=file -fallback-style=LLVM "%%f" || set "FAILED=1"
    )
  ) else (
    echo Skipped: "WebView2Control" not found.
  )
) else (
  echo clang-format not found. Install LLVM and ensure clang-format is on PATH.
)

echo.
echo ==== [6/6] C++: clang-tidy (WebView2Control) ====
if defined HAS_CLANGTIDY (
  if exist "WebView2Control" (
    set "TIDY_DB="
    if exist "WebView2Control\compile_commands.json" set "TIDY_DB=WebView2Control"
    if exist "compile_commands.json" set "TIDY_DB=."
    if defined TIDY_DB (
      echo Using compilation database at "%TIDY_DB%\compile_commands.json"
      for /r "WebView2Control" %%f in (*.cpp *.cxx *.cc) do (
        clang-tidy "%%f" -p "%TIDY_DB%" --quiet || set "FAILED=1"
      )
    ) else (
      echo No compile_commands.json found. Running best-effort checks with C++20 defaults.
      for /r "WebView2Control" %%f in (*.cpp *.cxx *.cc) do (
        clang-tidy "%%f" -- -std=c++20 || set "FAILED=1"
      )
    )
  ) else (
    echo Skipped: "WebView2Control" not found.
  )
) else (
  echo clang-tidy not found. Install LLVM and ensure clang-tidy is on PATH.
)

echo.
if defined FAILED (
  echo Done with errors. See messages above.
  popd
  exit /b 1
) else (
  echo All formatting and checks completed successfully.
  popd
  exit /b 0
)
