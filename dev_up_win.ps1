$ErrorActionPreference = "Stop"

# ===== Config =====
$LLAMA_DIR  = if ($env:LLAMA_DIR) { $env:LLAMA_DIR } else { Join-Path $HOME "llama.cpp" }
$MODEL_DIR  = if ($env:MODEL_DIR) { $env:MODEL_DIR } else { Join-Path $LLAMA_DIR "models" }

$F1 = "qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf"
$F2 = "qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf"

$HOST = if ($env:LLM_HOST) { $env:LLM_HOST } else { "127.0.0.1" }
$PORT = if ($env:LLM_PORT) { $env:LLM_PORT } else { "8000" }

$CTX  = if ($env:LLM_CTX) { $env:LLM_CTX } else { "4096" }
$NGL  = if ($env:LLM_NGL) { $env:LLM_NGL } else { "30" }   # Apple Silicon-ish default; harmless on Windows

$REPO_BASE = "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main"

$LOG_PATH = Join-Path (Get-Location) ".llama-server.log"

function Say($msg) { Write-Host "[dev_up] $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "[dev_up] $msg" -ForegroundColor Red; exit 1 }
function Have($cmd) { return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }

function Download-File {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$Out
  )

  $dir = Split-Path -Parent $Out
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  if (Test-Path $Out) {
    Say "Already exists: $(Split-Path -Leaf $Out)"
    return
  }

  Say "Downloading: $(Split-Path -Leaf $Out)"

  if (Have "aria2c") {
    # aria2c supports resume by default with -c
    aria2c -x 8 -s 8 -c -o (Split-Path -Leaf $Out) -d $dir $Url
  }
  elseif (Have "curl.exe") {
    # Windows curl.exe exists on most systems; supports resume with -C -
    & curl.exe -L --fail --retry 3 --retry-delay 2 -C - -o $Out $Url
  }
  else {
    # Fallback: Invoke-WebRequest (no resume)
    Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing
  }
}

function Ensure-Llama {
  $gitDir = Join-Path $LLAMA_DIR ".git"
  if (!(Test-Path $gitDir)) {
    Say "Cloning llama.cpp → $LLAMA_DIR"
    if (!(Have "git")) { Die "git is required (install Git for Windows)." }
    git clone https://github.com/ggerganov/llama.cpp.git $LLAMA_DIR
  } else {
    Say "Found llama.cpp → $LLAMA_DIR"
  }
}

function Build-Server {
  $bin = Join-Path $LLAMA_DIR "build\bin\llama-server.exe"
  if (Test-Path $bin) {
    Say "Found llama-server → $bin"
    return
  }

  Say "Building llama.cpp (first time takes a bit)..."
  if (!(Have "cmake")) { Die "cmake required (install CMake and add to PATH)." }

  Push-Location $LLAMA_DIR
  try {
    if (!(Test-Path "build")) { New-Item -ItemType Directory -Force -Path "build" | Out-Null }

    # On Windows, cmake will pick a default generator. If you have VS Build Tools installed, this usually works.
    cmake -S . -B build
    cmake --build build --config Release -j
  }
  finally {
    Pop-Location
  }

  if (!(Test-Path $bin)) {
    # Some setups put the exe under build\bin\Release or build\Release\bin; try to help:
    $alt1 = Join-Path $LLAMA_DIR "build\bin\Release\llama-server.exe"
    $alt2 = Join-Path $LLAMA_DIR "build\Release\bin\llama-server.exe"
    if (Test-Path $alt1) { $bin = $alt1 }
    elseif (Test-Path $alt2) { $bin = $alt2 }
  }

  if (!(Test-Path $bin)) { Die "Build finished but llama-server.exe not found under $LLAMA_DIR\build" }
  Say "Built llama-server ✅"
}

function Ensure-Model {
  if (!(Test-Path $MODEL_DIR)) { New-Item -ItemType Directory -Force -Path $MODEL_DIR | Out-Null }
  Say "Model dir: $MODEL_DIR"

  $f1Path = Join-Path $MODEL_DIR $F1
  $f2Path = Join-Path $MODEL_DIR $F2

  if ((Test-Path $f1Path) -and (Test-Path $f2Path)) {
    Say "Qwen model already installed."
    return
  }

  Say "Model not fully present. Downloading missing parts..."
  if (!(Test-Path $f1Path)) { Download-File -Url "$REPO_BASE/$F1" -Out $f1Path }
  if (!(Test-Path $f2Path)) { Download-File -Url "$REPO_BASE/$F2" -Out $f2Path }

  if (!(Test-Path $f1Path)) { Die "Missing model file: $f1Path" }
  if (!(Test-Path $f2Path)) { Die "Missing model file: $f2Path" }

  Say "Model ready."
}

function Start-LLM {
  Say "Starting llama-server using your exact command..."
  # In your Bash script you run from: $LLAMA_DIR/build
  $buildDir = Join-Path $LLAMA_DIR "build"

  if (!(Test-Path $buildDir)) { Die "Build directory not found: $buildDir" }

  # NOTE: You used: -m ../models/$F1 (relative to $LLAMA_DIR/build)
  $args = @(
    "-m", "..\models\$F1",
    "-c", "$CTX",
    "-ngl", "$NGL",
    "--host", "$HOST",
    "--port", "$PORT"
  )

  # Clear/ensure log
  "" | Out-File -FilePath $LOG_PATH -Encoding utf8

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = (Join-Path $buildDir "bin\llama-server.exe")
  if (!(Test-Path $psi.FileName)) {
    # common alternates
    $alt = Join-Path $buildDir "bin\Release\llama-server.exe"
    if (Test-Path $alt) { $psi.FileName = $alt } else { Die "llama-server.exe not found under $buildDir\bin" }
  }

  $psi.WorkingDirectory = $buildDir
  $psi.Arguments = ($args -join " ")
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()

  # async log piping
  $stdout = $proc.StandardOutput
  $stderr = $proc.StandardError

  $job = Start-Job -ScriptBlock {
    param($outReader, $errReader, $logPath)
    while (-not $outReader.EndOfStream) {
      $line = $outReader.ReadLine()
      Add-Content -Path $logPath -Value $line
    }
    while (-not $errReader.EndOfStream) {
      $line = $errReader.ReadLine()
      Add-Content -Path $logPath -Value $line
    }
  } -ArgumentList $stdout, $stderr, $LOG_PATH

  Say "llama-server PID=$($proc.Id) (logs: .llama-server.log)"
  return @{ Proc = $proc; LogJob = $job }
}

function Wait-LLM {
  param([Parameter(Mandatory=$true)]$Proc)

  Say "Waiting for LLM to respond..."
  $tries = 0
  $maxTries = 60
  $url = "http://$HOST`:$PORT/"

  while ($tries -lt $maxTries) {
    $tries++
    Say "Health check attempt $tries/$maxTries..."

    if ($Proc.HasExited) {
      Say "llama-server exited early. Last 120 log lines:"
      if (Test-Path $LOG_PATH) { Get-Content $LOG_PATH -Tail 120 | ForEach-Object { Write-Host $_ } }
      Die "LLM crashed during startup (see .llama-server.log)."
    }

    try {
      Invoke-WebRequest -Uri $url -TimeoutSec 1 -UseBasicParsing | Out-Null
      Say "LLM ready ✅"
      return
    }
    catch {
      Start-Sleep -Seconds 1
    }
  }

  Say "Timed out. Last 120 log lines:"
  if (Test-Path $LOG_PATH) { Get-Content $LOG_PATH -Tail 120 | ForEach-Object { Write-Host $_ } }
  Die "LLM did not become ready."
}

# ===== Main =====
Say "Boot sequence..."
Ensure-Llama
Build-Server
Ensure-Model

$llm = $null
try {
  $llm = Start-LLM
  Wait-LLM -Proc $llm.Proc

  $env:LLM_BASE_URL = "http://$HOST`:$PORT/v1"
  $env:LLM_MODEL    = if ($env:LLM_MODEL) { $env:LLM_MODEL } else { "qwen" }

  Say "Starting Next.js..."
  if (!(Have "npm")) { Die "npm required (install Node.js LTS)." }

  Set-Location "ai-practice-lab"
  npm run dev
}
finally {
  if ($llm -and $llm.Proc -and -not $llm.Proc.HasExited) {
    Say "Stopping llama-server PID=$($llm.Proc.Id)"
    try { $llm.Proc.Kill() | Out-Null } catch {}
  }
  if ($llm -and $llm.LogJob) {
    try { Stop-Job $llm.LogJob -Force | Out-Null; Remove-Job $llm.LogJob -Force | Out-Null } catch {}
  }
}
