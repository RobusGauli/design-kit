# design-kit installer for Windows (PowerShell 5.1+): writes the skills INTO A REPO.
#
#   cd <your repo>; irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
#
# Same layout and the same per-file rule as install.sh (read it for the whole contract):
#   missing -> written · identical -> skipped · ours, differs -> refreshed · yours, differs -> kept
# Never deletes anything, never writes outside the repo. Output ends with `done.`.
# Pin a version with $env:DESIGN_KIT_REF = "v0.2.0"; $env:DESIGN_KIT_DIR picks the repo.

& {
  $ErrorActionPreference = "Stop"
  $Repo = "RobusGauli/design-kit"
  $Dest = (Resolve-Path ($(if ($env:DESIGN_KIT_DIR) { $env:DESIGN_KIT_DIR } else { "." }))).Path.TrimEnd('\', '/')
  if ($Dest -eq $HOME.TrimEnd('\', '/') -or $Dest -match '^[A-Za-z]:$' -or $Dest -eq '') {
    throw "$Dest is not a project. cd into the repo you want to design in, then run this again."
  }
  & git -C $Dest rev-parse --is-inside-work-tree *> $null
  if ($LASTEXITCODE -ne 0) { Write-Output "warning:   $Dest is not a git repo; writing anyway" }

  function Put([string]$Owner, [string]$From, [string]$Rel) {
    $to = Join-Path $Dest $Rel
    if (-not (Test-Path -LiteralPath $to)) {
      New-Item -ItemType Directory -Force -Path (Split-Path $to) | Out-Null
      Copy-Item -LiteralPath $From $to
      Write-Output "wrote:     $Rel"
    } elseif ((Get-FileHash -LiteralPath $From).Hash -eq (Get-FileHash -LiteralPath $to).Hash) {
    } elseif ($Owner -eq "ours") {
      Copy-Item -LiteralPath $From $to -Force
      Write-Output "refreshed: $Rel"
    } else {
      Write-Output "kept:      $Rel (yours; left as it is)"
    }
  }

  $Stage = Join-Path ([IO.Path]::GetTempPath()) ("design-kit." + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Path $Stage | Out-Null
  try {
    if ($env:DESIGN_KIT_SOURCE) {
      $Src = $env:DESIGN_KIT_SOURCE; $Source = "local:$Src"
    } else {
      $Ref = $env:DESIGN_KIT_REF
      if (-not $Ref) {
        $req = [System.Net.WebRequest]::Create("https://github.com/$Repo/releases/latest")
        $req.AllowAutoRedirect = $false
        $loc = $req.GetResponse().Headers["Location"]
        if ($loc -notmatch '/releases/tag/([A-Za-z0-9._-]+)$') { throw "could not find the latest design-kit release." }
        $Ref = $Matches[1]
      }
      $zip = Join-Path $Stage "src.zip"
      Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/$Ref" -OutFile $zip
      Expand-Archive $zip -DestinationPath (Join-Path $Stage "src")
      $Src = (Get-ChildItem (Join-Path $Stage "src") -Directory | Select-Object -First 1).FullName
      $Source = "$Repo@$Ref"
    }
    foreach ($f in @("skills\design-system\SKILL.md", "skills\prototype\SKILL.md", "template\AGENTS.md")) {
      if (-not (Test-Path (Join-Path $Src $f))) { throw "$Source has no $f." }
    }
    $Version = "unknown"
    if (Test-Path (Join-Path $Src "VERSION")) { $Version = (Get-Content (Join-Path $Src "VERSION") -Raw).Trim() }

    function Rel([string]$Root, [string]$Full) { $Full.Substring($Root.Length + 1).Replace('\', '/') }
    $skills = Join-Path $Src "skills"
    foreach ($s in @("design-system", "prototype")) {
      Get-ChildItem -Recurse -File (Join-Path $skills $s) | Where-Object { $_.Name -ne ".DS_Store" } |
        Sort-Object FullName | ForEach-Object { Put "ours" $_.FullName (".harbor/skills/" + (Rel $skills $_.FullName)) }
    }
    $tpl = Join-Path $Src "template"
    foreach ($d in @(".claude", ".kiro", ".cursor")) {
      Get-ChildItem -Recurse -File -Force (Join-Path $tpl $d) | Sort-Object FullName |
        ForEach-Object { Put "ours" $_.FullName (Rel $tpl $_.FullName) }
    }
    Put "ours" (Join-Path $skills "design-system\assets\studio-bridge.js") "design/studio-bridge.js"
    Get-ChildItem -File (Join-Path $skills "design-system\scripts") -Filter *.mjs | Sort-Object Name |
      ForEach-Object { Put "ours" $_.FullName ("design/" + $_.Name) }
    Put "yours" (Join-Path $skills "design-system\assets\DESIGN.md") "design/DESIGN.md"

    $agentsFrom = Join-Path $tpl "AGENTS.md"; $agents = Join-Path $Dest "AGENTS.md"
    if (-not (Test-Path -LiteralPath $agents)) {
      Copy-Item -LiteralPath $agentsFrom $agents; Write-Output "wrote:     AGENTS.md"
    } elseif ((Get-Content -LiteralPath $agents) -notcontains (Get-Content -LiteralPath $agentsFrom -TotalCount 1)) {
      Add-Content -LiteralPath $agents -Value ("`n" + (Get-Content -LiteralPath $agentsFrom -Raw)) -NoNewline
      Write-Output "appended:  AGENTS.md"
    }
    foreach ($d in @(".harbor/reviews", ".harbor/shots")) {
      $ignore = Join-Path $Dest "$d/.gitignore"
      if (-not (Test-Path -LiteralPath $ignore)) {
        New-Item -ItemType Directory -Force -Path (Join-Path $Dest $d) | Out-Null
        [IO.File]::WriteAllText($ignore, "*`n")
        Write-Output "wrote:     $d/.gitignore"
      }
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -and -not (Get-Command bun -ErrorAction SilentlyContinue)) {
      Write-Output "warning:   neither node (18+) nor bun is on PATH; the design scripts need one of them."
    }
    Write-Output "repo:      $Dest"
    Write-Output "version:   $Version"
    Write-Output "source:    $Source"
    Write-Output "done."
  } finally {
    Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue
  }
}
